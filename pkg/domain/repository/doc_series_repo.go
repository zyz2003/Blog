/*
 * @Description: 文档系列仓库接口
 * @Author: 安知鱼
 * @Date: 2025-12-30 10:00:00
 * @LastEditTime: 2025-12-30 10:00:00
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// DocSeriesRepository 定义了文档系列的数据仓库接口。
type DocSeriesRepository interface {
	Create(ctx context.Context, req *model.CreateDocSeriesRequest) (*model.DocSeries, error)
	Update(ctx context.Context, id string, req *model.UpdateDocSeriesRequest) (*model.DocSeries, error)
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, opts *model.ListDocSeriesOptions) ([]*model.DocSeries, int64, error)
	GetByID(ctx context.Context, id string) (*model.DocSeries, error)
	GetByIDWithArticles(ctx context.Context, id string) (*model.DocSeriesWithArticles, error)
	UpdateDocCount(ctx context.Context, id uint, delta int) error
	ExistsByName(ctx context.Context, name string) (bool, error)
}
