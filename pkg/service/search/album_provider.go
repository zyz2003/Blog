package search

import (
	"context"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type albumSearchRepository interface {
	SearchPublicAlbums(ctx context.Context, opts repository.AlbumSearchOptions) (*repository.PageResult[model.Album], error)
}

// AlbumSearchProvider 将公开相册接入全站搜索。
type AlbumSearchProvider struct {
	repo albumSearchRepository
}

func NewAlbumSearchProvider(repo albumSearchRepository) *AlbumSearchProvider {
	return &AlbumSearchProvider{repo: repo}
}

func (p *AlbumSearchProvider) Search(ctx context.Context, query string, limit int) ([]*model.SearchHit, int64, error) {
	if p == nil || p.repo == nil {
		return nil, 0, nil
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return []*model.SearchHit{}, 0, nil
	}
	if limit <= 0 {
		limit = 10
	}

	result, err := p.repo.SearchPublicAlbums(ctx, repository.AlbumSearchOptions{
		Query: query,
		Limit: limit,
	})
	if err != nil {
		return nil, 0, err
	}
	if result == nil {
		return []*model.SearchHit{}, 0, nil
	}

	hits := make([]*model.SearchHit, 0, len(result.Items))
	for _, album := range result.Items {
		if album == nil {
			continue
		}
		hits = append(hits, albumToSearchHit(album))
	}
	return hits, result.Total, nil
}

func albumToSearchHit(album *model.Album) *model.SearchHit {
	publishDate := album.CreatedAt
	if album.PublishedAt != nil {
		publishDate = *album.PublishedAt
	}

	title := strings.TrimSpace(album.Title)
	if title == "" {
		title = "相册"
	}

	snippetParts := make([]string, 0, 3)
	if album.Description != "" {
		snippetParts = append(snippetParts, album.Description)
	}
	if album.Location != "" {
		snippetParts = append(snippetParts, album.Location)
	}
	if album.Tags != "" {
		snippetParts = append(snippetParts, album.Tags)
	}

	return &model.SearchHit{
		ID:          fmt.Sprintf("album-%d", album.ID),
		Type:        model.SearchHitTypeAlbum,
		URL:         "/album",
		Title:       title,
		Snippet:     strings.Join(snippetParts, " · "),
		Author:      "相册",
		Category:    "相册",
		Tags:        splitAlbumTags(album.Tags),
		PublishDate: publishDate,
		CoverURL:    album.ImageUrl,
		ViewCount:   album.ViewCount,
	}
}

func splitAlbumTags(tags string) []string {
	if strings.TrimSpace(tags) == "" {
		return []string{}
	}
	parts := strings.Split(tags, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
