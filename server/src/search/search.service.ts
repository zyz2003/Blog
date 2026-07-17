import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { SettingsService } from '../settings/settings.service';
import { articles } from '../database/schemas/article.schema';
import { articlePostCategories } from '../database/schemas/article-post-category-pivot.schema';
import { articlePostTags } from '../database/schemas/article-post-tag-pivot.schema';
import { postCategories } from '../database/schemas/post-category.schema';
import { postTags } from '../database/schemas/post-tag.schema';
import { users } from '../database/schemas/user.schema';
import { generatePublicID, EntityType } from '../common/utils/sqids.util';
import { toISODateString } from '../common/utils/time.util';
import { eq, isNull, and, inArray, sql, desc } from 'drizzle-orm';

/**
 * SearchService implements FTS5 full-text search for articles.
 *
 * Per D-145: Uses SQLite FTS5 with contentless mode and unicode61 tokenizer.
 * Per D-147: bm25 ranking with title(10.0)/content(1.0)/keywords(5.0) weights.
 * Per D-150: FTS5 index rebuilt on startup from all published articles.
 * Per D-151: Exposes indexArticle/deleteArticle for ArticleService hooks.
 * Per D-152: Snippet extraction strips HTML and truncates to 150 chars.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly settingsService: SettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureFts5Table();
    } catch (error) {
      this.logger.warn('FTS5 table initialization skipped (may not be available in test environment)');
    }
  }

  /**
   * Create FTS5 virtual table and rebuild indexes.
   * Per D-145: contentless mode with unicode61 tokenizer.
   * Per D-146: unicode61 with tokens "0" for basic CJK support.
   */
  async ensureFts5Table(): Promise<void> {
    this.logger.log('Creating FTS5 virtual table articles_fts...');

    // Create FTS5 virtual table with contentless mode
    await this.db.run(
      sql`CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
        title,
        content,
        keywords,
        content='',
        tokenize='unicode61 tokens 0'
      )`,
    );

    // Drop existing index data before rebuild for clean state
    await this.db.run(sql`DELETE FROM articles_fts`);

    // Rebuild indexes from all published articles
    await this.rebuildAllIndexes();

    this.logger.log('FTS5 virtual table created and indexes rebuilt');
  }

  /**
   * Rebuild FTS5 indexes from all published articles.
   * Per D-150: Full rebuild on startup ensures index consistency.
   */
  async rebuildAllIndexes(): Promise<void> {
    // Fetch all published, non-deleted articles
    const publishedArticles = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        contentHtml: articles.contentHtml,
        keywords: articles.keywords,
      })
      .from(articles)
      .where(
        and(
          eq(articles.status, 'PUBLISHED'),
          isNull(articles.deletedAt),
        ),
      );

    this.logger.log(`Rebuilding FTS5 index for ${publishedArticles.length} articles...`);

    // Insert each article into FTS5
    for (const article of publishedArticles) {
      const plainContent = this.stripHtml(article.contentHtml || '');
      await this.db.run(
        sql`INSERT INTO articles_fts(rowid, title, content, keywords) VALUES (${article.id}, ${article.title}, ${plainContent}, ${article.keywords || ''})`,
      );
    }

    this.logger.log(`FTS5 index rebuilt with ${publishedArticles.length} articles`);
  }

  /**
   * Index a single article into FTS5.
   * Per D-151: Called from ArticleService on Create/Update.
   */
  async indexArticle(article: {
    id: number;
    title: string;
    contentHtml: string;
    keywords: string | null;
  }): Promise<void> {
    const plainContent = this.stripHtml(article.contentHtml || '');
    await this.db.run(
      sql`INSERT INTO articles_fts(rowid, title, content, keywords) VALUES (${article.id}, ${article.title}, ${plainContent}, ${article.keywords || ''})`,
    );
  }

  /**
   * Delete an article from FTS5 by database ID (rowid).
   * Per D-151: Called from ArticleService on Delete/Update.
   */
  async deleteArticle(articleDbId: number): Promise<void> {
    await this.db.run(
      sql`DELETE FROM articles_fts WHERE rowid = ${articleDbId}`,
    );
  }

  /**
   * Search articles using FTS5 with bm25 weighted ranking.
   * Per D-147: bm25(articles_fts, 10.0, 1.0, 5.0) for title/content/keywords.
   * Per D-148: Returns SearchResult matching Go model.SearchResult format.
   */
  async search(
    query: string,
    page: number,
    size: number,
  ): Promise<{
    pagination: {
      total: number;
      page: number;
      size: number;
      totalPages: number;
    };
    hits: any[];
  }> {
    // Empty query returns empty results (matches Go SimpleSearcher)
    if (!query || !query.trim()) {
      return {
        pagination: { total: 0, page, size, totalPages: 0 },
        hits: [],
      };
    }

    const offset = (page - 1) * size;

    try {
      // Get total matching count
      const countResult = await this.db.get(
        sql`SELECT count(*) as total FROM articles_fts WHERE articles_fts MATCH ${query}`,
      );
      const total = countResult?.total ?? 0;

      if (total === 0) {
        return {
          pagination: { total: 0, page, size, totalPages: 0 },
          hits: [],
        };
      }

      // Search with bm25 ranking
      const ftsResults = await this.db.all(
        sql`SELECT rowid as id, bm25(articles_fts, 10.0, 1.0, 5.0) AS rank
            FROM articles_fts
            WHERE articles_fts MATCH ${query}
            ORDER BY rank
            LIMIT ${size} OFFSET ${offset}`,
      );

      if (!ftsResults || ftsResults.length === 0) {
        return {
          pagination: { total, page, size, totalPages: Math.ceil(total / size) },
          hits: [],
        };
      }

      // Get article DB IDs from FTS5 results
      const articleDbIds = ftsResults.map((r: any) => r.id);

      // Fetch full article data with relations using Drizzle
      const articleRows = await this.db
        .select({
          id: articles.id,
          title: articles.title,
          contentHtml: articles.contentHtml,
          coverUrl: articles.coverUrl,
          abbrlink: articles.abbrlink,
          viewCount: articles.viewCount,
          wordCount: articles.wordCount,
          readingTime: articles.readingTime,
          isDoc: articles.isDoc,
          docSeriesId: articles.docSeriesId,
          keywords: articles.keywords,
          ownerId: articles.ownerId,
          copyrightAuthor: articles.copyrightAuthor,
          createdAt: articles.createdAt,
        })
        .from(articles)
        .where(inArray(articles.id, articleDbIds));

      // Build a map for quick lookup
      const articleMap = new Map<number, any>();
      for (const row of articleRows) {
        articleMap.set(row.id, row);
      }

      // Fetch categories and tags for all matched articles
      const categoriesMap = new Map<number, string>();
      const tagsMap = new Map<number, string[]>();

      if (articleDbIds.length > 0) {
        // Fetch categories
        const catRows = await this.db
          .select({
            articleId: articlePostCategories.articleId,
            name: postCategories.name,
          })
          .from(articlePostCategories)
          .innerJoin(
            postCategories,
            eq(articlePostCategories.postCategoryId, postCategories.id),
          )
          .where(
            and(
              inArray(articlePostCategories.articleId, articleDbIds),
              isNull(postCategories.deletedAt),
            ),
          );

        for (const row of catRows) {
          if (!categoriesMap.has(row.articleId)) {
            categoriesMap.set(row.articleId, row.name);
          }
        }

        // Fetch tags
        const tagRows = await this.db
          .select({
            articleId: articlePostTags.articleId,
            name: postTags.name,
          })
          .from(articlePostTags)
          .innerJoin(
            postTags,
            eq(articlePostTags.postTagId, postTags.id),
          )
          .where(
            and(
              inArray(articlePostTags.articleId, articleDbIds),
              isNull(postTags.deletedAt),
            ),
          );

        for (const row of tagRows) {
          if (!tagsMap.has(row.articleId)) {
            tagsMap.set(row.articleId, []);
          }
          tagsMap.get(row.articleId)!.push(row.name);
        }
      }

      // Build SearchHit objects in FTS5 rank order
      const hits = ftsResults.map((ftsRow: any) => {
        const article = articleMap.get(ftsRow.id);
        if (!article) return null;

        // Author: copyrightAuthor first, then site owner name from settings
        const author = article.copyrightAuthor ||
          this.settingsService.get('FRONT_DESK_SITE_OWNER_NAME') || '';

        // Doc series ID: encode via Sqids if non-null
        let docSeriesId = '';
        if (article.docSeriesId) {
          try {
            docSeriesId = generatePublicID(article.docSeriesId, EntityType.DocSeries);
          } catch {
            docSeriesId = '';
          }
        }

        return {
          id: generatePublicID(article.id, EntityType.Article),
          type: '',
          url: '',
          title: article.title,
          snippet: this.extractSnippet(article.contentHtml || ''),
          author,
          category: categoriesMap.get(article.id) || '',
          tags: tagsMap.get(article.id) || [],
          publish_date: toISODateString(article.createdAt),
          cover_url: article.coverUrl || '',
          abbrlink: article.abbrlink || '',
          view_count: article.viewCount ?? 0,
          word_count: article.wordCount ?? 0,
          reading_time: article.readingTime ?? 0,
          is_doc: article.isDoc ?? false,
          doc_series_id: docSeriesId,
        };
      }).filter((h: any) => h !== null);

      // Normalize hits: fill type and url per Go search_service.go
      const normalizedHits = this.normalizeSearchHits(hits);

      const totalPages = Math.ceil(total / size);

      return {
        pagination: { total, page, size, totalPages },
        hits: normalizedHits,
      };
    } catch (error) {
      // FTS5 table may not exist (e.g., in test environments or before migration)
      this.logger.warn('Search failed, FTS5 table may not exist');
      return {
        pagination: { total: 0, page, size, totalPages: 0 },
        hits: [],
      };
    }
  }

  /**
   * Extract snippet from HTML content.
   * Per D-152: Strip HTML tags, truncate to 150 chars with ellipsis.
   * Matches Go SimpleSearcher.articleToSearchHit snippet logic.
   */
  extractSnippet(contentHtml: string, maxLength = 150): string {
    // Strip HTML tags (same as Go's reHTMLTags.ReplaceAllString)
    const plainText = contentHtml.replace(/<[^>]*>/g, ' ').trim();
    // Collapse multiple spaces
    const collapsed = plainText.replace(/\s+/g, ' ');

    // Proper Unicode handling using spread for rune-level slicing
    const runes = [...collapsed];
    if (runes.length > maxLength) {
      return runes.slice(0, maxLength).join('') + '...';
    }
    return collapsed;
  }

  /**
   * Normalize search hits: fill type and url fields.
   * Per Go search_service.go lines 86-109:
   * - If type already set, skip
   * - If isDoc=true, type="doc" and url="/doc/{id}"
   * - Otherwise type="post" and url="/posts/{abbrlink}" (fallback to id)
   */
  normalizeSearchHits(hits: any[]): any[] {
    for (const hit of hits) {
      if (!hit || hit.type) {
        continue;
      }

      if (hit.is_doc) {
        hit.type = 'doc';
        if (!hit.url && hit.id) {
          hit.url = '/doc/' + hit.id;
        }
        continue;
      }

      hit.type = 'post';
      if (!hit.url) {
        const targetId = hit.abbrlink || hit.id;
        if (targetId) {
          hit.url = '/posts/' + targetId;
        }
      }
    }
    return hits;
  }

  /**
   * Strip HTML tags from content for FTS5 indexing.
   * Prevents HTML tag names from polluting search results.
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
