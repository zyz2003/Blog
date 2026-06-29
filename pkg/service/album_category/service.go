/*
 * @Description: 相册分类 Service
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package album_category

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// Service 定义了相册分类相关的业务逻辑接口
type Service interface {
	// 创建相册分类
	CreateCategory(ctx context.Context, req *model.CreateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error)
	// 获取所有相册分类
	ListCategories(ctx context.Context) ([]*model.AlbumCategoryDTO, error)
	// 根据ID获取相册分类
	GetCategory(ctx context.Context, id uint) (*model.AlbumCategoryDTO, error)
	// 更新相册分类
	UpdateCategory(ctx context.Context, id uint, req *model.UpdateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error)
	// 删除相册分类
	DeleteCategory(ctx context.Context, id uint) error
}

type service struct {
	albumCategoryRepo repository.AlbumCategoryRepository
}

// NewService 创建相册分类服务实例
func NewService(albumCategoryRepo repository.AlbumCategoryRepository) Service {
	return &service{
		albumCategoryRepo: albumCategoryRepo,
	}
}

func (s *service) CreateCategory(ctx context.Context, req *model.CreateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error) {
	return s.albumCategoryRepo.Create(ctx, req)
}

func (s *service) ListCategories(ctx context.Context) ([]*model.AlbumCategoryDTO, error) {
	return s.albumCategoryRepo.FindAll(ctx)
}

func (s *service) GetCategory(ctx context.Context, id uint) (*model.AlbumCategoryDTO, error) {
	return s.albumCategoryRepo.GetByID(ctx, id)
}

func (s *service) UpdateCategory(ctx context.Context, id uint, req *model.UpdateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error) {
	return s.albumCategoryRepo.Update(ctx, id, req)
}

func (s *service) DeleteCategory(ctx context.Context, id uint) error {
	return s.albumCategoryRepo.Delete(ctx, id)
}
