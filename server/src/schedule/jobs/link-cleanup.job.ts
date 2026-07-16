import { Injectable, Logger, Inject } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { DRIZZLE } from '../../database/database.module';
import { linkCategories } from '../../database/schemas/link-category.schema';
import { linkTags } from '../../database/schemas/link-tag.schema';
import { linkTagPivot } from '../../database/schemas/link-tag-pivot.schema';
import { links } from '../../database/schemas/link.schema';
import { eq, notInArray, inArray, sql, and, isNull } from 'drizzle-orm';

/**
 * LinkCleanupJob — cleans up unused link categories and tags.
 * On-demand job dispatched via ScheduleService.dispatchLinkCleanup().
 * Matches Go LinkCleanupJob (job_link_cleanup.go).
 *
 * Per Go:
 * 1. Get protected category IDs from settings (default category)
 * 2. Delete unused categories (excluding protected ones)
 * 3. Delete unused tags (no link_tag_pivot references)
 */
@Injectable()
export class LinkCleanupJob {
  private readonly logger = new Logger(LinkCleanupJob.name);

  constructor(
    private readonly settingsService: SettingsService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  /**
   * Run link cleanup.
   * Matches Go LinkCleanupJob.Run() which:
   * 1. Gets protected category IDs from settings
   * 2. Deletes unused categories (excluding protected)
   * 3. Deletes unused tags
   */
  async run(): Promise<void> {
    // 1. Get protected category IDs matching Go getProtectedCategoryIDs()
    const excludeIds = this.getProtectedCategoryIDs();

    // 2. Clean up unused categories (excluding protected)
    // Matches Go: DeleteAllUnusedExcluding(ctx, excludeIDs) — deletes only unused categories
    let deletedCategories = 0;
    try {
      // Find categories that have no links referencing them and are not in excludeIds
      const unusedCategories = await this.db
        .select({ id: linkCategories.id })
        .from(linkCategories)
        .where(
          and(
            excludeIds.length > 0 ? notInArray(linkCategories.id, excludeIds) : undefined,
            sql`${linkCategories.id} NOT IN (SELECT ${links.categoryId} FROM ${links})`,
          ),
        );

      if (unusedCategories.length > 0) {
        const idsToDelete = unusedCategories.map((c: any) => c.id);
        // Delete ONLY the identified unused categories (not everything else!)
        await this.db
          .delete(linkCategories)
          .where(inArray(linkCategories.id, idsToDelete));
        deletedCategories = idsToDelete.length;
      }

      if (deletedCategories > 0) {
        this.logger.log(
          `LinkCleanupJob: cleaned up ${deletedCategories} unused link categories (protected IDs: ${excludeIds})`,
        );
      }
    } catch (error) {
      this.logger.error(`LinkCleanupJob: failed to clean up categories: ${String(error)}`);
    }

    // 3. Clean up unused tags (no link_tag_pivot references)
    let deletedTags = 0;
    try {
      // Find tags that have no link_tag_pivot references
      // Matches Go: DeleteAllUnused — linktag.Not(linktag.HasLinks())
      const unusedTags = await this.db
        .select({ id: linkTags.id })
        .from(linkTags)
        .where(
          sql`${linkTags.id} NOT IN (SELECT ${linkTagPivot.linkTagId} FROM ${linkTagPivot})`,
        );

      if (unusedTags.length > 0) {
        const idsToDelete = unusedTags.map((t: any) => t.id);
        await this.db.delete(linkTags).where(inArray(linkTags.id, idsToDelete));
        deletedTags = idsToDelete.length;
      }

      if (deletedTags > 0) {
        this.logger.log(`LinkCleanupJob: cleaned up ${deletedTags} unused link tags`);
      }
    } catch (error) {
      this.logger.error(`LinkCleanupJob: failed to clean up tags: ${String(error)}`);
    }
  }

  /**
   * Get protected category IDs from settings.
   * Matches Go getProtectedCategoryIDs() which:
   * 1. Reads FRIEND_LINK_DEFAULT_CATEGORY from settings
   * 2. Falls back to ID 2 if not configured or invalid
   */
  private getProtectedCategoryIDs(): number[] {
    const defaultCategoryIdStr =
      this.settingsService.get('friend_link_default_category') || '';

    if (defaultCategoryIdStr) {
      const defaultCategoryId = parseInt(defaultCategoryIdStr, 10);
      if (!isNaN(defaultCategoryId) && defaultCategoryId > 0) {
        return [defaultCategoryId];
      }
    }

    // Fallback to ID 2 matching Go hardcoded default
    return [2];
  }
}
