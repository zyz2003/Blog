/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-26 11:44:52
 * @LastEditTime: 2025-06-26 12:11:22
 * @LastEditors: 安知鱼
 */
package model

import (
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"database/sql" // 导入 database/sql 用于 sql.NullString
	"time"         // 导入 time 包
)

// FileStorageVersion 是文件版本管理的领域模型。
// 它连接了逻辑文件 (File) 和其对应的物理存储实体 (FileStorageEntity)，
// 并支持版本控制。与 po.FileEntity 对应。
type FileStorageVersion struct {
	ID        uint      // 数据库主键 ID
	CreatedAt time.Time // 创建时间
	UpdatedAt time.Time // 更新时间

	FileID uint `json:"file_id"` // 关联的逻辑文件ID
	// File File `json:"file"` // 如果需要，可以关联 File 领域模型

	EntityID uint `json:"entity_id"` // 关联的物理存储实体ID
	// Entity FileStorageEntity `json:"entity"` // 如果需要，可以关联 FileStorageEntity 领域模型

	// Version 可以是简单的版本号、时间戳或 UUID，用于区分文件在不同时刻引用的物理实体。
	Version sql.NullString `json:"version,omitempty"` // 使用 sql.NullString 处理可空版本

	// IsCurrent 标记此条目是否是某个逻辑文件的当前激活版本。
	IsCurrent bool `json:"is_current"`

	UploadedByUserID types.NullUint64 `json:"uploaded_by_user_id,omitempty"`
}
