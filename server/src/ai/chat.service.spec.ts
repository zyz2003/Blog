/**
 * chat.service.spec.ts — unit tests for ChatService.chat persistence + error handling
 * + Phase 19 hardening: compression, token recording, consumeStream, system prompt.
 *
 * Verifies:
 * - ModelResolver DomainError propagation
 * - createConversation called when no conversationId
 * - Invalid conversationId → DomainError
 * - User message persisted before streamText
 * - onFinish persists assistant message with role + parts
 * - onFinish appendMessage failure is logged, not thrown
 * - System prompt read from settings, falls back to default (D-392)
 * - prepareStep compresses when messages > 20 (D-380/D-381)
 * - prepareStep does not compress when messages <= 20
 * - onStepFinish accumulates token counts across steps (D-382)
 * - onFinish persists accumulated token counts (D-382)
 * - consumeStream is called on the result (D-383)
 * - userId passed through to createConversation (D-391)
 *
 * Strategy: Mock all external dependencies (ModelResolver, ChatHistoryService,
 * SettingsService, ModuleRef, DRIZZLE). Mock the `ai` module's streamText
 * and generateText to avoid real LLM calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { ModelResolver } from './model/model-resolver.service';
import { ChatHistoryService } from './chat-history.service';
import { SettingsService } from '../settings/settings.service';
import { DomainError } from './domain-error';
import { DRIZZLE } from '../database/database.module';
import { ModuleRef } from '@nestjs/core';

// Mock sqids.util — decodePublicID + EntityType
vi.mock('../common/utils/sqids.util', () => ({
  decodePublicID: vi.fn(),
  EntityType: { ChatConversation: 23 },
}));

import { decodePublicID } from '../common/utils/sqids.util';

const mockDecodePublicID = vi.mocked(decodePublicID);

// Mock the `ai` module — streamText, generateText, convertToModelMessages, stepCountIs, toUIMessageStream, tool
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    streamText: vi.fn(),
    generateText: vi.fn().mockResolvedValue({ text: 'summary text' }),
    convertToModelMessages: vi.fn().mockResolvedValue([]),
    stepCountIs: vi.fn().mockReturnValue({}),
    toUIMessageStream: vi.fn().mockReturnValue({}),
    // tool() is called in ChatService constructor via toAiSdkTools — must return a valid tool object
    tool: vi.fn((def: any) => ({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: def.execute,
    })),
  };
});

import { streamText, generateText } from 'ai';

const mockStreamText = vi.mocked(streamText);
const mockGenerateText = vi.mocked(generateText);

/**
 * Create a mock UIMessage with the given role and text parts.
 */
function createUIMessage(role: 'user' | 'assistant', text: string) {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    parts: [{ type: 'text' as const, text }],
    createdAt: new Date(),
  };
}

/**
 * Create a mock ModelMessage (as returned by convertToModelMessages).
 */
function createModelMessage(role: 'user' | 'assistant' | 'system', content: string) {
  return { role, content } as any;
}

