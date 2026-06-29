/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 11:50:29
 * @LastEditTime: 2025-08-05 11:21:32
 * @LastEditors: 安知鱼
 */
package post_tag

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/util"
)

// Service 封装了文章标签的业务逻辑。
type Service struct {
	repo repository.PostTagRepository
}

// NewService 是 PostTag Service 的构造函数。
func NewService(repo repository.PostTagRepository) *Service {
	return &Service{repo: repo}
}

// toAPIResponse 是一个私有的辅助函数，将领域模型转换为用于API响应的DTO。
func (s *Service) toAPIResponse(t *model.PostTag) *model.PostTagResponse {
	if t == nil {
		return nil
	}
	return &model.PostTagResponse{
		ID:        t.ID,
		CreatedAt: t.CreatedAt,
		UpdatedAt: t.UpdatedAt,
		Name:      t.Name,
		Slug:      t.Slug,
		Count:     t.Count,
	}
}

// Create 处理创建新标签的业务逻辑。
func (s *Service) Create(ctx context.Context, req *model.CreatePostTagRequest) (*model.PostTagResponse, error) {
	// 检查标签名称是否已存在
	exists, err := s.repo.ExistsByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("检查标签名称失败: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("标签名称 '%s' 已存在", req.Name)
	}

	if req.Slug == "" {
		req.Slug = util.GenerateSlug(req.Name)
	}

	newTag, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return s.toAPIResponse(newTag), nil
}

// List 处理获取所有标签的业务逻辑。
func (s *Service) List(ctx context.Context, options model.ListPostTagsOptions) ([]*model.PostTagResponse, error) {
	tags, err := s.repo.List(ctx, &options)
	if err != nil {
		return nil, err
	}

	responses := make([]*model.PostTagResponse, len(tags))
	for i, tag := range tags {
		responses[i] = s.toAPIResponse(tag)
	}

	return responses, nil
}

// Update 处理更新标签的业务逻辑。
func (s *Service) Update(ctx context.Context, publicID string, req *model.UpdatePostTagRequest) (*model.PostTagResponse, error) {
	updatedTag, err := s.repo.Update(ctx, publicID, req)
	if err != nil {
		return nil, err
	}
	return s.toAPIResponse(updatedTag), nil
}

// Delete 处理删除标签的业务逻辑。
func (s *Service) Delete(ctx context.Context, publicID string) error {
	return s.repo.Delete(ctx, publicID)
}
