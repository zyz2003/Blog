/*
 * @Description: 相册分类 Repository 实现
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package ent

import (
	"context"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/album"
	"github.com/anzhiyu-c/anheyu-app/ent/albumcategory"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type albumCategoryRepo struct {
	client *ent.Client
}

func NewAlbumCategoryRepo(client *ent.Client) repository.AlbumCategoryRepository {
	return &albumCategoryRepo{client: client}
}

func (r *albumCategoryRepo) Create(ctx context.Context, req *model.CreateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error) {
	create := r.client.AlbumCategory.Create().
		SetName(req.Name).
		SetDisplayOrder(req.DisplayOrder)

	if req.Description != "" {
		create.SetDescription(req.Description)
	}

	savedCategory, err := create.Save(ctx)
	if err != nil {
		// 检查是否是重复名称错误
		if strings.Contains(err.Error(), "duplicate key value violates unique constraint") &&
			strings.Contains(err.Error(), "album_categories_name_key") {
			return nil, fmt.Errorf("分类名称 '%s' 已存在，请使用其他名称", req.Name)
		}
		return nil, err
	}
	return mapEntAlbumCategoryToDTO(savedCategory), nil
}

func (r *albumCategoryRepo) FindAll(ctx context.Context) ([]*model.AlbumCategoryDTO, error) {
	entCategories, err := r.client.AlbumCategory.Query().
		Order(ent.Asc(albumcategory.FieldDisplayOrder)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntAlbumCategoriesToDTOs(entCategories), nil
}

func (r *albumCategoryRepo) GetByID(ctx context.Context, id uint) (*model.AlbumCategoryDTO, error) {
	category, err := r.client.AlbumCategory.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	return mapEntAlbumCategoryToDTO(category), nil
}

func (r *albumCategoryRepo) GetByName(ctx context.Context, name string) (*model.AlbumCategoryDTO, error) {
	category, err := r.client.AlbumCategory.Query().
		Where(albumcategory.NameEQ(name)).
		First(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntAlbumCategoryToDTO(category), nil
}

func (r *albumCategoryRepo) Update(ctx context.Context, id uint, req *model.UpdateAlbumCategoryRequest) (*model.AlbumCategoryDTO, error) {
	updatedCategory, err := r.client.AlbumCategory.UpdateOneID(id).
		SetName(req.Name).
		SetDescription(req.Description).
		SetDisplayOrder(req.DisplayOrder).
		Save(ctx)

	if err != nil {
		return nil, err
	}
	return mapEntAlbumCategoryToDTO(updatedCategory), nil
}

func (r *albumCategoryRepo) Delete(ctx context.Context, id uint) error {
	// 检查是否还有相册在使用这个分类
	exists, err := r.client.Album.Query().
		Where(album.HasCategoryWith(albumcategory.IDEQ(id))).
		Exist(ctx)
	if err != nil {
		return err
	}

	if exists {
		return fmt.Errorf("该分类下还有相册，无法删除")
	}

	return r.client.AlbumCategory.DeleteOneID(id).Exec(ctx)
}

func (r *albumCategoryRepo) DeleteIfUnused(ctx context.Context, categoryID uint) (bool, error) {
	// 检查是否还有相册在使用这个分类
	exists, err := r.client.Album.Query().
		Where(album.HasCategoryWith(albumcategory.IDEQ(categoryID))).
		Exist(ctx)
	if err != nil {
		return false, err
	}

	// 如果不存在引用，则删除
	if !exists {
		err = r.client.AlbumCategory.DeleteOneID(categoryID).Exec(ctx)
		if err != nil {
			// 忽略未找到的错误，因为可能已被其他并发操作删除
			if ent.IsNotFound(err) {
				return true, nil
			}
			return false, err
		}
		return true, nil
	}

	return false, nil
}

// --- 辅助函数 ---

func mapEntAlbumCategoryToDTO(entCategory *ent.AlbumCategory) *model.AlbumCategoryDTO {
	if entCategory == nil {
		return nil
	}
	return &model.AlbumCategoryDTO{
		ID:           entCategory.ID,
		Name:         entCategory.Name,
		Description:  entCategory.Description,
		DisplayOrder: entCategory.DisplayOrder,
	}
}

func mapEntAlbumCategoriesToDTOs(entCategories []*ent.AlbumCategory) []*model.AlbumCategoryDTO {
	dtos := make([]*model.AlbumCategoryDTO, 0, len(entCategories))
	for _, entCat := range entCategories {
		dtos = append(dtos, mapEntAlbumCategoryToDTO(entCat))
	}
	return dtos
}
