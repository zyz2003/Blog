import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { StatisticsService } from '../statistics/statistics.service';

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

  constructor(
    private readonly statisticsService: StatisticsService,
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
   * Run a job with both wrappers chained: panicRecovery -> logging -> fn.
   * Matches Go cron.WithChain(NewPanicRecoveryWrapper, NewLoggingWrapper).
   */
  async runJob(jobName: string, fn: () => Promise<void>): Promise<void> {
    await this.wrapWithPanicRecovery(jobName, async () => {
      await this.wrapWithLogging(jobName, fn);
    });
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

    // Yesterday in China timezone
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    this.logger.log(
      `Starting to backfill aggregation data from ${startDate.toISOString()} to ${yesterday.toISOString()}`,
    );

    // Iterate day-by-day from startDate to yesterday
    const current = new Date(startDate);
    while (current.getTime() < today.getTime()) {
      this.logger.log(`Aggregating data for date ${current.toISOString()}`);

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
