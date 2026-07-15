import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { ArticleService } from '../../article/article.service';

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
  ) {}

  @Cron('0 2 * * *')
  async handleCron() {
    await this.scheduleService.runJob(SyncViewCountsJob.name, async () => {
      const { syncedCount } = await this.articleService.syncViewCountsToDb();

      if (syncedCount === 0) {
        this.logger.log('No view counts to sync');
      } else {
        this.logger.log(`Synced view counts for ${syncedCount} articles`);
      }
    });
  }
}
