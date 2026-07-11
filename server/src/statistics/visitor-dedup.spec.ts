import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VisitorDedupService } from './visitor-dedup';

describe('VisitorDedupService', () => {
  let service: VisitorDedupService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new VisitorDedupService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  describe('isUniqueVisitor', () => {
    it('should return true for first visit from an IP on a date', () => {
      const result = service.isUniqueVisitor('192.168.1.1', '2026-07-11');
      expect(result).toBe(true);
    });

    it('should return false for repeat visit from same IP on same date', () => {
      service.isUniqueVisitor('192.168.1.1', '2026-07-11');
      const result = service.isUniqueVisitor('192.168.1.1', '2026-07-11');
      expect(result).toBe(false);
    });

    it('should return true for same IP on different date', () => {
      service.isUniqueVisitor('192.168.1.1', '2026-07-11');
      const result = service.isUniqueVisitor('192.168.1.1', '2026-07-12');
      expect(result).toBe(true);
    });

    it('should return true for different IP on same date', () => {
      service.isUniqueVisitor('192.168.1.1', '2026-07-11');
      const result = service.isUniqueVisitor('192.168.1.2', '2026-07-11');
      expect(result).toBe(true);
    });
  });

  describe('isUniquePageView', () => {
    it('should return true for first page view from an IP on a date', () => {
      const result = service.isUniquePageView('192.168.1.1', '/posts/test', '2026-07-11');
      expect(result).toBe(true);
    });

    it('should return false for repeat page view from same IP on same URL and date', () => {
      service.isUniquePageView('192.168.1.1', '/posts/test', '2026-07-11');
      const result = service.isUniquePageView('192.168.1.1', '/posts/test', '2026-07-11');
      expect(result).toBe(false);
    });

    it('should return true for same IP on different URL on same date', () => {
      service.isUniquePageView('192.168.1.1', '/posts/test', '2026-07-11');
      const result = service.isUniquePageView('192.168.1.1', '/posts/other', '2026-07-11');
      expect(result).toBe(true);
    });
  });

  describe('isDuplicateRequest', () => {
    it('should return false for first request (not duplicate)', () => {
      const result = service.isDuplicateRequest('visitor123', '/posts/test');
      expect(result).toBe(false);
    });

    it('should return true for duplicate request within 3-second window', () => {
      service.isDuplicateRequest('visitor123', '/posts/test');
      const result = service.isDuplicateRequest('visitor123', '/posts/test');
      expect(result).toBe(true);
    });

    it('should return false for request after 3-second window', () => {
      service.isDuplicateRequest('visitor123', '/posts/test');

      // Advance time by 4 seconds
      vi.advanceTimersByTime(4000);

      const result = service.isDuplicateRequest('visitor123', '/posts/test');
      expect(result).toBe(false);
    });

    it('should return false for different visitor on same URL', () => {
      service.isDuplicateRequest('visitor123', '/posts/test');
      const result = service.isDuplicateRequest('visitor456', '/posts/test');
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove expired UV dedup entries', () => {
      service.isUniqueVisitor('192.168.1.1', '2026-07-11');

      // Advance time past end of day (China timezone)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours

      service.cleanup();

      const map = (service as any).uvDedupMap;
      expect(map.size).toBe(0);
    });

    it('should remove expired PV dedup entries', () => {
      service.isUniquePageView('192.168.1.1', '/posts/test', '2026-07-11');

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      service.cleanup();

      const map = (service as any).pvDedupMap;
      expect(map.size).toBe(0);
    });

    it('should remove expired request dedup entries', () => {
      service.isDuplicateRequest('visitor123', '/posts/test');

      vi.advanceTimersByTime(5000); // 5 seconds

      service.cleanup();

      const map = (service as any).requestDedupMap;
      expect(map.size).toBe(0);
    });

    it('should keep non-expired entries', () => {
      service.isUniqueVisitor('192.168.1.1', '2026-07-11');

      // Only advance 1 hour — entry should still be valid
      vi.advanceTimersByTime(60 * 60 * 1000);

      service.cleanup();

      const map = (service as any).uvDedupMap;
      expect(map.size).toBe(1);
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
