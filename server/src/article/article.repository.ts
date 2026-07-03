import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { articles } from '../database/schemas/article.schema';
import { articlePostCategories } from '../database/schemas/article-post-category-pivot.schema';
import { articlePostTags } from '../database/schemas/article-post-tag-pivot.schema';
import { postCategories } from '../database/schemas/post-category.schema';
import { postTags } from '../database/schemas/post-tag.schema';
import { users } from '../database/schemas/user.schema';
import { isNull, eq, and, desc, asc, like, sql, inArray } from 'drizzle-orm';

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
}
