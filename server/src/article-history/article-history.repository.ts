import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { articleHistories } from '../database/schemas/article-history.schema';
import { eq, and, desc, sql } from 'drizzle-orm';

@Injectable()
export class ArticleHistoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Get the latest version number for an article.
   * Returns 0 if no histories exist.
   */
  async getLatestVersion(articleDbId: number): Promise<number> {
    const [result] = await this.db
      .select({ maxVersion: sql<number>`COALESCE(MAX(${articleHistories.version}), 0)` })
      .from(articleHistories)
      .where(eq(articleHistories.articleId, articleDbId));
    return result?.maxVersion ?? 0;
  }

  /**
   * Create a new history record.
   */
  async create(data: {
    articleId: number;
    version: number;
    title: string;
    contentMd: string | null;
    contentHtml: string | null;
    coverUrl: string | null;
    topImgUrl: string | null;
    primaryColor: string | null;
    summaries: any;
    wordCount: number;
    keywords: string | null;
    editorId: number;
    editorNickname: string | null;
    changeNote: string | null;
  }) {
    const [history] = await this.db
      .insert(articleHistories)
      .values({
        articleId: data.articleId,
        version: data.version,
        title: data.title,
        contentMd: data.contentMd,
        contentHtml: data.contentHtml,
        coverUrl: data.coverUrl,
        topImgUrl: data.topImgUrl,
        primaryColor: data.primaryColor,
        summaries: data.summaries,
        wordCount: data.wordCount,
        keywords: data.keywords,
        editorId: data.editorId,
        editorNickname: data.editorNickname,
        changeNote: data.changeNote,
      })
      .returning();
    return history;
  }

  /**
   * List histories for an article with pagination, ordered by version DESC.
   * Returns { list, total }.
   */
  async listByArticle(
    articleDbId: number,
    page: number,
    pageSize: number,
  ): Promise<{ list: any[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [countResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(articleHistories)
      .where(eq(articleHistories.articleId, articleDbId));

    const total = countResult?.count ?? 0;

    const list = await this.db
      .select()
      .from(articleHistories)
      .where(eq(articleHistories.articleId, articleDbId))
      .orderBy(desc(articleHistories.version))
      .limit(pageSize)
      .offset(offset);

    return { list, total };
  }

  /**
   * Get total history count for an article.
   */
  async getCount(articleDbId: number): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(articleHistories)
      .where(eq(articleHistories.articleId, articleDbId));
    return result?.count ?? 0;
  }

  /**
   * Get a specific version of an article's history.
   */
  async getByVersion(articleDbId: number, version: number) {
    const [history] = await this.db
      .select()
      .from(articleHistories)
      .where(
        and(
          eq(articleHistories.articleId, articleDbId),
          eq(articleHistories.version, version),
        ),
      );
    return history ?? null;
  }

  /**
   * Delete old versions beyond keepCount.
   * Keeps the latest `keepCount` versions per article.
   * Matches Go maxVersions=10.
   */
  async deleteOldVersions(articleDbId: number, keepCount: number): Promise<void> {
    // Get the total count of versions for this article
    const total = await this.getCount(articleDbId);

    // If total versions <= keepCount, nothing to delete
    if (total <= keepCount) return;

    // Get the version number at the cutoff (the oldest version to keep)
    const versionsToKeep = await this.db
      .select({ version: articleHistories.version })
      .from(articleHistories)
      .where(eq(articleHistories.articleId, articleDbId))
      .orderBy(desc(articleHistories.version))
      .limit(keepCount);

    if (versionsToKeep.length === 0) return;

    // Find the minimum version number among those to keep
    const minKeepVersion = Math.min(...versionsToKeep.map((v) => v.version));

    // Delete all versions with version number less than the minimum keep version
    await this.db
      .delete(articleHistories)
      .where(
        and(
          eq(articleHistories.articleId, articleDbId),
          sql`${articleHistories.version} < ${minKeepVersion}`,
        ),
      );
  }
}
