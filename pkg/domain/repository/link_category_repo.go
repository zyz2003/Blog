/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 15:08:16
 * @LastEditTime: 2025-08-19 16:07:25
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type LinkCategoryRepository interface {
	Create(ctx context.Context, category *model.CreateLinkCategoryRequest) (*model.LinkCategoryDTO, error)
	FindAll(ctx context.Context) ([]*model.LinkCategoryDTO, error)
	FindAllWithLinks(ctx context.Context) ([]*model.LinkCategoryDTO, error) // 只返回有已审核通过友链的分类
	GetByID(ctx context.Context, id int) (*model.LinkCategoryDTO, error)    // 根据ID获取分类信息
	DeleteIfUnused(ctx context.Context, categoryID int) (bool, error)
	DeleteAllUnused(ctx context.Context) (int, error)
	DeleteAllUnusedExcluding(ctx context.Context, excludeIDs []int) (int, error)
	Update(ctx context.Context, id int, req *model.UpdateLinkCategoryRequest) (*model.LinkCategoryDTO, error)
	// 为导入功能添加的方法
	GetByName(ctx context.Context, name string) (*model.LinkCategoryDTO, error)
}
