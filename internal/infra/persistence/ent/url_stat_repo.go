/*
 * @Description: URL统计仓储实现
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-08-21 10:54:00
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/urlstat"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"

	"entgo.io/ent/dialect/sql"
)

type entURLStatRepository struct {
	client *ent.Client
}

// NewURLStatRepository 创建URL统计仓储实例
func NewURLStatRepository(client *ent.Client) repository.URLStatRepository {
	return &entURLStatRepository{
		client: client,
	}
}

func (r *entURLStatRepository) GetByURLPath(ctx context.Context, urlPath string) (*ent.URLStat, error) {
	return r.client.URLStat.Query().
		Where(urlstat.URLPathEQ(urlPath)).
		Only(ctx)
}

func (r *entURLStatRepository) CreateOrUpdate(ctx context.Context, stat *ent.URLStat) error {
	return r.client.URLStat.Create().
		SetURLPath(stat.URLPath).
		SetNillablePageTitle(stat.PageTitle).
		SetTotalViews(stat.TotalViews).
		SetUniqueViews(stat.UniqueViews).
		SetBounceCount(stat.BounceCount).
		SetAvgDuration(stat.AvgDuration).
		SetNillableLastVisitedAt(stat.LastVisitedAt).
		OnConflict(
			// 明确指定冲突列为 url_path 字段
			sql.ConflictColumns(urlstat.FieldURLPath),
		).
		UpdateNewValues().
		Exec(ctx)
}

func (r *entURLStatRepository) GetTopPages(ctx context.Context, limit int) ([]*model.URLStatistics, error) {
	stats, err := r.client.URLStat.Query().
		Order(ent.Desc(urlstat.FieldTotalViews)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]*model.URLStatistics, len(stats))
	for i, stat := range stats {
		bounceRate := float64(0)
		if stat.TotalViews > 0 {
			bounceRate = float64(stat.BounceCount) / float64(stat.TotalViews) * 100
		}

		result[i] = &model.URLStatistics{
			URLPath:       stat.URLPath,
			PageTitle:     getStringValue(stat.PageTitle),
			TotalViews:    stat.TotalViews,
			UniqueViews:   stat.UniqueViews,
			BounceCount:   stat.BounceCount,
			BounceRate:    bounceRate,
			AvgDuration:   stat.AvgDuration,
			LastVisitedAt: stat.LastVisitedAt,
		}
	}

	return result, nil
}

func (r *entURLStatRepository) GetAll(ctx context.Context, offset, limit int) ([]*ent.URLStat, int64, error) {
	stats, err := r.client.URLStat.Query().
		Order(ent.Desc(urlstat.FieldTotalViews)).
		Offset(offset).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}

	total, err := r.client.URLStat.Query().Count(ctx)
	if err != nil {
		return nil, 0, err
	}

	return stats, int64(total), nil
}

func (r *entURLStatRepository) IncrementViews(ctx context.Context, urlPath string, isUnique bool, duration int, isBounce bool) error {
	now := time.Now()

	// 尝试获取现有记录
	existing, err := r.GetByURLPath(ctx, urlPath)
	if err != nil {
		// 记录不存在，创建新记录
		if ent.IsNotFound(err) {
			totalViews := int64(1)
			uniqueViews := int64(0)
			bounceCount := int64(0)
			if isUnique {
				uniqueViews = 1
			}
			if isBounce {
				bounceCount = 1
			}

			// 使用CreateOrUpdate确保原子性，避免竞态条件
			newStat := &ent.URLStat{
				URLPath:       urlPath,
				TotalViews:    totalViews,
				UniqueViews:   uniqueViews,
				BounceCount:   bounceCount,
				AvgDuration:   float64(duration),
				LastVisitedAt: &now,
			}

			return r.CreateOrUpdate(ctx, newStat)
		}
		return err
	}

	// 更新现有记录
	newTotalViews := existing.TotalViews + 1
	newUniqueViews := existing.UniqueViews
	newBounceCount := existing.BounceCount
	if isUnique {
		newUniqueViews++
	}
	if isBounce {
		newBounceCount++
	}

	// 计算新的平均停留时间
	newAvgDuration := (existing.AvgDuration*float64(existing.TotalViews) + float64(duration)) / float64(newTotalViews)

	return r.client.URLStat.UpdateOneID(existing.ID).
		SetTotalViews(newTotalViews).
		SetUniqueViews(newUniqueViews).
		SetBounceCount(newBounceCount).
		SetAvgDuration(newAvgDuration).
		SetLastVisitedAt(now).
		Exec(ctx)
}

// getStringValue 安全获取字符串指针的值
func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
