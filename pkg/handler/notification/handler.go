/*
 * @Description: 通知API Handler
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package notification

import (
	"fmt"
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/notification"
	"github.com/gin-gonic/gin"
)

// Handler 通知处理器
type Handler struct {
	notificationSvc notification.Service
}

// NewHandler 创建通知处理器
func NewHandler(notificationSvc notification.Service) *Handler {
	return &Handler{
		notificationSvc: notificationSvc,
	}
}

// getCurrentUserID 从context中获取当前用户ID
func getCurrentUserID(c *gin.Context) (uint, error) {
	claimsValue, exists := c.Get(auth.ClaimsKey)
	if !exists {
		return 0, fmt.Errorf("未认证")
	}

	claims, ok := claimsValue.(*auth.CustomClaims)
	if !ok {
		return 0, fmt.Errorf("认证信息格式不正确")
	}

	// 解码公共ID
	userID, entityType, err := idgen.DecodePublicID(claims.UserID)
	if err != nil || entityType != idgen.EntityTypeUser {
		return 0, fmt.Errorf("用户ID无效")
	}

	return userID, nil
}

// ListNotificationTypes 获取所有通知类型
// @Summary 获取所有通知类型
// @Description 获取系统支持的所有通知类型列表
// @Tags 通知管理
// @Accept json
// @Produce json
// @Success 200 {object} response.Response{data=[]NotificationTypeDTO}
// @Router /notification/types [get]
func (h *Handler) ListNotificationTypes(c *gin.Context) {
	ctx := c.Request.Context()

	types, err := h.notificationSvc.ListNotificationTypes(ctx)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取通知类型列表失败: "+err.Error())
		return
	}

	dtos := make([]NotificationTypeDTO, len(types))
	for i, t := range types {
		dtos[i] = toNotificationTypeDTO(t)
	}

	response.Success(c, dtos, "获取成功")
}

// GetUserNotificationSettings 获取用户通知设置（简化版，给前端用）
// @Summary 获取用户通知设置
// @Description 获取当前用户的通知偏好设置
// @Tags 用户通知
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} response.Response{data=SimpleUserNotificationSettingsResponse}
// @Router /user/notification-settings [get]
func (h *Handler) GetUserNotificationSettings(c *gin.Context) {
	ctx := c.Request.Context()
	userID, err := getCurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "获取用户信息失败: "+err.Error())
		return
	}

	// 获取用户的所有通知配置
	configs, err := h.notificationSvc.GetUserNotificationConfigs(ctx, userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取通知设置失败: "+err.Error())
		return
	}

	// 转换为简化格式
	resp := SimpleUserNotificationSettingsResponse{
		AllowCommentReplyNotification: false,
	}

	for _, config := range configs {
		if config.NotificationType == nil {
			continue
		}

		if config.NotificationType.Code == model.NotificationTypeCommentReply {
			resp.AllowCommentReplyNotification = config.IsEnabled
		}
	}

	response.Success(c, resp, "获取成功")
}

// UpdateUserNotificationSettings 更新用户通知设置（简化版，给前端用）
// @Summary 更新用户通知设置
// @Description 更新当前用户的通知偏好设置
// @Tags 用户通知
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body SimpleUserNotificationSettingsRequest true "通知设置"
// @Success 200 {object} response.Response{data=SimpleUserNotificationSettingsResponse}
// @Router /user/notification-settings [put]
func (h *Handler) UpdateUserNotificationSettings(c *gin.Context) {
	ctx := c.Request.Context()
	userID, err := getCurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "获取用户信息失败: "+err.Error())
		return
	}

	var req SimpleUserNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 获取评论回复通知类型
	commentReplyType, err := h.notificationSvc.GetNotificationTypeByCode(ctx, model.NotificationTypeCommentReply)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取通知类型失败: "+err.Error())
		return
	}

	// 构建配置
	config := &model.UserNotificationConfig{
		UserID:             userID,
		NotificationTypeID: commentReplyType.ID,
		IsEnabled:          req.AllowCommentReplyNotification,
		EnabledChannels:    commentReplyType.SupportedChannels,
		CustomSettings:     make(map[string]interface{}),
	}

	// 更新配置
	_, err = h.notificationSvc.UpdateUserNotificationConfig(ctx, userID, config)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新通知设置失败: "+err.Error())
		return
	}

	// 返回更新后的设置
	resp := SimpleUserNotificationSettingsResponse{
		AllowCommentReplyNotification: req.AllowCommentReplyNotification,
	}

	response.Success(c, resp, "更新成功")
}

// GetUserNotificationConfigs 获取用户通知配置详情（完整版）
// @Summary 获取用户通知配置详情
// @Description 获取当前用户的所有通知配置详情
// @Tags 用户通知
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} response.Response{data=[]UserNotificationConfigDTO}
// @Router /user/notification-configs [get]
func (h *Handler) GetUserNotificationConfigs(c *gin.Context) {
	ctx := c.Request.Context()
	userID, err := getCurrentUserID(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "获取用户信息失败: "+err.Error())
		return
	}

	configs, err := h.notificationSvc.GetUserNotificationConfigs(ctx, userID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取通知配置失败: "+err.Error())
		return
	}

	dtos := make([]UserNotificationConfigDTO, len(configs))
	for i, config := range configs {
		dtos[i] = toUserNotificationConfigDTO(config)
	}

	response.Success(c, dtos, "获取成功")
}

// toNotificationTypeDTO 转换为DTO
func toNotificationTypeDTO(nt *model.NotificationType) NotificationTypeDTO {
	return NotificationTypeDTO{
		ID:                nt.ID,
		Code:              nt.Code,
		Name:              nt.Name,
		Description:       nt.Description,
		Category:          nt.Category,
		IsActive:          nt.IsActive,
		DefaultEnabled:    nt.DefaultEnabled,
		SupportedChannels: nt.SupportedChannels,
		CreatedAt:         nt.CreatedAt,
		UpdatedAt:         nt.UpdatedAt,
	}
}

// toUserNotificationConfigDTO 转换为DTO
func toUserNotificationConfigDTO(config *model.UserNotificationConfig) UserNotificationConfigDTO {
	dto := UserNotificationConfigDTO{
		ID:                 config.ID,
		UserID:             config.UserID,
		NotificationTypeID: config.NotificationTypeID,
		IsEnabled:          config.IsEnabled,
		EnabledChannels:    config.EnabledChannels,
		NotificationEmail:  config.NotificationEmail,
		CustomSettings:     config.CustomSettings,
		CreatedAt:          config.CreatedAt,
		UpdatedAt:          config.UpdatedAt,
	}

	if config.NotificationType != nil {
		notificationType := toNotificationTypeDTO(config.NotificationType)
		dto.NotificationType = &notificationType
	}

	return dto
}
