import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { comments } from '../database/schemas/comment.schema';
import { isNull, eq, and, desc, like, sql, inArray } from 'drizzle-orm';

export interface CreateCommentParams {
  targetPath: string;
  targetTitle?: string | null;
  userId?: number | null;
  parentId?: number | null;
  replyToId?: number | null;
  nickname: string;
  email?: string | null;
  emailMd5: string;
  website?: string | null;
  content: string;
  contentHtml: string;
  status: number;
  isAdminComment: boolean;
  isAnonymous: boolean;
  userAgent?: string | null;
  ipAddress: string;
  ipLocation?: string | null;
}

export interface AdminListFilters {
  page: number;
  pageSize: number;
  nickname?: string;
  email?: string;
  targetPath?: string;
  ipAddress?: string;
  content?: string;
  status?: number;
}

@Injectable()
export class CommentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Find all published comments for a given target path.
   * Matches Go ListByPath query: status=1 (Published), deletedAt is null.
   * Limited to 500 results per D-119.
   */
  async findAllPublishedByPath(targetPath: string) {
    return this.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.targetPath, targetPath),
          eq(comments.status, 1),
          isNull(comments.deletedAt),
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(500);
  }

  /**
   * Find all published comments with pagination.
   * Used by ListLatest endpoint.
   */
  async findAllPublishedPaginated(page: number, pageSize: number) {
    const conditions = and(eq(comments.status, 1), isNull(comments.deletedAt));

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(comments)
      .where(conditions);

    const list = await this.db
      .select()
      .from(comments)
      .where(conditions)
      .orderBy(desc(comments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total };
  }

  /**
   * Find a single comment by DB ID.
   * Filters out soft-deleted records.
   */
  async findById(dbId: number) {
    const [comment] = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, dbId), isNull(comments.deletedAt)));
    return comment ?? undefined;
  }

  /**
   * Find multiple comments by an array of DB IDs.
   * Used for batch lookups (e.g., parent/replyTo resolution).
   */
  async findManyByIDs(dbIds: number[]) {
    if (dbIds.length === 0) return [];
    return this.db
      .select()
      .from(comments)
      .where(inArray(comments.id, dbIds));
  }

  /**
   * Create a new comment record.
   * Returns the inserted record with all fields.
   */
  async create(params: CreateCommentParams) {
    const [comment] = await this.db
      .insert(comments)
      .values(params)
      .returning();
    return comment;
  }

  /**
   * Admin list with dynamic filters and pagination.
   * Matches Go AdminListRequest: supports nickname, email, targetPath,
   * ipAddress, content (LIKE filters) and status (exact filter).
   * Shows all non-deleted comments regardless of status.
   */
  async adminList(filters: AdminListFilters) {
    const { page, pageSize, nickname, email, targetPath, ipAddress, content, status } = filters;
    const conditions = [isNull(comments.deletedAt)];

    if (nickname) {
      conditions.push(like(comments.nickname, `%${nickname}%`));
    }
    if (email) {
      conditions.push(like(comments.email, `%${email}%`));
    }
    if (targetPath) {
      conditions.push(like(comments.targetPath, `%${targetPath}%`));
    }
    if (ipAddress) {
      conditions.push(like(comments.ipAddress, `%${ipAddress}%`));
    }
    if (content) {
      conditions.push(like(comments.content, `%${content}%`));
    }
    if (status !== undefined) {
      conditions.push(eq(comments.status, status));
    }

    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(comments)
      .where(whereClause);

    const list = await this.db
      .select()
      .from(comments)
      .where(whereClause)
      .orderBy(desc(comments.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total };
  }

  /**
   * Soft delete comments by setting deletedAt to now.
   * Matches Go SoftDeleteMixin behavior.
   */
  async softDelete(dbIds: number[]) {
    await this.db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(inArray(comments.id, dbIds));
  }

  /**
   * Update comment status (1=Published, 2=Pending, 3=Rejected).
   * Matches Go UpdateStatus.
   */
  async updateStatus(dbId: number, status: number) {
    const [comment] = await this.db
      .update(comments)
      .set({ status })
      .where(eq(comments.id, dbId))
      .returning();
    return comment;
  }

  /**
   * Update comment content and contentHtml.
   * Also sets updatedAt to now.
   * Matches Go UpdateContent.
   */
  async updateContent(dbId: number, content: string, contentHtml: string) {
    const [comment] = await this.db
      .update(comments)
      .set({ content, contentHtml, updatedAt: new Date() })
      .where(eq(comments.id, dbId))
      .returning();
    return comment;
  }

  /**
   * Update comment user info (nickname, email, emailMd5, website).
   * Also sets updatedAt to now.
   * Matches Go UpdateCommentInfo.
   */
  async updateCommentInfo(dbId: number, data: { nickname?: string; email?: string; emailMd5?: string; website?: string }) {
    const [comment] = await this.db
      .update(comments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(comments.id, dbId))
      .returning();
    return comment;
  }

  /**
   * Set or clear pin on a comment.
   * isPinned=true → pinnedAt=now; isPinned=false → pinnedAt=null.
   * Matches Go SetPin per D-134.
   */
  async setPin(dbId: number, isPinned: boolean) {
    const [comment] = await this.db
      .update(comments)
      .set({ pinnedAt: isPinned ? new Date() : null })
      .where(eq(comments.id, dbId))
      .returning();
    return comment;
  }

  /**
   * Increment likeCount by 1.
   * Matches Go LikeComment per D-133.
   */
  async incrementLikeCount(dbId: number) {
    await this.db
      .update(comments)
      .set({ likeCount: sql`${comments.likeCount} + 1` })
      .where(eq(comments.id, dbId));
  }

  /**
   * Decrement likeCount by 1, minimum 0.
   * Uses GREATEST to prevent negative values.
   * Matches Go UnlikeComment per D-133.
   */
  async decrementLikeCount(dbId: number) {
    await this.db
      .update(comments)
      .set({ likeCount: sql`GREATEST(${comments.likeCount} - 1, 0)` })
      .where(eq(comments.id, dbId));
  }
}
