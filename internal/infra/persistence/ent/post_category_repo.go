package ent

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/postcategory"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
)

type postCategoryRepo struct {
	db *ent.Client
}

// NewPostCategoryRepo 是 postCategoryRepo 的构造函数。
func NewPostCategoryRepo(db *ent.Client) repository.PostCategoryRepository {
	return &postCategoryRepo{db: db}
}

// FindAnySeries 检查给定的 ID 列表中是否存在任何“系列”分类
func (r *postCategoryRepo) FindAnySeries(ctx context.Context, ids []uint) (bool, error) {
	if len(ids) == 0 {
		return false, nil
	}
	count, err := r.db.PostCategory.Query().
		Where(
			postcategory.IDIn(ids...),
			postcategory.IsSeries(true),
		).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// DeleteIfUnused 实现了删除未使用分类的逻辑
func (r *postCategoryRepo) DeleteIfUnused(ctx context.Context, ids []uint) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.db.PostCategory.Delete().
		Where(
			postcategory.IDIn(ids...),
			postcategory.CountLTE(0), // 检查条件：引用计数小于或等于0
		).
		Exec(ctx)
	return err
}

// UpdateCount 更新指定 ID 集合的计数值
func (r *postCategoryRepo) UpdateCount(ctx context.Context, incIDs, decIDs []uint) error {
	if len(incIDs) > 0 {
		// 对 incIDs 列表中的所有分类 count+1
		_, err := r.db.PostCategory.Update().Where(postcategory.IDIn(incIDs...)).AddCount(1).Save(ctx)
		if err != nil {
			return err
		}
	}
	if len(decIDs) > 0 {
		// 对 decIDs 列表中的所有分类 count-1
		_, err := r.db.PostCategory.Update().Where(postcategory.IDIn(decIDs...)).AddCount(-1).Save(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

// toModel 是一个私有辅助函数，将 ent 实体转换为领域模型。
func (r *postCategoryRepo) toModel(c *ent.PostCategory) *model.PostCategory {
	if c == nil {
		return nil
	}
	publicID, _ := idgen.GeneratePublicID(c.ID, idgen.EntityTypePostCategory)
	slug := ""
	if c.Slug != nil {
		slug = *c.Slug
	}
	return &model.PostCategory{
		ID:          publicID,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
		Name:        c.Name,
		Slug:        slug,
		Description: c.Description,
		Count:       c.Count,
		IsSeries:    c.IsSeries,
		SortOrder:   c.SortOrder,
	}
}

func (r *postCategoryRepo) Create(ctx context.Context, req *model.CreatePostCategoryRequest) (*model.PostCategory, error) {
	creator := r.db.PostCategory.Create().
		SetName(req.Name).
		SetNillableDescription(&req.Description).
		SetIsSeries(req.IsSeries).
		SetSortOrder(req.SortOrder)
	if req.Slug != "" {
		creator.SetSlug(req.Slug)
	}
	newCategory, err := creator.Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(newCategory), nil
}

// ExistsByName 检查指定名称的分类是否已存在
func (r *postCategoryRepo) ExistsByName(ctx context.Context, name string) (bool, error) {
	count, err := r.db.PostCategory.Query().
		Where(postcategory.Name(name)).
		Count(ctx)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *postCategoryRepo) Update(ctx context.Context, publicID string, req *model.UpdatePostCategoryRequest) (*model.PostCategory, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	updater := r.db.PostCategory.UpdateOneID(dbID)
	if req.Name != nil {
		updater.SetName(*req.Name)
	}
	if req.Slug != nil {
		if *req.Slug == "" {
			updater.ClearSlug()
		} else {
			updater.SetSlug(*req.Slug)
		}
	}
	if req.Description != nil {
		updater.SetDescription(*req.Description)
	}
	if req.IsSeries != nil {
		updater.SetIsSeries(*req.IsSeries)
	}
	if req.SortOrder != nil {
		updater.SetSortOrder(*req.SortOrder)
	}
	updatedCategory, err := updater.Save(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(updatedCategory), nil
}

func (r *postCategoryRepo) Delete(ctx context.Context, publicID string) error {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return err
	}
	return r.db.PostCategory.DeleteOneID(dbID).Exec(ctx)
}

func (r *postCategoryRepo) List(ctx context.Context) ([]*model.PostCategory, error) {
	entities, err := r.db.PostCategory.Query().
		Where(postcategory.DeletedAtIsNil()).
		Order(ent.Asc(postcategory.FieldSortOrder), ent.Desc(postcategory.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, err
	}

	models := make([]*model.PostCategory, len(entities))
	for i, entity := range entities {
		models[i] = r.toModel(entity)
	}
	return models, nil
}

func (r *postCategoryRepo) GetByID(ctx context.Context, publicID string) (*model.PostCategory, error) {
	dbID, _, err := idgen.DecodePublicID(publicID)
	if err != nil {
		return nil, err
	}
	entity, err := r.db.PostCategory.Query().
		Where(postcategory.ID(dbID), postcategory.DeletedAtIsNil()).
		Only(ctx)
	if err != nil {
		return nil, err
	}
	return r.toModel(entity), nil
}
