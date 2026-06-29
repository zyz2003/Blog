package repository

import (
	"context"
)

// BaseRepository 定义了所有仓储层都应具备的最基础的CRUD操作。
type BaseRepository[T any] interface {
	// FindByID 根据主键ID查找实体。
	FindByID(ctx context.Context, id uint) (*T, error)

	// Create 创建一个新的实体。
	Create(ctx context.Context, entity *T) error

	// Update 更新一个已存在的实体。
	Update(ctx context.Context, entity *T) error

	// Delete 根据主键ID删除一个实体。
	Delete(ctx context.Context, id uint) error
}
