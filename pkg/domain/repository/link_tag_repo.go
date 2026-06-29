/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 15:09:00
 * @LastEditTime: 2025-08-19 16:11:15
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type LinkTagRepository interface {
	Create(ctx context.Context, tag *model.CreateLinkTagRequest) (*model.LinkTagDTO, error)
	FindAll(ctx context.Context) ([]*model.LinkTagDTO, error)
	DeleteIfUnused(ctx context.Context, tagIDs []int) (int64, error)
	DeleteAllUnused(ctx context.Context) (int, error)
	Update(ctx context.Context, id int, req *model.UpdateLinkTagRequest) (*model.LinkTagDTO, error)
	// 为导入功能添加的方法
	GetByName(ctx context.Context, name string) (*model.LinkTagDTO, error)
}
