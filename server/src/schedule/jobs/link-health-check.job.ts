import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleService } from '../schedule.service';
import { LinkService } from '../../link/link.service';

/**
 * LinkHealthCheckJob — checks health of all friend links.
 * Schedule: daily at 3:00 AM (0 3 * * *)
 * Matches Go LinkHealthCheckJob (job_link_health_check.go).
 * Per D-227: 10-minute timeout, bypasses is_running guard.
 */
@Injectable()
export class LinkHealthCheckJob {
  private readonly logger = new Logger(LinkHealthCheckJob.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly linkService: LinkService,
  ) {}

  @Cron('0 3 * * *')
  async handleCron() {
    await this.scheduleService.runJob(LinkHealthCheckJob.name, async () => {
      // 10-minute timeout
      const timeoutMs = 10 * 60 * 1000;
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Link health check timed out after 10 minutes')), timeoutMs);
      });

      try {
        const result = await Promise.race([
          this.linkService.forceHealthCheck(),
          timeoutPromise,
        ]);

        if (result) {
          this.logger.log(
            `Link health check completed: total=${result.total} healthy=${result.healthy} unhealthy=${result.unhealthy}`,
          );
        }
      } catch (error) {
        this.logger.error(`Link health check failed: ${String(error)}`);
        throw error;
      }
    });
  }
}
