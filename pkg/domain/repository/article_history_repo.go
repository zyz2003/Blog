/*
 * @Description: 文章历史版本仓储接口
 * @Author: 安知鱼
 * @Date: 2026-01-13
 */
package repository

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// ArticleHistoryRepository 定义了文章历史版本数据仓库的接口。
type ArticleHistoryRepository interface {
	// Create 创建历史版本记录
	Create(ctx context.Context, params *model.CreateArticleHistoryParams) (*model.ArticleHistory, error)

	// GetByArticleAndVersion 根据文章ID和版本号获取历史记录
	GetByArticleAndVersion(ctx context.Context, articleDBID uint, version int) (*model.ArticleHistory, error)

	// ListByArticle 分页获取文章的历史版本列表
	ListByArticle(ctx context.Context, articleDBID uint, page, pageSize int) ([]model.ArticleHistoryListItem, int64, error)

	// GetLatestVersion 获取文章的最新版本号，如果没有历史记录则返回0
	GetLatestVersion(ctx context.Context, articleDBID uint) (int, error)

	// DeleteOldVersions 删除旧版本（保留最近N个版本）
	DeleteOldVersions(ctx context.Context, articleDBID uint, keepCount int) error

	// CountByArticle 获取文章的历史版本总数
	CountByArticle(ctx context.Context, articleDBID uint) (int, error)

	// DeleteByArticle 删除文章的所有历史版本（文章被删除时调用）
	DeleteByArticle(ctx context.Context, articleDBID uint) error

	// GetAllArticleIDsWithHistory 获取所有有历史记录的文章ID列表（用于定时清理任务）
	GetAllArticleIDsWithHistory(ctx context.Context) ([]uint, error)
}
