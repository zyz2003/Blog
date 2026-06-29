/*
 * @Description: 用户通知配置仓储Ent实现
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package ent

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/notificationtype"
	"github.com/anzhiyu-c/anheyu-app/ent/user"
	"github.com/anzhiyu-c/anheyu-app/ent/usernotificationconfig"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// entUserNotificationConfigRepository 是 UserNotificationConfigRepository 的 Ent 实现
type entUserNotificationConfigRepository struct {
	client *ent.Client
}

// NewEntUserNotificationConfigRepository 创建用户通知配置仓储
func NewEntUserNotificationConfigRepository(client *ent.Client) repository.UserNotificationConfigRepository {
	return &entUserNotificationConfigRepository{client: client}
}

// FindByUserID 获取用户的所有通知配置
func (r *entUserNotificationConfigRepository) FindByUserID(ctx context.Context, userID uint) ([]*model.UserNotificationConfig, error) {
	entConfigs, err := r.client.UserNotificationConfig.
		Query().
		Where(usernotificationconfig.UserID(userID)).
		WithNotificationType().
		All(ctx)

	if err != nil {
		return nil, fmt.Errorf("查询用户通知配置失败: %w", err)
	}

	configs := make([]*model.UserNotificationConfig, len(entConfigs))
	for i, ec := range entConfigs {
		configs[i] = toDomainUserNotificationConfig(ec)
	}

	return configs, nil
}

// FindByUserAndType 获取用户指定类型的通知配置
func (r *entUserNotificationConfigRepository) FindByUserAndType(ctx context.Context, userID uint, notificationTypeCode string) (*model.UserNotificationConfig, error) {
	// 先查找通知类型
	entType, err := r.client.NotificationType.
		Query().
		Where(notificationtype.Code(notificationTypeCode)).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, fmt.Errorf("通知类型不存在: %s", notificationTypeCode)
		}
		return nil, fmt.Errorf("查询通知类型失败: %w", err)
	}

	// 查找用户配置
	entConfig, err := r.client.UserNotificationConfig.
		Query().
		Where(
			usernotificationconfig.UserID(userID),
			usernotificationconfig.NotificationTypeID(entType.ID),
		).
		WithNotificationType().
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			// 不存在则返回默认配置
			return &model.UserNotificationConfig{
				UserID:             userID,
				NotificationTypeID: entType.ID,
				IsEnabled:          entType.DefaultEnabled,
				EnabledChannels:    entType.SupportedChannels,
				NotificationEmail:  "",
				CustomSettings:     make(map[string]interface{}),
				NotificationType:   toDomainNotificationType(entType),
			}, nil
		}
		return nil, fmt.Errorf("查询用户通知配置失败: %w", err)
	}

	return toDomainUserNotificationConfig(entConfig), nil
}

// CreateOrUpdate 创建或更新用户通知配置
func (r *entUserNotificationConfigRepository) CreateOrUpdate(ctx context.Context, config *model.UserNotificationConfig) (*model.UserNotificationConfig, error) {
	// 检查是否存在
	existing, err := r.client.UserNotificationConfig.
		Query().
		Where(
			usernotificationconfig.UserID(config.UserID),
			usernotificationconfig.NotificationTypeID(config.NotificationTypeID),
		).
		Only(ctx)

	var result *ent.UserNotificationConfig

	if err != nil && !ent.IsNotFound(err) {
		return nil, fmt.Errorf("查询用户通知配置失败: %w", err)
	}

	if ent.IsNotFound(err) {
		// 不存在，创建
		result, err = r.client.UserNotificationConfig.
			Create().
			SetUserID(config.UserID).
			SetNotificationTypeID(config.NotificationTypeID).
			SetIsEnabled(config.IsEnabled).
			SetEnabledChannels(config.EnabledChannels).
			SetNillableNotificationEmail(nilIfEmpty(config.NotificationEmail)).
			SetCustomSettings(config.CustomSettings).
			Save(ctx)

		if err != nil {
			return nil, fmt.Errorf("创建用户通知配置失败: %w", err)
		}
	} else {
		// 存在，更新
		result, err = existing.Update().
			SetIsEnabled(config.IsEnabled).
			SetEnabledChannels(config.EnabledChannels).
			SetNillableNotificationEmail(nilIfEmpty(config.NotificationEmail)).
			SetCustomSettings(config.CustomSettings).
			Save(ctx)

		if err != nil {
			return nil, fmt.Errorf("更新用户通知配置失败: %w", err)
		}
	}

	// 重新查询以获取关联数据
	result, err = r.client.UserNotificationConfig.
		Query().
		Where(usernotificationconfig.ID(result.ID)).
		WithNotificationType().
		Only(ctx)

	if err != nil {
		return nil, fmt.Errorf("查询更新后的配置失败: %w", err)
	}

	return toDomainUserNotificationConfig(result), nil
}

// BatchCreateOrUpdate 批量创建或更新用户通知配置
func (r *entUserNotificationConfigRepository) BatchCreateOrUpdate(ctx context.Context, userID uint, configs []*model.UserNotificationConfig) error {
	for _, config := range configs {
		config.UserID = userID
		_, err := r.CreateOrUpdate(ctx, config)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetEffectiveNotificationEmail 获取用户的有效通知邮箱
func (r *entUserNotificationConfigRepository) GetEffectiveNotificationEmail(ctx context.Context, userID uint, notificationTypeCode string) (string, error) {
	// 查找用户配置
	config, err := r.FindByUserAndType(ctx, userID, notificationTypeCode)
	if err != nil {
		return "", err
	}

	// 如果配置了自定义邮箱，使用自定义邮箱
	if config.NotificationEmail != "" {
		return config.NotificationEmail, nil
	}

	// 否则使用用户邮箱
	entUser, err := r.client.User.
		Query().
		Where(user.ID(userID)).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return "", fmt.Errorf("用户不存在")
		}
		return "", fmt.Errorf("查询用户失败: %w", err)
	}

	if entUser.Email == "" {
		return "", fmt.Errorf("用户未设置邮箱")
	}

	return entUser.Email, nil
}

// ShouldNotify 检查是否应该通知用户
func (r *entUserNotificationConfigRepository) ShouldNotify(ctx context.Context, userID uint, notificationTypeCode string, channel string) (bool, string, error) {
	// 查找用户配置
	config, err := r.FindByUserAndType(ctx, userID, notificationTypeCode)
	if err != nil {
		return false, "", err
	}

	// 检查是否启用
	if !config.IsEnabled {
		return false, "", nil
	}

	// 检查渠道是否启用
	channelEnabled := false
	for _, ch := range config.EnabledChannels {
		if ch == channel {
			channelEnabled = true
			break
		}
	}

	if !channelEnabled {
		return false, "", nil
	}

	// 获取有效邮箱
	email, err := r.GetEffectiveNotificationEmail(ctx, userID, notificationTypeCode)
	if err != nil {
		return false, "", err
	}

	if email == "" {
		return false, "", nil
	}

	return true, email, nil
}

// toDomainUserNotificationConfig 将 Ent 实体转换为领域模型
func toDomainUserNotificationConfig(entConfig *ent.UserNotificationConfig) *model.UserNotificationConfig {
	if entConfig == nil {
		return nil
	}

	config := &model.UserNotificationConfig{
		ID:                 entConfig.ID,
		CreatedAt:          entConfig.CreatedAt,
		UpdatedAt:          entConfig.UpdatedAt,
		UserID:             entConfig.UserID,
		NotificationTypeID: entConfig.NotificationTypeID,
		IsEnabled:          entConfig.IsEnabled,
		EnabledChannels:    entConfig.EnabledChannels,
		NotificationEmail:  entConfig.NotificationEmail,
		CustomSettings:     entConfig.CustomSettings,
	}

	// 添加关联的通知类型
	if entConfig.Edges.NotificationType != nil {
		config.NotificationType = toDomainNotificationType(entConfig.Edges.NotificationType)
	}

	return config
}

// nilIfEmpty 如果字符串为空则返回nil
func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
