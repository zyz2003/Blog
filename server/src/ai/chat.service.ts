/**
 * ChatService — core streaming chat: streamText + tools + persistence.
 *
 * Per D-364: ToolContext built with moduleRef.resolve-based getService.
 * Per D-365: Tool call loop capped at 5 steps via stepCountIs(5).
 * Per D-371: User message persisted BEFORE stream; assistant message in onFinish.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  toUIMessageStream,
  type UIMessage,
  type ToolSet,
  type StepResult,
} from 'ai';
import { DRIZZLE } from '../database/database.module';
import { SettingsService } from '../settings/settings.service';
import { ModelResolver } from './model/model-resolver.service';
import { ChatHistoryService } from './chat-history.service';
import { DomainError } from './domain-error';
import { toAiSdkTools } from './tools/tool-bridge';
import { articleTools } from './tools/article-tools';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
import type { ToolContext } from './tools/tool-def';
import type { ChatMessagePart } from './chat.schema';

const SYSTEM_PROMPT =
  '你是博客站的 AI 助手，可以搜索和阅读博客文章来回答用户问题。请用中文回答。';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly toolCtx: ToolContext;
  private readonly tools: ToolSet;

  constructor(
    @Inject(DRIZZLE) private db: unknown,
    private modelResolver: ModelResolver,
    private chatHistory: ChatHistoryService,
    private settings: SettingsService,
    private moduleRef: ModuleRef,
  ) {
    this.toolCtx = {
      db: this.db,
      settings: this.settings,
      getService: <T>(token: string) => this.moduleRef.get<T>(token, { strict: false }),
    };
    this.tools = toAiSdkTools(articleTools, this.toolCtx);
  }

  /**
   * Stream a chat response for the given messages.
   *
   * 1. Resolve model (re-throw DomainError for controller to handle)
   * 2. Resolve or create conversation
   * 3. Persist user message before stream
   * 4. Call streamText with tools, stepCountIs(5), toolChoice 'auto'
   * 5. Persist assistant message in onFinish
   * 6. Return UIMessageStream as ReadableStream<Uint8Array>
   */
  async chat(
    messages: UIMessage[],
    options?: {
      conversationId?: string;
      profileId?: string;
      abortSignal?: AbortSignal;
    },
  ): Promise<ReadableStream<Uint8Array>> {
    // 1. Resolve model — re-throw DomainError for controller 4xx/5xx handling
    const model = this.modelResolver.resolve(options?.profileId);

    // 2. Resolve conversationId — wrap decodePublicID errors as DomainError
    let conversationId: string;
    if (options?.conversationId) {
      try {
        // Validate that the provided ID is a valid Sqids-encoded conversation ID
        const { dbID, entityType } = decodePublicID(options.conversationId);
        if (entityType !== EntityType.ChatConversation) {
          throw new DomainError('无效的会话 ID');
        }
        conversationId = options.conversationId;
      } catch (err) {
        throw err instanceof DomainError
          ? err
          : new DomainError('无效的会话 ID');
      }
    } else {
      conversationId = await this.chatHistory.createConversation(undefined, options?.profileId);
    }

    // 3. Persist last user message before stream (per D-371)
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      const userText = extractUserText(lastUserMsg);
      await this.chatHistory.appendMessage(conversationId, {
        role: 'user',
        content: userText,
      });
    }

    // 4. Call streamText
    const result = streamText({
      model,
      instructions: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: this.tools,
      stopWhen: stepCountIs(5),
      toolChoice: 'auto' as const,
      abortSignal: options?.abortSignal,
      onError: ({ error }) => {
        this.logger.error(
          `streamText error: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      },
      onFinish: async ({ text, steps, usage }) => {
        // 5. Persist assistant message in onFinish (per D-371)
        // Note: errors here are logged but not propagated — the stream
        // has already been sent to the client. A missed persist means
        // the assistant message won't appear in conversation history.
        try {
          const parts = extractPartsFromSteps(steps);
          await this.chatHistory.appendMessage(conversationId, {
            role: 'assistant',
            content: text ?? '',
            parts: parts.length > 0 ? parts : undefined,
            inputTokens: usage.inputTokens ?? undefined,
            outputTokens: usage.outputTokens ?? undefined,
          });
        } catch (err) {
          this.logger.error(
            `Failed to persist assistant message for conversation ${conversationId}: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      },
    });

    // 6. Return UIMessageStream
    return toUIMessageStream({ stream: result.stream }) as unknown as ReadableStream<Uint8Array>;
  }
}

/**
 * Extract plain text from a UIMessage's parts array.
 * UIMessage uses `parts` (not `content`) in AI SDK 7.
 */
function extractUserText(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/**
 * Extract ChatMessagePart[] from streamText steps for persistence.
 * Collects tool calls and tool results across all steps.
 *
 * Note: AI SDK StepResult types tool calls with `input` (not `args`)
 * and tool results with `output` (not `result`). We cast to unknown
 * because our ChatMessagePart uses generic `args`/`result` fields.
 */
function extractPartsFromSteps(
  steps: StepResult<ToolSet>[],
): ChatMessagePart[] {
  const parts: ChatMessagePart[] = [];

  for (const step of steps) {
    for (const tc of step.toolCalls) {
      parts.push({
        type: 'tool_call',
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: (tc as { input: unknown }).input,
      });
    }
    for (const tr of step.toolResults) {
      parts.push({
        type: 'tool_result',
        toolCallId: tr.toolCallId,
        result: (tr as { output: unknown }).output,
      });
    }
  }

  return parts;
}
