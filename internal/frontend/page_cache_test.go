package frontend

import (
	"net/http/httptest"
	"testing"
)

func TestBuildPageCacheKeyIncludesQuery(t *testing.T) {
	reqA := httptest.NewRequest("GET", "https://example.com/album?category=photos", nil)
	reqB := httptest.NewRequest("GET", "https://example.com/album?category=videos", nil)

	keyA := buildPageCacheKey(reqA)
	keyB := buildPageCacheKey(reqB)

	if keyA == keyB {
		t.Fatalf("buildPageCacheKey returned the same key for different queries: %q", keyA)
	}
	if keyA != "/album?category=photos" {
		t.Fatalf("buildPageCacheKey() = %q, want %q", keyA, "/album?category=photos")
	}
}
