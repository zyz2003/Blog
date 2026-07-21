import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { links } from '../database/schemas/link.schema';
import { linkCategories } from '../database/schemas/link-category.schema';
import { linkTags } from '../database/schemas/link-tag.schema';
import { linkTagPivot } from '../database/schemas/link-tag-pivot.schema';
import { isNull, eq, and, desc, like, sql, inArray, asc, exists, SQL } from 'drizzle-orm';

export interface CreateLinkParams {
  name: string;
  url: string;
  rssUrl?: string | null;
  logo?: string | null;
  description?: string | null;
  status: string;
  siteshot?: string | null;
  email?: string | null;
  type?: string | null;
  originalUrl?: string | null;
  updateReason?: string | null;
  sortOrder?: number;
  skipHealthCheck?: boolean;
  categoryId: number;
}

export interface AdminListFilters {
  page: number;
  pageSize: number;
  status?: string;
  categoryId?: number;
  tagId?: number;
}

export interface CreateCategoryParams {
  name: string;
  style: string;
  description?: string | null;
}

export interface UpdateCategoryParams {
  name?: string;
  style?: string;
  description?: string | null;
}

export interface CreateTagParams {
  name: string;
  color?: string;
}

export interface UpdateTagParams {
  name?: string;
  color?: string;
}

