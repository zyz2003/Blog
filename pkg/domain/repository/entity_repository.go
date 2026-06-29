/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-26 12:04:54
 * @LastEditTime: 2025-07-14 00:04:44
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// EntityRepository 定义了物理存储实体 (Entity) 的数据访问操作契约。
// 它处理与 'entities' 表的交互，操作领域模型 model.FileStorageEntity。
type EntityRepository interface {
	// BaseRepository 包含了通用的 CRUD 方法，例如 Create, FindByID, Update, Delete 等。
	BaseRepository[model.FileStorageEntity]

	// FindUploadingByOwnerID 查找某个用户所有正在进行的上传任务。
	// “上传中”的任务由其 upload_session_id 字段不为 NULL 来标识。
	FindUploadingByOwnerID(ctx context.Context, ownerID uint) ([]*model.FileStorageEntity, error)

	// Transaction 提供事务支持，允许在单个数据库事务中执行多个仓库操作。
	Transaction(ctx context.Context, fn func(repo EntityRepository) error) error

	// FindBatchByIDs 根据一组实体 ID 批量查找物理存储实体。
	FindBatchByIDs(ctx context.Context, ids []uint) ([]*model.FileStorageEntity, error)

	// SumSizeByIDs 根据一组实体 ID 计算它们的总大小。
	SumSizeByIDs(ctx context.Context, ids []uint64) (int64, error)

	// FindOrphaned 查找所有未被任何逻辑文件引用的物理存储实体。
	FindOrphaned(ctx context.Context, olderThan time.Time) ([]*model.FileStorageEntity, error)

	// HardDelete 永久删除一个物理存储实体。
	HardDelete(ctx context.Context, id uint) error

	// CountEntityByStoragePolicyID 统计指定存储策略下的实体数量和总大小。
	CountEntityByStoragePolicyID(ctx context.Context, policyID uint) (count int64, totalSize int64, err error)

	// IsStoragePolicyUsedByEntities 检查指定的存储策略是否被任何实体使用。
	IsStoragePolicyUsedByEntities(ctx context.Context, policyID uint) (bool, error)

	// FindByStoragePolicyID 查找指定存储策略下的所有实体。
	FindByStoragePolicyID(ctx context.Context, policyID uint) ([]*model.FileStorageEntity, error)

	// DeleteByStoragePolicyID 删除指定存储策略下的所有实体记录。
	DeleteByStoragePolicyID(ctx context.Context, policyID uint) error
}
