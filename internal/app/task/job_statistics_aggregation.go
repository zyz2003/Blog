/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-20 15:15:37
 * @LastEditTime: 2025-08-26 11:03:02
 * @LastEditors: 安知鱼
 */
package task

import (
	"context"
	"log/slog"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/statistics"
)

// StatisticsAggregationJob 统计数据聚合任务
type StatisticsAggregationJob struct {
	statService statistics.VisitorStatService
	logger      *slog.Logger
}

// NewStatisticsAggregationJob 创建统计数据聚合任务实例
func NewStatisticsAggregationJob(statService statistics.VisitorStatService, logger *slog.Logger) *StatisticsAggregationJob {
	return &StatisticsAggregationJob{
		statService: statService,
		logger:      logger,
	}
}

// Run 执行统计数据聚合任务
func (j *StatisticsAggregationJob) Run() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	j.logger.Info("开始执行统计数据聚合任务")

	// 聚合昨天的数据（使用中国时区 UTC+8，与访问日志记录时间保持一致）
	now := utils.NowInChina()
	yesterday := utils.StartOfDayInChina(now).AddDate(0, 0, -1)
	if err := j.statService.AggregateDaily(ctx, yesterday); err != nil {
		j.logger.Error("聚合昨日统计数据失败", slog.Any("error", err), slog.Time("date", yesterday))
		return
	}

	j.logger.Info("统计数据聚合任务执行完成", slog.Time("date", yesterday))
}

// Name 返回任务名称
func (j *StatisticsAggregationJob) Name() string {
	return "StatisticsAggregationJob"
}

// StatisticsCleanupJob 统计数据清理任务
type StatisticsCleanupJob struct {
	statService statistics.VisitorStatService
	logger      *slog.Logger
}

// NewStatisticsCleanupJob 创建统计数据清理任务实例
func NewStatisticsCleanupJob(statService statistics.VisitorStatService, logger *slog.Logger) *StatisticsCleanupJob {
	return &StatisticsCleanupJob{
		statService: statService,
		logger:      logger,
	}
}

// Run 执行统计数据清理任务
func (j *StatisticsCleanupJob) Run() {
	// 这里可以添加清理逻辑，比如删除过期的访问日志
	j.logger.Info("统计数据清理任务执行完成")
}

// Name 返回任务名称
func (j *StatisticsCleanupJob) Name() string {
	return "StatisticsCleanupJob"
}
