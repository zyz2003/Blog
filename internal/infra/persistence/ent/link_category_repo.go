/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 15:09:42
 * @LastEditTime: 2025-08-19 16:07:39
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/link"
	"github.com/anzhiyu-c/anheyu-app/ent/linkcategory"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type linkCategoryRepo struct {
	client *ent.Client
}

func NewLinkCategoryRepo(client *ent.Client) repository.LinkCategoryRepository {
	return &linkCategoryRepo{client: client}
}

func (r *linkCategoryRepo) DeleteAllUnused(ctx context.Context) (int, error) {
	// 查找所有没有关联任何 Link 的 LinkCategory 并删除它们
	return r.client.LinkCategory.Delete().
		Where(linkcategory.Not(linkcategory.HasLinks())).
		Exec(ctx)
}

func (r *linkCategoryRepo) DeleteAllUnusedExcluding(ctx context.Context, excludeIDs []int) (int, error) {
	// 查找所有没有关联任何 Link 的 LinkCategory，但排除指定的ID列表
	query := r.client.LinkCategory.Delete().
		Where(linkcategory.Not(linkcategory.HasLinks()))

	// 如果有要排除的ID，添加排除条件
	if len(excludeIDs) > 0 {
		query = query.Where(linkcategory.Not(linkcategory.IDIn(excludeIDs...)))
	}

	return query.Exec(ctx)
}

func (r *linkCategoryRepo) Update(ctx context.Context, id int, req *model.UpdateLinkCategoryRequest) (*model.LinkCategoryDTO, error) {
	updatedCategory, err := r.client.LinkCategory.UpdateOneID(id).
		SetName(req.Name).
		SetStyle(linkcategory.Style(req.Style)).
		SetDescription(req.Description).
		Save(ctx)

	if err != nil {
		return nil, err
	}
	return mapEntLinkCategoryToDTO(updatedCategory), nil
}

func (r *linkCategoryRepo) DeleteIfUnused(ctx context.Context, categoryID int) (bool, error) {
	// 检查是否还有友链在使用这个分类
	exists, err := r.client.Link.Query().
		Where(link.HasCategoryWith(linkcategory.ID(categoryID))).
		Exist(ctx)
	if err != nil {
		return false, err
	}

	// 如果不存在引用，则删除
	if !exists {
		err = r.client.LinkCategory.DeleteOneID(categoryID).Exec(ctx)
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

func (r *linkCategoryRepo) Create(ctx context.Context, req *model.CreateLinkCategoryRequest) (*model.LinkCategoryDTO, error) {
	create := r.client.LinkCategory.Create().
		SetName(req.Name).
		SetStyle(linkcategory.Style(req.Style))

	if req.Description != "" {
		create.SetDescription(req.Description)
	}

	savedCategory, err := create.Save(ctx)
	if err != nil {
		// 检查是否是重复名称错误
		if strings.Contains(err.Error(), "duplicate key value violates unique constraint") &&
			strings.Contains(err.Error(), "link_categories_name_key") {
			return nil, fmt.Errorf("分类名称 '%s' 已存在，请使用其他名称", req.Name)
		}
		return nil, err
	}
	return mapEntLinkCategoryToDTO(savedCategory), nil
}

// GetByID 根据ID获取分类信息
func (r *linkCategoryRepo) GetByID(ctx context.Context, id int) (*model.LinkCategoryDTO, error) {
	category, err := r.client.LinkCategory.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	return mapEntLinkCategoryToDTO(category), nil
}

func (r *linkCategoryRepo) FindAll(ctx context.Context) ([]*model.LinkCategoryDTO, error) {
	entCategories, err := r.client.LinkCategory.Query().All(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinkCategoriesToDTOs(entCategories), nil
}

func (r *linkCategoryRepo) FindAllWithLinks(ctx context.Context) ([]*model.LinkCategoryDTO, error) {
	entCategories, err := r.client.LinkCategory.Query().
		Where(linkcategory.HasLinksWith(link.StatusEQ(link.StatusAPPROVED))).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinkCategoriesToDTOs(entCategories), nil
}

// --- 辅助函数 ---

func mapEntLinkCategoryToDTO(entCategory *ent.LinkCategory) *model.LinkCategoryDTO {
	if entCategory == nil {
		return nil
	}
	return &model.LinkCategoryDTO{
		ID:          entCategory.ID,
		Name:        entCategory.Name,
		Style:       string(entCategory.Style),
		Description: entCategory.Description,
	}
}

func mapEntLinkCategoriesToDTOs(entCategories []*ent.LinkCategory) []*model.LinkCategoryDTO {
	dtos := make([]*model.LinkCategoryDTO, len(entCategories))
	for i, category := range entCategories {
		dtos[i] = mapEntLinkCategoryToDTO(category)
	}
	return dtos
}

// GetByName 根据名称获取分类信息
func (r *linkCategoryRepo) GetByName(ctx context.Context, name string) (*model.LinkCategoryDTO, error) {
	category, err := r.client.LinkCategory.Query().
		Where(linkcategory.NameEQ(name)).
		First(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinkCategoryToDTO(category), nil
}
