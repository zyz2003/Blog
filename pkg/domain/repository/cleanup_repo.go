/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-02 16:12:29
 * @LastEditTime: 2025-08-02 16:12:34
 * @LastEditors: 安知鱼
 */
package repository

import "context"

// CleanupRepository 定义了清理操作的接口。
type CleanupRepository interface {
	// CleanupOrphanedTagsAndCategories 负责移除未被任何文章引用的标签和分类。
	// 它会分别返回被删除的标签和分类的数量。
	CleanupOrphanedTagsAndCategories(ctx context.Context) (int, int, error)
}
