/**
 * AiWritingController - AI 写作 3 个 SSE 端点。
 *
 * POST /api/ai/writing/generate  -- 从头写
 * POST /api/ai/writing/continue   -- 续写
 * POST /api/ai/writing/rewrite    -- 改写
 *
 * 全部需要 JWT + 管理员权限。用 @Res() 绕过 ResponseInterceptor，
 * 手动写 SSE 格式。
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import type { Response } from 'express';
import { AiWritingService } from './ai-writing.service';
import { DomainError } from '../domain-error';
import { AI_BLOCKS } from './block-registry';

@Controller('ai/writing')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AiWritingController {
  private readonly logger = new Logger(AiWritingController.name);

  constructor(private readonly writingService: AiWritingService) {}

  /**
   * GET /api/ai/writing/blocks - 返回 AI 可用的自定义块注册表（给后台开关 UI 用）。
   * 走 ResponseInterceptor 包成 { code, data, message }。
   */
  @Get('blocks')
  listBlocks() {
    return AI_BLOCKS;
  }

  @Post('generate')
  async generate(
    @Body() body: { prompt?: string },
    @Res() res: Response,
  ): Promise<void> {
    if (!body.prompt?.trim()) {
      res.status(400).json({ code: 400, message: '提示词不能为空', data: null });
      return;
    }
    try {
      await this.writingService.generate(body.prompt, res);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  @Post('continue')
  async continue(
    @Body() body: { content?: string },
    @Res() res: Response,
  ): Promise<void> {
    if (!body.content?.trim()) {
      res.status(400).json({ code: 400, message: '内容不能为空', data: null });
      return;
    }
    try {
      await this.writingService.continue(body.content, res);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  @Post('rewrite')
  async rewrite(
    @Body() body: { text?: string; instruction?: string },
    @Res() res: Response,
  ): Promise<void> {
    if (!body.text?.trim()) {
      res.status(400).json({ code: 400, message: '文本不能为空', data: null });
      return;
    }
    if (!body.instruction?.trim()) {
      res.status(400).json({ code: 400, message: '改写指令不能为空', data: null });
      return;
    }
    try {
      await this.writingService.rewrite(body.text, body.instruction, res);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof DomainError) {
      res.status(500).json({ code: 500, message: error.message, data: null });
      return;
    }
    this.logger.error('AI writing error', error);
    res.status(500).json({ code: 500, message: '内部服务器错误', data: null });
  }
}
