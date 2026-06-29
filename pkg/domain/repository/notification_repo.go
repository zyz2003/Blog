/*
 * @Description: 通知系统仓储接口
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// NotificationTypeRepository 通知类型仓储接口
type NotificationTypeRepository interface {
	// FindAll 获取所有通知类型
	FindAll(ctx context.Context) ([]*model.NotificationType, error)

	// FindByCode 根据code查找通知类型
	FindByCode(ctx context.Context, code string) (*model.NotificationType, error)

	// FindByCategory 根据分类查找通知类型列表
	FindByCategory(ctx context.Context, category string) ([]*model.NotificationType, error)

	// Create 创建通知类型
	Create(ctx context.Context, nt *model.NotificationType) (*model.NotificationType, error)

	// Update 更新通知类型
	Update(ctx context.Context, id uint, nt *model.NotificationType) (*model.NotificationType, error)
}

// UserNotificationConfigRepository 用户通知配置仓储接口
type UserNotificationConfigRepository interface {
	// FindByUserID 获取用户的所有通知配置
	FindByUserID(ctx context.Context, userID uint) ([]*model.UserNotificationConfig, error)

	// FindByUserAndType 获取用户指定类型的通知配置
	FindByUserAndType(ctx context.Context, userID uint, notificationTypeCode string) (*model.UserNotificationConfig, error)

	// CreateOrUpdate 创建或更新用户通知配置
	CreateOrUpdate(ctx context.Context, config *model.UserNotificationConfig) (*model.UserNotificationConfig, error)

	// BatchCreateOrUpdate 批量创建或更新用户通知配置
	BatchCreateOrUpdate(ctx context.Context, userID uint, configs []*model.UserNotificationConfig) error

	// GetEffectiveNotificationEmail 获取用户的有效通知邮箱
	// 优先返回该通知类型配置的邮箱，如果未设置则返回用户邮箱
	GetEffectiveNotificationEmail(ctx context.Context, userID uint, notificationTypeCode string) (string, error)

	// ShouldNotify 检查是否应该通知用户
	// 返回: (是否通知, 通知邮箱, 启用的渠道, 错误)
	ShouldNotify(ctx context.Context, userID uint, notificationTypeCode string, channel string) (bool, string, error)
}
