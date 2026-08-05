import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { articles } from '../database/schemas/article.schema';
import { articlePostCategories } from '../database/schemas/article-post-category-pivot.schema';
import { articlePostTags } from '../database/schemas/article-post-tag-pivot.schema';
import { postCategories } from '../database/schemas/post-category.schema';
import { postTags } from '../database/schemas/post-tag.schema';
import { users } from '../database/schemas/user.schema';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
import { isNull, eq, and, desc, asc, like, sql, inArray, gt, lt, isNotNull, lte } from 'drizzle-orm';

/**
 * Calculate word count and reading time from Markdown content.
 * Matches Go calculatePostStats (service.go lines 526-543).
 */
export function calculatePostStats(content: string): {
  wordCount: number;
  readingTime: number;
} {
  if (!content) {
    return { wordCount: 0, readingTime: 0 };
  }

  // Count Chinese characters
  const chineseCharCount = (content.match(/[一-鿿]/g) || []).length;

  // Count English words (split by whitespace, filter empty)
  const englishWordCount = content
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const wordCount = chineseCharCount + englishWordCount;

  let readingTime = 0;
  if (wordCount > 0) {
    readingTime = Math.ceil(wordCount / 200);
  }
  if (readingTime === 0 && wordCount > 0) {
    readingTime = 1;
  }

  return { wordCount, readingTime };
}

/**
 * Compute added/removed IDs for count sync.
 * Matches Go diffIDs (service.go).
 */
export function diffIDs(
  oldIds: number[],
  newIds: number[],
): { inc: number[]; dec: number[] } {
  const oldSet = new Set(oldIds);
  const newSet = new Set(newIds);

  const inc = newIds.filter((id) => !oldSet.has(id));
  const dec = oldIds.filter((id) => !newSet.has(id));

  return { inc, dec };
}

