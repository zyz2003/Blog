/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-09 10:02:33
 * @LastEditTime: 2025-07-09 15:51:10
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// DirectLinkRepository 定义了直链数据的持久化操作接口
type DirectLinkRepository interface {
	// FindByPublicID 查找直链及其关联的文件
	FindByPublicID(ctx context.Context, publicID string) (*model.DirectLink, error)

	// IncrementDownloads 原子地增加下载计数
	IncrementDownloads(ctx context.Context, id uint) error

	// FindOrCreateBatch 批量创建直链
	FindOrCreateBatch(ctx context.Context, links []*model.DirectLink) error

	// DeleteByFileID 按文件ID删除直链记录
	DeleteByFileID(ctx context.Context, fileID uint) error
}
