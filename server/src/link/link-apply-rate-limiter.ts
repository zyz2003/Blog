import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Link apply rate limiter using in-memory Map.
 * Per D-171: tracks IP+date counts, matches Go rate limiting pattern.
 * Key format: link:apply:{ip}:{date} where date is YYYY-MM-DD in China timezone.
 * Cleanup: setTimeout at end of day (China timezone).
 */
@Injectable()
export class LinkApplyRateLimiter {
  private rateLimitMap = new Map<string, number>();

  /**
   * Check if the IP has exceeded the daily rate limit for link applications.
   * Throws BadRequestException with Chinese message when limit exceeded.
   *
   * @param ip - Client IP address
   * @param maxPerDay - Maximum link applications allowed per day per IP
   * @throws BadRequestException when rate limit exceeded
   */
  checkLimit(ip: string, maxPerDay: number): void {
    // Get current date in China timezone (UTC+8)
    const now = new Date();
    const chinaOffset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(now.getTime() + chinaOffset + now.getTimezoneOffset() * 60 * 1000);
    const date = `${chinaTime.getFullYear()}-${String(chinaTime.getMonth() + 1).padStart(2, '0')}-${String(chinaTime.getDate()).padStart(2, '0')}`;

    const key = `link:apply:${ip}:${date}`;
    const count = (this.rateLimitMap.get(key) || 0) + 1;
    this.rateLimitMap.set(key, count);

    if (count === 1) {
      // Schedule cleanup at end of day in China timezone
      // Compute ms until midnight China time
      const endOfDay = new Date(chinaTime);
      endOfDay.setHours(23, 59, 59, 999);
      const msUntilEndOfDay = endOfDay.getTime() - chinaTime.getTime() + 1000; // +1s to roll over to next day
      setTimeout(() => this.rateLimitMap.delete(key), msUntilEndOfDay);
    }

    if (count > maxPerDay) {
      throw new BadRequestException('友链申请太频繁，请明天再试');
    }
  }
}
