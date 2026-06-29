/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-20 13:07:24
 * @LastEditTime: 2025-08-11 18:58:50
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// UserRepository 定义了所有用户数据操作的契约。
type UserRepository interface {
	// 嵌入基础接口，自动获得 FindByID, Create, Update, Delete 等方法
	BaseRepository[model.User]

	// FindByID 根据用户id(number)查找用户
	FindByID(ctx context.Context, id uint) (*model.User, error)

	// FindByUsername 根据用户名(string)查找用户
	FindByUsername(ctx context.Context, username string) (*model.User, error)

	// FindByEmail 根据邮箱(string)查找用户
	FindByEmail(ctx context.Context, email string) (*model.User, error)

	// FindByGroupID 根据用户组ID查找用户列表
	FindByGroupID(ctx context.Context, groupID uint) ([]*model.User, error)

	// List 分页查询用户列表，支持搜索关键词、用户组筛选和状态筛选
	List(ctx context.Context, page, pageSize int, keyword string, groupID *uint, status *int) ([]*model.User, int64, error)

	// Count 统计用户总数
	Count(ctx context.Context) (int64, error)

	// Transaction 处理用户相关的数据库事务
	Transaction(ctx context.Context, fn func(repo UserRepository) error) error
}

// UserGroupRepository 定义了用户组数据操作的契约
type UserGroupRepository interface {
	// FindByID 根据ID查找用户组
	FindByID(ctx context.Context, id uint) (*model.UserGroup, error)

	// FindAll 获取所有用户组
	FindAll(ctx context.Context) ([]*model.UserGroup, error)
}
