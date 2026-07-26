import {
  Controller,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ArticleAiPort } from './ports/ai.port';

@Controller('ai')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AiSummaryController {
  constructor(
    @Inject('ARTICLE_AI_PORT') private readonly articleAi: ArticleAiPort,
  ) {}

  /**
   * Generate AI summary for a given article.
   * POST /api/ai/generate-summary/:id
   *
   * Does not write to database — returns the generated summary for the
   * frontend to fill into the editor and save.
   */
  @HttpCode(HttpStatus.OK)
  @Post('generate-summary/:id')
  async generateSummary(
    @Param('id') id: string,
  ): Promise<{ summary: string }> {
    return this.articleAi.summarizeArticle(id);
  }
}
