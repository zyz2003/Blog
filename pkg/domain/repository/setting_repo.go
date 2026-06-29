/*
 * @Description: 配置数据操作的契约
 * @Author: 安知鱼
 * @Date: 2025-06-20 13:07:49
 * @LastEditTime: 2025-06-21 18:53:13
 * @LastEditors: 安知鱼
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// SettingRepository 定义了配置数据操作的契约
type SettingRepository interface {
	FindByKey(ctx context.Context, key string) (*model.Setting, error)
	Save(ctx context.Context, setting *model.Setting) error
	FindAll(ctx context.Context) ([]*model.Setting, error)
	Update(ctx context.Context, settingsToUpdate map[string]string) error
	// Upsert 将 map 中每个键值对写入数据库：已存在则更新，不存在则插入（用于配置导入全覆盖）
	Upsert(ctx context.Context, settings map[string]string) error
}
