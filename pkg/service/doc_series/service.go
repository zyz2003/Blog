/*
 * @Description: 文档系列服务
 * @Author: 安知鱼
 * @Date: 2025-12-30 10:00:00
 * @LastEditTime: 2025-12-30 10:00:00
 * @LastEditors: 安知鱼
 */
package doc_series

import (
	"context"
	"fmt"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// Service 封装了文档系列的业务逻辑。
type Service struct {
	repo repository.DocSeriesRepository
}

// NewService 是 DocSeries Service 的构造函数。
func NewService(repo repository.DocSeriesRepository) *Service {
	return &Service{repo: repo}
}

// toAPIResponse 是一个私有的辅助函数，将领域模型转换为用于API响应的DTO。
func (s *Service) toAPIResponse(ds *model.DocSeries) *model.DocSeriesResponse {
	if ds == nil {
		return nil
	}
	return &model.DocSeriesResponse{
		ID:          ds.ID,
		CreatedAt:   ds.CreatedAt,
		UpdatedAt:   ds.UpdatedAt,
		Name:        ds.Name,
		Description: ds.Description,
		CoverURL:    ds.CoverURL,
		Sort:        ds.Sort,
		DocCount:    ds.DocCount,
	}
}

// Create 处理创建新文档系列的业务逻辑。
func (s *Service) Create(ctx context.Context, req *model.CreateDocSeriesRequest) (*model.DocSeriesResponse, error) {
	// 检查系列名称是否已存在
	exists, err := s.repo.ExistsByName(ctx, req.Name)
	if err != nil {
		return nil, fmt.Errorf("检查系列名称失败: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("系列名称 '%s' 已存在", req.Name)
	}

	newSeries, err := s.repo.Create(ctx, req)
	if err != nil {
		return nil, err
	}
	return s.toAPIResponse(newSeries), nil
}

// List 处理获取所有文档系列的业务逻辑。
func (s *Service) List(ctx context.Context, opts *model.ListDocSeriesOptions) (*model.DocSeriesListResponse, error) {
	series, total, err := s.repo.List(ctx, opts)
	if err != nil {
		return nil, err
	}

	responses := make([]model.DocSeriesResponse, len(series))
	for i, ds := range series {
		responses[i] = *s.toAPIResponse(ds)
	}

	page := 1
	pageSize := 20
	if opts != nil {
		if opts.Page > 0 {
			page = opts.Page
		}
		if opts.PageSize > 0 {
			pageSize = opts.PageSize
		}
	}

	return &model.DocSeriesListResponse{
		List:     responses,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

// GetByID 根据ID获取文档系列。
func (s *Service) GetByID(ctx context.Context, publicID string) (*model.DocSeriesResponse, error) {
	ds, err := s.repo.GetByID(ctx, publicID)
	if err != nil {
		return nil, err
	}
	return s.toAPIResponse(ds), nil
}

// GetByIDWithArticles 根据ID获取文档系列及其包含的文章。
func (s *Service) GetByIDWithArticles(ctx context.Context, publicID string) (*model.DocSeriesWithArticles, error) {
	return s.repo.GetByIDWithArticles(ctx, publicID)
}

// Update 处理更新文档系列的业务逻辑。
func (s *Service) Update(ctx context.Context, publicID string, req *model.UpdateDocSeriesRequest) (*model.DocSeriesResponse, error) {
	// 如果要更新名称，检查新名称是否已存在
	if req.Name != nil {
		exists, err := s.repo.ExistsByName(ctx, *req.Name)
		if err != nil {
			return nil, fmt.Errorf("检查系列名称失败: %w", err)
		}
		// 获取当前系列信息以比较名称
		current, err := s.repo.GetByID(ctx, publicID)
		if err != nil {
			return nil, err
		}
		if exists && current.Name != *req.Name {
			return nil, fmt.Errorf("系列名称 '%s' 已存在", *req.Name)
		}
	}

	updatedSeries, err := s.repo.Update(ctx, publicID, req)
	if err != nil {
		return nil, err
	}
	return s.toAPIResponse(updatedSeries), nil
}

// Delete 处理删除文档系列的业务逻辑。
func (s *Service) Delete(ctx context.Context, publicID string) error {
	// 检查系列下是否还有文档
	ds, err := s.repo.GetByID(ctx, publicID)
	if err != nil {
		return err
	}
	if ds.DocCount > 0 {
		return fmt.Errorf("无法删除，该系列下还有 %d 篇文档", ds.DocCount)
	}
	return s.repo.Delete(ctx, publicID)
}
