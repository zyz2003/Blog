/*
 * @Description: 通知API DTO定义
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package notification

import "time"

// NotificationTypeDTO 通知类型DTO
type NotificationTypeDTO struct {
	ID                uint      `json:"id"`
	Code              string    `json:"code"`
	Name              string    `json:"name"`
	Description       string    `json:"description"`
	Category          string    `json:"category"`
	IsActive          bool      `json:"isActive"`
	DefaultEnabled    bool      `json:"defaultEnabled"`
	SupportedChannels []string  `json:"supportedChannels"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// UserNotificationConfigDTO 用户通知配置DTO
type UserNotificationConfigDTO struct {
	ID                 uint                   `json:"id"`
	UserID             uint                   `json:"userId"`
	NotificationTypeID uint                   `json:"notificationTypeId"`
	IsEnabled          bool                   `json:"isEnabled"`
	EnabledChannels    []string               `json:"enabledChannels"`
	NotificationEmail  string                 `json:"notificationEmail,omitempty"`
	CustomSettings     map[string]interface{} `json:"customSettings,omitempty"`
	NotificationType   *NotificationTypeDTO   `json:"notificationType,omitempty"`
	CreatedAt          time.Time              `json:"createdAt"`
	UpdatedAt          time.Time              `json:"updatedAt"`
}

// UpdateUserNotificationConfigRequest 更新用户通知配置请求
type UpdateUserNotificationConfigRequest struct {
	NotificationTypeCode string                 `json:"notificationTypeCode" binding:"required"`
	IsEnabled            bool                   `json:"isEnabled"`
	EnabledChannels      []string               `json:"enabledChannels"`
	NotificationEmail    string                 `json:"notificationEmail,omitempty"`
	CustomSettings       map[string]interface{} `json:"customSettings,omitempty"`
}

// BatchUpdateUserNotificationConfigRequest 批量更新用户通知配置请求
type BatchUpdateUserNotificationConfigRequest struct {
	Configs []UpdateUserNotificationConfigRequest `json:"configs" binding:"required"`
}

// SimpleUserNotificationSettingsRequest 简化的用户通知设置请求（前端用）
type SimpleUserNotificationSettingsRequest struct {
	AllowCommentReplyNotification bool `json:"allowCommentReplyNotification"`
}

// SimpleUserNotificationSettingsResponse 简化的用户通知设置响应（前端用）
type SimpleUserNotificationSettingsResponse struct {
	AllowCommentReplyNotification bool `json:"allowCommentReplyNotification"`
}
