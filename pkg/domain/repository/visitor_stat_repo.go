/*
 * @Description: 访问统计仓储接口
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-08-21 10:37:05
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// VisitorStatRepository 访问统计仓储接口
type VisitorStatRepository interface {
	// 获取指定日期的统计数据
	GetByDate(ctx context.Context, date time.Time) (*ent.VisitorStat, error)

	// 创建或更新统计数据
	CreateOrUpdate(ctx context.Context, stat *ent.VisitorStat) error

	// 获取日期范围内的统计数据
	GetByDateRange(ctx context.Context, startDate, endDate time.Time) ([]*ent.VisitorStat, error)

	// 获取最近N天的统计数据
	GetRecentDays(ctx context.Context, days int) ([]*ent.VisitorStat, error)

	// 获取基础统计数据（今日、昨日、月、年）
	GetBasicStatistics(ctx context.Context) (*model.VisitorStatistics, error)

	// 获取最后一次成功聚合的日期
	GetLatestDate(ctx context.Context) (*time.Time, error)
}

// VisitorLogRepository 访问日志仓储接口
type VisitorLogRepository interface {
	// 创建访问日志
	Create(ctx context.Context, log *ent.VisitorLog) error

	// 批量创建访问日志
	CreateBatch(ctx context.Context, logs []*ent.VisitorLog) error

	// 获取指定时间范围的访问日志
	GetByTimeRange(ctx context.Context, startTime, endTime time.Time) ([]*ent.VisitorLog, error)

	// 获取指定访客的访问日志
	GetByVisitorID(ctx context.Context, visitorID string, limit int) ([]*ent.VisitorLog, error)

	// 统计指定日期的独立访客数
	CountUniqueVisitors(ctx context.Context, date time.Time) (int64, error)

	// 统计指定日期的总访问量
	CountTotalViews(ctx context.Context, date time.Time) (int64, error)

	// 获取访客分析数据
	GetVisitorAnalytics(ctx context.Context, startDate, endDate time.Time) (*model.VisitorAnalytics, error)

	// 清理过期日志（保留指定天数的数据）
	CleanupOldLogs(ctx context.Context, keepDays int) error

	// 获取第一条访问日志的日期
	GetFirstDate(ctx context.Context) (*time.Time, error)
}

// URLStatRepository URL统计仓储接口
type URLStatRepository interface {
	// 获取URL统计信息
	GetByURLPath(ctx context.Context, urlPath string) (*ent.URLStat, error)

	// 创建或更新URL统计
	CreateOrUpdate(ctx context.Context, stat *ent.URLStat) error

	// 获取热门页面列表
	GetTopPages(ctx context.Context, limit int) ([]*model.URLStatistics, error)

	// 获取所有URL统计（分页）
	GetAll(ctx context.Context, offset, limit int) ([]*ent.URLStat, int64, error)

	// 更新URL访问统计
	IncrementViews(ctx context.Context, urlPath string, isUnique bool, duration int, isBounce bool) error
}
