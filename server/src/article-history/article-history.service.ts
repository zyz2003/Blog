import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { ArticleHistoryRepository } from './article-history.repository';
import { DRIZZLE } from '../database/database.module';
import { articleHistories } from '../database/schemas/article-history.schema';
import { users } from '../database/schemas/user.schema';
import { eq, sql } from 'drizzle-orm';
import { generatePublicID, decodePublicID, EntityType } from '../common/utils/sqids.util';
import { toISODateString } from '../common/utils/time.util';
import { ErrorCodes } from '../common/constants/error-codes';

/** Maximum history versions to keep per article. Matches Go maxVersions=10. */
const MAX_VERSIONS = 10;

@Injectable()
export class ArticleHistoryService {
  private readonly logger = new Logger(ArticleHistoryService.name);

  constructor(
    private readonly historyRepo: ArticleHistoryRepository,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  /**
   * Create a history record for an article.
   * Called by ArticleService after Create/Update.
   * Per D-55: version=1 on Create, version increments on Update.
   */
  async createHistory(
    article: any,
    editorDbId: number,
    changeNote?: string,
  ): Promise<void> {
    // Get latest version
    const latestVersion = await this.historyRepo.getLatestVersion(article.id);
    const newVersion = latestVersion + 1;

    // Get editor nickname from user lookup
    const editorNickname = await this.getEditorNickname(editorDbId);

    // Create history record with snapshot fields
    await this.historyRepo.create({
      articleId: article.id,
      version: newVersion,
      title: article.title,
      contentMd: article.contentMd ?? null,
      contentHtml: article.contentHtml ?? null,
      coverUrl: article.coverUrl ?? null,
      topImgUrl: article.topImgUrl ?? null,
      primaryColor: article.primaryColor ?? null,
      summaries: article.summaries ?? null,
      wordCount: article.wordCount ?? 0,
      keywords: article.keywords ?? null,
      editorId: editorDbId,
      editorNickname,
      changeNote: changeNote ?? null,
    });

    // Clean old versions (keep latest MAX_VERSIONS)
    await this.historyRepo.deleteOldVersions(article.id, MAX_VERSIONS);
  }

  /**
   * List history versions for an article (paginated).
   * Matches Go ListHistory.
   */
  async listHistory(
    articlePublicId: string,
    page: number,
    pageSize: number,
  ) {
    let dbID: number;
    try {
      ({ dbID } = decodePublicID(articlePublicId));
    } catch {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }

    const { list, total } = await this.historyRepo.listByArticle(
      dbID,
      page,
      pageSize,
    );

    return {
      list: list.map((h) => this.toHistoryListItem(h, articlePublicId)),
      total,
      page,
      page_size: pageSize,
    };
  }

  /**
   * Get a specific version of an article's history.
   * Matches Go GetVersion.
   */
  async getHistoryVersion(articlePublicId: string, version: number) {
    let dbID: number;
    try {
      ({ dbID } = decodePublicID(articlePublicId));
    } catch {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }

    const history = await this.historyRepo.getByVersion(dbID, version);
    if (!history) {
      throw new NotFoundException(ErrorCodes.ARTICLE_HISTORY_NOT_FOUND);
    }

    return this.toHistoryResponse(history, articlePublicId);
  }

  /**
   * Compare two versions of an article's history.
   * Per D-56: returns both versions for client-side diff.
   * Matches Go CompareVersions.
   */
  async compareVersions(
    articlePublicId: string,
    v1: number,
    v2: number,
  ) {
    if (v1 === v2) {
      throw new BadRequestException('两个版本号不能相同');
    }

    let dbID: number;
    try {
      ({ dbID } = decodePublicID(articlePublicId));
    } catch {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }

    const [version1, version2] = await Promise.all([
      this.historyRepo.getByVersion(dbID, v1),
      this.historyRepo.getByVersion(dbID, v2),
    ]);

    if (!version1) {
      throw new NotFoundException(`版本 ${v1} 不存在`);
    }
    if (!version2) {
      throw new NotFoundException(`版本 ${v2} 不存在`);
    }

    // Per Go model: old_version = smaller version, new_version = larger version
    const oldVersion = v1 < v2 ? version1 : version2;
    const newVersion = v1 < v2 ? version2 : version1;

    return {
      old_version: this.toHistoryResponse(oldVersion, articlePublicId),
      new_version: this.toHistoryResponse(newVersion, articlePublicId),
    };
  }

  /**
   * Restore a version — returns the version data for manual restore.
   * Per Go handler: "获取历史版本成功，请使用返回的数据调用更新文章接口完成恢复"
   * This endpoint does NOT modify the article; caller must use PUT /api/articles/:id.
   */
  async restoreVersion(articlePublicId: string, version: number) {
    let dbID: number;
    try {
      ({ dbID } = decodePublicID(articlePublicId));
    } catch {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }

    const history = await this.historyRepo.getByVersion(dbID, version);
    if (!history) {
      throw new NotFoundException(ErrorCodes.ARTICLE_HISTORY_NOT_FOUND);
    }

    return this.toHistoryResponse(history, articlePublicId);
  }

  /**
   * Get history count for an article.
   * Matches Go GetHistoryCount.
   */
  async getHistoryCount(articlePublicId: string): Promise<{ count: number }> {
    let dbID: number;
    try {
      ({ dbID } = decodePublicID(articlePublicId));
    } catch {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }
    const count = await this.historyRepo.getCount(dbID);
    return { count };
  }

  /**
   * Format a history record as a full response.
   * Matches Go ArticleHistory model JSON tags.
   */
  private toHistoryResponse(history: any, articlePublicId: string) {
    return {
      id: generatePublicID(history.id, EntityType.ArticleHistory),
      article_id: articlePublicId,
      version: history.version,
      title: history.title,
      content_md: history.contentMd ?? null,
      content_html: history.contentHtml ?? null,
      cover_url: history.coverUrl ?? null,
      top_img_url: history.topImgUrl ?? null,
      primary_color: history.primaryColor ?? null,
      summaries: history.summaries ?? null,
      word_count: history.wordCount ?? 0,
      keywords: history.keywords ?? null,
      editor_id: history.editorId,
      editor_nickname: history.editorNickname ?? null,
      change_note: history.changeNote ?? null,
      created_at: toISODateString(history.createdAt),
    };
  }

  /**
   * Format a history record as a list item (no full content).
   * Matches Go ArticleHistoryListItem model JSON tags.
   */
  private toHistoryListItem(history: any, articlePublicId: string) {
    return {
      id: generatePublicID(history.id, EntityType.ArticleHistory),
      version: history.version,
      title: history.title,
      word_count: history.wordCount ?? 0,
      editor_nickname: history.editorNickname ?? null,
      change_note: history.changeNote ?? null,
      created_at: toISODateString(history.createdAt),
    };
  }

  /**
   * Clean up old history versions for ALL articles.
   * Queries all distinct article IDs, calls per-article cleanup.
   * Matches Go CleanupAllOldVersions (article_history_service.go).
   * Returns total number of articles cleaned.
   */
  async cleanupAllOldVersions(): Promise<number> {
    // Get all distinct article IDs that have history records
    const articleIds = await this.db
      .selectDistinct({ articleId: articleHistories.articleId })
      .from(articleHistories);

    let cleanedCount = 0;
    for (const row of articleIds) {
      try {
        await this.historyRepo.deleteOldVersions(row.articleId, MAX_VERSIONS);
        cleanedCount++;
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup old versions for article ${row.articleId}: ${String(error)}`,
        );
        // Continue to next article — don't stop on single failure
      }
    }

    return cleanedCount;
  }

  /**
   * Get editor nickname from user DB ID.
   * Falls back to '未知用户' if user not found, matching Go behavior.
   */
  private async getEditorNickname(editorDbId: number): Promise<string> {
    if (!editorDbId || editorDbId <= 0) return '未知用户';

    try {
      const [user] = await this.db
        .select({ nickname: users.nickname })
        .from(users)
        .where(eq(users.id, editorDbId))
        .limit(1);
      return user?.nickname ?? '未知用户';
    } catch {
      return '未知用户';
    }
  }
}
