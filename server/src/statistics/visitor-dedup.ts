import { Injectable } from '@nestjs/common';

/**
 * VisitorDedupService — in-memory visitor dedup with TTL-based expiry.
 * Per D-161: three Maps for UV/PV/request dedup matching Go Redis + sync.Map pattern.
 *
 * 1. uvDedupMap: key format stat:uv:{ip}:{date} (unique visitor dedup), TTL to end of current day in China timezone
 * 2. pvDedupMap: key format stat:pv:{ip}:{urlPath}:{date} (unique page view dedup), TTL to end of current day
 * 3. requestDedupMap: key format {visitorId}:{urlPath}:{timestamp/3s} (3-second request dedup), TTL 3 seconds
 */
@Injectable()
export class VisitorDedupService {
  private uvDedupMap = new Map<string, { value: true; expiresAt: number }>();
  private pvDedupMap = new Map<string, { value: true; expiresAt: number }>();
  private requestDedupMap = new Map<string, { value: true; expiresAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      VisitorDedupService.CLEANUP_INTERVAL_MS,
    );
  }

  /**
   * Check if this IP is a unique visitor for the given date.
   * Returns true if new visitor (not seen before or expired), false if duplicate.
   * Key format: stat:uv:{ip}:{date}
   * TTL: end of current day in China timezone.
   */
  isUniqueVisitor(ip: string, date: string): boolean {
    const key = `stat:uv:${ip}:${date}`;
    const entry = this.uvDedupMap.get(key);

    if (entry && entry.expiresAt > Date.now()) {
      return false; // Not unique — already seen today
    }

    // New visitor — set entry with TTL to end of day in China timezone
    const expiresAt = this.getEndOfDayChina(date);
    this.uvDedupMap.set(key, { value: true, expiresAt });
    return true;
  }

  /**
   * Check if this IP+URL is a unique page view for the given date.
   * Returns true if new page view (not seen before or expired), false if duplicate.
   * Key format: stat:pv:{ip}:{urlPath}:{date}
   * TTL: end of current day in China timezone.
   */
  isUniquePageView(ip: string, urlPath: string, date: string): boolean {
    const key = `stat:pv:${ip}:${urlPath}:${date}`;
    const entry = this.pvDedupMap.get(key);

    if (entry && entry.expiresAt > Date.now()) {
      return false; // Not unique — already viewed today
    }

    // New page view — set entry with TTL to end of day in China timezone
    const expiresAt = this.getEndOfDayChina(date);
    this.pvDedupMap.set(key, { value: true, expiresAt });
    return true;
  }

  /**
   * Check if this is a duplicate request within the 3-second window.
   * Returns true if this is a new request (not duplicate), false if duplicate.
   * Key format: {visitorId}:{urlPath}:{timestamp/3s}
   * TTL: 3 seconds.
   */
  isDuplicateRequest(visitorId: string, urlPath: string): boolean {
    const windowKey = Math.floor(Date.now() / 3000); // 3-second window
    const key = `${visitorId}:${urlPath}:${windowKey}`;
    const entry = this.requestDedupMap.get(key);

    if (entry && entry.expiresAt > Date.now()) {
      return true; // Duplicate request
    }

    // New request — set entry with 3-second TTL
    this.requestDedupMap.set(key, { value: true, expiresAt: Date.now() + 3000 });
    return false;
  }

  /**
   * Cleanup expired entries from all maps.
   * Called by setInterval every 30 minutes (matching Go cleanupCaches pattern).
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.uvDedupMap) {
      if (entry.expiresAt <= now) {
        this.uvDedupMap.delete(key);
      }
    }

    for (const [key, entry] of this.pvDedupMap) {
      if (entry.expiresAt <= now) {
        this.pvDedupMap.delete(key);
      }
    }

    for (const [key, entry] of this.requestDedupMap) {
      if (entry.expiresAt <= now) {
        this.requestDedupMap.delete(key);
      }
    }
  }

  /**
   * Calculate end of day in China timezone (UTC+8) as a Unix timestamp in ms.
   * Given a date string like "2026-07-11", returns the ms timestamp for 23:59:59+08:00.
   */
  private getEndOfDayChina(date: string): number {
    // Parse as China timezone end of day: YYYY-MM-DDT23:59:59+08:00
    return new Date(`${date}T23:59:59+08:00`).getTime();
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
