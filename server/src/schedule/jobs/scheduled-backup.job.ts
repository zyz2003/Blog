import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { BackupService } from '../../backup/backup.service';

/**
 * ScheduledBackupJob — creates automatic daily backup.
 * Schedule: daily at 4:00 AM (0 4 * * *)
 * Matches Go ScheduledBackupJob (job_scheduled_backup.go).
 *
 * Retry logic: up to 3 attempts with backoff (10s, 20s, 30s).
 * 5-minute timeout wraps entire retry loop.
 * On success: log filename and size.
 * On all failures: throw last error.
 */
@Injectable()
export class ScheduledBackupJob {
  private readonly logger = new Logger(ScheduledBackupJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly backupService: BackupService,
  ) {}

  @Cron('0 4 * * *')
  async handleCron() {
    await this.scheduleService.runJob(ScheduledBackupJob.name, async () => {
      await this.runWithRetry();
    });
  }

  /**
   * Run backup with retry logic: up to 3 attempts with backoff (10s, 20s, 30s).
   * 5-minute timeout wraps entire retry loop.
   * Matches Go ScheduledBackupJob retry pattern.
   */
  private async runWithRetry(): Promise<void> {
    const maxAttempts = 3;
    const backoffMs = [10_000, 20_000, 30_000];
    const timeoutMs = 5 * 60 * 1000; // 5 minutes

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Scheduled backup timed out after 5 minutes')),
        timeoutMs,
      );
    });

    await Promise.race([
      this.doRetry(maxAttempts, backoffMs),
      timeoutPromise,
    ]);
  }

  private async doRetry(maxAttempts: number, backoffMs: number[]): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const backup = await this.backupService.createBackup('每日自动备份', true);
        this.logger.log(
          `Scheduled backup succeeded: ${backup.filename} (${backup.size} bytes)`,
        );
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Scheduled backup attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`,
        );

        if (attempt < maxAttempts) {
          const delay = backoffMs[attempt - 1] || 30_000;
          this.logger.log(`Retrying in ${delay / 1000}s...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Scheduled backup failed after all attempts');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
