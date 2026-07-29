/**
 * ai-chat.controller.spec.ts — unit tests for AiChatController.
 *
 * Phase 18: Pre-stream validation + stream piping.
 * Phase 19: Conversation CRUD endpoints with auth guards.
 *
 * Verifies:
 * - Empty messages body → 400 JSON
 * - Undefined messages → 400 JSON
 * - Valid messages → ChatService.chat called, pipeUIMessageStreamToResponse called
 * - DomainError → 500 JSON
 * - GET /conversations requires admin auth, returns paginated data
 * - GET /conversations/:id/messages is @Public(), returns message array
 * - DELETE /conversations/:id requires admin auth, returns success
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AiChatController } from './ai-chat.controller';
import { ChatService } from './chat.service';
import { ChatHistoryService } from './chat-history.service';
import { DomainError } from './domain-error';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

// Mock the `ai` module for pipeUIMessageStreamToResponse
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    pipeUIMessageStreamToResponse: vi.fn(),
  };
});

import { pipeUIMessageStreamToResponse } from 'ai';

const mockPipeUIMessageStreamToResponse = vi.mocked(pipeUIMessageStreamToResponse);

/**
 * Create a mock Express Response object with jest.fn() for status, json, set, write, end.
 */
function createMockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.write = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.flush = vi.fn().mockReturnValue(res);
  return res as any;
}

describe('AiChatController', () => {
  let controller: AiChatController;
  let chatService: ChatService;
  let chatHistory: ChatHistoryService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AiChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            chat: vi.fn(),
          },
        },
        {
          provide: ChatHistoryService,
          useValue: {
            listConversationsPaged: vi.fn().mockResolvedValue({ list: [], total: 0 }),
            getConversationMessages: vi.fn().mockResolvedValue([]),
            deleteConversation: vi.fn().mockResolvedValue(undefined),
          },
        },
        // Provide guard overrides so they don't block in tests
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: vi.fn().mockReturnValue(true) },
        },
        {
          provide: AdminGuard,
          useValue: { canActivate: vi.fn().mockReturnValue(true) },
        },
      ],
    }).compile();

    controller = module.get(AiChatController);
    chatService = module.get(ChatService);
    chatHistory = module.get(ChatHistoryService);
  });

  // --- Phase 18 tests (existing) ---

  it('POST /api/ai/chat with empty messages → res.status(400) with code:400 and message', async () => {
    const res = createMockResponse();

    await controller.chat({ messages: [] }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: 400,
      data: null,
      message: '消息不能为空',
    });
  });

  it('POST /api/ai/chat with undefined messages → res.status(400) with code:400', async () => {
    const res = createMockResponse();

    await controller.chat({ messages: undefined }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: 400,
      data: null,
      message: '消息不能为空',
    });
  });

  it('POST /api/ai/chat with valid messages → ChatService.chat called, pipeUIMessageStreamToResponse called', async () => {
    const res = createMockResponse();
    const mockStream = { stream: true };
    vi.mocked(chatService.chat).mockResolvedValue(mockStream as any);

    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Hello' }],
        createdAt: new Date(),
      },
    ];

    await controller.chat(
      { messages, conversationId: 'conv-1', profileId: 'profile-1' },
      res,
    );

    expect(chatService.chat).toHaveBeenCalledWith(messages, {
      conversationId: 'conv-1',
      profileId: 'profile-1',
    });

    expect(mockPipeUIMessageStreamToResponse).toHaveBeenCalledWith({
      response: res,
      stream: mockStream,
    });
  });

  it('when ChatService.chat throws DomainError → res.status(500) with code:500 and error message', async () => {
    const res = createMockResponse();
    const domainError = new DomainError('未配置可用的 AI 模型');
    vi.mocked(chatService.chat).mockRejectedValue(domainError);

    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Hello' }],
        createdAt: new Date(),
      },
    ];

    await controller.chat({ messages }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 500,
      data: null,
      message: '未配置可用的 AI 模型',
    });
  });

  // --- Phase 19 tests: GET /conversations ---

  it('GET /conversations returns paginated data with code:200', async () => {
    const mockList = [
      { publicId: 'conv-1', title: 'Chat 1', profileId: null, userId: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    vi.mocked(chatHistory.listConversationsPaged).mockResolvedValue({
      list: mockList as any,
      total: 5,
    });

    const result = await controller.listConversations('1', '20');

    expect(result).toEqual({
      code: 200,
      data: {
        list: mockList,
        total: 5,
        page: 1,
        page_size: 20,
      },
      message: 'ok',
    });

    expect(chatHistory.listConversationsPaged).toHaveBeenCalledWith(1, 20);
  });

  it('GET /conversations defaults to page=1, pageSize=20 when no query params', async () => {
    vi.mocked(chatHistory.listConversationsPaged).mockResolvedValue({
      list: [],
      total: 0,
    });

    const result = await controller.listConversations(undefined, undefined);

    expect(chatHistory.listConversationsPaged).toHaveBeenCalledWith(1, 20);
    expect(result.data.page).toBe(1);
    expect(result.data.page_size).toBe(20);
  });

  it('GET /conversations clamps pageSize to max 100', async () => {
    vi.mocked(chatHistory.listConversationsPaged).mockResolvedValue({
      list: [],
      total: 0,
    });

    const result = await controller.listConversations('1', '500');

    expect(chatHistory.listConversationsPaged).toHaveBeenCalledWith(1, 100);
    expect(result.data.page_size).toBe(100);
  });

  it('GET /conversations clamps page to min 1', async () => {
    vi.mocked(chatHistory.listConversationsPaged).mockResolvedValue({
      list: [],
      total: 0,
    });

    const result = await controller.listConversations('0', '10');

    expect(chatHistory.listConversationsPaged).toHaveBeenCalledWith(1, 10);
    expect(result.data.page).toBe(1);
  });

  // --- Phase 19 tests: GET /conversations/:id/messages ---

  it('GET /conversations/:id/messages returns message array with code:200', async () => {
    const mockMessages = [
      { role: 'user', content: 'Hello', createdAt: new Date() },
      { role: 'assistant', content: 'Hi there', createdAt: new Date() },
    ];
    vi.mocked(chatHistory.getConversationMessages).mockResolvedValue(mockMessages as any);

    const result = await controller.getConversationMessages('conv-abc');

    expect(result).toEqual({
      code: 200,
      data: mockMessages,
      message: 'ok',
    });

    expect(chatHistory.getConversationMessages).toHaveBeenCalledWith('conv-abc');
  });

  it('GET /conversations/:id/messages returns empty array for conversation with no messages', async () => {
    vi.mocked(chatHistory.getConversationMessages).mockResolvedValue([]);

    const result = await controller.getConversationMessages('conv-empty');

    expect(result.data).toEqual([]);
    expect(result.code).toBe(200);
  });

  // --- Phase 19 tests: DELETE /conversations/:id ---

  it('DELETE /conversations/:id returns code:200 with data:null on success', async () => {
    const result = await controller.deleteConversation('conv-del');

    expect(result).toEqual({
      code: 200,
      data: null,
      message: 'ok',
    });

    expect(chatHistory.deleteConversation).toHaveBeenCalledWith('conv-del');
  });

  it('DELETE /conversations/:id calls ChatHistoryService.deleteConversation with correct id', async () => {
    await controller.deleteConversation('conv-xyz');

    expect(chatHistory.deleteConversation).toHaveBeenCalledWith('conv-xyz');
  });
});
