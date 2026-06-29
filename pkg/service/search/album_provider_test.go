package search

import (
	"context"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type fakeAlbumSearchRepository struct {
	opts repository.AlbumSearchOptions
}

func (f *fakeAlbumSearchRepository) SearchPublicAlbums(ctx context.Context, opts repository.AlbumSearchOptions) (*repository.PageResult[model.Album], error) {
	f.opts = opts
	publishedAt := time.Date(2026, 5, 20, 8, 0, 0, 0, time.UTC)
	return &repository.PageResult[model.Album]{
		Total: 1,
		Items: []*model.Album{
			{
				ID:            12,
				Title:         "重庆火锅",
				Description:   "周末美食探店",
				Tags:          "美食,火锅",
				Location:      "重庆",
				ImageUrl:      "https://example.com/hotpot.webp",
				ViewCount:     8,
				DownloadCount: 2,
				PublishedAt:   &publishedAt,
			},
		},
	}, nil
}

func TestAlbumSearchProviderSearchesPublicAlbums(t *testing.T) {
	repo := &fakeAlbumSearchRepository{}
	provider := NewAlbumSearchProvider(repo)

	hits, total, err := provider.Search(context.Background(), "美食", 10)
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}

	if repo.opts.Query != "美食" || repo.opts.Limit != 10 {
		t.Fatalf("repo opts = %#v, want query 美食 limit 10", repo.opts)
	}
	if total != 1 {
		t.Fatalf("total = %d, want 1", total)
	}
	if len(hits) != 1 {
		t.Fatalf("len(hits) = %d, want 1", len(hits))
	}

	hit := hits[0]
	if hit.ID != "album-12" {
		t.Fatalf("hit.ID = %q, want album-12", hit.ID)
	}
	if hit.Type != model.SearchHitTypeAlbum {
		t.Fatalf("hit.Type = %q, want %q", hit.Type, model.SearchHitTypeAlbum)
	}
	if hit.URL != "/album" {
		t.Fatalf("hit.URL = %q, want /album", hit.URL)
	}
	if hit.CoverURL != "https://example.com/hotpot.webp" {
		t.Fatalf("hit.CoverURL = %q", hit.CoverURL)
	}
	if hit.PublishDate.IsZero() {
		t.Fatal("hit.PublishDate is zero")
	}
}
