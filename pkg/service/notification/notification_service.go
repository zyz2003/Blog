/*
 * @Description: 通知服务实现
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package notification

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// UserNotificationSettings 用户通知偏好设置
type UserNotificationSettings struct {
	AllowCommentReplyNotification bool
}

// Service 通知服务接口
type Service interface {
	// 通知类型相关
	ListNotificationTypes(ctx context.Context) ([]*model.NotificationType, error)
	GetNotificationTypeByCode(ctx context.Context, code string) (*model.NotificationType, error)

	// 用户通知配置相关
	GetUserNotificationConfigs(ctx context.Context, userID uint) ([]*model.UserNotificationConfig, error)
	GetUserNotificationConfig(ctx context.Context, userID uint, notificationTypeCode string) (*model.UserNotificationConfig, error)
	UpdateUserNotificationConfig(ctx context.Context, userID uint, config *model.UserNotificationConfig) (*model.UserNotificationConfig, error)
	BatchUpdateUserNotificationConfigs(ctx context.Context, userID uint, configs []*model.UserNotificationConfig) error
	GetUserNotificationSettings(ctx context.Context, userID uint) (*UserNotificationSettings, error)

	// 通知判断相关
	ShouldNotifyUser(ctx context.Context, userID uint, notificationTypeCode string, channel string) (bool, string, error)

	// 初始化相关
	InitializeDefaultNotificationTypes(ctx context.Context) error
	EnsureUserDefaultConfigs(ctx context.Context, userID uint) error
}

type notificationService struct {
	notificationTypeRepo repository.NotificationTypeRepository
	userConfigRepo       repository.UserNotificationConfigRepository
}

// NewNotificationService 创建通知服务
func NewNotificationService(
	notificationTypeRepo repository.NotificationTypeRepository,
	userConfigRepo repository.UserNotificationConfigRepository,
) Service {
	return &notificationService{
		notificationTypeRepo: notificationTypeRepo,
		userConfigRepo:       userConfigRepo,
	}
}

// ListNotificationTypes 获取所有通知类型
func (s *notificationService) ListNotificationTypes(ctx context.Context) ([]*model.NotificationType, error) {
	return s.notificationTypeRepo.FindAll(ctx)
}

// GetNotificationTypeByCode 根据code获取通知类型
func (s *notificationService) GetNotificationTypeByCode(ctx context.Context, code string) (*model.NotificationType, error) {
	return s.notificationTypeRepo.FindByCode(ctx, code)
}

// GetUserNotificationConfigs 获取用户的所有通知配置
func (s *notificationService) GetUserNotificationConfigs(ctx context.Context, userID uint) ([]*model.UserNotificationConfig, error) {
	// 先确保用户有默认配置
	if err := s.EnsureUserDefaultConfigs(ctx, userID); err != nil {
		return nil, err
	}

	return s.userConfigRepo.FindByUserID(ctx, userID)
}

// GetUserNotificationConfig 获取用户指定类型的通知配置
func (s *notificationService) GetUserNotificationConfig(ctx context.Context, userID uint, notificationTypeCode string) (*model.UserNotificationConfig, error) {
	return s.userConfigRepo.FindByUserAndType(ctx, userID, notificationTypeCode)
}

// UpdateUserNotificationConfig 更新用户通知配置
func (s *notificationService) UpdateUserNotificationConfig(ctx context.Context, userID uint, config *model.UserNotificationConfig) (*model.UserNotificationConfig, error) {
	config.UserID = userID
	return s.userConfigRepo.CreateOrUpdate(ctx, config)
}

// BatchUpdateUserNotificationConfigs 批量更新用户通知配置
func (s *notificationService) BatchUpdateUserNotificationConfigs(ctx context.Context, userID uint, configs []*model.UserNotificationConfig) error {
	return s.userConfigRepo.BatchCreateOrUpdate(ctx, userID, configs)
}

// GetUserNotificationSettings 获取用户通知偏好设置（简化版）
func (s *notificationService) GetUserNotificationSettings(ctx context.Context, userID uint) (*UserNotificationSettings, error) {
	// 获取用户的所有通知配置
	configs, err := s.GetUserNotificationConfigs(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("获取通知配置失败: %w", err)
	}

	// 转换为简化格式
	settings := &UserNotificationSettings{
		AllowCommentReplyNotification: false, // 默认关闭
	}

	for _, config := range configs {
		if config.NotificationType == nil {
			continue
		}

		if config.NotificationType.Code == model.NotificationTypeCommentReply {
			settings.AllowCommentReplyNotification = config.IsEnabled
			break
		}
	}

	return settings, nil
}

// ShouldNotifyUser 检查是否应该通知用户
func (s *notificationService) ShouldNotifyUser(ctx context.Context, userID uint, notificationTypeCode string, channel string) (bool, string, error) {
	return s.userConfigRepo.ShouldNotify(ctx, userID, notificationTypeCode, channel)
}

// InitializeDefaultNotificationTypes 初始化默认通知类型
func (s *notificationService) InitializeDefaultNotificationTypes(ctx context.Context) error {
	defaultTypes := model.DefaultNotificationTypes()

	for _, nt := range defaultTypes {
		// 检查是否已存在
		existing, err := s.notificationTypeRepo.FindByCode(ctx, nt.Code)
		if err != nil {
			return fmt.Errorf("检查通知类型失败: %w", err)
		}

		if existing == nil {
			// 不存在，创建
			_, err := s.notificationTypeRepo.Create(ctx, nt)
			if err != nil {
				return fmt.Errorf("创建通知类型失败 [%s]: %w", nt.Code, err)
			}
		} else {
			// 存在，更新（除了code和id外的字段）
			nt.ID = existing.ID
			_, err := s.notificationTypeRepo.Update(ctx, existing.ID, nt)
			if err != nil {
				return fmt.Errorf("更新通知类型失败 [%s]: %w", nt.Code, err)
			}
		}
	}

	return nil
}

// EnsureUserDefaultConfigs 确保用户拥有所有默认通知类型的配置
func (s *notificationService) EnsureUserDefaultConfigs(ctx context.Context, userID uint) error {
	// 获取所有通知类型
	notificationTypes, err := s.notificationTypeRepo.FindAll(ctx)
	if err != nil {
		return fmt.Errorf("获取通知类型列表失败: %w", err)
	}

	// 获取用户已有的配置
	userConfigs, err := s.userConfigRepo.FindByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("获取用户通知配置失败: %w", err)
	}

	// 构建已有配置的map
	existingConfigsMap := make(map[uint]bool)
	for _, config := range userConfigs {
		existingConfigsMap[config.NotificationTypeID] = true
	}

	// 为缺失的通知类型创建默认配置
	for _, nt := range notificationTypes {
		if !existingConfigsMap[nt.ID] {
			config := &model.UserNotificationConfig{
				UserID:             userID,
				NotificationTypeID: nt.ID,
				IsEnabled:          nt.DefaultEnabled,
				EnabledChannels:    nt.SupportedChannels,
				CustomSettings:     make(map[string]interface{}),
			}

			_, err := s.userConfigRepo.CreateOrUpdate(ctx, config)
			if err != nil {
				return fmt.Errorf("创建用户默认通知配置失败 [type_id=%d]: %w", nt.ID, err)
			}
		}
	}

	return nil
}
