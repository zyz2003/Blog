/**
 * ai-chat.controller.spec.ts — unit tests for AiChatController pre-stream validation + stream piping.
 *
 * Verifies:
 * - Empty messages body → 400 JSON
 * - Undefined messages → 400 JSON
 * - Valid messages → ChatService.chat called, pipeUIMessageStreamToResponse called
 * - DomainError → 500 JSON
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AiChatController } from './ai-chat.controller';
import { ChatService } from './chat.service';
import { DomainError } from './domain-error';

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
      ],
    }).compile();

    controller = module.get(AiChatController);
    chatService = module.get(ChatService);
  });

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
});
