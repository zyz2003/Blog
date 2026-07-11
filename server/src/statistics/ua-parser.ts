import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import type { IUAParser } from 'ua-parser-js';
import { createHash } from 'crypto';

/**
 * UAParserService — UA parsing with MD5-keyed 12h TTL cache.
 * Per D-165: wraps ua-parser-js with cache matching Go userAgentCache pattern.
 * Cache key = MD5 hex of userAgent string.
 * Cleanup: setInterval every 30 minutes to purge entries older than 12h.
 */
@Injectable()
export class UAParserService {
  private cache = new Map<string, { browser: string; os: string; device: string; timestamp: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
  private static readonly CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      UAParserService.CLEANUP_INTERVAL_MS,
    );
  }

  /**
   * Parse User-Agent string with caching.
   * Returns { browser, os, device }.
   * Default device to 'Desktop' if type is undefined (matching Go backend behavior).
   */
  parse(userAgent: string): { browser: string; os: string; device: string } {
    const cacheKey = createHash('md5').update(userAgent).digest('hex');

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < UAParserService.CACHE_TTL_MS) {
      return { browser: cached.browser, os: cached.os, device: cached.device };
    }

    // Cache miss or expired — parse UA
    // ua-parser-js v2: UAParser is a named export, call directly as function
    const result: IUAParser.IResult = UAParser(userAgent);

    const browser = result.browser?.name || 'Other';
    const os = result.os?.name || 'Other';
    const device = result.device?.type
      ? this.normalizeDeviceType(result.device.type)
      : 'Desktop';

    // Store in cache
    this.cache.set(cacheKey, { browser, os, device, timestamp: Date.now() });

    return { browser, os, device };
  }

  /**
   * Normalize device type to match Go backend Chinese labels.
   * Go returns: 桌面, 手机, 平板
   */
  private normalizeDeviceType(type: string): string {
    switch (type.toLowerCase()) {
      case 'mobile':
        return 'Mobile';
      case 'tablet':
        return 'Tablet';
      case 'smarttv':
      case 'wearable':
      case 'embedded':
        return 'Other';
      default:
        return 'Desktop';
    }
  }

  /**
   * Cleanup expired cache entries.
   * Called by setInterval every 30 minutes (matching Go cleanupCaches pattern).
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp >= UAParserService.CACHE_TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup timer. Call on module destroy.
   */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
