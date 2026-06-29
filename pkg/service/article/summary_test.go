package article

import (
	"reflect"
	"testing"
)

func TestNormalizeArticleSummariesDefaultLimit(t *testing.T) {
	got := normalizeArticleSummaries([]string{" first ", "", "second", "third"}, 0, "Test")
	want := []string{"first"}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeArticleSummaries() = %#v, want %#v", got, want)
	}
}

func TestNormalizeArticleSummariesProLimit(t *testing.T) {
	got := normalizeArticleSummaries([]string{" first ", "second", "", "third", "fourth"}, 3, "Test")
	want := []string{"first", "second", "third"}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("normalizeArticleSummaries() = %#v, want %#v", got, want)
	}
}
