/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-02 16:12:47
 * @LastEditTime: 2025-08-02 16:12:51
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/postcategory"
	"github.com/anzhiyu-c/anheyu-app/ent/posttag"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// cleanupRepo 是 CleanupRepository 的 Ent 实现。
type cleanupRepo struct {
	db *ent.Client
}

// NewCleanupRepo 是 cleanupRepo 的构造函数。
func NewCleanupRepo(db *ent.Client) repository.CleanupRepository {
	return &cleanupRepo{db: db}
}

// CleanupOrphanedTagsAndCategories 实现了清理逻辑。
func (r *cleanupRepo) CleanupOrphanedTagsAndCategories(ctx context.Context) (int, int, error) {
	// --- 清理标签 ---
	orphanedTagIDs, err := r.db.PostTag.Query().
		Where(
			posttag.Not(posttag.HasArticles()), // 核心逻辑：没有文章关联
			posttag.DeletedAtIsNil(),           // 确保我们不重复处理已删除的
		).
		IDs(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("查找孤立标签时出错: %w", err)
	}

	var deletedTagsCount int
	if len(orphanedTagIDs) > 0 {
		deletedTagsCount, err = r.db.PostTag.Delete().
			Where(posttag.IDIn(orphanedTagIDs...)).
			Exec(ctx)
		if err != nil {
			return 0, 0, fmt.Errorf("删除孤立标签时出错: %w", err)
		}
	}

	// --- 清理分类 ---
	orphanedCategoryIDs, err := r.db.PostCategory.Query().
		Where(
			postcategory.Not(postcategory.HasArticles()), // 核心逻辑：没有文章关联
			postcategory.DeletedAtIsNil(),
		).
		IDs(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("查找孤立分类时出错: %w", err)
	}

	var deletedCategoriesCount int
	if len(orphanedCategoryIDs) > 0 {
		deletedCategoriesCount, err = r.db.PostCategory.Delete().
			Where(postcategory.IDIn(orphanedCategoryIDs...)).
			Exec(ctx)
		if err != nil {
			return 0, 0, fmt.Errorf("删除孤立分类时出错: %w", err)
		}
	}

	return deletedTagsCount, deletedCategoriesCount, nil
}
