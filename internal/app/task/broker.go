// internal/app/task/broker.go
package task

import (
	"context"
	"log/slog"
	"os"
	"runtime"
	"runtime/debug"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	article_history_service "github.com/anzhiyu-c/anheyu-app/pkg/service/article_history"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/cleanup"
	configsvc "github.com/anzhiyu-c/anheyu-app/pkg/service/config"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/statistics"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/thumbnail"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"

	"github.com/robfig/cron/v3"
)

// Broker 是整个后台任务模块的核心协调者。
type Broker struct {
	cron              *cron.Cron
	logger            *slog.Logger
	uploadSvc         file.IUploadService
	thumbnailSvc      *thumbnail.ThumbnailService
	cleanupSvc        cleanup.ICleanupService
	jobQueue          chan Job
	articleRepo       repository.ArticleRepository // 保留，用于其他任务
	commentRepo       repository.CommentRepository
	emailSvc          utility.EmailService
	cacheSvc          utility.CacheService
	linkCategoryRepo  repository.LinkCategoryRepository
	linkTagRepo       repository.LinkTagRepository
	linkRepo          repository.LinkRepository
	settingSvc        setting.SettingService
	statService       statistics.VisitorStatService
	articleHistorySvc article_history_service.Service
	backupSvc         configsvc.BackupService
}

// NewBroker 是 Broker 的构造函数。
func NewBroker(
	uploadSvc file.IUploadService,
	thumbnailSvc *thumbnail.ThumbnailService,
	cleanupSvc cleanup.ICleanupService,
	articleRepo repository.ArticleRepository,
	commentRepo repository.CommentRepository,
	emailSvc utility.EmailService,
	cacheSvc utility.CacheService,
	linkCategoryRepo repository.LinkCategoryRepository,
	linkTagRepo repository.LinkTagRepository,
	linkRepo repository.LinkRepository,
	settingSvc setting.SettingService,
	statService statistics.VisitorStatService,
	articleHistorySvc article_history_service.Service,
	backupSvc configsvc.BackupService,
) *Broker {

	slogHandler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(slogHandler).With("system", "task_broker")

	c := cron.New(
		cron.WithSeconds(),
		cron.WithChain(
			NewPanicRecoveryWrapper(logger),
			NewLoggingWrapper(logger),
			cron.DelayIfStillRunning(cron.DefaultLogger),
		),
	)

	jobQueue := make(chan Job, 1000)

	broker := &Broker{
		cron:              c,
		logger:            logger,
		uploadSvc:         uploadSvc,
		thumbnailSvc:      thumbnailSvc,
		cleanupSvc:        cleanupSvc,
		jobQueue:          jobQueue,
		articleRepo:       articleRepo,
		commentRepo:       commentRepo,
		emailSvc:          emailSvc,
		cacheSvc:          cacheSvc,
		linkCategoryRepo:  linkCategoryRepo,
		linkTagRepo:       linkTagRepo,
		linkRepo:          linkRepo,
		settingSvc:        settingSvc,
		statService:       statService,
		articleHistorySvc: articleHistorySvc,
		backupSvc:         backupSvc,
	}

	broker.startWorkerPool()

	return broker
}

// startWorkerPool 启动固定数量的 worker goroutine 来处理任务。
func (b *Broker) startWorkerPool() {
	workerCount := runtime.NumCPU()
	if workerCount <= 0 {
		workerCount = 4
	}
	b.logger.Info("Starting task worker pool", "concurrency", workerCount)

	for i := 0; i < workerCount; i++ {
		workerID := i + 1
		go func() {
			b.logger.Info("Worker started", "worker_id", workerID)
			for job := range b.jobQueue {
				jobWithWrappers := cron.NewChain(
					NewPanicRecoveryWrapper(b.logger),
					NewLoggingWrapper(b.logger),
				).Then(job)

				b.logger.Info("Worker picked up a job", "worker_id", workerID, "job_name", job.Name())
				jobWithWrappers.Run()
				b.logger.Info("Worker finished a job", "worker_id", workerID, "job_name", job.Name())
			}
			b.logger.Info("Worker stopped", "worker_id", workerID)
		}()
	}
}

// DispatchCommentNotification 派发评论通知任务的方法。
func (b *Broker) DispatchCommentNotification(newCommentID uint) {
	job := NewCommentNotificationJob(b.emailSvc, b.commentRepo, newCommentID)
	b.Dispatch(job)
	b.logger.Info("Successfully queued comment notification job", "comment_id", newCommentID)
}

