package search

import (
	"context"
	"errors"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type fakeSearcher struct {
	result *model.SearchResult
	err    error
}

func (f fakeSearcher) Search(ctx context.Context, query string, page int, size int) (*model.SearchResult, error) {
	return f.result, f.err
}

func (f fakeSearcher) IndexArticle(ctx context.Context, article *model.Article) error {
	return nil
}

func (f fakeSearcher) DeleteArticle(ctx context.Context, articleID string) error {
	return nil
}

func (f fakeSearcher) ClearAllDocuments(ctx context.Context) error {
	return nil
}

func (f fakeSearcher) HealthCheck(ctx context.Context) error {
	return nil
}

type fakeProvider struct {
	hits    []*model.SearchHit
	total   int64
	err     error
	queries []string
}

func (f *fakeProvider) Search(ctx context.Context, query string, limit int) ([]*model.SearchHit, int64, error) {
	f.queries = append(f.queries, query)
	return f.hits, f.total, f.err
}

func TestSearchServiceAppendsExtraProviders(t *testing.T) {
	oldSearcher := AppSearcher
	defer func() { AppSearcher = oldSearcher }()

	AppSearcher = fakeSearcher{result: &model.SearchResult{
		Pagination: &model.SearchPagination{Total: 1, Page: 1, Size: 10, TotalPages: 1},
		Hits: []*model.SearchHit{
			{ID: "post-1", Title: "文章", Abbrlink: "hello"},
		},
	}}

	provider := &fakeProvider{
		hits: []*model.SearchHit{
			{ID: "album-1", Title: "相册", Type: model.SearchHitTypeAlbum, URL: "/album"},
		},
		total: 1,
	}

	svc := NewSearchService()
	svc.RegisterProvider(provider)

	result, err := svc.Search(context.Background(), "美食", 1, 10)
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}

	if len(provider.queries) != 1 || provider.queries[0] != "美食" {
		t.Fatalf("provider queries = %v, want [美食]", provider.queries)
	}
	if got, want := len(result.Hits), 2; got != want {
		t.Fatalf("len(result.Hits) = %d, want %d", got, want)
	}
	if result.Hits[0].Type != model.SearchHitTypePost {
		t.Fatalf("first hit type = %q, want %q", result.Hits[0].Type, model.SearchHitTypePost)
	}
	if result.Hits[1].Type != model.SearchHitTypeAlbum || result.Hits[1].URL != "/album" {
		t.Fatalf("provider hit = %#v, want album with /album", result.Hits[1])
	}
	if got, want := result.Pagination.Total, int64(2); got != want {
		t.Fatalf("pagination total = %d, want %d", got, want)
	}
	if got, want := result.Pagination.TotalPages, 1; got != want {
		t.Fatalf("pagination totalPages = %d, want %d", got, want)
	}
}

func TestSearchServiceReturnsProviderError(t *testing.T) {
	oldSearcher := AppSearcher
	defer func() { AppSearcher = oldSearcher }()

	AppSearcher = fakeSearcher{result: &model.SearchResult{
		Pagination: &model.SearchPagination{Total: 0, Page: 1, Size: 10, TotalPages: 0},
		Hits:       []*model.SearchHit{},
	}}

	svc := NewSearchService()
	svc.RegisterProvider(&fakeProvider{err: errors.New("provider down")})

	if _, err := svc.Search(context.Background(), "美食", 1, 10); err == nil {
		t.Fatal("Search() error = nil, want provider error")
	}
}
