import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { getChinaYesterday } from '../../common/utils/time.util';

/**
 * StatisticsAggregationJob — aggregates daily statistics from visitor_logs.
 * Schedule: daily at 1:00 AM (0 1 * * *)
 * Matches Go StatisticsAggregationJob (job_statistics_aggregation.go).
 * Per D-226: 10-minute timeout.
 */
@Injectable()
export class StatisticsAggregationJob {
  private readonly logger = new Logger(StatisticsAggregationJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly statisticsService: StatisticsService,
  ) {}

  @Cron('0 1 * * *')
  async handleCron() {
    await this.scheduleService.runJob(StatisticsAggregationJob.name, async () => {
      // Aggregate yesterday's data (China timezone UTC+8)
      const yesterday = getChinaYesterday();

      // 10-minute timeout
      const timeoutMs = 10 * 60 * 1000;
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Statistics aggregation timed out after 10 minutes')), timeoutMs);
      });

      try {
        await Promise.race([
          this.statisticsService.aggregateDaily(yesterday),
          timeoutPromise,
        ]);
        this.logger.log(`Statistics aggregation completed for ${yesterday.toISOString()}`);
      } catch (error) {
        this.logger.error(`Statistics aggregation failed: ${String(error)}`);
        throw error; // Re-throw so wrapper logs it
      }
    });
  }
}
