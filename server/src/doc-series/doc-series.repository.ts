import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { docSeries } from '../database/schemas/doc-series.schema';
import { articles } from '../database/schemas/article.schema';
import { decodePublicID, generatePublicID, EntityType } from '../common/utils/sqids.util';
import { toISODateString } from '../common/utils/time.util';
import { isNull, eq, and, desc, asc, sql } from 'drizzle-orm';

export interface CreateDocSeriesParams {
  name: string;
  description?: string;
  coverUrl?: string;
  sort?: number;
}

export interface UpdateDocSeriesParams {
  name?: string;
  description?: string;
  coverUrl?: string;
  sort?: number;
}

export interface ListDocSeriesOptions {
  page: number;
  pageSize: number;
}

@Injectable()
export class DocSeriesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Create a new doc series. Returns the record with Sqids-encoded public ID.
   * DocSeries uses Sqids-encoded IDs per D-183 (EntityType.DocSeries = 12).
   */
  async create(params: CreateDocSeriesParams) {
    const [series] = await this.db
      .insert(docSeries)
      .values({
        name: params.name,
        description: params.description ?? null,
        coverUrl: params.coverUrl ?? null,
        sort: params.sort ?? 0,
      })
      .returning();

    return {
      ...series,
      id: generatePublicID(series.id, EntityType.DocSeries),
    };
  }

  /**
   * Update doc series by public ID (Sqids-encoded).
   * Decodes Sqids → dbID, then partial updates non-nil fields.
   */
  async update(publicID: string, params: UpdateDocSeriesParams) {
    const { dbID } = decodePublicID(publicID);

    // Build update data with only provided fields
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.coverUrl !== undefined) updateData.coverUrl = params.coverUrl;
    if (params.sort !== undefined) updateData.sort = params.sort;

    const [series] = await this.db
      .update(docSeries)
      .set(updateData)
      .where(eq(docSeries.id, dbID))
      .returning();

    if (!series) return null;

    return {
      ...series,
      id: generatePublicID(series.id, EntityType.DocSeries),
    };
  }

  /**
   * Hard delete doc series by public ID (Sqids-encoded).
   * DocSeries has no soft delete per Go schema.
   */
  async delete(publicID: string) {
    const { dbID } = decodePublicID(publicID);
    await this.db
      .delete(docSeries)
      .where(eq(docSeries.id, dbID));
  }

  /**
   * List doc series with pagination.
   * ORDER BY sort ASC, created_at DESC (matches Go ListDocSeries).
   * Returns items with Sqids-encoded IDs.
   */
  async list(opts: ListDocSeriesOptions) {
    const { page, pageSize } = opts;

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(docSeries);

    const items = await this.db
      .select()
      .from(docSeries)
      .orderBy(asc(docSeries.sort), desc(docSeries.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Encode IDs with Sqids
    const encodedItems = items.map((item: any) => ({
      ...item,
      id: generatePublicID(item.id, EntityType.DocSeries),
    }));

    return { items: encodedItems, total };
  }

  /**
   * Get doc series by public ID (Sqids-encoded).
   * Returns item with Sqids-encoded ID.
   */
  async getById(publicID: string) {
    const { dbID } = decodePublicID(publicID);

    const [series] = await this.db
      .select()
      .from(docSeries)
      .where(eq(docSeries.id, dbID));

    if (!series) return null;

    return {
      ...series,
      id: generatePublicID(series.id, EntityType.DocSeries),
    };
  }

  /**
   * Get doc series by public ID with associated articles.
   * Matches Go GetByIDWithArticles per D-193.
   * Queries articles WHERE doc_series_id=dbID AND is_doc=true
   *   AND status='PUBLISHED' AND deleted_at IS NULL
   * ORDER BY doc_sort ASC, created_at ASC.
   * Returns DocSeriesWithArticles structure.
   */
  async getByIdWithArticles(publicID: string) {
    const { dbID } = decodePublicID(publicID);

    const [series] = await this.db
      .select()
      .from(docSeries)
      .where(eq(docSeries.id, dbID));

    if (!series) return null;

    // Query associated articles
    const articleRows = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        abbrlink: articles.abbrlink,
        docSort: articles.docSort,
        createdAt: articles.createdAt,
      })
      .from(articles)
      .where(
        and(
          eq(articles.docSeriesId, dbID),
          eq(articles.isDoc, true),
          eq(articles.status, 'PUBLISHED'),
          isNull(articles.deletedAt),
        ),
      )
      .orderBy(asc(articles.docSort), asc(articles.createdAt));

    // Encode article IDs with Sqids (EntityType.Article)
    const articleItems = articleRows.map((row: any) => ({
      id: generatePublicID(row.id, EntityType.Article),
      title: row.title,
      abbrlink: row.abbrlink,
      doc_sort: row.docSort,
      created_at: toISODateString(row.createdAt),
    }));

    return {
      ...series,
      id: generatePublicID(series.id, EntityType.DocSeries),
      articles: articleItems,
    };
  }

  /**
   * Update doc_count by delta (increment or decrement).
   * Used when articles are associated/disassociated with a series.
   */
  async updateDocCount(dbID: number, delta: number) {
    await this.db
      .update(docSeries)
      .set({
        docCount: sql`${docSeries.docCount} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(docSeries.id, dbID));
  }

  /**
   * Check if a doc series with the given name exists.
   * Used for name uniqueness validation on create/update.
   */
  async existsByName(name: string, excludeDbId?: number): Promise<boolean> {
    const conditions = [eq(docSeries.name, name)];
    if (excludeDbId) {
      conditions.push(sql`${docSeries.id} != ${excludeDbId}`);
    }

    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(docSeries)
      .where(and(...conditions));

    return (result?.count ?? 0) > 0;
  }
}
