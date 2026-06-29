/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-10 14:10:27
 * @LastEditTime: 2025-07-30 17:00:11
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// MetadataRepository 定义了元数据仓库的接口
type MetadataRepository interface {
	DeleteByFileID(ctx context.Context, fileID uint) error
	Set(ctx context.Context, meta *model.Metadata) error
	Get(ctx context.Context, fileID uint, name string) (*model.Metadata, error)
	GetAll(ctx context.Context, fileID uint) ([]*model.Metadata, error)
	Delete(ctx context.Context, fileID uint, name string) error
	ResetThumbnailMetadataForFileIDs(ctx context.Context, fileIDs []uint) error
}
