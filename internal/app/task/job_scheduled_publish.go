/*
 * @Description: 定时发布文章任务
 * @Author: 安知鱼
 * @Date: 2026-01-07
 */
package task

import (
	"context"
	"log/slog"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

// ScheduledPublishJob 是定时发布文章的任务
// 每分钟执行一次，检查是否有需要发布的定时文章
type ScheduledPublishJob struct {
	articleRepo repository.ArticleRepository
	cacheSvc    utility.CacheService
	logger      *slog.Logger
}

// NewScheduledPublishJob 创建定时发布任务实例
func NewScheduledPublishJob(
	articleRepo repository.ArticleRepository,
	cacheSvc utility.CacheService,
	logger *slog.Logger,
) *ScheduledPublishJob {
	return &ScheduledPublishJob{
		articleRepo: articleRepo,
		cacheSvc:    cacheSvc,
		logger:      logger,
	}
}

// Name 返回任务名称
func (j *ScheduledPublishJob) Name() string {
	return "ScheduledPublishJob"
}

// Run 执行定时发布任务
func (j *ScheduledPublishJob) Run() {
	ctx := context.Background()
	now := time.Now()

	j.logger.Info("开始执行定时发布检查", slog.Time("check_time", now))

	// 查找所有需要发布的定时文章
	articles, err := j.articleRepo.FindScheduledArticlesToPublish(ctx, now)
	if err != nil {
		j.logger.Error("查询定时发布文章失败", slog.Any("error", err))
		return
	}

	if len(articles) == 0 {
		j.logger.Debug("没有待发布的定时文章")
		return
	}

	j.logger.Info("找到待发布的定时文章", slog.Int("count", len(articles)))

	// 逐个发布文章
	successCount := 0
	failCount := 0
	for _, article := range articles {
		// 解码公共ID获取数据库ID
		dbID, _, err := idgen.DecodePublicID(article.ID)
		if err != nil {
			j.logger.Error("解码文章ID失败",
				slog.String("article_id", article.ID),
				slog.Any("error", err),
			)
			failCount++
			continue
		}

		// 发布文章
		err = j.articleRepo.PublishScheduledArticle(ctx, dbID)
		if err != nil {
			j.logger.Error("发布定时文章失败",
				slog.String("article_id", article.ID),
				slog.String("title", article.Title),
				slog.Any("error", err),
			)
			failCount++
			continue
		}

		j.logger.Info("定时文章发布成功",
			slog.String("article_id", article.ID),
			slog.String("title", article.Title),
			slog.Time("scheduled_at", *article.ScheduledAt),
		)
		successCount++

		// 清除相关缓存
		j.invalidateArticleCache(ctx, article.ID, article.Abbrlink)
	}

	j.logger.Info("定时发布任务执行完成",
		slog.Int("success", successCount),
		slog.Int("failed", failCount),
	)

	// 如果有成功发布的文章，清除全局缓存
	if successCount > 0 {
		j.invalidateGlobalCaches(ctx)
	}
}

// invalidateArticleCache 清除特定文章的缓存
func (j *ScheduledPublishJob) invalidateArticleCache(ctx context.Context, articleID, abbrlink string) {
	// 清除文章详情缓存
	cacheKeys := []string{
		"article:html:" + articleID,
	}
	if abbrlink != "" {
		cacheKeys = append(cacheKeys, "article:html:"+abbrlink)
	}

	for _, key := range cacheKeys {
		if err := j.cacheSvc.Delete(ctx, key); err != nil {
			j.logger.Warn("清除文章缓存失败",
				slog.String("key", key),
				slog.Any("error", err),
			)
		}
	}
}

// invalidateGlobalCaches 清除全局缓存（RSS、首页等）
func (j *ScheduledPublishJob) invalidateGlobalCaches(ctx context.Context) {
	globalKeys := []string{
		"rss:feed:latest",
		"home:articles:cache",
		"home:featured:cache",
		"sidebar:recent:cache",
	}

	for _, key := range globalKeys {
		if err := j.cacheSvc.Delete(ctx, key); err != nil {
			j.logger.Warn("清除全局缓存失败",
				slog.String("key", key),
				slog.Any("error", err),
			)
		}
	}

	j.logger.Info("已清除全局缓存（RSS、首页等）")
}
