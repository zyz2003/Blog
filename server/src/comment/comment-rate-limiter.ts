import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Comment rate limiter using in-memory Map.
 * Per D-130: tracks IP+minute counts, matches Go Redis Increment pattern.
 * Key format: comment:rate_limit:{ip}:{minute}
 * Cleanup: setTimeout at 70s matching Go's 70s Redis expiry.
 */
@Injectable()
export class CommentRateLimiter {
  private rateLimitMap = new Map<string, number>();

  /**
   * Check if the IP has exceeded the rate limit for the current minute.
   * Throws BadRequestException with Chinese message when limit exceeded.
   *
   * @param ip - Client IP address
   * @param limitPerMinute - Maximum comments allowed per minute per IP
   * @throws BadRequestException when rate limit exceeded
   */
  checkLimit(ip: string, limitPerMinute: number): void {
    const now = new Date();
    // Format: YYYYMMDDHHmm — matches Go time.Now().Format("200601021504")
    const minute = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0');

    const key = `comment:rate_limit:${ip}:${minute}`;
    const count = (this.rateLimitMap.get(key) || 0) + 1;
    this.rateLimitMap.set(key, count);

    if (count === 1) {
      // Schedule cleanup after 70 seconds (matching Go's 70s Redis expiry)
      setTimeout(() => this.rateLimitMap.delete(key), 70_000);
    }

    if (count > limitPerMinute) {
      throw new BadRequestException('您的评论太频繁了，请稍后再试');
    }
  }
}
