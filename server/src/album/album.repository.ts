import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { albums } from '../database/schemas/album.schema';
import { isNull, eq, and, desc, asc, sql, inArray, gte, lte } from 'drizzle-orm';

export interface CreateAlbumParams {
  categoryId?: number | null;
  imageUrl: string;
  bigImageUrl?: string;
  downloadUrl?: string;
  thumbParam?: string;
  bigParam?: string;
  tags?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
  fileHash: string;
  displayOrder?: number;
  title?: string;
  description?: string;
  location?: string;
  publishedAt?: Date | null;
  createdAt?: Date;
  aspectRatio?: string;
}

export interface FindAlbumsOptions {
  page: number;
  pageSize: number;
  categoryId?: number;
  tag?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  sort?: string;
}

export type CreateOrRestoreStatus = 'created' | 'restored' | 'existed';

export interface CreateOrRestoreResult {
  album: any;
  status: CreateOrRestoreStatus;
}

@Injectable()
export class AlbumRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Insert a new album record. Returns the created record.
   */
  async create(params: CreateAlbumParams) {
    const values: Record<string, any> = {
      imageUrl: params.imageUrl,
      bigImageUrl: params.bigImageUrl ?? null,
      downloadUrl: params.downloadUrl ?? null,
      thumbParam: params.thumbParam ?? null,
      bigParam: params.bigParam ?? null,
      tags: params.tags ?? null,
      width: params.width ?? null,
      height: params.height ?? null,
      fileSize: params.fileSize ?? null,
      format: params.format ?? null,
      aspectRatio: params.aspectRatio ?? null,
      fileHash: params.fileHash,
      displayOrder: params.displayOrder ?? 0,
      categoryId: params.categoryId ?? null,
      title: params.title ?? null,
      description: params.description ?? null,
      location: params.location ?? null,
      publishedAt: params.publishedAt ?? null,
    };

    if (params.createdAt) {
      values.createdAt = params.createdAt;
    }

    const [album] = await this.db.insert(albums).values(values).returning();
    return album;
  }

  /**
   * CreateOrRestore — matches Go CreateOrRestore dedup logic per D-190.
   * 1. Query by fileHash (WITHOUT deletedAt IS NULL filter, so we find both active and soft-deleted).
   * 2. If not found → insert new → status 'created'.
   * 3. If found + deletedAt not null (soft-deleted) → restore + update fields → status 'restored'.
   * 4. If found + deletedAt null (active) → return existing → status 'existed'.
   */
  async createOrRestore(params: CreateAlbumParams): Promise<CreateOrRestoreResult> {
    // Query WITHOUT deletedAt IS NULL filter — must find soft-deleted records for restore
    const [existing] = await this.db
      .select()
      .from(albums)
      .where(eq(albums.fileHash, params.fileHash));

    if (!existing) {
      // No record found — create new
      const album = await this.create(params);
      return { album, status: 'created' };
    }

    if (existing.deletedAt !== null) {
      // Soft-deleted record found — restore it by updating all fields and clearing deletedAt
      const [restored] = await this.db
        .update(albums)
        .set({
          deletedAt: null,
          imageUrl: params.imageUrl,
          bigImageUrl: params.bigImageUrl ?? existing.bigImageUrl,
          downloadUrl: params.downloadUrl ?? existing.downloadUrl,
          thumbParam: params.thumbParam ?? existing.thumbParam,
          bigParam: params.bigParam ?? existing.bigParam,
          tags: params.tags ?? existing.tags,
          width: params.width ?? existing.width,
          height: params.height ?? existing.height,
          fileSize: params.fileSize ?? existing.fileSize,
          format: params.format ?? existing.format,
          aspectRatio: params.aspectRatio ?? existing.aspectRatio,
          displayOrder: params.displayOrder ?? existing.displayOrder,
          categoryId: params.categoryId ?? existing.categoryId,
          title: params.title ?? existing.title,
          description: params.description ?? existing.description,
          location: params.location ?? existing.location,
          publishedAt: params.publishedAt ?? existing.publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(albums.id, existing.id))
        .returning();
      return { album: restored, status: 'restored' };
    }

    // Active record found — already exists
    return { album: existing, status: 'existed' };
  }

  /**
   * Find album by ID. Only returns active records (WHERE deleted_at IS NULL).
   * Matches Go SoftDeleteMixin automatic filter behavior.
   */
  async findById(id: number) {
    const [album] = await this.db
      .select()
      .from(albums)
      .where(and(eq(albums.id, id), isNull(albums.deletedAt)));
    return album ?? null;
  }

  /**
   * Update album by ID. Only updates active records (WHERE deleted_at IS NULL).
   * Sets updatedAt to current time.
   */
  async update(id: number, data: Partial<CreateAlbumParams>) {
    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };

    const [album] = await this.db
      .update(albums)
      .set(updateData)
      .where(and(eq(albums.id, id), isNull(albums.deletedAt)))
      .returning();
    return album ?? null;
  }

  /**
   * Soft delete album by setting deletedAt to current time.
   * Matches Go SoftDeleteMixin behavior which intercepts DeleteOneID
   * and converts it to UpdateOneID setting deleted_at = time.Now().
   */
  async delete(id: number) {
    const [album] = await this.db
      .update(albums)
      .set({ deletedAt: new Date() })
      .where(eq(albums.id, id))
      .returning();
    return album ?? null;
  }

  /**
   * Batch soft delete albums by setting deletedAt to current time.
   * Returns the number of deleted records.
   */
  async batchDelete(ids: number[]) {
    const result = await this.db
      .update(albums)
      .set({ deletedAt: new Date() })
      .where(and(inArray(albums.id, ids), isNull(albums.deletedAt)))
      .returning();
    return result.length;
  }

  /**
   * Paginated query with filters for album list.
   * ALL queries MUST include WHERE deleted_at IS NULL per Go SoftDeleteMixin.
   * Supports: categoryId, tag, time range, sort modes.
   */
  async findListByOptions(opts: FindAlbumsOptions) {
    const { page, pageSize, categoryId, tag, createdAtStart, createdAtEnd, sort } = opts;
    const conditions = [isNull(albums.deletedAt)];

    // Category filter
    if (categoryId) {
      conditions.push(eq(albums.categoryId, categoryId));
    }

    // Tag filter: SQLite CONCAT(',', tags, ',') LIKE '%,tag,%'
    if (tag) {
      conditions.push(
        sql`(',' || ${albums.tags} || ',') LIKE ${'%' + ',' + tag + ',' + '%'}`,
      );
    }

    // Time range filter
    if (createdAtStart) {
      const startTs = Math.floor(new Date(createdAtStart).getTime() / 1000);
      conditions.push(gte(albums.createdAt, sql`${startTs}`));
    }
    if (createdAtEnd) {
      const endTs = Math.floor(new Date(createdAtEnd).getTime() / 1000);
      conditions.push(lte(albums.createdAt, sql`${endTs}`));
    }

    const whereClause = and(...conditions);

    // Count total
    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(albums)
      .where(whereClause);

    // Determine sort order
    let orderBy;
    switch (sort) {
      case 'created_at_asc':
        orderBy = [asc(albums.createdAt)];
        break;
      case 'created_at_desc':
        orderBy = [desc(albums.createdAt)];
        break;
      case 'view_count_desc':
        orderBy = [desc(albums.viewCount), desc(albums.createdAt)];
        break;
      case 'display_order_asc':
      default:
        orderBy = [asc(albums.displayOrder), desc(albums.createdAt)];
        break;
    }

    // Fetch paginated results
    const items = await this.db
      .select()
      .from(albums)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items, total };
  }

  /**
   * Get all active albums without pagination (for export).
   * Filters by deletedAt IS NULL.
   */
  async findAll() {
    return this.db
      .select()
      .from(albums)
      .where(isNull(albums.deletedAt));
  }

  /**
   * Increment view count for an active album.
   * Only increments if album exists and is not soft-deleted.
   */
  async incrementViewCount(id: number) {
    await this.db
      .update(albums)
      .set({ viewCount: sql`${albums.viewCount} + 1` })
      .where(and(eq(albums.id, id), isNull(albums.deletedAt)));
  }

  /**
   * Increment download count for an active album.
   * Only increments if album exists and is not soft-deleted.
   */
  async incrementDownloadCount(id: number) {
    await this.db
      .update(albums)
      .set({ downloadCount: sql`${albums.downloadCount} + 1` })
      .where(and(eq(albums.id, id), isNull(albums.deletedAt)));
  }

  /**
   * Get all albums for import/batch dedup.
   * Returns fileHash→id map. INCLUDES soft-deleted records (no deletedAt filter)
   * so dedup catches both active and deleted albums.
   */
  async findAllForDedup() {
    const allAlbums = await this.db
      .select({
        fileHash: albums.fileHash,
        id: albums.id,
      })
      .from(albums);

    const dedupMap = new Map<string, number>();
    for (const album of allAlbums) {
      if (album.fileHash) {
        dedupMap.set(album.fileHash, album.id);
      }
    }
    return dedupMap;
  }
}
