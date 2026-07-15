import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { postTags } from '../../database/schemas/post-tag.schema';
import { postCategories } from '../../database/schemas/post-category.schema';
import { articlePostTags } from '../../database/schemas/article-post-tag-pivot.schema';
import { articlePostCategories } from '../../database/schemas/article-post-category-pivot.schema';
import { sql, isNull, eq, and } from 'drizzle-orm';

/**
 * CleanupOrphanedItemsJob — deletes post_tags and post_categories with no article references.
 * On-demand job dispatched via ScheduleService.dispatchOrphanCleanup().
 * Matches Go CleanupOrphanedItemsJob (job_cleanup_items.go).
 *
 * Per Go cleanup_repo.CleanupOrphanedTagsAndCategories():
 * 1. Find post_tags with no articles (NOT HasArticles) and DeletedAtIsNil
 * 2. Delete those orphaned tags
 * 3. Find post_categories with no articles (NOT HasArticles) and DeletedAtIsNil
 * 4. Delete those orphaned categories
 */
@Injectable()
export class CleanupOrphanedItemsJob {
  private readonly logger = new Logger(CleanupOrphanedItemsJob.name);

  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Run orphaned items cleanup.
   * Matches Go CleanupOrphanedItemsJob.Run() which calls cleanupSvc.CleanupOrphanedItems().
   * Returns counts of deleted tags and categories.
   */
  async run(): Promise<{ deletedTags: number; deletedCategories: number }> {
    let deletedTags = 0;
    let deletedCategories = 0;

    // 1. Clean up orphaned tags (no article references)
    // Matches Go: PostTag.Not(PostTag.HasArticles()) AND DeletedAtIsNil
    try {
      const orphanedTags = await this.db
        .select({ id: postTags.id })
        .from(postTags)
        .where(
          and(
            isNull(postTags.deletedAt),
            sql`${postTags.id} NOT IN (SELECT ${articlePostTags.postTagId} FROM ${articlePostTags})`,
          ),
        );

      if (orphanedTags.length > 0) {
        for (const tag of orphanedTags) {
          await this.db.delete(postTags).where(eq(postTags.id, tag.id));
        }
        deletedTags = orphanedTags.length;
      }
    } catch (error) {
      this.logger.error(`CleanupOrphanedItemsJob: failed to clean up tags: ${String(error)}`);
    }

    // 2. Clean up orphaned categories (no article references)
    // Matches Go: PostCategory.Not(PostCategory.HasArticles()) AND DeletedAtIsNil
    try {
      const orphanedCategories = await this.db
        .select({ id: postCategories.id })
        .from(postCategories)
        .where(
          and(
            isNull(postCategories.deletedAt),
            sql`${postCategories.id} NOT IN (SELECT ${articlePostCategories.postCategoryId} FROM ${articlePostCategories})`,
          ),
        );

      if (orphanedCategories.length > 0) {
        for (const cat of orphanedCategories) {
          await this.db.delete(postCategories).where(eq(postCategories.id, cat.id));
        }
        deletedCategories = orphanedCategories.length;
      }
    } catch (error) {
      this.logger.error(`CleanupOrphanedItemsJob: failed to clean up categories: ${String(error)}`);
    }

    if (deletedTags > 0 || deletedCategories > 0) {
      this.logger.log(
        `CleanupOrphanedItemsJob: cleaned up ${deletedTags} tags and ${deletedCategories} categories`,
      );
    }

    return { deletedTags, deletedCategories };
  }
}