// DispatchOrphanCleanup 创建一个清理孤立项的任务并将其派发到后台执行。
func (b *Broker) DispatchOrphanCleanup() {
	job := NewCleanupOrphanedItemsJob(b.cleanupSvc)
	b.Dispatch(job)
	b.logger.Info("Successfully queued orphaned items cleanup job")
}

// RegisterCronJobs 注册所有周期性任务。
func (b *Broker) RegisterCronJobs() {
	b.logger.Info("Registering all periodic jobs...")

	cleanupJob := NewCleanupAbandonedUploadsJob(b.uploadSvc)
	_, err := b.cron.AddJob("0 0 3 * * *", cleanupJob) // 每天凌晨3点
	if err != nil {
		b.logger.Error("Failed to add 'CleanupAbandonedUploadsJob'", slog.Any("error", err))
		os.Exit(1)
	}
	b.logger.Info("-> Successfully registered 'CleanupAbandonedUploadsJob'", "schedule", "every day at 3:00:00 AM")

	syncViewsJob := NewSyncViewCountsJob(b.articleRepo, b.cacheSvc)
	_, err = b.cron.AddJob("0 0 2 * * *", syncViewsJob) // 每天凌晨 2 点执行一次
	if err != nil {
		b.logger.Error("Failed to add 'SyncViewCountsJob'", slog.Any("error", err))
		os.Exit(1)
	}
	b.logger.Info("-> Successfully registered 'SyncViewCountsJob'", "schedule", "every day at 2:00:00 AM")

	// 添加统计聚合任务
	statsAggregationJob := NewStatisticsAggregationJob(b.statService, b.logger)
	_, err = b.cron.AddJob("0 0 1 * * *", statsAggregationJob) // 每天凌晨1点执行
	if err != nil {
		b.logger.Error("Failed to add 'StatisticsAggregationJob'", slog.Any("error", err))
		os.Exit(1)
	}
	b.logger.Info("-> Successfully registered 'StatisticsAggregationJob'", "schedule", "every day at 1:00:00 AM")

	// 添加友链健康检查任务
	linkHealthCheckJob := NewLinkHealthCheckJob(b.linkRepo, b.logger)
	_, err = b.cron.AddJob("0 0 3 * * *", linkHealthCheckJob) // 每天凌晨3点执行
	if err != nil {
		b.logger.Error("Failed to add 'LinkHealthCheckJob'", slog.Any("error", err))
		os.Exit(1)
	}
	b.logger.Info("-> Successfully registered 'LinkHealthCheckJob'", "schedule", "every day at 3:00:00 AM")

	// 添加定时发布文章任务 - 每分钟检查一次
	scheduledPublishJob := NewScheduledPublishJob(b.articleRepo, b.cacheSvc, b.logger)
	_, err = b.cron.AddJob("0 * * * * *", scheduledPublishJob) // 每分钟的第0秒执行
	if err != nil {
		b.logger.Error("Failed to add 'ScheduledPublishJob'", slog.Any("error", err))
		os.Exit(1)
	}
	b.logger.Info("-> Successfully registered 'ScheduledPublishJob'", "schedule", "every minute")

	// 添加文章历史版本清理任务 - 每天凌晨3:30执行
	if b.articleHistorySvc != nil {
		articleHistoryCleanupJob := NewArticleHistoryCleanupJob(b.articleHistorySvc)
		_, err = b.cron.AddJob("0 30 3 * * *", articleHistoryCleanupJob) // 每天凌晨3:30执行
		if err != nil {
			b.logger.Error("Failed to add 'ArticleHistoryCleanupJob'", slog.Any("error", err))
			os.Exit(1)
		}
		b.logger.Info("-> Successfully registered 'ArticleHistoryCleanupJob'", "schedule", "every day at 3:30:00 AM")
	}

	// 添加定时自动备份任务 - 每天凌晨4点执行
	// 备份任务为非核心功能，注册失败时仅记录日志而不终止应用启动
	if b.backupSvc != nil {
		scheduledBackupJob := NewScheduledBackupJob(b.backupSvc, b.logger)
		_, err = b.cron.AddJob("0 0 4 * * *", scheduledBackupJob) // 每天凌晨4点
		if err != nil {
			b.logger.Error("Failed to add 'ScheduledBackupJob'", slog.Any("error", err))
		} else {
			b.logger.Info("-> Successfully registered 'ScheduledBackupJob'", "schedule", "every day at 4:00:00 AM")
		}
	}

	b.logger.Info("All periodic jobs registered.")
}

// SetBackupService 设置备份服务（用于延迟注入，避免初始化顺序问题）
func (b *Broker) SetBackupService(svc configsvc.BackupService) {
	b.backupSvc = svc
}

// Dispatch 将任务发送到队列中。
func (b *Broker) Dispatch(job Job) {
	b.jobQueue <- job
}