describe('ChatService', () => {
  let service: ChatService;
  let modelResolver: ModelResolver;
  let chatHistory: ChatHistoryService;
  let settings: SettingsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: decodePublicID returns a valid ChatConversation ID
    mockDecodePublicID.mockReturnValue({ dbID: 1, entityType: 23 });

    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: ModelResolver,
          useValue: {
            resolve: vi.fn().mockReturnValue({ modelId: 'test-model' }),
          },
        },
        {
          provide: ChatHistoryService,
          useValue: {
            createConversation: vi.fn().mockResolvedValue('conv-123'),
            appendMessage: vi.fn().mockResolvedValue(undefined),
            getMessages: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: SettingsService,
          useValue: { get: vi.fn().mockReturnValue(undefined) },
        },
        {
          provide: DRIZZLE,
          useValue: {},
        },
        {
          provide: ModuleRef,
          useValue: { get: vi.fn() },
        },
      ],
    }).compile();

    service = module.get(ChatService);
    modelResolver = module.get(ModelResolver);
    chatHistory = module.get(ChatHistoryService);
    settings = module.get(SettingsService);
  });

  // --- Phase 18 tests (existing) ---

  it('when ModelResolver.resolve throws DomainError, chat re-throws it', async () => {
    const domainError = new DomainError('未配置可用的 AI 模型');
    vi.mocked(modelResolver.resolve).mockImplementation(() => {
      throw domainError;
    });

    await expect(
      service.chat([createUIMessage('user', 'hello')]),
    ).rejects.toThrow(DomainError);

    await expect(
      service.chat([createUIMessage('user', 'hello')]),
    ).rejects.toThrow('未配置可用的 AI 模型');
  });

  it('when conversationId not provided, createConversation is called', async () => {
    // Setup streamText to return a minimal stream
    mockStreamText.mockReturnValue({
      stream: { [Symbol.asyncIterator]: async function* () {} },
      consumeStream: vi.fn(),
    } as any);

    const messages = [createUIMessage('user', 'hello')];

    await service.chat(messages);

    expect(chatHistory.createConversation).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
    );
  });

  it('user message persisted via appendMessage before streamText is called', async () => {
    const callOrder: string[] = [];

    // Track appendMessage call order
    vi.mocked(chatHistory.appendMessage).mockImplementation(
      async () => {
        callOrder.push('appendMessage');
      },
    );

    // Track streamText call order
    mockStreamText.mockImplementation(() => {
      callOrder.push('streamText');
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const messages = [createUIMessage('user', 'hello')];

    await service.chat(messages, { conversationId: 'conv-456' });

    // appendMessage should be called before streamText
    expect(callOrder).toEqual(['appendMessage', 'streamText']);
    expect(chatHistory.appendMessage).toHaveBeenCalledWith(
      'conv-456',
      expect.objectContaining({
        role: 'user',
        content: 'hello',
      }),
    );
  });

  it('onFinish callback persists assistant message with role=assistant and parts', async () => {
    let onFinishCallback: any;

    mockStreamText.mockImplementation((opts: any) => {
      onFinishCallback = opts.onFinish;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const messages = [createUIMessage('user', 'hello')];

    await service.chat(messages, { conversationId: 'conv-789' });

    // Simulate onFinish being called by streamText
    expect(onFinishCallback).toBeDefined();

    await onFinishCallback({
      text: 'AI response text',
      steps: [
        {
          toolCalls: [
            {
              toolCallId: 'tc-1',
              toolName: 'search_articles',
              input: { keyword: 'test' },
            },
          ],
          toolResults: [
            {
              toolCallId: 'tc-1',
              output: { articles: [] },
            },
          ],
        },
      ],
    });

    // Verify appendMessage was called for the assistant message
    expect(chatHistory.appendMessage).toHaveBeenCalledWith(
      'conv-789',
      expect.objectContaining({
        role: 'assistant',
        content: 'AI response text',
        parts: expect.arrayContaining([
          expect.objectContaining({
            type: 'tool_call',
            toolCallId: 'tc-1',
            toolName: 'search_articles',
          }),
          expect.objectContaining({
            type: 'tool_result',
            toolCallId: 'tc-1',
          }),
        ]),
      }),
    );
  });

  it('invalid conversationId (decodePublicID throws) → DomainError', async () => {
    mockDecodePublicID.mockImplementation(() => {
      throw new Error('无法从公共ID解码出预期数量的数字');
    });

    await expect(
      service.chat([createUIMessage('user', 'hello')], {
        conversationId: 'invalid-uuid-format',
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      service.chat([createUIMessage('user', 'hello')], {
        conversationId: 'invalid-uuid-format',
      }),
    ).rejects.toThrow('无效的会话 ID');
  });

  it('conversationId with wrong entity type → DomainError', async () => {
    // Return a valid Sqids decode but wrong entity type (e.g. Article=3)
    mockDecodePublicID.mockReturnValue({ dbID: 1, entityType: 3 });

    await expect(
      service.chat([createUIMessage('user', 'hello')], {
        conversationId: 'article-id-not-conversation',
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      service.chat([createUIMessage('user', 'hello')], {
        conversationId: 'article-id-not-conversation',
      }),
    ).rejects.toThrow('无效的会话 ID');
  });

  it('onFinish appendMessage failure is logged, not thrown', async () => {
    let onFinishCallback: any;

    mockStreamText.mockImplementation((opts: any) => {
      onFinishCallback = opts.onFinish;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    // Make appendMessage fail for the assistant message (second call)
    let callCount = 0;
    vi.mocked(chatHistory.appendMessage).mockImplementation(async () => {
      callCount++;
      if (callCount > 1) throw new Error('DB write failed');
    });

    const messages = [createUIMessage('user', 'hello')];
    await service.chat(messages, { conversationId: 'conv-err' });

    // onFinish should not throw even though appendMessage fails
    expect(onFinishCallback).toBeDefined();
    await expect(
      onFinishCallback({
        text: 'response',
        steps: [],
      }),
    ).resolves.toBeUndefined();
  });

  // --- Phase 19 tests: System prompt from settings (D-392) ---

  it('system prompt read from settings.get(ai_chat_system_prompt) when set', async () => {
    vi.mocked(settings.get).mockReturnValue('Custom system prompt from settings');

    let capturedInstructions: string | undefined;
    mockStreamText.mockImplementation((opts: any) => {
      capturedInstructions = opts.instructions;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    await service.chat([createUIMessage('user', 'hello')], { conversationId: 'conv-1' });

    expect(settings.get).toHaveBeenCalledWith('ai_chat_system_prompt');
    expect(capturedInstructions).toBe('Custom system prompt from settings');
  });

  it('system prompt falls back to DEFAULT_SYSTEM_PROMPT when settings returns undefined', async () => {
    vi.mocked(settings.get).mockReturnValue(undefined);

    let capturedInstructions: string | undefined;
    mockStreamText.mockImplementation((opts: any) => {
      capturedInstructions = opts.instructions;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    await service.chat([createUIMessage('user', 'hello')], { conversationId: 'conv-1' });

    expect(capturedInstructions).toBe(
      '你是博客站的 AI 助手，可以搜索和阅读博客文章来回答用户问题。请用中文回答。',
    );
  });

  // --- Phase 19 tests: prepareStep compression (D-380/D-381) ---

  it('prepareStep compresses when messages > 20 (COMPRESSION_THRESHOLD)', async () => {
    // Create 25 model messages to exceed the threshold
    const manyMessages = Array.from({ length: 25 }, (_, i) =>
      createModelMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`),
    );

    // Mock convertToModelMessages to return our 25 messages
    const { convertToModelMessages } = await import('ai');
    vi.mocked(convertToModelMessages).mockResolvedValue(manyMessages as any);

    let capturedPrepareStep: any;
    mockStreamText.mockImplementation((opts: any) => {
      capturedPrepareStep = opts.prepareStep;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const uiMessages = [createUIMessage('user', 'hello')];
    await service.chat(uiMessages, { conversationId: 'conv-1' });

    expect(capturedPrepareStep).toBeDefined();

    // Call prepareStep with 25 messages
    const result = await capturedPrepareStep({ messages: manyMessages });

    // Should return compressed messages
    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
    // System message (0 or 1) + summary message (1) + recent 10 = 11 or 12
    expect(result.messages.length).toBeLessThanOrEqual(12);
    expect(result.messages.length).toBeGreaterThanOrEqual(11);

    // Should contain a summary message
    const summaryMsg = result.messages.find(
      (m: any) => typeof m.content === 'string' && m.content.startsWith('之前的对话摘要：'),
    );
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg.role).toBe('system');

    // generateText should have been called for summary
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('prepareStep does not compress when messages <= 20', async () => {
    const fewMessages = Array.from({ length: 15 }, (_, i) =>
      createModelMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`),
    );

    let capturedPrepareStep: any;
    mockStreamText.mockImplementation((opts: any) => {
      capturedPrepareStep = opts.prepareStep;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const uiMessages = [createUIMessage('user', 'hello')];
    await service.chat(uiMessages, { conversationId: 'conv-1' });

    expect(capturedPrepareStep).toBeDefined();

    // Call prepareStep with 15 messages (below threshold)
    const result = await capturedPrepareStep({ messages: fewMessages });

    // Should return undefined (no compression)
    expect(result).toBeUndefined();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('prepareStep preserves system message when compressing', async () => {
    const systemMsg = createModelMessage('system', 'Original system prompt');
    const userMessages = Array.from({ length: 22 }, (_, i) =>
      createModelMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`),
    );
    const allMessages = [systemMsg, ...userMessages]; // 23 total

    let capturedPrepareStep: any;
    mockStreamText.mockImplementation((opts: any) => {
      capturedPrepareStep = opts.prepareStep;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const uiMessages = [createUIMessage('user', 'hello')];
    await service.chat(uiMessages, { conversationId: 'conv-1' });

    const result = await capturedPrepareStep({ messages: allMessages });

    // First message should be the original system message
    expect(result.messages[0]).toEqual(systemMsg);

    // Second message should be the summary
    expect(result.messages[1].role).toBe('system');
    expect(result.messages[1].content).toContain('之前的对话摘要：');
  });

  it('prepareStep falls back gracefully when generateText fails', async () => {
    const manyMessages = Array.from({ length: 25 }, (_, i) =>
      createModelMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`),
    );

    mockGenerateText.mockRejectedValue(new Error('LLM unavailable'));

    let capturedPrepareStep: any;
    mockStreamText.mockImplementation((opts: any) => {
      capturedPrepareStep = opts.prepareStep;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const uiMessages = [createUIMessage('user', 'hello')];
    await service.chat(uiMessages, { conversationId: 'conv-1' });

    const result = await capturedPrepareStep({ messages: manyMessages });

    // Should return undefined (graceful fallback)
    expect(result).toBeUndefined();
  });

  // --- Phase 19 tests: onStepFinish token accumulation (D-382) ---

  it('onStepFinish accumulates token counts across multiple steps', async () => {
    let onStepFinishCallback: any;
    let onFinishCallback: any;

    mockStreamText.mockImplementation((opts: any) => {
      onStepFinishCallback = opts.onStepFinish;
      onFinishCallback = opts.onFinish;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const messages = [createUIMessage('user', 'hello')];
    await service.chat(messages, { conversationId: 'conv-tokens' });

    // Simulate 2 steps with different token usage
    onStepFinishCallback({ usage: { inputTokens: 100, outputTokens: 50 } });
    onStepFinishCallback({ usage: { inputTokens: 200, outputTokens: 80 } });

    // Now call onFinish — should use accumulated tokens
    await onFinishCallback({ text: 'response', steps: [] });

    // Verify accumulated tokens are persisted (100+200=300, 50+80=130)
    expect(chatHistory.appendMessage).toHaveBeenCalledWith(
      'conv-tokens',
      expect.objectContaining({
        role: 'assistant',
        inputTokens: 300,
        outputTokens: 130,
      }),
    );
  });

  it('onFinish persists accumulated token counts, not just last step', async () => {
    let onStepFinishCallback: any;
    let onFinishCallback: any;

    mockStreamText.mockImplementation((opts: any) => {
      onStepFinishCallback = opts.onStepFinish;
      onFinishCallback = opts.onFinish;
      return {
        stream: { [Symbol.asyncIterator]: async function* () {} },
        consumeStream: vi.fn(),
      } as any;
    });

    const messages = [createUIMessage('user', 'hello')];
    await service.chat(messages, { conversationId: 'conv-acc' });

    // Simulate 3 steps
    onStepFinishCallback({ usage: { inputTokens: 50, outputTokens: 20 } });
    onStepFinishCallback({ usage: { inputTokens: 30, outputTokens: 10 } });
    onStepFinishCallback({ usage: { inputTokens: 100, outputTokens: 40 } });

    await onFinishCallback({ text: 'response', steps: [] });

    // Total: 50+30+100=180 input, 20+10+40=70 output
    expect(chatHistory.appendMessage).toHaveBeenCalledWith(
      'conv-acc',
      expect.objectContaining({
        inputTokens: 180,
        outputTokens: 70,
      }),
    );
  });

  // --- Phase 19 tests: consumeStream (D-383) ---

  it('consumeStream is called on the streamText result before returning', async () => {
    const mockConsumeStream = vi.fn();
    mockStreamText.mockReturnValue({
      stream: { [Symbol.asyncIterator]: async function* () {} },
      consumeStream: mockConsumeStream,
    } as any);

    const messages = [createUIMessage('user', 'hello')];
    await service.chat(messages, { conversationId: 'conv-cs' });

    expect(mockConsumeStream).toHaveBeenCalledTimes(1);
  });

  // --- Phase 19 tests: userId passthrough (D-391) ---

  it('userId is passed through to createConversation', async () => {
    mockStreamText.mockReturnValue({
      stream: { [Symbol.asyncIterator]: async function* () {} },
      consumeStream: vi.fn(),
    } as any);

    const messages = [createUIMessage('user', 'hello')];
    await service.chat(messages, { userId: 42 });

    expect(chatHistory.createConversation).toHaveBeenCalledWith(
      undefined,
      undefined,
      42,
    );
  });

  it('userId=null is passed through to createConversation for anonymous users', async () => {
    mockStreamText.mockReturnValue({
      stream: { [Symbol.asyncIterator]: async function* () {} },
      consumeStream: vi.fn(),
    } as any);

    const messages = [createUIMessage('user', 'hello')];
    await service.chat(messages, { userId: null });

    expect(chatHistory.createConversation).toHaveBeenCalledWith(
      undefined,
      undefined,
      null,
    );
  });
});
