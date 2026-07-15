import { Global, Module, forwardRef } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { StatisticsModule } from '../statistics/statistics.module';
import { ArticleModule } from '../article/article.module';
import { FileModule } from '../file/file.module';
import { LinkModule } from '../link/link.module';
import { ArticleHistoryModule } from '../article-history/article-history.module';
import { RssModule } from '../rss/rss.module';
import { CommonModule } from '../common/common.module';
import {
  CleanupAbandonedUploadsJob,
  StatisticsAggregationJob,
  SyncViewCountsJob,
  LinkHealthCheckJob,
  ScheduledPublishJob,
  ArticleHistoryCleanupJob,
  ScheduledBackupJob,
} from './jobs';

@Global()
@Module({
  imports: [
    StatisticsModule,
    ArticleModule,
    FileModule,
    LinkModule,
    ArticleHistoryModule,
    forwardRef(() => RssModule),
    CommonModule,
  ],
  providers: [
    ScheduleService,
    CleanupAbandonedUploadsJob,
    StatisticsAggregationJob,
    SyncViewCountsJob,
    LinkHealthCheckJob,
    ScheduledPublishJob,
    ArticleHistoryCleanupJob,
    ScheduledBackupJob,
  ],
  exports: [ScheduleService],
})
export class ScheduleModule {}
