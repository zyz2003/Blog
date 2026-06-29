/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-02 16:13:20
 * @LastEditTime: 2025-08-02 16:13:25
 * @LastEditors: 安知鱼
 */
package cleanup

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// ICleanupService 定义了清理服务的接口。
type ICleanupService interface {
	CleanupOrphanedItems(ctx context.Context) (int, int, error)
}

// CleanupService 封装了清理相关的业务逻辑。
type CleanupService struct {
	cleanupRepo repository.CleanupRepository
}

// NewCleanupService 是 Service 的构造函数。
func NewCleanupService(cleanupRepo repository.CleanupRepository) ICleanupService {
	return &CleanupService{cleanupRepo: cleanupRepo}
}

// CleanupOrphanedItems 调用数据仓库层来执行清理。
func (s *CleanupService) CleanupOrphanedItems(ctx context.Context) (int, int, error) {
	deletedTags, deletedCategories, err := s.cleanupRepo.CleanupOrphanedTagsAndCategories(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("服务执行清理失败: %w", err)
	}
	return deletedTags, deletedCategories, nil
}
