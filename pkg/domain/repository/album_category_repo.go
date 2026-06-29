/*
 * @Description: 相册分类 Repository 接口
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type AlbumCategoryRepository interface {
	Create(ctx context.Context, req *model.CreateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error)
	Update(ctx context.Context, id uint, req *model.UpdateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error)
	Delete(ctx context.Context, id uint) error
	GetByID(ctx context.Context, id uint) (*model.AlbumCategoryDTO, error)
	GetByName(ctx context.Context, name string) (*model.AlbumCategoryDTO, error)
	FindAll(ctx context.Context) ([]*model.AlbumCategoryDTO, error)
	DeleteIfUnused(ctx context.Context, categoryID uint) (bool, error)
}
