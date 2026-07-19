import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StatisticsService } from '../statistics/statistics.service';
import { ThumbnailGenerationJob } from './jobs/thumbnail-generation.job';
import { CommentNotificationJob } from './jobs/comment-notification.job';
import { LinkCleanupJob } from './jobs/link-cleanup.job';
import { CleanupOrphanedItemsJob } from './jobs/cleanup-orphaned-items.job';

/**
 * ScheduleService — core job execution infrastructure with panic-recovery and logging wrappers.
 * Matches Go backend's NewPanicRecoveryWrapper + NewLoggingWrapper (wrappers.go).
 *
 * Per D-220: wrapWithLogging generates UUID executionId, logs start/end with duration.
 * Per D-221: wrapWithPanicRecovery catches errors, logs with stack trace, prevents app crash.
 * Per D-224: dispatch is fire-and-forget (unawaited Promise).
 */
@Injectable()
export class ScheduleService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleService.name);

  /**
   * Track currently running jobs to prevent concurrent execution.
   * Matches Go cron.DelayIfStillRunning — if a job is still running when
   * the next cron tick fires, skip the new execution.
   */
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly thumbnailGenerationJob: ThumbnailGenerationJob,
    private readonly commentNotificationJob: CommentNotificationJob,
    private readonly linkCleanupJob: LinkCleanupJob,
    private readonly cleanupOrphanedItemsJob: CleanupOrphanedItemsJob,
  ) {}

  /**
   * OnModuleInit: fire-and-forget missed aggregation catch-up.
   * Matches Go CheckAndRunMissedAggregation (broker.go lines 266-338).
   */
  async onModuleInit() {
    this.dispatch('CheckAndRunMissedAggregation', async () => {
      await this.runMissedAggregationCatchUp();
    });
  }

  /**
   * Logging wrapper: generates UUID executionId, logs start/end with duration.
   * Matches Go NewLoggingWrapper (wrappers.go lines 26-48).
   */
  async wrapWithLogging(jobName: string, fn: () => Promise<void>): Promise<void> {
    const executionId = uuidv4();
    const startTime = Date.now();

    this.logger.log(`Job execution started [${jobName}] executionId=${executionId}`);

    await fn();

    const duration = Date.now() - startTime;
    this.logger.log(`Job execution finished [${jobName}] executionId=${executionId} duration=${duration}ms`);
  }

  /**
   * Panic recovery wrapper: catches errors, logs with stack trace, prevents app crash.
   * Matches Go NewPanicRecoveryWrapper (wrappers.go lines 53-71).
   */
  async wrapWithPanicRecovery(jobName: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Job panicked [${jobName}] panic=${String(error)} stack_trace=${stack}`,
      );
    }
  }

  /**
   * Run a job with all wrappers chained: delayIfStillRunning -> panicRecovery -> logging -> fn.
   * Matches Go cron.WithChain(NewPanicRecoveryWrapper, NewLoggingWrapper, DelayIfStillRunning).
   *
   * If the same job is already running, skip this execution (DelayIfStillRunning).
   */
  async runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
    // DelayIfStillRunning guard — skip if same job is already executing
    if (this.runningJobs.has(jobName)) {
      this.logger.log(`Job [${jobName}] still running, skipping this execution`);
      return;
    }

    this.runningJobs.add(jobName);
    try {
      await this.wrapWithPanicRecovery(jobName, async () => {
        await this.wrapWithLogging(jobName, fn);
      });
    } finally {
      this.runningJobs.delete(jobName);
    }
  }

  /**
   * Fire-and-forget: calls runJob without awaiting.
   * Matches Go Broker.Dispatch (broker.go line 225).
   * Used for on-demand jobs and startup catch-up.
   */
  dispatch(jobName: string, fn: () => Promise<void>): void {
    // Do NOT await — fire-and-forget per D-224
    this.runJob(jobName, fn).catch(() => {
      // Already handled by panicRecovery wrapper; this catch is a safety net
    });
  }

  /**
   * Dispatch thumbnail generation for a file.
   * Matches Go Broker.DispatchThumbnailGeneration (broker.go line 230).
   */
  dispatchThumbnailGeneration(fileId: number): void {
    this.dispatch('ThumbnailGenerationJob', () => this.thumbnailGenerationJob.run(fileId));
    this.logger.log(`Successfully queued thumbnail generation job for fileId=${fileId}`);
  }

  /**
   * Dispatch comment notification for a new comment.
   * Matches Go Broker.DispatchCommentNotification (broker.go line 133).
   */
  dispatchCommentNotification(commentId: number): void {
    this.dispatch('CommentNotificationJob', () => this.commentNotificationJob.run(commentId));
    this.logger.log(`Successfully queued comment notification job for commentId=${commentId}`);
  }

  /**
   * Dispatch link cleanup for unused categories and tags.
   * Matches Go Broker.DispatchLinkCleanup (broker.go line 252).
   */
  dispatchLinkCleanup(): void {
    this.dispatch('LinkCleanupJob', () => this.linkCleanupJob.run());
    this.logger.log('Successfully queued link cleanup job');
  }

  /**
   * Dispatch orphaned items cleanup for unused tags and categories.
   * Matches Go Broker.DispatchOrphanCleanup (broker.go line 140).
   */
  dispatchOrphanCleanup(): void {
    this.dispatch('CleanupOrphanedItemsJob', async () => {
      await this.cleanupOrphanedItemsJob.run();
    });
    this.logger.log('Successfully queued orphaned items cleanup job');
  }

  /**
   * Check for missed aggregation dates and backfill them.
   * Matches Go CheckAndRunMissedAggregation (broker.go lines 266-338).
   *
   * Per D-228: 30-minute timeout for entire catch-up.
   * Per D-229: iterate day-by-day, stop on first error.
   */
  private async runMissedAggregationCatchUp(): Promise<void> {
    this.logger.log('Checking for any missed statistics aggregation jobs...');

    // 30-minute timeout for entire catch-up
    const timeoutMs = 30 * 60 * 1000;
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Missed aggregation catch-up timed out after 30 minutes')), timeoutMs);
    });

    try {
      await Promise.race([
        this.doMissedAggregationCatchUp(),
        timeoutPromise,
      ]);
    } catch (error) {
      this.logger.error(`Missed aggregation catch-up failed: ${String(error)}`);
    }
  }

  private async doMissedAggregationCatchUp(): Promise<void> {
    // 1. Get last aggregated date
    const lastDate = await this.statisticsService.getLastStatDate();

    let startDate: Date;
    if (!lastDate) {
      // Never aggregated: find first log date
      this.logger.log('No previous aggregation found. Checking for the first visit log.');
      const firstLogDate = await this.statisticsService.getFirstLogDate();
      if (!firstLogDate) {
        this.logger.log('No visit logs found. Nothing to aggregate.');
        return;
      }
      startDate = firstLogDate;
    } else {
      // Start from day after last aggregation
      startDate = new Date(lastDate);
      startDate.setDate(startDate.getDate() + 1);
    }

    // Convert to China timezone day boundaries
    const { startOfDayInChina } = await import('../common/utils/time.util');
    startDate = startOfDayInChina(startDate);

    // Today in China timezone
    const { getChinaNow } = await import('../common/utils/time.util');
    const today = startOfDayInChina(getChinaNow());

    // If startDate is not before today, data is already up to date
    if (startDate.getTime() >= today.getTime()) {
      this.logger.log('Statistics are already up to date. No aggregation needed.');
      return;
    }

    // Safety limit: only backfill up to 30 days to prevent excessive log spam
    // on first startup or after long downtime
    const MAX_BACKFILL_DAYS = 30;
    const maxStartDate = new Date(today);
    maxStartDate.setDate(maxStartDate.getDate() - MAX_BACKFILL_DAYS);
    if (startDate.getTime() < maxStartDate.getTime()) {
      this.logger.warn(
        `First log date is too old (${startDate.toISOString()}). ` +
        `Clamping backfill to last ${MAX_BACKFILL_DAYS} days from today.`,
      );
      startDate = maxStartDate;
    }

    // Yesterday in China timezone
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    this.logger.log(
      `Starting to backfill aggregation data from ${startDate.toISOString()} to ${yesterday.toISOString()}`,
    );

    // Iterate day-by-day from startDate to yesterday
    const current = new Date(startDate);
    while (current.getTime() < today.getTime()) {
      try {
        await this.statisticsService.aggregateDaily(new Date(current));
      } catch (error) {
        this.logger.error(
          `Failed to run missed aggregation for date ${current.toISOString()}: ${String(error)}`,
        );
        this.logger.log('Stopping backfill process due to an error.');
        return; // Stop on first error per Go behavior
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    this.logger.log('Successfully completed all missed aggregation jobs.');
  }
}
