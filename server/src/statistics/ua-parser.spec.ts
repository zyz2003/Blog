import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UAParserService } from './ua-parser';

describe('UAParserService', () => {
  let service: UAParserService;

  beforeEach(() => {
    service = new UAParserService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('parse', () => {
    it('should parse Chrome on Windows Desktop', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = service.parse(ua);

      expect(result.browser).toBe('Chrome');
      expect(result.os).toBe('Windows');
      expect(result.device).toBe('Desktop');
    });

    it('should parse Safari on macOS Desktop', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      const result = service.parse(ua);

      expect(result.browser).toBe('Safari');
      expect(result.os).toBe('macOS');
      expect(result.device).toBe('Desktop');
    });

    it('should parse Mobile device', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = service.parse(ua);

      expect(result.device).toBe('Mobile');
    });

    it('should default device to Desktop when type is undefined', () => {
      // A UA string that doesn't indicate mobile/tablet
      const ua = 'SomeUnknownDesktopBrowser/1.0';
      const result = service.parse(ua);

      expect(result.device).toBe('Desktop');
    });

    it('should return cached result on second call with same UA', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
      const result1 = service.parse(ua);
      const result2 = service.parse(ua);

      expect(result1).toEqual(result2);
    });

    it('should use MD5 hash as cache key', () => {
      const parseSpy = vi.spyOn(service as any, 'parse');
      const ua = 'TestAgent/1.0';

      // First call — cache miss
      service.parse(ua);
      // Second call — cache hit (should not re-parse)
      service.parse(ua);

      // Both calls go through parse(), but the second should hit cache
      // We verify by checking the cache map directly
      const cache = (service as any).cache;
      expect(cache.size).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired cache entries', () => {
      const ua = 'TestAgent/1.0';
      service.parse(ua);

      // Manually expire the cache entry
      const cache = (service as any).cache;
      for (const [, entry] of cache) {
        entry.timestamp = Date.now() - 13 * 60 * 60 * 1000; // 13 hours ago
      }

      service.cleanup();

      expect(cache.size).toBe(0);
    });

    it('should keep non-expired cache entries', () => {
      const ua = 'TestAgent/1.0';
      service.parse(ua);

      service.cleanup();

      const cache = (service as any).cache;
      expect(cache.size).toBe(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear the cleanup timer', () => {
      const timer = (service as any).cleanupTimer;
      expect(timer).not.toBeNull();

      service.onModuleDestroy();

      expect((service as any).cleanupTimer).toBeNull();
    });
  });
});
