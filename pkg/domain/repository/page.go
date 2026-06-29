package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// PageRepository 页面仓库接口
type PageRepository interface {
	// Create 创建页面
	Create(ctx context.Context, options *model.CreatePageOptions) (*model.Page, error)

	// GetByID 根据ID获取页面
	GetByID(ctx context.Context, id string) (*model.Page, error)

	// GetByPath 根据路径获取页面
	GetByPath(ctx context.Context, path string) (*model.Page, error)

	// List 列出页面
	List(ctx context.Context, options *model.ListPagesOptions) ([]*model.Page, int, error)

	// Update 更新页面
	Update(ctx context.Context, id string, options *model.UpdatePageOptions) (*model.Page, error)

	// Delete 删除页面
	Delete(ctx context.Context, id string) error

	// ExistsByPath 检查路径是否存在
	ExistsByPath(ctx context.Context, path string, excludeID string) (bool, error)
}
