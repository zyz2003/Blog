import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ArticleHistoryService } from './article-history.service';
import { RestoreHistoryDto } from './dto/restore-history.dto';

/**
 * ArticleHistoryController — handles article history version endpoints.
 * All endpoints require JWT auth (global JwtAuthGuard applies, no @Public()).
 * Route: /api/articles/:articleId/history/*
 * Matches Go article_history handler routes.
 */
@Controller('articles/:articleId/history')
export class ArticleHistoryController {
  constructor(private readonly historyService: ArticleHistoryService) {}

  /**
   * GET /api/articles/:articleId/history
   * List history versions for an article (paginated).
   * Matches Go ListHistory.
   */
  @Get()
  async listHistory(
    @Param('articleId') articleId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;

    // Validate pagination params
    const validPage = p > 0 ? p : 1;
    const validPageSize = ps > 0 && ps <= 100 ? ps : 20;

    return this.historyService.listHistory(articleId, validPage, validPageSize);
  }

  /**
   * GET /api/articles/:articleId/history/count
   * Get history version count for an article.
   * Matches Go GetHistoryCount.
   */
  @Get('count')
  async getCount(@Param('articleId') articleId: string) {
    return this.historyService.getHistoryCount(articleId);
  }

  /**
   * GET /api/articles/:articleId/history/compare?v1=X&v2=Y
   * Compare two history versions.
   * Matches Go CompareVersions.
   */
  @Get('compare')
  async compareVersions(
    @Param('articleId') articleId: string,
    @Query('v1') v1: string,
    @Query('v2') v2: string,
  ) {
    const version1 = parseInt(v1, 10);
    const version2 = parseInt(v2, 10);

    if (isNaN(version1) || isNaN(version2) || version1 <= 0 || version2 <= 0) {
      throw new BadRequestException('请提供有效的版本号');
    }

    return this.historyService.compareVersions(articleId, version1, version2);
  }

  /**
   * GET /api/articles/:articleId/history/:version
   * Get a specific history version.
   * Matches Go GetVersion.
   */
  @Get(':version')
  async getVersion(
    @Param('articleId') articleId: string,
    @Param('version') version: string,
  ) {
    const v = parseInt(version, 10);
    if (isNaN(v) || v <= 0) {
      throw new BadRequestException('无效的版本号');
    }
    return this.historyService.getHistoryVersion(articleId, v);
  }

  /**
   * POST /api/articles/:articleId/history/:version/restore
   * Restore a history version — returns version data for manual restore.
   * Matches Go RestoreVersion.
   */
  @HttpCode(HttpStatus.OK)
  @Post(':version/restore')
  async restoreVersion(
    @Param('articleId') articleId: string,
    @Param('version') version: string,
    @Body() dto?: RestoreHistoryDto,
  ) {
    const v = parseInt(version, 10);
    if (isNaN(v) || v <= 0) {
      throw new BadRequestException('无效的版本号');
    }
    return this.historyService.restoreVersion(articleId, v);
  }
}
