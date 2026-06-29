/*
 * @Description: 搜索服务 - 搜索架构实现
 * @Author: 安知鱼
 * @Date: 2025-01-27 10:00:00
 * @LastEditTime: 2026-04-09
 * @LastEditors: 安知鱼
 */
package search

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// AppSearcher 全局搜索器实例（可由插件管理器在启动时替换）
var AppSearcher model.Searcher

// SearchService 搜索服务
// 始终读取全局 AppSearcher 以支持插件热更新，不缓存本地引用
type SearchService struct {
	providers []SearchProvider
}

// SearchProvider 提供文章索引之外的公开内容搜索结果。
type SearchProvider interface {
	Search(ctx context.Context, query string, limit int) ([]*model.SearchHit, int64, error)
}

// NewSearchService 创建搜索服务实例
func NewSearchService() *SearchService {
	return &SearchService{}
}

// RegisterProvider 注册额外搜索内容提供者。
func (s *SearchService) RegisterProvider(provider SearchProvider) {
	if provider == nil {
		return
	}
	s.providers = append(s.providers, provider)
}

// Search 执行搜索
func (s *SearchService) Search(ctx context.Context, query string, page int, size int) (*model.SearchResult, error) {
	searcher := AppSearcher
	if searcher == nil {
		return nil, fmt.Errorf("搜索引擎未初始化")
	}
	result, err := searcher.Search(ctx, query, page, size)
	if err != nil {
		return nil, err
	}
	if result == nil {
		result = &model.SearchResult{}
	}
	if result.Pagination == nil {
		result.Pagination = &model.SearchPagination{Page: page, Size: size}
	}

	normalizeSearchHits(result.Hits)

	if strings.TrimSpace(query) == "" || len(s.providers) == 0 {
		return result, nil
	}

	totalExtra := int64(0)
	for _, provider := range s.providers {
		hits, total, err := provider.Search(ctx, query, size)
		if err != nil {
			return nil, fmt.Errorf("扩展搜索失败: %w", err)
		}
		normalizeSearchHits(hits)
		result.Hits = append(result.Hits, hits...)
		totalExtra += total
	}

	result.Pagination.Total += totalExtra
	result.Pagination.TotalPages = calculateTotalPages(result.Pagination.Total, result.Pagination.Size)
	return result, nil
}

func normalizeSearchHits(hits []*model.SearchHit) {
	for _, hit := range hits {
		if hit == nil || hit.Type != "" {
			continue
		}
		if hit.IsDoc {
			hit.Type = model.SearchHitTypeDoc
			if hit.URL == "" && hit.ID != "" {
				hit.URL = "/doc/" + hit.ID
			}
			continue
		}
		hit.Type = model.SearchHitTypePost
		if hit.URL == "" {
			targetID := hit.Abbrlink
			if targetID == "" {
				targetID = hit.ID
			}
			if targetID != "" {
				hit.URL = "/posts/" + targetID
			}
		}
	}
}

func calculateTotalPages(total int64, size int) int {
	if total <= 0 || size <= 0 {
		return 0
	}
	return int((total + int64(size) - 1) / int64(size))
}

// IndexArticle 索引文章
func (s *SearchService) IndexArticle(ctx context.Context, article *model.Article) error {
	searcher := AppSearcher
	if searcher == nil {
		log.Println("[警告] 搜索引擎未初始化，跳过索引操作")
		return nil
	}
	return searcher.IndexArticle(ctx, article)
}

// DeleteArticle 删除文章索引
func (s *SearchService) DeleteArticle(ctx context.Context, articleID string) error {
	searcher := AppSearcher
	if searcher == nil {
		log.Println("[警告] 搜索引擎未初始化，跳过删除索引操作")
		return nil
	}
	return searcher.DeleteArticle(ctx, articleID)
}

// RebuildAllIndexes 重建所有文章的搜索索引
func (s *SearchService) RebuildAllIndexes(ctx context.Context) error {
	searcher := AppSearcher
	if searcher == nil {
		log.Println("[警告] 搜索引擎未初始化，跳过重建索引操作")
		return fmt.Errorf("搜索引擎未初始化")
	}

	log.Println("开始重建搜索索引...")
	if err := searcher.ClearAllDocuments(ctx); err != nil {
		return fmt.Errorf("清理现有索引失败: %w", err)
	}

	log.Println("搜索索引清理完成，等待文章数据重建...")
	return nil
}

// InitializeSearchEngine 初始化搜索引擎（内置引擎降级链）
// 如果插件已提供搜索引擎（AppSearcher 已被设置），此函数不会覆盖
// 优先级: 插件搜索引擎 > Redis > Simple（内存）
func InitializeSearchEngine(settingSvc setting.SettingService) error {
	if AppSearcher != nil {
		log.Println("✅ 搜索引擎已由外部设置（可能来自插件），跳过内置引擎初始化")
		return nil
	}

	// 尝试使用 Redis 搜索模式
	redisSearcher, err := NewRedisSearcher(settingSvc)
	if err != nil {
		return fmt.Errorf("Redis 搜索初始化失败: %w", err)
	}

	if redisSearcher != nil {
		AppSearcher = redisSearcher
		log.Println("✅ Redis 搜索模式已启用")
		return nil
	}

	// 降级到简单搜索模式
	simpleSearcher := NewSimpleSearcher(settingSvc)
	AppSearcher = simpleSearcher
	log.Println("✅ 简单搜索模式已启用（降级方案）")
	return nil
}
