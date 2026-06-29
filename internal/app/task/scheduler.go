/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-12 16:09:46
 * @LastEditTime: 2025-07-18 18:20:00
 * @LastEditors: 安知鱼
 */
package task

import (
	"log/slog"
	"os"

	"github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	article_history_service "github.com/anzhiyu-c/anheyu-app/pkg/service/article_history"

	"github.com/robfig/cron/v3"
)

// Scheduler 封装了 cron 实例和其依赖。
// 它是整个定时任务模块的核心协调者，负责任务的注册、启动和停止。
type Scheduler struct {
	cron   *cron.Cron
	logger *slog.Logger
	// 在这里注入所有任务可能需要的 service 依赖
	uploadSvc         file.IUploadService
	articleHistorySvc article_history_service.Service
}

// NewScheduler 是 Scheduler 的构造函数。
// 它现在使用 slog 来创建 logger，并将其传递给新的装饰器。
func NewScheduler(uploadSvc file.IUploadService, articleHistorySvc article_history_service.Service) *Scheduler {
	// 1. 创建一个 slog.Logger 实例，并为其添加一个固定的 "system":"cron" 属性。
	slogHandler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(slogHandler).With("system", "cron")

	// 2. 创建一个新的 cron 调度器实例，并将新的 logger 传递给装饰器。
	c := cron.New(
		cron.WithSeconds(),
		cron.WithChain(
			// NewPanicRecoveryWrapper 和 NewLoggingWrapper 现在接收 *slog.Logger
			NewPanicRecoveryWrapper(logger),
			NewLoggingWrapper(logger),
			cron.DelayIfStillRunning(cron.DefaultLogger),
		),
	)

	return &Scheduler{
		cron:              c,
		logger:            logger,
		uploadSvc:         uploadSvc,
		articleHistorySvc: articleHistorySvc,
	}
}

// RegisterJobs 在调度器中注册所有定义好的定时任务。
func (s *Scheduler) RegisterJobs() {
	s.logger.Info("Registering all periodic jobs...")

	// --- 任务1: 清理被遗弃的上传记录 ---
	cleanupJob := NewCleanupAbandonedUploadsJob(s.uploadSvc)

	_, err := s.cron.AddJob("0 0 3 * * *", cleanupJob)
	if err != nil {
		// 使用 slog.Error 记录致命错误，然后退出程序，模拟 log.Fatalf 的行为。
		s.logger.Error("Failed to add 'CleanupAbandonedUploadsJob'", slog.Any("error", err))
		os.Exit(1)
	}
	s.logger.Info("-> Successfully registered 'CleanupAbandonedUploadsJob'", "schedule", "every day at 3:00:00 AM")

	// --- 任务2: 清理文章旧历史版本 ---
	if s.articleHistorySvc != nil {
		historyCleanupJob := NewArticleHistoryCleanupJob(s.articleHistorySvc)
		_, err = s.cron.AddJob("0 30 3 * * *", historyCleanupJob)
		if err != nil {
			s.logger.Error("Failed to add 'ArticleHistoryCleanupJob'", slog.Any("error", err))
			os.Exit(1)
		}
		s.logger.Info("-> Successfully registered 'ArticleHistoryCleanupJob'", "schedule", "every day at 3:30:00 AM")
	}

	s.logger.Info("All periodic jobs registered.")
}

// Start 启动 cron 调度器。
func (s *Scheduler) Start() {
	s.logger.Info("Cron scheduler started.")
	s.cron.Start()
}

// Stop 优雅地停止 cron 调度器。
func (s *Scheduler) Stop() {
	s.logger.Info("Stopping cron scheduler...")
	ctx := s.cron.Stop()
	<-ctx.Done()
	s.logger.Info("Cron scheduler gracefully stopped.")
}
