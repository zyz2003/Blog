/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-07 14:07:33
 * @LastEditTime: 2025-08-07 14:07:38
 * @LastEditors: 安知鱼
 */
package task

import (
	"context"
	"log"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

// Redis Key 前缀常量
const (
	TaskKeyNamespace           = "anheyu:"
	ArticleViewCountKeyPattern = TaskKeyNamespace + "article:view_count:*"
	ArticleViewCountKeyPrefix  = TaskKeyNamespace + "article:view_count:"
)

// SyncViewCountsJob 负责将 Redis 中的浏览量同步到数据库。
type SyncViewCountsJob struct {
	repo     repository.ArticleRepository
	cacheSvc utility.CacheService
}

// NewSyncViewCountsJob 是任务的构造函数。
func NewSyncViewCountsJob(repo repository.ArticleRepository, cacheSvc utility.CacheService) *SyncViewCountsJob {
	return &SyncViewCountsJob{
		repo:     repo,
		cacheSvc: cacheSvc,
	}
}

// Name 方法返回任务的可读名称。
func (j *SyncViewCountsJob) Name() string {
	return "SyncArticleViewCountsToDBJob"
}

// Run 是 Job 接口要求实现的方法，包含了核心的同步逻辑。
func (j *SyncViewCountsJob) Run() {
	ctx := context.Background()

	// 1. 从 Redis 扫描所有待处理的浏览量键
	keys, err := j.cacheSvc.Scan(ctx, ArticleViewCountKeyPattern)
	if err != nil {
		log.Printf("错误: 任务 '%s' 扫描 Redis 键失败: %v", j.Name(), err)
		return
	}
	if len(keys) == 0 {
		log.Printf("信息: 任务 '%s' 没有发现需要同步的浏览量。", j.Name())
		return
	}

	// 2. 高效地获取并删除这些键
	viewIncrements, err := j.cacheSvc.GetAndDeleteMany(ctx, keys)
	if err != nil {
		log.Printf("错误: 任务 '%s' 从 Redis 获取或删除键失败: %v", j.Name(), err)
		return
	}

	// 3. 将数据从 map[string]int 转换为 map[uint]int
	updates := make(map[uint]int)
	for key, increment := range viewIncrements {
		publicID := strings.TrimPrefix(key, ArticleViewCountKeyPrefix)
		dbID, _, err := idgen.DecodePublicID(publicID)
		if err != nil {
			log.Printf("警告: 任务 '%s' 解码 public ID '%s' 失败: %v", j.Name(), publicID, err)
			continue
		}
		updates[dbID] = increment
	}

	// 4. 将累积的浏览量批量更新到数据库
	// 注意：你需要在 ArticleRepository 接口和实现中添加 UpdateViewCounts 方法
	if err := j.repo.UpdateViewCounts(ctx, updates); err != nil {
		log.Printf("错误: 任务 '%s' 批量更新数据库失败: %v", j.Name(), err)
		// 在生产环境中，这里应该有重试或将失败的键重新写回 Redis 的逻辑
		return
	}

	log.Printf("成功: 任务 '%s' 已成功同步 %d 篇文章的浏览量。", j.Name(), len(updates))
}
