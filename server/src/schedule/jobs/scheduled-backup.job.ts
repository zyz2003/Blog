import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';

/**
 * ScheduledBackupJob — creates automatic daily backup.
 * Schedule: daily at 4:00 AM (0 4 * * *)
 * Matches Go ScheduledBackupJob (job_scheduled_backup.go).
 * Per D-232: stub for now — BackupService will be implemented in Plan 10-03.
 * Retry logic: up to 3 attempts with backoff (10s, 20s, 30s).
 */
@Injectable()
export class ScheduledBackupJob {
  private readonly logger = new Logger(ScheduledBackupJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
  ) {}

  @Cron('0 4 * * *')
  async handleCron() {
    await this.scheduleService.runJob(ScheduledBackupJob.name, async () => {
      // BackupService not yet available — stub per Plan 10-03
      this.logger.log('BackupService not available — scheduled backup skipped (will be implemented in Plan 10-03)');
    });
  }
}
