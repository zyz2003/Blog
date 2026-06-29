package task

import (
	"context"
	"log/slog"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/service/config"
)

const maxRetries = 3

// ScheduledBackupJob 定时自动备份任务
// 在 cron 调度下定期创建系统设置备份
type ScheduledBackupJob struct {
	backupSvc config.BackupService
	logger    *slog.Logger
}

// NewScheduledBackupJob 创建定时备份任务实例
func NewScheduledBackupJob(backupSvc config.BackupService, logger *slog.Logger) *ScheduledBackupJob {
	return &ScheduledBackupJob{
		backupSvc: backupSvc,
		logger:    logger,
	}
}

// Name 返回任务名称
func (j *ScheduledBackupJob) Name() string {
	return "ScheduledBackupJob"
}

// Run 执行定时备份（含重试）
func (j *ScheduledBackupJob) Run() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	j.logger.Info("开始执行定时自动备份...")

	var backup *config.BackupInfo
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		var err error
		backup, err = j.backupSvc.CreateBackup(ctx, "定时自动备份", true)
		if err == nil {
			break
		}
		lastErr = err
		j.logger.Warn("定时备份尝试失败",
			slog.Int("attempt", attempt),
			slog.Int("max_retries", maxRetries),
			slog.Any("error", err),
		)
		if attempt < maxRetries {
			time.Sleep(time.Duration(attempt) * 10 * time.Second)
		}
	}

	if lastErr != nil && backup == nil {
		j.logger.Error("定时自动备份最终失败（已重试）", slog.Any("error", lastErr))
		return
	}

	j.logger.Info("定时自动备份完成",
		slog.String("filename", backup.Filename),
		slog.Int64("size", backup.Size),
	)
}
