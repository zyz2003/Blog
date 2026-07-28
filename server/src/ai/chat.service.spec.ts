/**
 * chat.service.spec.ts — unit tests for ChatService.chat persistence + error handling.
 *
 * Verifies:
 * - ModelResolver DomainError propagation
 * - createConversation called when no conversationId
 * - Invalid conversationId → DomainError
 * - User message persisted before streamText
 * - onFinish persists assistant message with role + parts
 * - onFinish appendMessage failure is logged, not thrown
 *
 * Strategy: Mock all external dependencies (ModelResolver, ChatHistoryService,
 * SettingsService, ModuleRef, DRIZZLE). Mock the `ai` module's streamText
 * to avoid real LLM calls.
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

// Mock the `ai` module — streamText, convertToModelMessages, stepCountIs, toUIMessageStream, tool
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    streamText: vi.fn(),
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

import { streamText } from 'ai';

const mockStreamText = vi.mocked(streamText);

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

describe('ChatService', () => {
  let service: ChatService;
  let modelResolver: ModelResolver;
  let chatHistory: ChatHistoryService;

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
  });

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
    } as any);

    const messages = [createUIMessage('user', 'hello')];

    await service.chat(messages);

    expect(chatHistory.createConversation).toHaveBeenCalledWith(
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
      usage: { inputTokens: 50, outputTokens: 100 },
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
        inputTokens: 50,
        outputTokens: 100,
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
        usage: { inputTokens: 10, outputTokens: 20 },
      }),
    ).resolves.toBeUndefined();
  });
});