// DispatchThumbnailGeneration 创建一个缩略图生成任务并将其派发到后台执行。
func (b *Broker) DispatchThumbnailGeneration(fileID uint) {
	job := NewThumbnailGenerationJob(b.thumbnailSvc, fileID)
	b.Dispatch(job)
	b.logger.Info("Successfully queued thumbnail generation job", slog.Uint64("file_id", uint64(fileID)))
}

// Start 启动 cron 调度器。
func (b *Broker) Start() {
	b.logger.Info("Task broker started.")
	b.cron.Start()
}

// Stop 优雅地停止 cron 调度器和所有 worker。
func (b *Broker) Stop() {
	b.logger.Info("Stopping task broker...")
	ctx := b.cron.Stop()
	<-ctx.Done()
	close(b.jobQueue)
	b.logger.Info("Task broker gracefully stopped.")
}

// DispatchLinkCleanup 创建一个清理友链相关数据的任务并派发到后台。
func (b *Broker) DispatchLinkCleanup() {
	job := NewLinkCleanupJob(b.linkCategoryRepo, b.linkTagRepo, b.settingSvc)
	b.Dispatch(job)
	b.logger.Info("Successfully queued link cleanup job")
}

// DispatchLinkHealthCheck 创建一个友链健康检查任务并派发到后台。
func (b *Broker) DispatchLinkHealthCheck() {
	job := NewLinkHealthCheckJob(b.linkRepo, b.logger)
	b.Dispatch(job)
	b.logger.Info("Successfully queued link health check job")
}

// CheckAndRunMissedAggregation 在应用启动时检查并追补所有错过的聚合任务
func (b *Broker) CheckAndRunMissedAggregation() {
	b.logger.Info("Checking for any missed statistics aggregation jobs...")

	// 使用 goroutine 在后台执行整个追补过程，避免阻塞启动
	go func() {
		// 添加 panic 恢复机制，防止此后台任务意外崩溃导致整个应用退出
		defer func() {
			if r := recover(); r != nil {
				b.logger.Error("Panic recovered in missed aggregation job",
					slog.Any("panic", r),
					slog.String("stack_trace", string(debug.Stack())),
				)
			}
		}()

		// 留出足够的时间用于追补，例如30分钟
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		// 1. 获取最后一次聚合的日期
		lastDate, err := b.statService.GetLastAggregatedDate(ctx)
		if err != nil && !ent.IsNotFound(err) {
			b.logger.Error("Failed to get last aggregated date", slog.Any("error", err))
			return
		}

		var startDate time.Time
		// 2. 确定追补的起始日期
		if lastDate == nil { // 情况一：从未聚合过
			b.logger.Info("No previous aggregation found. Checking for the first visit log.")
			firstLogDate, err := b.statService.GetFirstLogDate(ctx)
			if err != nil && !ent.IsNotFound(err) {
				b.logger.Error("Failed to get first log date", slog.Any("error", err))
				return
			}
			if firstLogDate == nil { // 如果没有任何访问日志
				b.logger.Info("No visit logs found. Nothing to aggregate.")
				return
			}
			startDate = *firstLogDate
		} else { // 情况二：从上一次聚合的后一天开始
			startDate = lastDate.AddDate(0, 0, 1)
		}

		// 3. 循环追补数据直到昨天（使用中国时区 UTC+8，与访问日志记录时间保持一致）
		now := utils.NowInChina()
		today := utils.StartOfDayInChina(now)
		// 将 startDate 也转换为中国时区
		startDate = utils.StartOfDayInChina(startDate)

		// 如果起始日期不在今天之前，说明数据已经是最新的，无需追补
		if !startDate.Before(today) {
			b.logger.Info("Statistics are already up to date. No aggregation needed.")
			return
		}

		b.logger.Info("Starting to backfill aggregation data...", "from", startDate.Format("2006-01-02"), "to", today.AddDate(0, 0, -1).Format("2006-01-02"))

		// 从起始日开始，一天天循环聚合，直到今天的前一天
		for day := startDate; day.Before(today); day = day.AddDate(0, 0, 1) {
			b.logger.Info("Aggregating data for date", slog.String("date", day.Format("2006-01-02")))

			// 执行单日聚合
			if err := b.statService.AggregateDaily(ctx, day); err != nil {
				b.logger.Error("Failed to run missed aggregation job for date", slog.Any("error", err), slog.String("date", day.Format("2006-01-02")))
				b.logger.Info("Stopping backfill process due to an error.")
				return // 如果某一天聚合失败，则停止整个过程，等待下次启动再试
			}
		}

		b.logger.Info("Successfully completed all missed aggregation jobs.")
	}()
}
