/*
 * @Description: 通知类型仓储Ent实现
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package ent

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/notificationtype"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// entNotificationTypeRepository 是 NotificationTypeRepository 的 Ent 实现
type entNotificationTypeRepository struct {
	client *ent.Client
}

// NewEntNotificationTypeRepository 创建通知类型仓储
func NewEntNotificationTypeRepository(client *ent.Client) repository.NotificationTypeRepository {
	return &entNotificationTypeRepository{client: client}
}

// FindAll 获取所有通知类型
func (r *entNotificationTypeRepository) FindAll(ctx context.Context) ([]*model.NotificationType, error) {
	entTypes, err := r.client.NotificationType.
		Query().
		All(ctx)

	if err != nil {
		return nil, fmt.Errorf("查询通知类型列表失败: %w", err)
	}

	types := make([]*model.NotificationType, len(entTypes))
	for i, et := range entTypes {
		types[i] = toDomainNotificationType(et)
	}

	return types, nil
}

// FindByCode 根据code查找通知类型
func (r *entNotificationTypeRepository) FindByCode(ctx context.Context, code string) (*model.NotificationType, error) {
	entType, err := r.client.NotificationType.
		Query().
		Where(notificationtype.Code(code)).
		Only(ctx)

	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("查询通知类型失败: %w", err)
	}

	return toDomainNotificationType(entType), nil
}

// FindByCategory 根据分类查找通知类型列表
func (r *entNotificationTypeRepository) FindByCategory(ctx context.Context, category string) ([]*model.NotificationType, error) {
	entTypes, err := r.client.NotificationType.
		Query().
		Where(notificationtype.Category(category)).
		All(ctx)

	if err != nil {
		return nil, fmt.Errorf("查询通知类型列表失败: %w", err)
	}

	types := make([]*model.NotificationType, len(entTypes))
	for i, et := range entTypes {
		types[i] = toDomainNotificationType(et)
	}

	return types, nil
}

// Create 创建通知类型
func (r *entNotificationTypeRepository) Create(ctx context.Context, nt *model.NotificationType) (*model.NotificationType, error) {
	entType, err := r.client.NotificationType.
		Create().
		SetCode(nt.Code).
		SetName(nt.Name).
		SetNillableDescription(&nt.Description).
		SetCategory(nt.Category).
		SetIsActive(nt.IsActive).
		SetDefaultEnabled(nt.DefaultEnabled).
		SetSupportedChannels(nt.SupportedChannels).
		Save(ctx)

	if err != nil {
		return nil, fmt.Errorf("创建通知类型失败: %w", err)
	}

	return toDomainNotificationType(entType), nil
}

// Update 更新通知类型
func (r *entNotificationTypeRepository) Update(ctx context.Context, id uint, nt *model.NotificationType) (*model.NotificationType, error) {
	entType, err := r.client.NotificationType.
		UpdateOneID(id).
		SetName(nt.Name).
		SetNillableDescription(&nt.Description).
		SetCategory(nt.Category).
		SetIsActive(nt.IsActive).
		SetDefaultEnabled(nt.DefaultEnabled).
		SetSupportedChannels(nt.SupportedChannels).
		Save(ctx)

	if err != nil {
		return nil, fmt.Errorf("更新通知类型失败: %w", err)
	}

	return toDomainNotificationType(entType), nil
}

// toDomainNotificationType 将 Ent 实体转换为领域模型
func toDomainNotificationType(entType *ent.NotificationType) *model.NotificationType {
	if entType == nil {
		return nil
	}

	return &model.NotificationType{
		ID:                entType.ID,
		CreatedAt:         entType.CreatedAt,
		UpdatedAt:         entType.UpdatedAt,
		Code:              entType.Code,
		Name:              entType.Name,
		Description:       entType.Description,
		Category:          entType.Category,
		IsActive:          entType.IsActive,
		DefaultEnabled:    entType.DefaultEnabled,
		SupportedChannels: entType.SupportedChannels,
	}
}
