import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { ArticleService } from '../../article/article.service';
import { ArticleRepository } from '../../article/article.repository';
import { decodePublicID, EntityType } from '../../common/utils/sqids.util';

/**
 * Key prefix for view count map entries.
 * Matches Go ArticleViewCountKeyPrefix = "anheyu:article:view_count:"
 * (minus the "anheyu:" namespace prefix since we use in-memory Map, not Redis).
 */
const ARTICLE_VIEW_COUNT_KEY_PREFIX = 'article:view_count:';

/**
 * SyncViewCountsJob — syncs in-memory view counts to the database.
 * Schedule: daily at 2:00 AM (0 2 * * *)
 * Matches Go SyncViewCountsJob (job_sync_views.go).
 * Per D-225: reads Map, decodes publicIds, batch updates DB.
 */
@Injectable()
export class SyncViewCountsJob {
  private readonly logger = new Logger(SyncViewCountsJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly articleService: ArticleService,
    private readonly articleRepo: ArticleRepository,
  ) {}

  @Cron('0 2 * * *')
  async handleCron() {
    await this.scheduleService.runJob(SyncViewCountsJob.name, async () => {
      const map = this.articleService.getViewCountMap();

      if (map.size === 0) {
        this.logger.log('No view counts to sync');
        return;
      }

      // Build updates map: dbId -> increment
      const updates = new Map<number, number>();
      const validKeys: string[] = [];

      for (const [key, increment] of map) {
        // Trim prefix to get publicId
        const publicId = key.startsWith(ARTICLE_VIEW_COUNT_KEY_PREFIX)
          ? key.slice(ARTICLE_VIEW_COUNT_KEY_PREFIX.length)
          : null;

        if (!publicId) {
          this.logger.warn(`Skipping invalid key format: ${key}`);
          continue;
        }

        // Decode publicId to get dbId and entityType
        try {
          const { dbID, entityType } = decodePublicID(publicId);
          if (entityType !== EntityType.Article) {
            this.logger.warn(`Skipping non-article key: ${key} (entityType=${entityType})`);
            continue;
          }
          // Accumulate increments for same article
          updates.set(dbID, (updates.get(dbID) ?? 0) + increment);
          validKeys.push(key);
        } catch (error) {
          this.logger.warn(`Failed to decode publicId '${publicId}': ${String(error)}`);
          continue;
        }
      }

      if (updates.size === 0) {
        this.logger.log('No valid view counts to sync after decoding');
        return;
      }

      // Batch update DB
      await this.articleRepo.batchUpdateViewCounts(updates);

      // Clear processed keys from the Map
      this.articleService.clearViewCountKeys(validKeys);

      this.logger.log(`Synced view counts for ${updates.size} articles`);
    });
  }
}
