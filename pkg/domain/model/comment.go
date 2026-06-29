/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-11 17:58:40
 * @LastEditTime: 2025-09-01 22:57:09
 * @LastEditors: 安知鱼
 */
// internal/domain/model/comment.go
package model

import "time"

// Status 定义了评论的状态，使用自定义类型代替魔法数字(int)，更类型安全。
type Status int

const (
	StatusPublished Status = 1 // 已发布
	StatusPending   Status = 2 // 待审核
)

// Comment 是评论的核心领域模型。
// 它已经与任何具体实体（如文章、页面）解耦，通过路径进行关联。
type Comment struct {
	ID uint // 在领域内，我们使用数据库的 uint ID 作为其唯一标识。

	// --- 核心关联字段 ---
	TargetPath  string  // 评论所属的目标路径, 例如 "/posts/my-first-post"
	TargetTitle *string // 目标页面的标题 (可选, 用于后台展示和通知)

	// --- 关系 ---
	ParentID  *uint
	ReplyToID *uint // 回复目标评论ID，用于构建对话链
	UserID    *uint
	User      *User // 关联的用户信息（如果有）

	// --- 评论者信息 ---
	Author Author

	// --- 内容 ---
	Content     string // Markdown 原文
	ContentHTML string // 渲染后的 HTML
	LikeCount   int

	// --- 元数据 ---
	Status        Status
	IsAdminAuthor bool
	IsAnonymous   bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
	PinnedAt      *time.Time
}

// Author 代表了评论的作者信息
type Author struct {
	Nickname  string
	Email     *string // 指针类型，因为可以匿名
	Website   *string
	IP        string
	UserAgent string
	Location  string
}

// TargetMeta 包含了评论目标（如文章、页面）的元信息，主要用于发送通知。
// 它取代了原有的 ArticleMeta，变得更加通用。
type TargetMeta struct {
	Identifier string  // 目标的唯一标识符，对于路径绑定模型来说就是路径本身。
	Title      *string // 目标的标题。
}

// --- 领域逻辑方法 ---

// IsPublished 检查评论是否已发布。业务逻辑被封装在模型内部。
func (c *Comment) IsPublished() bool {
	return c.Status == StatusPublished
}

// IsTopLevel 检查是否为根评论。
func (c *Comment) IsTopLevel() bool {
	return c.ParentID == nil
}
