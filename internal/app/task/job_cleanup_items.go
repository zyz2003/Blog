/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-02 16:13:35
 * @LastEditTime: 2025-08-02 16:13:40
 * @LastEditors: 安知鱼
 */
package task

import (
	"context"
	"log"

	"github.com/anzhiyu-c/anheyu-app/pkg/service/cleanup"
)

// CleanupOrphanedItemsJob 负责清理无引用的标签和分类。
type CleanupOrphanedItemsJob struct {
	cleanupSvc cleanup.ICleanupService
}

// NewCleanupOrphanedItemsJob 是任务的构造函数。
func NewCleanupOrphanedItemsJob(cleanupSvc cleanup.ICleanupService) *CleanupOrphanedItemsJob {
	return &CleanupOrphanedItemsJob{
		cleanupSvc: cleanupSvc,
	}
}

// Run 是 Job 接口要求实现的方法。
func (j *CleanupOrphanedItemsJob) Run() {
	deletedTags, deletedCategories, err := j.cleanupSvc.CleanupOrphanedItems(context.Background())
	if err != nil {
		log.Printf("任务 '%s' 在执行业务逻辑时捕获到错误: %v", j.Name(), err)
	} else {
		log.Printf("任务 '%s' 业务逻辑执行完毕，共清理了 %d 个标签和 %d 个分类。", j.Name(), deletedTags, deletedCategories)
	}
}

// Name 方法让日志包装器可以打印出更有意义的任务名。
func (j *CleanupOrphanedItemsJob) Name() string {
	return "CleanupOrphanedTagsAndCategoriesJob"
}
