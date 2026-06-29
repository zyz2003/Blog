/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-20 13:08:31
 * @LastEditTime: 2025-06-21 19:37:33
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// TagRepository 定义了标签数据操作的契约
type TagRepository interface {
	// 根据一组标签名，查找已存在的标签，或创建新标签
	FindOrCreate(ctx context.Context, names []string) ([]*model.Tag, error)
}
