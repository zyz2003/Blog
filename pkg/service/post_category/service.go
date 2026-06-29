/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 11:50:43
 * @LastEditTime: 2025-08-28 13:27:36
 * @LastEditors: 安知鱼
 */
package post_category

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/util"
)

// Service 封装了文章分类的业务逻辑。
type Service struct {
	repo        repository.PostCategoryRepository
	articleRepo repository.ArticleRepository
}

// NewService 是 PostCategory Service 的构造函数。
func NewService(repo repository.PostCategoryRepository, articleRepo repository.ArticleRepository) *Service {
	return &Service{repo: repo, articleRepo: articleRepo}
}

// toAPIResponse 是一个私有的辅助函数，将领域模型转换为用于API响应的DTO。
func (s *Service) toAPIResponse(c *model.PostCategory) *model.PostCategoryResponse {
	if c == nil {
		return nil
	}
	return &model.PostCategoryResponse{
		ID:          c.ID,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
		Name:        c.Name,
		Slug:        c.Slug,
		Description: c.Description,
		Count:       c.Count,
		IsSeries:    c.IsSeries,
		SortOrder:   c.SortOrder,
	}
}

// Create 处理创建新分类的业务逻辑。
func (s *Service) Create(ctx context.Context, req *model.CreatePostCategoryRequest) (*model.PostCategoryResponse, error) {
	// 检查分类名称是否已存在
	exists, err := s.repo.ExistsByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("检查分类名称失败: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("分类名称 '%s' 已存在", req.Name)
	}

	if req.Slug == "" {
		req.Slug = util.GenerateSlug(req.Name)
	}

	newCategory, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return s.toAPIResponse(newCategory), nil
}

// List 处理获取所有分类的业务逻辑。
func (s *Service) List(ctx context.Context) ([]*model.PostCategoryResponse, error) {
	categories, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	responses := make([]*model.PostCategoryResponse, len(categories))
	for i, category := range categories {
		responses[i] = s.toAPIResponse(category)
	}

	return responses, nil
}

// Update 处理更新分类的业务逻辑。
func (s *Service) Update(ctx context.Context, publicID string, req *model.UpdatePostCategoryRequest) (*model.PostCategoryResponse, error) {
	if req.IsSeries != nil && *req.IsSeries {
		dbID, _, err := idgen.DecodePublicID(publicID)
		if err != nil {
			return nil, fmt.Errorf("无效的分类ID: %w", err)
		}

		// 检查是否有文章同时属于此分类和其他分类
		count, err := s.articleRepo.CountByCategoryWithMultipleCategories(ctx, dbID)
		if err != nil {
			return nil, fmt.Errorf("检查文章关联失败: %w", err)
		}
		if count > 0 {
			return nil, fmt.Errorf("无法将此分类设置为系列，因为有 %d 篇关联文章同时属于其他分类", count)
		}
	}
	updatedCategory, err := s.repo.Update(ctx, publicID, req)
	if err != nil {
		return nil, err
	}
	return s.toAPIResponse(updatedCategory), nil
}

// Delete 处理删除分类的业务逻辑。
func (s *Service) Delete(ctx context.Context, publicID string) error {
	return s.repo.Delete(ctx, publicID)
}
