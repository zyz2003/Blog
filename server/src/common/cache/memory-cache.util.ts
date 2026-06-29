/**
 * In-memory cache with TTL support and auto-cleanup.
 * Replaces Redis for single-user blog scenario.
 *
 * Per D-14: Map + TTL basic in-memory cache, startup timer cleans expired entries.
 */
export class MemoryCache {
  private store = new Map<string, { value: any; expiresAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs: number = 60000) {
    // Clean expired entries every 60 seconds by default
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * Store a value with a TTL (time-to-live) in milliseconds.
   */
  set<T = any>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Retrieve a value by key. Returns undefined if not found or expired.
   * Automatically deletes expired entries on access.
   */
  get<T = any>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Delete a specific key from the cache.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove all expired entries from the store.
   * Uses forEach instead of for-of to avoid downlevelIteration requirement.
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });
    for (const key of expiredKeys) {
      this.store.delete(key);
    }
  }

  /**
   * Stop the cleanup interval. Should be called on application shutdown.
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get the number of entries in the cache (including potentially expired ones).
   */
  get size(): number {
    return this.store.size;
  }
}
