/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-28 00:21:55
 * @LastEditTime: 2025-07-14 00:17:47
 * @LastEditors: 安知鱼
 */
package model

import (
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"database/sql" // 导入 database/sql 用于 NullString
	"time"         // 导入 time 包
)

// StorageProviderType 定义存储提供者类型
type StorageProviderType string

const (
	StorageProviderLocal StorageProviderType = "local" // 本地存储
	StorageProviderS3    StorageProviderType = "s3"    // AWS S3 兼容存储
	StorageProviderOSS   StorageProviderType = "oss"   // 阿里云 OSS 存储
	// 更多存储类型...
)

// FileStorageEntity 是文件物理存储实体的领域模型。
// 它代表了文件数据在实际存储介质上的信息，与逻辑文件分离。
// 与 po.Entity 对应。
type FileStorageEntity struct {
	ID        uint      // 数据库主键 ID
	CreatedAt time.Time // 创建时间
	UpdatedAt time.Time // 更新时间

	// Type 表示该实体存储的内容类型 (例如 "file_content", "image_content")
	Type EntityType `json:"type"` // 使用领域模型中的 EntityType

	Source sql.NullString `json:"source,omitempty"` // 文件内容的来源路径或键

	Size int64 `json:"size"` // 物理存储的文件大小 (字节)

	UploadSessionID sql.NullString `json:"upload_session_id,omitempty"` // 关联的上传会话ID

	RecycleOptions sql.NullString `json:"recycle_options,omitempty"` // 回收选项 (存储为 JSON 字符串)

	PolicyID uint `json:"policy_id"` // 关联的存储策略ID

	CreatedBy types.NullUint64 `json:"created_by,omitempty"` // 创建此存储实体的用户ID

	Etag      sql.NullString `json:"etag,omitempty"`      // 存储实体的ETag/哈希值
	MimeType  sql.NullString `json:"mime_type,omitempty"` // 文件的MIME类型
	Dimension sql.NullString `json:"dimension,omitempty"` // 媒体文件尺寸

	StorageMetadata map[string]interface{} `json:"storage_metadata,omitempty"` // 存储提供者特有的额外元数据 (非结构化)
}

// EntityType 在领域模型中重新定义，以避免循环依赖或命名冲突。
// 它表示的是存储内容的具体分类，而不是存储提供者类型。
type EntityType string

const (
	EntityTypeFileContentModel  EntityType = "file_content"  // 普通文件内容模型
	EntityTypeImageContentModel EntityType = "image_content" // 图片内容模型
	EntityTypeVideoContentModel EntityType = "video_content" // 视频内容模型
)
