package middleware

import (
	"testing"
	"time"
)

func TestSlidingWindowIPRateLimiterBlocksFourthRequestInWindow(t *testing.T) {
	now := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	limiter := newSlidingWindowIPRateLimiter(3, 10*time.Minute, func() time.Time {
		return now
	})

	for i := 0; i < 3; i++ {
		if !limiter.allow("203.0.113.10") {
			t.Fatalf("allow attempt %d = false, want true", i+1)
		}
	}

	if limiter.allow("203.0.113.10") {
		t.Fatal("allow fourth attempt = true, want false")
	}
}

func TestSlidingWindowIPRateLimiterAllowsAfterWindow(t *testing.T) {
	now := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	limiter := newSlidingWindowIPRateLimiter(1, 10*time.Minute, func() time.Time {
		return now
	})

	if !limiter.allow("203.0.113.10") {
		t.Fatal("first allow = false, want true")
	}
	if limiter.allow("203.0.113.10") {
		t.Fatal("second allow in same window = true, want false")
	}

	now = now.Add(10*time.Minute + time.Nanosecond)

	if !limiter.allow("203.0.113.10") {
		t.Fatal("allow after window = false, want true")
	}
}
