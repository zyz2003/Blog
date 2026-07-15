import { Global, Module, forwardRef } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { StatisticsModule } from '../statistics/statistics.module';
import { ArticleModule } from '../article/article.module';
import { FileModule } from '../file/file.module';
import { LinkModule } from '../link/link.module';
import { ArticleHistoryModule } from '../article-history/article-history.module';
import { RssModule } from '../rss/rss.module';
import { CommonModule } from '../common/common.module';
import { EmailModule } from '../email/email.module';
import { CommentModule } from '../comment/comment.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { DatabaseModule } from '../database/database.module';
import {
  CleanupAbandonedUploadsJob,
  StatisticsAggregationJob,
  SyncViewCountsJob,
  LinkHealthCheckJob,
  ScheduledPublishJob,
  ArticleHistoryCleanupJob,
  ScheduledBackupJob,
  ThumbnailGenerationJob,
  CommentNotificationJob,
  LinkCleanupJob,
  CleanupOrphanedItemsJob,
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
    EmailModule,
    CommentModule,
    ThumbnailModule,
    DatabaseModule,
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
    ThumbnailGenerationJob,
    CommentNotificationJob,
    LinkCleanupJob,
    CleanupOrphanedItemsJob,
  ],
  exports: [ScheduleService],
})
export class ScheduleModule {}
