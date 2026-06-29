/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-18 17:12:58
 * @LastEditTime: 2025-08-18 17:13:03
 * @LastEditors: 安知鱼
 */
package task

import (
	"context"
	"log"
	"strconv"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// LinkCleanupJob 负责清理不再被任何友链引用的分类和标签。
type LinkCleanupJob struct {
	linkCategoryRepo repository.LinkCategoryRepository
	linkTagRepo      repository.LinkTagRepository
	settingService   setting.SettingService
}

// NewLinkCleanupJob 是任务的构造函数。
func NewLinkCleanupJob(
	linkCategoryRepo repository.LinkCategoryRepository,
	linkTagRepo repository.LinkTagRepository,
	settingService setting.SettingService,
) *LinkCleanupJob {
	return &LinkCleanupJob{
		linkCategoryRepo: linkCategoryRepo,
		linkTagRepo:      linkTagRepo,
		settingService:   settingService,
	}
}

// Run 是 Job 接口要求实现的方法。
func (j *LinkCleanupJob) Run() {
	ctx := context.Background()

	// 1. 获取需要保护的默认分类ID列表
	excludeIDs := j.getProtectedCategoryIDs()

	// 2. 清理孤立的分类，但保护默认分类
	var deletedCategories int
	var err error
	if len(excludeIDs) > 0 {
		deletedCategories, err = j.linkCategoryRepo.DeleteAllUnusedExcluding(ctx, excludeIDs)
		if err != nil {
			log.Printf("错误: 任务 '%s' 在清理友链分类时失败: %v", j.Name(), err)
		} else if deletedCategories > 0 {
			log.Printf("任务 '%s' 执行完毕，清理了 %d 个未使用的友链分类（已保护默认分类 %v）。", j.Name(), deletedCategories, excludeIDs)
		}
	} else {
		// 如果没有配置默认分类，则使用原有逻辑
		deletedCategories, err = j.linkCategoryRepo.DeleteAllUnused(ctx)
		if err != nil {
			log.Printf("错误: 任务 '%s' 在清理友链分类时失败: %v", j.Name(), err)
		} else if deletedCategories > 0 {
			log.Printf("任务 '%s' 执行完毕，清理了 %d 个未使用的友链分类。", j.Name(), deletedCategories)
		}
	}

	// 3. 清理孤立的标签
	deletedTags, err := j.linkTagRepo.DeleteAllUnused(ctx)
	if err != nil {
		log.Printf("错误: 任务 '%s' 在清理友链标签时失败: %v", j.Name(), err)
	} else if deletedTags > 0 {
		log.Printf("任务 '%s' 执行完毕，清理了 %d 个未使用的友链标签。", j.Name(), deletedTags)
	}
}

// Name 方法返回任务的可读名称。
func (j *LinkCleanupJob) Name() string {
	return "LinkCleanupJob"
}

// getProtectedCategoryIDs 获取需要保护的默认分类ID列表
func (j *LinkCleanupJob) getProtectedCategoryIDs() []int {
	var excludeIDs []int

	// 获取配置中的默认分类ID
	defaultCategoryIDStr := j.settingService.Get(constant.KeyFriendLinkDefaultCategory.String())
	if defaultCategoryIDStr != "" {
		if defaultCategoryID, err := strconv.Atoi(defaultCategoryIDStr); err == nil && defaultCategoryID > 0 {
			excludeIDs = append(excludeIDs, defaultCategoryID)
			return excludeIDs
		}
	}

	// 如果没有配置默认分类ID，或配置无效，则使用硬编码的默认值（通常是ID=2）
	// 这是为了向后兼容，防止配置缺失时误删重要分类
	excludeIDs = append(excludeIDs, 2)
	return excludeIDs
}