@Injectable()
export class ArticleRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findById(dbId: number) {
    const [article] = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.id, dbId), isNull(articles.deletedAt)));
    return article ?? null;
  }

  async findByIdWithRelations(dbId: number) {
    // Fetch the article
    const article = await this.findById(dbId);
    if (!article) return null;

    // Fetch associated categories and tags
    const [categories, tags, owner] = await Promise.all([
      this.getArticleCategories(dbId),
      this.getArticleTags(dbId),
      this.getArticleOwner(article.ownerId),
    ]);

    return { ...article, postCategories: categories, postTags: tags, owner };
  }

  async list(options: {
    page: number;
    pageSize: number;
    query?: string;
    status?: string;
    categoryName?: string;
    tagName?: string;
  }) {
    const { page, pageSize, query, status, categoryName, tagName } = options;
    const conditions = [isNull(articles.deletedAt)];

    if (status) {
      conditions.push(eq(articles.status, status));
    }
    if (query) {
      conditions.push(like(articles.title, `%${query}%`));
    }

    // When filtering by category/tag name, we need to join
    let articleIds: number[] | null = null;

    if (categoryName) {
      const matched = await this.db
        .select({ articleId: articlePostCategories.articleId })
        .from(articlePostCategories)
        .innerJoin(
          postCategories,
          eq(articlePostCategories.postCategoryId, postCategories.id),
        )
        .where(
          and(
            eq(postCategories.name, categoryName),
            isNull(postCategories.deletedAt),
          ),
        );
      articleIds = matched.map((r: any) => r.articleId);
      if (articleIds.length === 0) {
        return { list: [], total: 0 };
      }
    }

    if (tagName) {
      const matched = await this.db
        .select({ articleId: articlePostTags.articleId })
        .from(articlePostTags)
        .innerJoin(postTags, eq(articlePostTags.postTagId, postTags.id))
        .where(
          and(eq(postTags.name, tagName), isNull(postTags.deletedAt)),
        );
      const tagArticleIds = matched.map((r: any) => r.articleId);
      if (articleIds !== null) {
        // Intersection of both filters
        articleIds = articleIds.filter((id) => tagArticleIds.includes(id));
      } else {
        articleIds = tagArticleIds;
      }
      if (articleIds.length === 0) {
        return { list: [], total: 0 };
      }
    }

    if (articleIds !== null) {
      conditions.push(inArray(articles.id, articleIds));
    }

    const whereClause = and(...conditions);

    // Count
    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(articles)
      .where(whereClause);

    // Fetch paginated
    const list = await this.db
      .select()
      .from(articles)
      .where(whereClause)
      .orderBy(desc(articles.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Fetch relations for each article
    const listWithRelations = await Promise.all(
      list.map(async (article: any) => {
        const [categories, tags, owner] = await Promise.all([
          this.getArticleCategories(article.id),
          this.getArticleTags(article.id),
          this.getArticleOwner(article.ownerId),
        ]);
        return { ...article, postCategories: categories, postTags: tags, owner };
      }),
    );

    return { list: listWithRelations, total };
  }

  async createWithAssociations(
    data: any,
    categoryDbIds: number[],
    tagDbIds: number[],
  ) {
    // Insert article
    const [article] = await this.db
      .insert(articles)
      .values(data)
      .returning();

    // Insert junction table entries
    if (categoryDbIds.length > 0) {
      await this.db.insert(articlePostCategories).values(
        categoryDbIds.map((catId) => ({
          articleId: article.id,
          postCategoryId: catId,
        })),
      );
    }

    if (tagDbIds.length > 0) {
      await this.db.insert(articlePostTags).values(
        tagDbIds.map((tagId) => ({
          articleId: article.id,
          postTagId: tagId,
        })),
      );
    }

    return article;
  }

  async updateWithAssociations(
    dbId: number,
    data: any,
    categoryDbIds: number[] | null,
    tagDbIds: number[] | null,
  ) {
    // Update article
    const [article] = await this.db
      .update(articles)
      .set(data)
      .where(eq(articles.id, dbId))
      .returning();

    // Update junction tables if IDs provided
    if (categoryDbIds !== null) {
      await this.db
        .delete(articlePostCategories)
        .where(eq(articlePostCategories.articleId, dbId));
      if (categoryDbIds.length > 0) {
        await this.db.insert(articlePostCategories).values(
          categoryDbIds.map((catId) => ({
            articleId: dbId,
            postCategoryId: catId,
          })),
        );
      }
    }

    if (tagDbIds !== null) {
      await this.db
        .delete(articlePostTags)
        .where(eq(articlePostTags.articleId, dbId));
      if (tagDbIds.length > 0) {
        await this.db.insert(articlePostTags).values(
          tagDbIds.map((tagId) => ({
            articleId: dbId,
            postTagId: tagId,
          })),
        );
      }
    }

    return article;
  }

  async softDelete(dbId: number) {
    const [article] = await this.db
      .update(articles)
      .set({ deletedAt: new Date() })
      .where(eq(articles.id, dbId))
      .returning();
    return article ?? null;
  }

  async getArticleCategories(dbId: number) {
    return this.db
      .select({
        id: postCategories.id,
        createdAt: postCategories.createdAt,
        updatedAt: postCategories.updatedAt,
        name: postCategories.name,
        slug: postCategories.slug,
        description: postCategories.description,
        count: postCategories.count,
        isSeries: postCategories.isSeries,
      })
      .from(articlePostCategories)
      .innerJoin(
        postCategories,
        eq(articlePostCategories.postCategoryId, postCategories.id),
      )
      .where(
        and(
          eq(articlePostCategories.articleId, dbId),
          isNull(postCategories.deletedAt),
        ),
      );
  }

  async getArticleTags(dbId: number) {
    return this.db
      .select({
        id: postTags.id,
        createdAt: postTags.createdAt,
        updatedAt: postTags.updatedAt,
        name: postTags.name,
        slug: postTags.slug,
        count: postTags.count,
      })
      .from(articlePostTags)
      .innerJoin(
        postTags,
        eq(articlePostTags.postTagId, postTags.id),
      )
      .where(
        and(
          eq(articlePostTags.articleId, dbId),
          isNull(postTags.deletedAt),
        ),
      );
  }

  async getArticleOwner(ownerId: number) {
    if (!ownerId) return null;
    const [user] = await this.db
      .select({
        id: users.id,
        nickname: users.nickname,
        avatar: users.avatar,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, ownerId));
    return user ?? null;
  }

  async existsByAbbrlink(abbrlink: string, excludeDbId?: number) {
    const conditions = [eq(articles.abbrlink, abbrlink)];
    if (excludeDbId) {
      conditions.push(sql`${articles.id} != ${excludeDbId}`);
    }
    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(articles)
      .where(and(...conditions));
    return (result?.count ?? 0) > 0;
  }

  // ─── Public query methods ────────────────────────────────────────
  // All filter: status=PUBLISHED AND isTakedown=false AND deletedAt IS NULL

  /**
   * Base conditions for all public queries.
   */
  private publicConditions() {
    return [
      eq(articles.status, 'PUBLISHED'),
      eq(articles.isTakedown, false),
      isNull(articles.deletedAt),
    ];
  }

  /**
   * List published articles with pagination and optional category/tag/year/month filters.
   * Matches Go ListPublic (service.go lines 1779-1825).
   */
  async listPublic(options: {
    page: number;
    pageSize: number;
    categoryName?: string;
    tagName?: string;
    year?: number;
    month?: number;
  }) {
    const { page, pageSize, categoryName, tagName, year, month } = options;
    const conditions = [...this.publicConditions()];

    // Filter by category name via junction table
    let articleIds: number[] | null = null;

    if (categoryName) {
      const matched = await this.db
        .select({ articleId: articlePostCategories.articleId })
        .from(articlePostCategories)
        .innerJoin(
          postCategories,
          eq(articlePostCategories.postCategoryId, postCategories.id),
        )
        .where(
          and(
            eq(postCategories.name, categoryName),
            isNull(postCategories.deletedAt),
          ),
        );
      articleIds = matched.map((r: any) => r.articleId);
      if (articleIds.length === 0) {
        return { list: [], total: 0 };
      }
    }

    // Filter by tag name via junction table
    if (tagName) {
      const matched = await this.db
        .select({ articleId: articlePostTags.articleId })
        .from(articlePostTags)
        .innerJoin(
          postTags,
          eq(articlePostTags.postTagId, postTags.id),
        )
        .where(
          and(eq(postTags.name, tagName), isNull(postTags.deletedAt)),
        );
      const tagArticleIds = matched.map((r: any) => r.articleId);
      if (articleIds !== null) {
        articleIds = articleIds.filter((id) => tagArticleIds.includes(id));
      } else {
        articleIds = tagArticleIds;
      }
      if (articleIds.length === 0) {
        return { list: [], total: 0 };
      }
    }

    if (articleIds !== null) {
      conditions.push(inArray(articles.id, articleIds));
    }

    // Filter by year
    if (year) {
      conditions.push(
        sql`cast(strftime('%Y', ${articles.createdAt}, 'unixepoch', '+8 hours') as integer) = ${year}`,
      );
    }

    // Filter by month
    if (month) {
      conditions.push(
        sql`cast(strftime('%m', ${articles.createdAt}, 'unixepoch', '+8 hours') as integer) = ${month}`,
      );
    }

    const whereClause = and(...conditions);

    // Count
    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(articles)
      .where(whereClause);

    // Fetch paginated — order by pinSort ASC, createdAt DESC (matches Go sort)
    const list = await this.db
      .select()
      .from(articles)
      .where(whereClause)
      .orderBy(asc(articles.pinSort), desc(articles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Fetch relations for each article
    const listWithRelations = await Promise.all(
      list.map(async (article: any) => {
        const [categories, tags, owner] = await Promise.all([
          this.getArticleCategories(article.id),
          this.getArticleTags(article.id),
          this.getArticleOwner(article.ownerId),
        ]);
        return { ...article, postCategories: categories, postTags: tags, owner };
      }),
    );

    return { list: listWithRelations, total };
  }

  /**
   * List home-visible articles (showOnHome=true).
   * No pagination per D-51 — returns all home-visible articles.
   * Matches Go ListHome (service.go lines 1762-1776).
   */
  async listHome() {
    const conditions = [
      ...this.publicConditions(),
      eq(articles.showOnHome, true),
    ];

    const list = await this.db
      .select()
      .from(articles)
      .where(and(...conditions))
      .orderBy(asc(articles.pinSort), asc(articles.homeSort), desc(articles.createdAt));

    // Fetch relations
    const listWithRelations = await Promise.all(
      list.map(async (article: any) => {
        const [categories, tags, owner] = await Promise.all([
          this.getArticleCategories(article.id),
          this.getArticleTags(article.id),
          this.getArticleOwner(article.ownerId),
        ]);
        return { ...article, postCategories: categories, postTags: tags, owner };
      }),
    );

    return listWithRelations;
  }

  /**
   * Get a single random published article.
   * Matches Go GetRandom (service.go lines 1751-1759).
   */
  async getRandom() {
    const [article] = await this.db
      .select()
      .from(articles)
      .where(and(...this.publicConditions()))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (!article) return null;

    // Fetch relations
    const [categories, tags, owner] = await Promise.all([
      this.getArticleCategories(article.id),
      this.getArticleTags(article.id),
      this.getArticleOwner(article.ownerId),
    ]);

    return { ...article, postCategories: categories, postTags: tags, owner };
  }

  /**
   * List archive summary: year-month grouped article counts.
   * Returns raw { year, month, count } rows for service to format.
   * Matches Go GetArchiveSummary / ListArchives (service.go lines 1828-1845).
   */
  async listArchives() {
    const rows = await this.db
      .select({
        year: sql<number>`cast(strftime('%Y', ${articles.createdAt}, 'unixepoch', '+8 hours') as integer)`.as('year'),
        month: sql<number>`cast(strftime('%m', ${articles.createdAt}, 'unixepoch', '+8 hours') as integer)`.as('month'),
        count: sql<number>`count(*)`.as('count'),
      })
      .from(articles)
      .where(and(...this.publicConditions()))
      .groupBy(
        sql`strftime('%Y', ${articles.createdAt}, 'unixepoch', '+8 hours')`,
        sql`strftime('%m', ${articles.createdAt}, 'unixepoch', '+8 hours')`,
      )
      .orderBy(
        sql`strftime('%Y', ${articles.createdAt}, 'unixepoch', '+8 hours') DESC`,
        sql`strftime('%m', ${articles.createdAt}, 'unixepoch', '+8 hours') DESC`,
      );

    return rows;
  }

  /**
   * Get article statistics: total posts, total words, avg words, total views,
   * per-category counts, per-tag counts, top viewed posts, publish trend.
   * Matches Go GetArticleStatistics (service.go lines 428-523).
   */
  async getArticleStatistics() {
    // 1. Basic stats: total posts, total words, total views
    const [siteStats] = await this.db
      .select({
        totalPosts: sql<number>`count(*)`.as('totalPosts'),
        totalWords: sql<number>`coalesce(sum(${articles.wordCount}), 0)`.as('totalWords'),
        totalViews: sql<number>`coalesce(sum(${articles.viewCount}), 0)`.as('totalViews'),
      })
      .from(articles)
      .where(and(...this.publicConditions()));

    const avgWords =
      siteStats?.totalPosts > 0
        ? Math.floor(siteStats.totalWords / siteStats.totalPosts)
        : 0;

    // 2. Per-category article counts
    const categoryStats = await this.db
      .select({
        name: postCategories.name,
        count: postCategories.count,
      })
      .from(postCategories)
      .where(isNull(postCategories.deletedAt));

    // 3. Per-tag article counts
    const tagStats = await this.db
      .select({
        name: postTags.name,
        count: postTags.count,
      })
      .from(postTags)
      .where(isNull(postTags.deletedAt));

    // 4. Top 10 viewed articles
    const topViewedPosts = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        viewCount: articles.viewCount,
        coverUrl: articles.coverUrl,
      })
      .from(articles)
      .where(and(...this.publicConditions()))
      .orderBy(desc(articles.viewCount))
      .limit(10);

    // 5. Publish trend: group by month (last 12 months)
    const publishTrend = await this.db
      .select({
        month: sql<string>`strftime('%Y-%m', ${articles.createdAt}, 'unixepoch', '+8 hours')`.as('month'),
        count: sql<number>`count(*)`.as('count'),
      })
      .from(articles)
      .where(and(...this.publicConditions()))
      .groupBy(
        sql`strftime('%Y-%m', ${articles.createdAt}, 'unixepoch', '+8 hours')`,
      )
      .orderBy(
        sql`strftime('%Y-%m', ${articles.createdAt}, 'unixepoch', '+8 hours') DESC`,
      )
      .limit(12);

    return {
      totalPosts: siteStats?.totalPosts ?? 0,
      totalWords: siteStats?.totalWords ?? 0,
      avgWords,
      totalViews: siteStats?.totalViews ?? 0,
      categoryStats: categoryStats.filter((c: any) => c.count > 0),
      tagStats: tagStats.filter((t: any) => t.count > 0),
      topViewedPosts,
      publishTrend,
    };
  }

  /**
   * Find article by abbrlink first, then try Sqids decode.
   * Matches Go GetBySlugOrID (repo layer).
   */
  async findByAbbrlinkOrId(slugOrId: string) {
    // First try: find by abbrlink
    const [byAbbrlink] = await this.db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.abbrlink, slugOrId),
          ...this.publicConditions(),
        ),
      );

    if (byAbbrlink) {
      return this.enrichWithRelations(byAbbrlink);
    }

    // Second try: decode as Sqids public ID
    try {
      const { dbID, entityType } = decodePublicID(slugOrId);
      if (entityType !== EntityType.Article) return null;

      const [byId] = await this.db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.id, dbID),
            ...this.publicConditions(),
          ),
        );

      if (byId) {
        return this.enrichWithRelations(byId);
      }
    } catch {
      // Not a valid Sqids ID
    }

    return null;
  }

  /**
   * Find chronologically adjacent published articles for prev/next navigation.
   * Returns raw chronological neighbors; service handles the Go swap.
   * - chronoNewer: createdAt > currentCreatedAt, order ASC LIMIT 1
   * - chronoOlder: createdAt < currentCreatedAt, order DESC LIMIT 1
   */
  async findPrevNextArticles(dbId: number, createdAt: Date) {
    // Chronologically newer article (created after current)
    const [chronoNewer] = await this.db
      .select()
      .from(articles)
      .where(
        and(
          ...this.publicConditions(),
          gt(articles.createdAt, createdAt),
        ),
      )
      .orderBy(asc(articles.createdAt))
      .limit(1);

    // Chronologically older article (created before current)
    const [chronoOlder] = await this.db
      .select()
      .from(articles)
      .where(
        and(
          ...this.publicConditions(),
          lt(articles.createdAt, createdAt),
        ),
      )
      .orderBy(desc(articles.createdAt))
      .limit(1);

    // Enrich with relations if found
    const newer = chronoNewer ? await this.enrichWithRelations(chronoNewer) : null;
    const older = chronoOlder ? await this.enrichWithRelations(chronoOlder) : null;

    return { chronoNewer: newer, chronoOlder: older };
  }

  /**
   * Increment view count atomically.
   * Per D-65: simple DB increment for Phase 03.
   */
  async incrementViewCount(dbId: number) {
    await this.db
      .update(articles)
      .set({ viewCount: sql`${articles.viewCount} + 1` })
      .where(eq(articles.id, dbId));
  }

  /**
   * Batch update view counts by incrementing.
   * Accepts Map of dbId -> increment count.
   * Matches Go UpdateViewCounts (article_repo.go).
   */
  async batchUpdateViewCounts(updates: Map<number, number>): Promise<void> {
    if (updates.size === 0) return;

    // better-sqlite3 is synchronous — db.transaction() requires a sync callback.
    this.db.transaction((tx: any) => {
      for (const [dbId, increment] of updates) {
        tx
          .update(articles)
          .set({ viewCount: sql`${articles.viewCount} + ${increment}` })
          .where(eq(articles.id, dbId))
          .run();
      }
    });
  }

  /**
   * Find articles that are scheduled to be published.
   * Matches Go FindScheduledArticlesToPublish — only SCHEDULED status, not DRAFT.
   * Go: article.StatusEQ(article.StatusSCHEDULED) AND ScheduledAtLTE(now) AND ScheduledAtNotNil()
   */
  async findScheduledArticlesToPublish(): Promise<any[]> {
    return this.db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.status, 'SCHEDULED'),
          isNotNull(articles.scheduledAt),
          lte(articles.scheduledAt, new Date()),
          isNull(articles.deletedAt),
        ),
      );
  }

  /**
   * Publish a scheduled article by setting status to PUBLISHED.
   * Matches Go PublishScheduledArticle — also sets created_at = scheduled_at
   * so the article's display timestamp matches the user's intended publish time.
   * Go: updater.SetCreatedAt(*articleEntity.ScheduledAt)
   */
  async publishArticle(dbId: number): Promise<void> {
    // First get the article to read scheduledAt for created_at update
    const [article] = await this.db
      .select()
      .from(articles)
      .where(eq(articles.id, dbId));

    const updateData: any = {
      status: 'PUBLISHED',
      scheduledAt: null,
      updatedAt: new Date(),
    };

    // Set createdAt to scheduledAt so display time matches user intent
    // Matches Go: if articleEntity.ScheduledAt != nil { updater.SetCreatedAt(*articleEntity.ScheduledAt) }
    if (article?.scheduledAt) {
      updateData.createdAt = article.scheduledAt;
    }

    await this.db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, dbId));
  }

  /**
   * Helper: enrich an article row with categories, tags, and owner.
   */
  private async enrichWithRelations(article: any) {
    const [categories, tags, owner] = await Promise.all([
      this.getArticleCategories(article.id),
      this.getArticleTags(article.id),
      this.getArticleOwner(article.ownerId),
    ]);
    return { ...article, postCategories: categories, postTags: tags, owner };
  }
}
