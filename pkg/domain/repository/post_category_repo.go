/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 11:51:57
 * @LastEditTime: 2025-08-28 13:33:32
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// PostCategoryRepository 定义了文章分类的数据仓库接口。
type PostCategoryRepository interface {
	Create(ctx context.Context, req *model.CreatePostCategoryRequest) (*model.PostCategory, error)
	Update(ctx context.Context, id string, req *model.UpdatePostCategoryRequest) (*model.PostCategory, error)
	Delete(ctx context.Context, id string) error
	List(ctx context.Context) ([]*model.PostCategory, error)
	GetByID(ctx context.Context, id string) (*model.PostCategory, error)
	UpdateCount(ctx context.Context, incIDs, decIDs []uint) error
	DeleteIfUnused(ctx context.Context, ids []uint) error
	FindAnySeries(ctx context.Context, ids []uint) (bool, error)
	ExistsByName(ctx context.Context, name string) (bool, error)
}
