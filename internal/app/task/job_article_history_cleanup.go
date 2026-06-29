/*
 * @Description: 文章历史版本清理定时任务
 * @Author: 安知鱼
 * @Date: 2026-01-13
 */
package task

import (
	"context"
	"log"

	article_history_service "github.com/anzhiyu-c/anheyu-app/pkg/service/article_history"
)

// ArticleHistoryCleanupJob 负责定期清理文章的旧历史版本
// 保留策略：每篇文章最多保留10个历史版本
type ArticleHistoryCleanupJob struct {
	historyService article_history_service.Service
}

// NewArticleHistoryCleanupJob 是任务的构造函数
func NewArticleHistoryCleanupJob(historyService article_history_service.Service) *ArticleHistoryCleanupJob {
	return &ArticleHistoryCleanupJob{
		historyService: historyService,
	}
}

// Run 是 Job 接口要求实现的方法
func (j *ArticleHistoryCleanupJob) Run() {
	cleanedCount, err := j.historyService.CleanupAllOldVersions(context.Background())
	if err != nil {
		log.Printf("任务 '%s' 在执行业务逻辑时捕获到错误: %v", j.Name(), err)
	} else {
		log.Printf("任务 '%s' 业务逻辑执行完毕，共清理了 %d 篇文章的旧版本。", j.Name(), cleanedCount)
	}
}

// Name 方法让日志包装器可以打印出更有意义的任务名
func (j *ArticleHistoryCleanupJob) Name() string {
	return "ArticleHistoryCleanupJob"
}
