/**
 * AiChatController — POST /api/ai/chat streaming endpoint.
 *
 * Per D-360: @Public() route — anonymous visitors can chat without login.
 * Per D-369: Pre-stream validation returns { code, data, message } JSON.
 * Uses @Res() to bypass ResponseInterceptor — manual JSON for errors,
 * pipeUIMessageStreamToResponse for streaming success.
 */
import {
  Controller,
  Post,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import type { Response } from 'express';
import { pipeUIMessageStreamToResponse, type UIMessage, type UIMessageChunk } from 'ai';
import { ChatService } from './chat.service';
import { DomainError } from './domain-error';

@Public()
@Controller('ai')
export class AiChatController {
  private readonly logger = new Logger(AiChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /api/ai/chat — stream a chat response.
   *
   * Per D-360: Throttled at ~6s/request (10/min) for anonymous access.
   * Per D-369: Pre-stream validation for empty messages → 400.
   * DomainError from ChatService (model not configured) → 500.
   * On success: pipes UIMessageStream to response.
   */
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
}
