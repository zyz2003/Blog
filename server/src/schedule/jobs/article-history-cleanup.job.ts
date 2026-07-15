import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { ArticleHistoryService } from '../../article-history/article-history.service';

/**
 * ArticleHistoryCleanupJob — cleans up old article history versions.
 * Schedule: daily at 3:30 AM (30 3 * * *)
 * Matches Go ArticleHistoryCleanupJob (job_article_history_cleanup.go).
 * Per D-231: queries all article IDs, calls per-article cleanup.
 */
@Injectable()
export class ArticleHistoryCleanupJob {
  private readonly logger = new Logger(ArticleHistoryCleanupJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly historyService: ArticleHistoryService,
  ) {}

  @Cron('30 3 * * *')
  async handleCron() {
    await this.scheduleService.runJob(ArticleHistoryCleanupJob.name, async () => {
      const cleanedCount = await this.historyService.cleanupAllOldVersions();
      this.logger.log(`Cleaned up old versions for ${cleanedCount} articles`);
    });
  }
}
