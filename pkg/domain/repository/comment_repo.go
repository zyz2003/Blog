/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-11 17:58:48
 * @LastEditTime: 2025-10-12 03:44:26
 * @LastEditors: 安知鱼
 */
// internal/domain/repository/comment_repo.go
package repository

import (
	"context"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type CreateCommentParams struct {
	TargetPath     string
	TargetTitle    *string
	UserID         *uint
	ParentID       *uint
	ReplyToID      *uint // 回复目标评论的数据库ID
	Nickname       string
	Email          *string
	EmailMD5       string
	Website        *string
	Content        string
	ContentHTML    string
	UserAgent      *string
	IPAddress      string
	IPLocation     string
	Status         int
	IsAdminComment bool
	IsAnonymous    bool
	CreatedAt      *time.Time // 可选的创建时间（用于导入时保留原始时间）
	UpdatedAt      *time.Time // 可选的更新时间（用于导入时保留原始时间）
	LikeCount      int        // 点赞数（用于导入时保留原始点赞数）
}
type AdminListParams struct {
	Page       int
	PageSize   int
	Nickname   *string
	Email      *string
	Website    *string
	IPAddress  *string
	Content    *string
	TargetPath *string
	Status     *int
}

// UpdateCommentInfoParams 定义了更新评论信息的参数
type UpdateCommentInfoParams struct {
	Content     *string // 更新后的 Markdown 内容
	ContentHTML *string // 更新后的 HTML 内容
	Nickname    *string // 用户昵称
	Email       *string // 用户邮箱
	EmailMD5    *string // 邮箱的 MD5 哈希（用于 Gravatar）
	Website     *string // 用户网站
}

// CommentRepository 定义了评论数据的持久化操作接口。
type CommentRepository interface {
	// 创建一条新评论
	Create(ctx context.Context, params *CreateCommentParams) (*model.Comment, error)

	// 根据路径查找所有已发布的评论
	FindAllPublishedByPath(ctx context.Context, path string) ([]*model.Comment, error)

	// 根据数据库ID查找单条评论
	FindByID(ctx context.Context, id uint) (*model.Comment, error)

	// 根据一组数据库ID查找多条评论，用于批量查询
	FindManyByIDs(ctx context.Context, ids []uint) ([]*model.Comment, error)

	// 增加评论的点赞数
	IncrementLikeCount(ctx context.Context, id uint) (*model.Comment, error)

	// 减少评论的点赞数
	DecrementLikeCount(ctx context.Context, id uint) (*model.Comment, error)

	// --- 管理员方法 ---

	// 根据多种条件分页查询评论列表
	FindWithConditions(ctx context.Context, params AdminListParams) ([]*model.Comment, int64, error)

	// 根据ID列表批量（软）删除评论
	DeleteByIDs(ctx context.Context, ids []uint) (int, error)

	// 更新单条评论的状态
	UpdateStatus(ctx context.Context, id uint, status model.Status) (*model.Comment, error)

	// 设置或取消评论的置顶状态
	SetPin(ctx context.Context, id uint, pinTime *time.Time) (*model.Comment, error)

	// 更新评论的内容（仅限管理员）
	UpdateContent(ctx context.Context, id uint, content, contentHTML string) (*model.Comment, error)

	// 更新评论的用户信息和内容（仅限管理员）
	UpdateCommentInfo(ctx context.Context, id uint, params *UpdateCommentInfoParams) (*model.Comment, error)

	// 更新评论的路径（用于处理文章或页面slug变更的情况）
	UpdatePath(ctx context.Context, oldPath, newPath string) (int, error)

	// 根据父评论ID分页查找已发布的子评论
	FindPublishedChildrenByParentID(ctx context.Context, parentID uint, page, pageSize int) ([]*model.Comment, int64, error)

	// 分页查找所有已发布的评论，按创建时间降序
	FindAllPublishedPaginated(ctx context.Context, page, pageSize int) ([]*model.Comment, int64, error)

	// 批量统计多个文章的评论数量
	CountByTargetPaths(ctx context.Context, targetPaths []string) (map[string]int, error)
}
