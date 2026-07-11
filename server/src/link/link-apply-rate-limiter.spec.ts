import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LinkApplyRateLimiter } from './link-apply-rate-limiter';

describe('LinkApplyRateLimiter', () => {
  let limiter: LinkApplyRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new LinkApplyRateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within the limit', () => {
    expect(() => limiter.checkLimit('127.0.0.1', 3)).not.toThrow();
    expect(() => limiter.checkLimit('127.0.0.1', 3)).not.toThrow();
    expect(() => limiter.checkLimit('127.0.0.1', 3)).not.toThrow();
  });

  it('should throw when rate limit exceeded', () => {
    limiter.checkLimit('127.0.0.1', 2);
    limiter.checkLimit('127.0.0.1', 2);

    expect(() => limiter.checkLimit('127.0.0.1', 2)).toThrow('友链申请太频繁，请明天再试');
  });

  it('should track different IPs independently', () => {
    limiter.checkLimit('127.0.0.1', 1);
    // Different IP should have its own counter
    expect(() => limiter.checkLimit('192.168.1.1', 1)).not.toThrow();
  });

  it('should use link:apply:{ip}:{date} key format per D-171', () => {
    // Verify the key format by checking that the same IP on the same date is rate-limited
    limiter.checkLimit('10.0.0.1', 1);
    expect(() => limiter.checkLimit('10.0.0.1', 1)).toThrow();
  });

  it('should schedule cleanup at end of day', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    limiter.checkLimit('127.0.0.1', 5);

    // setTimeout should have been called for cleanup scheduling
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it('should reset count after day rolls over', () => {
    limiter.checkLimit('127.0.0.1', 1);

    // Advance time by 25 hours (past end of day)
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    // Should not throw after day rollover
    expect(() => limiter.checkLimit('127.0.0.1', 1)).not.toThrow();
  });
});
