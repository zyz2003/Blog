/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 11:51:31
 * @LastEditTime: 2025-08-05 14:50:53
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// PostTagRepository 定义了文章标签的数据仓库接口。
type PostTagRepository interface {
	Create(ctx context.Context, req *model.CreatePostTagRequest) (*model.PostTag, error)
	Update(ctx context.Context, id string, req *model.UpdatePostTagRequest) (*model.PostTag, error)
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, options *model.ListPostTagsOptions) ([]*model.PostTag, error)
	GetByID(ctx context.Context, id string) (*model.PostTag, error)
	UpdateCount(ctx context.Context, incIDs, decIDs []uint) error
	DeleteIfUnused(ctx context.Context, ids []uint) error
	ExistsByName(ctx context.Context, name string) (bool, error)
}
