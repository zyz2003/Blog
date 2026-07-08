import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommentRateLimiter } from './comment-rate-limiter';
import { BadRequestException } from '@nestjs/common';

describe('CommentRateLimiter', () => {
  let limiter: CommentRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new CommentRateLimiter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow comments within the rate limit', () => {
    expect(() => limiter.checkLimit('127.0.0.1', 5)).not.toThrow();
  });

  it('should throw BadRequestException when rate limit exceeded', () => {
    const limit = 3;
    // First 3 should pass
    limiter.checkLimit('127.0.0.1', limit);
    limiter.checkLimit('127.0.0.1', limit);
    limiter.checkLimit('127.0.0.1', limit);

    // 4th should throw
    expect(() => limiter.checkLimit('127.0.0.1', limit)).toThrow(BadRequestException);
    expect(() => limiter.checkLimit('127.0.0.1', limit)).toThrow('您的评论太频繁了，请稍后再试');
  });

  it('should track different IPs independently', () => {
    const limit = 2;
    limiter.checkLimit('192.168.1.1', limit);
    limiter.checkLimit('192.168.1.1', limit);

    // Different IP should still be allowed
    expect(() => limiter.checkLimit('10.0.0.1', limit)).not.toThrow();
  });

  it('should use minute-based key format', () => {
    const limit = 1;
    limiter.checkLimit('127.0.0.1', limit);

    // Advance time by 1 minute — new minute key should allow again
    vi.advanceTimersByTime(60_000);
    expect(() => limiter.checkLimit('127.0.0.1', limit)).not.toThrow();
  });

  it('should clean up rate limit entries after 70 seconds', () => {
    const limit = 1;
    limiter.checkLimit('127.0.0.1', limit);

    // Entry should still exist before 70s
    expect((limiter as any).rateLimitMap.size).toBeGreaterThan(0);

    // Advance time by 70 seconds — cleanup should fire
    vi.advanceTimersByTime(70_000);
    expect((limiter as any).rateLimitMap.size).toBe(0);
  });

  it('should schedule cleanup only on first entry for a key', () => {
    const limit = 5;
    limiter.checkLimit('127.0.0.1', limit);
    limiter.checkLimit('127.0.0.1', limit);

    // Only one entry in the map (same key)
    expect((limiter as any).rateLimitMap.size).toBe(1);
  });

  it('should throw with Chinese error message matching Go backend', () => {
    const limit = 1;
    limiter.checkLimit('127.0.0.1', limit);

    try {
      limiter.checkLimit('127.0.0.1', limit);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe('您的评论太频繁了，请稍后再试');
    }
  });
});
