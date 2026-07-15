import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { ArticleRepository } from '../../article/article.repository';
import { RssService } from '../../rss/rss.service';
import { MemoryCache } from '../../common/cache/memory-cache.util';
import { generatePublicID, EntityType } from '../../common/utils/sqids.util';

/**
 * ScheduledPublishJob — publishes scheduled articles when their time arrives.
 * Schedule: every minute (* * * * *)
 * Matches Go ScheduledPublishJob (job_scheduled_publish.go).
 * Per D-230: finds scheduled articles, publishes them, invalidates caches.
 */
@Injectable()
export class ScheduledPublishJob {
  private readonly logger = new Logger(ScheduledPublishJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly articleRepo: ArticleRepository,
    private readonly rssService: RssService,
    private readonly memoryCache: MemoryCache,
  ) {}

  @Cron('* * * * *')
  async handleCron() {
    await this.scheduleService.runJob(ScheduledPublishJob.name, async () => {
      const articles = await this.articleRepo.findScheduledArticlesToPublish();

      if (articles.length === 0) return;

      this.logger.log(`Found ${articles.length} scheduled articles to publish`);

      let successCount = 0;
      let failCount = 0;

      for (const article of articles) {
        try {
          await this.articleRepo.publishArticle(article.id);

          // Invalidate article-level caches
          const publicId = generatePublicID(article.id, EntityType.Article);
          this.memoryCache.delete(`article:html:${publicId}`);
          if (article.abbrlink) {
            this.memoryCache.delete(`article:html:${article.abbrlink}`);
          }

          this.logger.log(
            `Published scheduled article: id=${article.id} title=${article.title}`,
          );
          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to publish scheduled article id=${article.id}: ${String(error)}`,
          );
          failCount++;
        }
      }

      // If any articles published, invalidate global caches
      if (successCount > 0) {
        this.invalidateGlobalCaches();
      }

      this.logger.log(
        `Scheduled publish completed: success=${successCount} failed=${failCount}`,
      );
    });
  }

  /**
   * Invalidate global caches (RSS, home, sidebar).
   * Matches Go invalidateGlobalCaches (job_scheduled_publish.go lines 135-153).
   */
  private invalidateGlobalCaches(): void {
    const globalKeys = [
      'rss:feed:latest',
      'home:articles:cache',
      'home:featured:cache',
      'sidebar:recent:cache',
    ];

    for (const key of globalKeys) {
      this.memoryCache.delete(key);
    }

    // Also invalidate RSS service cache
    try {
      this.rssService.invalidateCache();
    } catch (e) {
      this.logger.warn(`RSS cache invalidation failed: ${e}`);
    }

    this.logger.log('Invalidated global caches (RSS, home, sidebar)');
  }
}
