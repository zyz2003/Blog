package ent

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent/article"
	"github.com/anzhiyu-c/anheyu-app/ent/enttest"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

func TestArticleViewStatsUseAllPublicArticles(t *testing.T) {
	if err := idgen.InitSqidsEncoderWithSeed("article_view_stats_test"); err != nil {
		t.Fatalf("InitSqidsEncoderWithSeed() error = %v", err)
	}

	ctx := context.Background()
	client := enttest.Open(t, "sqlite3", "file:article_view_stats?mode=memory&cache=shared&_fk=1")
	defer client.Close()

	now := time.Now()
	for i := 1; i <= 505; i++ {
		client.Article.Create().
			SetTitle(fmt.Sprintf("Public %03d", i)).
			SetStatus(article.StatusPUBLISHED).
			SetViewCount(i).
			SetWordCount(100).
			SetShowOnHome(true).
			SetReviewStatus(article.ReviewStatusAPPROVED).
			SetCreatedAt(now.Add(time.Duration(i) * time.Minute)).
			SaveX(ctx)
	}
	client.Article.Create().
		SetTitle("Draft should be ignored").
		SetStatus(article.StatusDRAFT).
		SetViewCount(10000).
		SetReviewStatus(article.ReviewStatusAPPROVED).
		SaveX(ctx)
	client.Article.Create().
		SetTitle("Pending should be ignored").
		SetStatus(article.StatusPUBLISHED).
		SetViewCount(9000).
		SetReviewStatus(article.ReviewStatusPENDING).
		SaveX(ctx)
	client.Article.Create().
		SetTitle("Takedown should be ignored").
		SetStatus(article.StatusPUBLISHED).
		SetViewCount(8000).
		SetReviewStatus(article.ReviewStatusAPPROVED).
		SetIsTakedown(true).
		SaveX(ctx)

	repo := NewArticleRepo(client, "sqlite3")
	totalViews, err := repo.GetTotalPublicViews(ctx)
	if err != nil {
		t.Fatalf("GetTotalPublicViews() error = %v", err)
	}
	if totalViews != 127765 {
		t.Fatalf("GetTotalPublicViews() = %d, want %d", totalViews, 127765)
	}

	topPosts, err := repo.GetTopViewedPublicArticles(ctx, 10)
	if err != nil {
		t.Fatalf("GetTopViewedPublicArticles() error = %v", err)
	}
	if len(topPosts) != 10 {
		t.Fatalf("len(GetTopViewedPublicArticles()) = %d, want 10", len(topPosts))
	}
	if topPosts[0].ViewCount != 505 || topPosts[0].Title != "Public 505" {
		t.Fatalf("first top post = (%q, %d), want (%q, %d)", topPosts[0].Title, topPosts[0].ViewCount, "Public 505", 505)
	}
	if topPosts[9].ViewCount != 496 || topPosts[9].Title != "Public 496" {
		t.Fatalf("tenth top post = (%q, %d), want (%q, %d)", topPosts[9].Title, topPosts[9].ViewCount, "Public 496", 496)
	}
}
