/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 15:09:56
 * @LastEditTime: 2025-08-19 16:11:26
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"fmt"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/link"
	"github.com/anzhiyu-c/anheyu-app/ent/linktag"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type linkTagRepo struct {
	client *ent.Client
}

func NewLinkTagRepo(client *ent.Client) repository.LinkTagRepository {
	return &linkTagRepo{client: client}
}

func (r *linkTagRepo) DeleteAllUnused(ctx context.Context) (int, error) {
	// 查找所有没有关联任何 Link 的 LinkTag 并删除它们
	return r.client.LinkTag.Delete().
		Where(linktag.Not(linktag.HasLinks())).
		Exec(ctx)
}

func (r *linkTagRepo) DeleteIfUnused(ctx context.Context, tagIDs []int) (int64, error) {
	var deletedCount int64 = 0
	for _, tagID := range tagIDs {
		exists, err := r.client.Link.Query().
			Where(link.HasTagsWith(linktag.ID(tagID))).
			Exist(ctx)
		if err != nil {
			return deletedCount, err
		}

		if !exists {
			err = r.client.LinkTag.DeleteOneID(tagID).Exec(ctx)
			if err != nil && !ent.IsNotFound(err) {
				return deletedCount, err
			}
			if err == nil {
				deletedCount++
			}
		}
	}
	return deletedCount, nil
}

func (r *linkTagRepo) Update(ctx context.Context, id int, req *model.UpdateLinkTagRequest) (*model.LinkTagDTO, error) {
	updatedTag, err := r.client.LinkTag.UpdateOneID(id).
		SetName(req.Name).
		SetColor(req.Color).
		Save(ctx)

	if err != nil {
		return nil, err
	}
	return mapEntLinkTagToDTO(updatedTag), nil
}

func (r *linkTagRepo) Create(ctx context.Context, req *model.CreateLinkTagRequest) (*model.LinkTagDTO, error) {
	create := r.client.LinkTag.Create().
		SetName(req.Name)

	if req.Color != "" {
		create.SetColor(req.Color)
	}

	savedTag, err := create.Save(ctx)
	if err != nil {
		// 检查是否是重复名称错误
		if strings.Contains(err.Error(), "duplicate key value violates unique constraint") &&
			strings.Contains(err.Error(), "link_tags_name_key") {
			return nil, fmt.Errorf("标签名称 '%s' 已存在，请使用其他名称", req.Name)
		}
		return nil, err
	}

	return mapEntLinkTagToDTO(savedTag), nil
}

func (r *linkTagRepo) FindAll(ctx context.Context) ([]*model.LinkTagDTO, error) {
	entTags, err := r.client.LinkTag.Query().All(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinkTagsToDTOs(entTags), nil
}

// --- 辅助函数 ---

func mapEntLinkTagToDTO(entTag *ent.LinkTag) *model.LinkTagDTO {
	if entTag == nil {
		return nil
	}
	return &model.LinkTagDTO{
		ID:    entTag.ID,
		Name:  entTag.Name,
		Color: entTag.Color,
	}
}

func mapEntLinkTagsToDTOs(entTags []*ent.LinkTag) []*model.LinkTagDTO {
	dtos := make([]*model.LinkTagDTO, len(entTags))
	for i, tag := range entTags {
		dtos[i] = mapEntLinkTagToDTO(tag)
	}
	return dtos
}

// GetByName 根据名称获取标签信息
func (r *linkTagRepo) GetByName(ctx context.Context, name string) (*model.LinkTagDTO, error) {
	tag, err := r.client.LinkTag.Query().
		Where(linktag.NameEQ(name)).
		First(ctx)
	if err != nil {
		return nil, err
	}
	return mapEntLinkTagToDTO(tag), nil
}
