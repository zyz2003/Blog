/*
 * @Description: 通知系统领域模型
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package model

import "time"

// 通知类型常量
const (
	// 评论相关
	NotificationTypeCommentReply = "comment_reply" // 评论回复
	NotificationTypeCommentNew   = "comment_new"   // 新评论（博主）

	// 系统相关
	NotificationTypeSystemUpdate   = "system_update"   // 系统更新
	NotificationTypeSystemMaintain = "system_maintain" // 系统维护

	// 营销相关
	NotificationTypeMarketingPromo = "marketing_promo" // 营销推广
	NotificationTypeMarketingNews  = "marketing_news"  // 营销资讯

	// 订单相关（预留）
	NotificationTypeOrderCreated = "order_created" // 订单创建
	NotificationTypeOrderPaid    = "order_paid"    // 订单支付
	NotificationTypeOrderShipped = "order_shipped" // 订单发货
)

// 通知分类常量
const (
	NotificationCategoryComment   = "comment"   // 评论
	NotificationCategorySystem    = "system"    // 系统
	NotificationCategoryMarketing = "marketing" // 营销
	NotificationCategoryOrder     = "order"     // 订单
)

// 通知渠道常量
const (
	NotificationChannelEmail = "email" // 邮件
	NotificationChannelPush  = "push"  // 推送
	NotificationChannelSMS   = "sms"   // 短信
)

// NotificationType 通知类型定义
type NotificationType struct {
	ID                uint
	CreatedAt         time.Time
	UpdatedAt         time.Time
	Code              string   // 唯一标识
	Name              string   // 显示名称
	Description       string   // 描述
	Category          string   // 分类
	IsActive          bool     // 是否启用
	DefaultEnabled    bool     // 默认是否开启
	SupportedChannels []string // 支持的通知渠道
}

// UserNotificationConfig 用户通知配置
type UserNotificationConfig struct {
	ID                 uint
	CreatedAt          time.Time
	UpdatedAt          time.Time
	UserID             uint
	NotificationTypeID uint
	IsEnabled          bool                   // 是否启用
	EnabledChannels    []string               // 启用的渠道
	NotificationEmail  string                 // 通知邮箱
	CustomSettings     map[string]interface{} // 自定义配置

	// 关联
	NotificationType *NotificationType `json:"notificationType,omitempty"`
}

// IsChannelEnabled 检查指定渠道是否启用
func (c *UserNotificationConfig) IsChannelEnabled(channel string) bool {
	if !c.IsEnabled {
		return false
	}
	for _, ch := range c.EnabledChannels {
		if ch == channel {
			return true
		}
	}
	return false
}

// GetEffectiveEmail 获取有效的通知邮箱
func (c *UserNotificationConfig) GetEffectiveEmail() string {
	return c.NotificationEmail
}

// DefaultNotificationTypes 返回默认的通知类型列表
func DefaultNotificationTypes() []*NotificationType {
	return []*NotificationType{
		{
			Code:              NotificationTypeCommentReply,
			Name:              "评论回复通知",
			Description:       "当您的评论被他人回复时通知您",
			Category:          NotificationCategoryComment,
			IsActive:          true,
			DefaultEnabled:    true,
			SupportedChannels: []string{NotificationChannelEmail, NotificationChannelPush},
		},
		{
			Code:              NotificationTypeCommentNew,
			Name:              "新评论通知",
			Description:       "当网站收到新评论时通知博主",
			Category:          NotificationCategoryComment,
			IsActive:          true,
			DefaultEnabled:    true,
			SupportedChannels: []string{NotificationChannelEmail, NotificationChannelPush},
		},
		{
			Code:              NotificationTypeSystemUpdate,
			Name:              "系统更新通知",
			Description:       "接收系统更新和新功能介绍",
			Category:          NotificationCategorySystem,
			IsActive:          true,
			DefaultEnabled:    true,
			SupportedChannels: []string{NotificationChannelEmail},
		},
		{
			Code:              NotificationTypeMarketingPromo,
			Name:              "营销推广通知",
			Description:       "接收活动推荐和优惠信息",
			Category:          NotificationCategoryMarketing,
			IsActive:          true,
			DefaultEnabled:    false,
			SupportedChannels: []string{NotificationChannelEmail},
		},
	}
}
