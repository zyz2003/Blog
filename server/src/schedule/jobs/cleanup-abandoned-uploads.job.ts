import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { UploadService } from '../../file/upload.service';

/**
 * CleanupAbandonedUploadsJob — cleans up abandoned upload records.
 * Schedule: daily at 3:00 AM (0 3 * * *)
 * Matches Go CleanupAbandonedUploadsJob (job_cleanup.go).
 */
@Injectable()
export class CleanupAbandonedUploadsJob {
  private readonly logger = new Logger(CleanupAbandonedUploadsJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly uploadService: UploadService,
  ) {}

  @Cron('0 3 * * *')
  async handleCron() {
    await this.scheduleService.runJob(CleanupAbandonedUploadsJob.name, async () => {
      const cleanedCount = await this.uploadService.cleanupAbandonedUploads();
      this.logger.log(`Cleaned up ${cleanedCount} abandoned upload records`);
    });
  }
}
