/**
 * ChatService — core streaming chat: streamText + tools + persistence.
 *
 * Per D-364: ToolContext built with moduleRef.resolve-based getService.
 * Per D-365: Tool call loop capped at 5 steps via stepCountIs(5).
 * Per D-371: User message persisted BEFORE stream; assistant message in onFinish.
 * Per D-380/D-381: prepareStep compression for long conversations (>20 messages).
 * Per D-382: onStepFinish token recording for per-step usage tracking.
 * Per D-383: consumeStream ensures onFinish fires even on client disconnect.
 * Per D-392: System prompt read from settings with hardcoded default fallback.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  streamText,
  generateText,
  convertToModelMessages,
  stepCountIs,
  toUIMessageStream,
  type UIMessage,
  type ToolSet,
  type StepResult,
  type ModelMessage,
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

const DEFAULT_SYSTEM_PROMPT =
  '你是博客站的 AI 助手，可以搜索和阅读博客文章来回答用户问题。请用中文回答。';

/** Per D-380: compress when messages exceed this threshold */
const COMPRESSION_THRESHOLD = 20;
/** Per D-381: keep this many recent messages after compression */
const KEEP_RECENT = 10;

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
   *    - prepareStep: compress long conversations (>20 messages)
   *    - onStepFinish: accumulate token usage per step
   * 5. Persist assistant message in onFinish with accumulated tokens
   * 6. consumeStream() ensures onFinish fires even on client disconnect
   * 7. Return UIMessageStream as ReadableStream<Uint8Array>
   */
  async chat(
    messages: UIMessage[],
    options?: {
      conversationId?: string;
      profileId?: string;
      userId?: number | null;
      abortSignal?: AbortSignal;
    },
  ): Promise<ReadableStream<Uint8Array>> {
    // 1. Resolve model — re-throw DomainError for controller 4xx/5xx handling
    const model = this.modelResolver.resolve(options?.profileId);

    // Per D-392: read system prompt from settings at call time (not constructor)
    // so runtime config changes take effect without restart
    const systemPrompt =
      (this.settings.get('ai_chat_system_prompt') as string | undefined) ||
      DEFAULT_SYSTEM_PROMPT;

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
      conversationId = await this.chatHistory.createConversation(undefined, options?.profileId, options?.userId);
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

    // Per D-382: accumulate token usage across steps via onStepFinish
    let stepInputTokens = 0;
    let stepOutputTokens = 0;

    // 4. Call streamText
    const result = streamText({
      model,
      instructions: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: this.tools,
      stopWhen: stepCountIs(5),
      toolChoice: 'auto' as const,
      abortSignal: options?.abortSignal,
      // Per D-380/D-381: compress long conversations in prepareStep
      prepareStep: async ({ messages: stepMessages }) => {
        if (stepMessages.length <= COMPRESSION_THRESHOLD) {
          return undefined;
        }

        // Keep system message (first if role=system) + summary of old messages + recent messages
        const systemMsg = stepMessages.find((m) => m.role === 'system');
        const nonSystemMessages = stepMessages.filter((m) => m.role !== 'system');
        const recentMessages = nonSystemMessages.slice(-KEEP_RECENT);
        const oldMessages = nonSystemMessages.slice(0, -KEEP_RECENT);

        if (oldMessages.length === 0) {
          return undefined;
        }

        // Generate summary of old messages
        const summaryText = oldMessages
          .map((m) => `${m.role}: ${extractModelMessageText(m)}`)
          .join('\n');

        try {
          const { text: summary } = await generateText({
            model,
            prompt: `请用中文简洁总结以下对话内容，保留关键信息：\n\n${summaryText}`,
          });

          const summaryMessage: ModelMessage = {
            role: 'system',
            content: `之前的对话摘要：${summary}`,
          };

          const compressedMessages: ModelMessage[] = [];
          if (systemMsg) {
            compressedMessages.push(systemMsg);
          }
          compressedMessages.push(summaryMessage);
          compressedMessages.push(...recentMessages);

          return { messages: compressedMessages };
        } catch (err) {
          this.logger.warn(
            `Failed to generate conversation summary, using messages as-is: ${err instanceof Error ? err.message : String(err)}`,
          );
          return undefined;
        }
      },
      onError: ({ error }) => {
        this.logger.error(
          `streamText error: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      },
      // Per D-382: accumulate token usage per step
      onStepFinish: ({ usage }) => {
        stepInputTokens += usage.inputTokens ?? 0;
        stepOutputTokens += usage.outputTokens ?? 0;
      },
      onFinish: async ({ text, steps }) => {
        // 5. Persist assistant message in onFinish (per D-371)
        // Per D-382: use accumulated token counts from onStepFinish
        // Note: errors here are logged but not propagated — the stream
        // has already been sent to the client. A missed persist means
        // the assistant message won't appear in conversation history.
        try {
          const parts = extractPartsFromSteps(steps);
          await this.chatHistory.appendMessage(conversationId, {
            role: 'assistant',
            content: text ?? '',
            parts: parts.length > 0 ? parts : undefined,
            inputTokens: stepInputTokens || undefined,
            outputTokens: stepOutputTokens || undefined,
          });
        } catch (err) {
          this.logger.error(
            `Failed to persist assistant message for conversation ${conversationId}: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      },
    });

    // Per D-383: consumeStream ensures onFinish fires even on client disconnect
    // Called without await — fire-and-forget background consumption
    result.consumeStream();

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
 * Extract text content from a ModelMessage for summary generation.
 * ModelMessage content can be a string or an array of content parts.
 */
function extractModelMessageText(message: ModelMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
  }
  return '';
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
