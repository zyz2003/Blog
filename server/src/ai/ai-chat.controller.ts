/**
 * AiChatController — POST /api/ai/chat streaming endpoint + conversation CRUD.
 *
 * Per D-360: @Public() route — anonymous visitors can chat without login.
 * Per D-369: Pre-stream validation returns { code, data, message } JSON.
 * Per D-385: GET /conversations/:id/messages is @Public() for conversation recovery.
 * Uses @Res() to bypass ResponseInterceptor — manual JSON for errors,
 * pipeUIMessageStreamToResponse for streaming success.
 */
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  Res,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import type { Response } from 'express';
import { pipeUIMessageStreamToResponse, type UIMessage, type UIMessageChunk } from 'ai';
import { ChatService } from './chat.service';
import { ChatHistoryService } from './chat-history.service';
import { DomainError } from './domain-error';

@Controller('ai')
export class AiChatController {
  private readonly logger = new Logger(AiChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatHistory: ChatHistoryService,
  ) {}

  /**
   * POST /api/ai/chat — stream a chat response.
   *
   * Per D-360: Throttled at ~6s/request (10/min) for anonymous access.
   * Per D-369: Pre-stream validation for empty messages → 400.
   * DomainError from ChatService (model not configured) → 500.
   * On success: pipes UIMessageStream to response.
   */
  @Public()
  @Throttle({ default: { ttl: 6000, limit: 1 } })
  @Post('chat')
  async chat(
    @Body()
    body: {
      messages?: UIMessage[];
      conversationId?: string;
      profileId?: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    // Pre-stream validation (per D-369)
    if (!body.messages || body.messages.length === 0) {
      res
        .status(400)
        .json({ code: 400, data: null, message: '消息不能为空' });
      return;
    }

    try {
      const stream = await this.chatService.chat(body.messages, {
        conversationId: body.conversationId,
        profileId: body.profileId,
      });

      // Pipe the UIMessageStream to the HTTP response
      // ChatService.chat returns ReadableStream<Uint8Array> at the port level,
      // but the actual runtime stream is ReadableStream<UIMessageChunk> from toUIMessageStream
      pipeUIMessageStreamToResponse({
        response: res,
        stream: stream as unknown as ReadableStream<UIMessageChunk>,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        res.status(500).json({
          code: 500,
          data: null,
          message: error.message,
        });
        return;
      }

      this.logger.error('Unexpected chat error', error);
      res.status(500).json({
        code: 500,
        data: null,
        message: '内部服务器错误',
      });
    }
  }

  /**
   * GET /api/ai/conversations — List conversations with pagination.
   * Admin-only: requires JWT + AdminGuard.
   * Returns { code: 200, data: { list, total, page, page_size }, message: 'ok' }
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('conversations')
  async listConversations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.max(1, Math.min(100, parseInt(pageSize ?? '20', 10) || 20));

    const { list, total } = await this.chatHistory.listConversationsPaged(p, ps);

    return {
      code: 200,
      data: {
        list,
        total,
        page: p,
        page_size: ps,
      },
      message: 'ok',
    };
  }

  /**
   * GET /api/ai/conversations/:id/messages — Get messages for a conversation.
   * Per D-385: @Public() so frontend can recover its own conversation after refresh.
   * The :id is the Sqids-encoded publicId.
   * Returns { code: 200, data: [...messages], message: 'ok' }
   */
  @Public()
  @Get('conversations/:id/messages')
  async getConversationMessages(@Param('id') id: string) {
    const messages = await this.chatHistory.getConversationMessages(id);

    return {
      code: 200,
      data: messages,
      message: 'ok',
    };
  }

  /**
   * DELETE /api/ai/conversations/:id — Delete a conversation.
   * Admin-only: requires JWT + AdminGuard.
   * The :id is the Sqids-encoded publicId.
   * Returns { code: 200, data: null, message: 'ok' }
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('conversations/:id')
  async deleteConversation(@Param('id') id: string) {
    await this.chatHistory.deleteConversation(id);

    return {
      code: 200,
      data: null,
      message: 'ok',
    };
  }
}