@Injectable()
export class LinkRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  // ─── Link CRUD ────────────────────────────────────────────────────

  /**
   * Create a new link record.
   * Returns the inserted record with all fields.
   */
  async create(params: CreateLinkParams) {
    const [link] = await this.db
      .insert(links)
      .values({
        name: params.name,
        url: params.url,
        rssUrl: params.rssUrl ?? null,
        logo: params.logo ?? null,
        description: params.description ?? null,
        status: params.status,
        siteshot: params.siteshot ?? null,
        email: params.email ?? null,
        type: params.type ?? null,
        originalUrl: params.originalUrl ?? null,
        updateReason: params.updateReason ?? null,
        sortOrder: params.sortOrder ?? 0,
        skipHealthCheck: params.skipHealthCheck ?? false,
        categoryId: params.categoryId,
      })
      .returning();
    return link;
  }

  /**
   * Find a single non-deleted link by DB ID.
   */
  async findById(dbId: number) {
    const [link] = await this.db
      .select()
      .from(links)
      .where(and(eq(links.id, dbId), isNull(links.deletedAt)));
    return link ?? undefined;
  }

  /**
   * Find a link matching a URL string (for dedup check).
   * Only returns non-deleted links.
   */
  async findByUrl(url: string) {
    const [link] = await this.db
      .select()
      .from(links)
      .where(and(eq(links.url, url), isNull(links.deletedAt)));
    return link ?? undefined;
  }

  /**
   * Check if any non-deleted link exists with given email.
   * Used for repeat applicant detection in ApplyLink.
   */
  async hasApplicationByEmail(email: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(links)
      .where(and(eq(links.email, email), isNull(links.deletedAt)));
    return (result?.count ?? 0) > 0;
  }

  /**
   * Find all APPROVED links with category and tag joins.
   * Ordered by sortOrder ASC.
   */
  async findApprovedLinks() {
    return this.db
      .select({
        link: links,
        category: linkCategories,
        tag: linkTags,
      })
      .from(links)
      .leftJoin(linkCategories, eq(links.categoryId, linkCategories.id))
      .leftJoin(linkTagPivot, eq(links.id, linkTagPivot.linkId))
      .leftJoin(linkTags, eq(linkTagPivot.linkTagId, linkTags.id))
      .where(and(eq(links.status, 'APPROVED'), isNull(links.deletedAt)))
      .orderBy(asc(links.sortOrder));
  }

  /**
   * Find N random APPROVED links with category and tag joins.
   * Uses ORDER BY RANDOM() via sql template.
   */
  async findRandomApproved(count: number) {
    return this.db
      .select({
        link: links,
        category: linkCategories,
        tag: linkTags,
      })
      .from(links)
      .leftJoin(linkCategories, eq(links.categoryId, linkCategories.id))
      .leftJoin(linkTagPivot, eq(links.id, linkTagPivot.linkId))
      .leftJoin(linkTags, eq(linkTagPivot.linkTagId, linkTags.id))
      .where(and(eq(links.status, 'APPROVED'), isNull(links.deletedAt)))
      .orderBy(sql`RANDOM()`)
      .limit(count);
  }

  /**
   * Admin list with dynamic filters and pagination.
   * Supports status, categoryId, tagId filters.
   * Joins with category and tag tables.
   */
  async adminList(filters: AdminListFilters) {
    const { page, pageSize, status, categoryId, tagId } = filters;
    const conditions = [isNull(links.deletedAt)];

    if (status) {
      conditions.push(eq(links.status, status));
    }
    if (categoryId) {
      conditions.push(eq(links.categoryId, categoryId));
    }

    const whereClause = and(...conditions);

    // If tagId filter is specified, we need to join with pivot table
    if (tagId) {
      const [{ count: total }] = await this.db
        .select({ count: sql`count(distinct ${links.id})` })
        .from(links)
        .leftJoin(linkTagPivot, eq(links.id, linkTagPivot.linkId))
        .where(and(whereClause!, eq(linkTagPivot.linkTagId, tagId)));

      const list = await this.db
        .select({
          link: links,
          category: linkCategories,
          tag: linkTags,
        })
        .from(links)
        .leftJoin(linkCategories, eq(links.categoryId, linkCategories.id))
        .leftJoin(linkTagPivot, eq(links.id, linkTagPivot.linkId))
        .leftJoin(linkTags, eq(linkTagPivot.linkTagId, linkTags.id))
        .where(and(whereClause!, eq(linkTagPivot.linkTagId, tagId)))
        .orderBy(desc(links.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { list, total };
    }

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(links)
      .where(whereClause);

    const list = await this.db
      .select({
        link: links,
        category: linkCategories,
        tag: linkTags,
      })
      .from(links)
      .leftJoin(linkCategories, eq(links.categoryId, linkCategories.id))
      .leftJoin(linkTagPivot, eq(links.id, linkTagPivot.linkId))
      .leftJoin(linkTags, eq(linkTagPivot.linkTagId, linkTags.id))
      .where(whereClause)
      .orderBy(desc(links.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total };
  }

  /**
   * Update specified link fields by DB ID.
   * Sets updatedAt to now.
   */
  async update(dbId: number, data: Partial<typeof links.$inferInsert>) {
    const [link] = await this.db
      .update(links)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(links.id, dbId))
      .returning();
    return link;
  }

  /**
   * Update status field for a link.
   * Optionally update siteshot.
   */
  async updateStatus(
    dbId: number,
    status: string,
    siteshot?: string | null,
    rejectReason?: string | null,
  ) {
    const updateData: Record<string, any> = { status };
    if (siteshot !== undefined) {
      updateData.siteshot = siteshot;
    }
    if (rejectReason !== undefined) {
      updateData.updateReason = rejectReason;
    }
    await this.db
      .update(links)
      .set(updateData)
      .where(eq(links.id, dbId));
  }

  /**
   * Soft delete links by setting deletedAt to now.
   */
  async softDelete(dbIds: number[]) {
    await this.db
      .update(links)
      .set({ deletedAt: new Date() })
      .where(inArray(links.id, dbIds));
  }

  /**
   * Batch update sortOrder for multiple links.
   * Uses CASE-based batch update for efficiency.
   */
  async batchUpdateSort(items: Array<{ id: number; sortOrder: number }>) {
    if (items.length === 0) return;

    // Build CASE WHEN clauses with parameterized values
    const whenClauses: SQL[] = [];
    const idParams: SQL[] = [];

    for (const item of items) {
      whenClauses.push(sql`WHEN ${item.id} THEN ${item.sortOrder}`);
      idParams.push(sql`${item.id}`);
    }

    // Use subquery alias to avoid table-qualified column names in SET clause
    // SQLite does not allow "table"."column" in SET — only "column"
    await this.db.run(
      sql`UPDATE links SET sort_order = CASE id ${sql.join(whenClauses, sql` `)} END WHERE id IN (${sql.join(idParams, sql`, `)})`,
    );
  }

  /**
   * Find links for health check.
   * Returns APPROVED + INVALID links where skipHealthCheck=false and not deleted.
   */
  async findLinksForHealthCheck() {
    return this.db
      .select()
      .from(links)
      .where(
        and(
          inArray(links.status, ['APPROVED', 'INVALID']),
          eq(links.skipHealthCheck, false),
          isNull(links.deletedAt),
        ),
      );
  }

  // ─── Category CRUD ────────────────────────────────────────────────

  /**
   * Create a new link category.
   */
  async createCategory(params: CreateCategoryParams) {
    const [category] = await this.db
      .insert(linkCategories)
      .values({
        name: params.name,
        style: params.style,
        description: params.description ?? null,
      })
      .returning();
    return category;
  }

  /**
   * Find all link categories.
   */
  async findAllCategories() {
    return this.db.select().from(linkCategories);
  }

  /**
   * Find a single category by DB ID.
   */
  async findCategoryById(dbId: number) {
    const [category] = await this.db
      .select()
      .from(linkCategories)
      .where(eq(linkCategories.id, dbId));
    return category ?? undefined;
  }

  /**
   * Update specified category fields.
   */
  async updateCategory(dbId: number, data: UpdateCategoryParams) {
    const [category] = await this.db
      .update(linkCategories)
      .set(data)
      .where(eq(linkCategories.id, dbId))
      .returning();
    return category;
  }

  /**
   * Delete a category only if no non-deleted links reference it.
   * Throws BadRequestException if category is in use.
   */
  async deleteCategoryIfUnused(dbId: number) {
    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(links)
      .where(and(eq(links.categoryId, dbId), isNull(links.deletedAt)));

    if ((result?.count ?? 0) > 0) {
      throw new BadRequestException('友链分类正在使用中，无法删除');
    }

    await this.db
      .delete(linkCategories)
      .where(eq(linkCategories.id, dbId));
  }

  // ─── Tag CRUD ─────────────────────────────────────────────────────

  /**
   * Create a new link tag.
   * Default color is '#666666'.
   */
  async createTag(params: CreateTagParams) {
    const [tag] = await this.db
      .insert(linkTags)
      .values({
        name: params.name,
        color: params.color ?? '#666666',
      })
      .returning();
    return tag;
  }

  /**
   * Find all link tags.
   */
  async findAllTags() {
    return this.db.select().from(linkTags);
  }

  /**
   * Find a single tag by DB ID.
   */
  async findTagById(dbId: number) {
    const [tag] = await this.db
      .select()
      .from(linkTags)
      .where(eq(linkTags.id, dbId));
    return tag ?? undefined;
  }

  /**
   * Find a tag by name.
   * Used for import dedup.
   */
  async findTagByName(name: string) {
    const [tag] = await this.db
      .select()
      .from(linkTags)
      .where(eq(linkTags.name, name));
    return tag ?? undefined;
  }

  /**
   * Update specified tag fields.
   */
  async updateTag(dbId: number, data: UpdateTagParams) {
    const [tag] = await this.db
      .update(linkTags)
      .set(data)
      .where(eq(linkTags.id, dbId))
      .returning();
    return tag;
  }

  /**
   * Delete a tag only if no link_tag_pivot references it.
   * Also deletes pivot entries for this tag.
   * Throws BadRequestException if tag is in use.
   */
  async deleteTagIfUnused(dbId: number) {
    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(linkTagPivot)
      .where(eq(linkTagPivot.linkTagId, dbId));

    if ((result?.count ?? 0) > 0) {
      throw new BadRequestException('友链标签正在使用中，无法删除');
    }

    await this.db
      .delete(linkTags)
      .where(eq(linkTags.id, dbId));
  }

  // ─── Link-Tag Pivot ───────────────────────────────────────────────

  /**
   * Set the tag for a link (single-tag-per-link pattern per Go backend).
   * Deletes existing pivot entries for this linkId.
   * If tagId is not null, inserts new pivot entry.
   */
  async setLinkTag(linkId: number, tagId: number | null) {
    // Delete existing pivot entries for this link
    await this.db
      .delete(linkTagPivot)
      .where(eq(linkTagPivot.linkId, linkId));

    // Insert new pivot entry if tagId is provided
    if (tagId !== null) {
      await this.db
        .insert(linkTagPivot)
        .values({ linkId, linkTagId: tagId });
    }
  }

  /**
   * Get the tag for a single link.
   * Joins link_tag_pivot with link_tags.
   * Returns single tag or null (per Go backend, each link has at most one tag).
   */
  async getLinkTag(linkId: number) {
    const [result] = await this.db
      .select({ tag: linkTags })
      .from(linkTagPivot)
      .leftJoin(linkTags, eq(linkTagPivot.linkTagId, linkTags.id))
      .where(eq(linkTagPivot.linkId, linkId));
    return result?.tag ?? null;
  }

  // ─── Public Category ──────────────────────────────────────────────

  /**
   * Find categories that have at least one APPROVED, non-deleted link.
   * Uses EXISTS subquery.
   */
  async findPublicCategories() {
    return this.db
      .select()
      .from(linkCategories)
      .where(
        exists(
          this.db
            .select({ id: links.id })
            .from(links)
            .where(
              and(
                eq(links.categoryId, linkCategories.id),
                eq(links.status, 'APPROVED'),
                isNull(links.deletedAt),
              ),
            ),
        ),
      );
  }
}
