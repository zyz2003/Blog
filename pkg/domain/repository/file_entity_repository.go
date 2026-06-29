/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-26 12:46:33
 * @LastEditTime: 2025-07-13 02:00:37
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// FileEntityRepository 定义了逻辑文件与物理存储实体关联 (FileEntity) 的数据访问操作契约。
// 它处理与 'file_entities' 表的交互，操作领域模型 model.FileStorageVersion。
type FileEntityRepository interface {
	// BaseRepository 包含了通用的 CRUD 方法，例如 Create, FindByID, Update, Delete 等。
	BaseRepository[model.FileStorageVersion]

	// FindCurrentByFileID 根据逻辑文件 ID 查找其当前关联的物理实体版本。
	FindCurrentByFileID(ctx context.Context, fileID uint) (*model.FileStorageVersion, error)

	// MarkOldVersionsAsNotCurrent 将某个逻辑文件的所有旧版本标记为非当前版本。
	MarkOldVersionsAsNotCurrent(ctx context.Context, fileID uint, excludeVersionID uint) error

	// FindByFileAndEntityID 根据逻辑文件ID和物理实体ID查找关联。
	FindByFileAndEntityID(ctx context.Context, fileID, entityID uint) (*model.FileStorageVersion, error)

	// Transaction 提供事务支持，允许在单个数据库事务中执行多个仓库操作。
	Transaction(ctx context.Context, fn func(repo FileEntityRepository) error) error

	// DeleteByFileID 根据逻辑文件ID删除所有相关的版本关联记录。
	DeleteByFileID(ctx context.Context, fileID uint) error

	// Delete 永久删除指定 ID 的文件实体关联记录。
	HardDelete(ctx context.Context, id uint) error

	// FindByEntityIDs 根据实体ID列表查找所有相关的文件实体关联记录。
	FindByEntityIDs(ctx context.Context, entityIDs []uint) ([]*model.FileStorageVersion, error)

	// DeleteByEntityIDs 根据实体ID列表删除所有相关的文件实体关联记录。
	DeleteByEntityIDs(ctx context.Context, entityIDs []uint) error
}
