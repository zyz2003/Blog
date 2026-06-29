/*
 * @Description: 文件仓库接口定义
 * @Author: 安知鱼
 * @Date: 2025-06-28 00:21:55
 * @LastEditTime: 2025-07-16 16:39:21
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type SyncItem struct {
	File      *model.File
	IsDeleted bool
}

// 定义分页令牌结构体，供 Service 和 Repository 共同使用
type PaginationToken struct {
	LastID           uint        `json:"last_id"`
	LastValue        interface{} `json:"last_value"`
	LastPrimaryValue interface{} `json:"last_primary_value,omitempty"`
}

// FileRepository 定义了所有文件数据操作的契约。
type FileRepository interface {
	// Create, Update, Delete 需要明确定义在接口中
	Create(ctx context.Context, file *model.File) error
	Update(ctx context.Context, file *model.File) error
	Delete(ctx context.Context, id uint) error

	// SoftDelete 软删除文件，设置deleted_at时间戳但不从数据库中物理删除
	SoftDelete(ctx context.Context, id uint) error

	// FindByID 根据文件的内部数据库 ID 查找文件。
	// 返回领域模型对象。
	FindByID(ctx context.Context, id uint) (*model.File, error)

	// FindByPath 在指定用户的文件中，根据路径字符串查找文件/目录。
	// 例如： path = "/Documents/report.docx"
	// 返回领域模型对象。
	FindByPath(ctx context.Context, ownerID uint, path string) (*model.File, error)

	// ListByParentID 列出某个目录下的所有直属文件和子目录。
	// 返回领域模型对象列表。
	ListByParentID(ctx context.Context, parentID uint) ([]*model.File, error)

	// Count 统计文件总数。
	Count(ctx context.Context) (int64, error)

	// Transaction 提供事务支持，允许在单个数据库事务中执行多个仓库操作。
	// 这对于需要原子性操作的复杂业务逻辑至关重要。
	Transaction(ctx context.Context, fn func(repo FileRepository) error) error

	// FindByParentIDAndName 根据父目录 ID 和文件名查找文件。
	FindByParentIDAndName(ctx context.Context, parentID uint, name string) (*model.File, error)

	// 修改文件夹视图参数
	UpdateViewConfig(ctx context.Context, fileID uint, viewConfigJSON string) error

	// GetDescendantFileInfo 递归获取一个文件夹下所有后代文件的信息。
	// 它只返回文件的信息（类型为 FileTypeFile），不包括子目录本身。
	// 返回一个包含文件大小和其关联实体ID的元组列表。
	GetDescendantFileInfo(ctx context.Context, folderID uint) ([]*model.FileInfoTuple, error)

	// IsDescendant 检查一个文件是否是另一个文件的后代，检查 potentialDescendantID 是否是 ancestorID 的后代。
	IsDescendant(ctx context.Context, ancestorID uint, potentialDescendantID uint) (bool, error)

	// FindByParentIDAndNameUnscoped 在指定父目录下查找文件或目录，不考虑软删除。
	CreateOrUpdate(ctx context.Context, file *model.File) (finalFile *model.File, status CreationStatus, err error)

	// 查询所有子项，包括软删除，并返回 SyncItem
	ListByParentIDUnscoped(ctx context.Context, parentID uint) ([]SyncItem, error)

	// 永久删除一条文件记录
	HardDelete(ctx context.Context, id uint) error

	// FindByIDUnscoped: 查找单个文件/目录记录，即使它已被软删除
	FindByIDUnscoped(ctx context.Context, fileID uint) (*model.File, error)

	// Restore: 恢复一个被软删除的文件/目录记录
	Restore(ctx context.Context, fileID uint) error

	// FindOrCreateDirectory 原子性地查找、恢复或创建单个目录。
	// 它封装了处理软删除目录的复杂逻辑。
	// @param parentID - 父目录的 ID。
	// @param name - 要查找或创建的目录的名称。
	// @param ownerID - 该目录的所有者 ID。
	// @return *model.File - 最终找到、恢复或创建的目录的领域模型。
	FindOrCreateDirectory(ctx context.Context, parentID uint, name string, ownerID uint) (*model.File, error)

	// FindOrCreateRootDirectory 专门用于处理根目录。
	FindOrCreateRootDirectory(ctx context.Context, ownerID uint) (*model.File, error)

	// 支持游标分页
	// ListByParentIDWithCursor 根据游标列出某个目录下的子项。
	// 它需要一个稳定的排序规则（例如 "created_at asc, id asc"）来保证分页的准确性。
	ListByParentIDWithCursor(
		ctx context.Context,
		parentID uint,
		orderBy string,
		direction string,
		limit int,
		token *PaginationToken,
	) ([]*model.File, error)

	// FindAncestors 使用递归查询获取一个文件或目录的所有祖先节点，包括其自身。
	// 返回的切片从当前节点开始，向上到根目录。
	FindAncestors(ctx context.Context, fileID uint) ([]*model.File, error)

	// @param ids - 一个包含文件数据库ID的切片。
	// @return []*model.File - 找到的文件领域模型对象列表。返回列表的顺序不保证与输入ID的顺序一致。
	// @return error - 如果查询过程中发生错误。
	FindBatchByIDs(ctx context.Context, ids []uint) ([]*model.File, error)

	// SoftDeleteByOwnerID 软删除指定用户的所有文件
	SoftDeleteByOwnerID(ctx context.Context, ownerID uint) error
}
