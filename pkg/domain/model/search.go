/*
 * @Description: 搜索相关的数据模型
 * @Author: 安知鱼
 * @Date: 2025-01-27 10:00:00
 * @LastEditTime: 2025-01-27 10:00:00
 * @LastEditors: 安知鱼
 */
package model

import (
	"context"
	"time"
)

// Searcher 定义了搜索服务的统一行为
type Searcher interface {
	// Search 执行搜索并返回结果
	Search(ctx context.Context, query string, page int, size int) (*SearchResult, error)
	// IndexArticle 创建或更新一篇文章的索引
	IndexArticle(ctx context.Context, article *Article) error
	// DeleteArticle 删除一篇文章的索引
	DeleteArticle(ctx context.Context, articleID string) error
	// ClearAllDocuments 清除所有已索引的文档（用于重建索引前的清理）
	ClearAllDocuments(ctx context.Context) error
	// HealthCheck 健康检查
	HealthCheck(ctx context.Context) error
}

// SearchResult 定义了搜索结果的统一结构
type SearchResult struct {
	Pagination *SearchPagination `json:"pagination"`
	Hits       []*SearchHit      `json:"hits"`
}

// SearchPagination 定义了搜索分页信息
type SearchPagination struct {
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	Size       int   `json:"size"`
	TotalPages int   `json:"totalPages"`
}

const (
	SearchHitTypePost  = "post"
	SearchHitTypeDoc   = "doc"
	SearchHitTypeAlbum = "album"
	SearchHitTypeEssay = "essay"
)

// SearchHit 定义了搜索结果中的单个文章信息
type SearchHit struct {
	ID          string    `json:"id"`
	Type        string    `json:"type,omitempty"`
	URL         string    `json:"url,omitempty"`
	Title       string    `json:"title"`
	Snippet     string    `json:"snippet"`
	Author      string    `json:"author"`
	Category    string    `json:"category"`
	Tags        []string  `json:"tags"`
	PublishDate time.Time `json:"publish_date"`
	CoverURL    string    `json:"cover_url"`
	Abbrlink    string    `json:"abbrlink"`
	ViewCount   int       `json:"view_count"`
	WordCount   int       `json:"word_count"`
	ReadingTime int       `json:"reading_time"`
	// 文档模式相关字段
	IsDoc       bool   `json:"is_doc,omitempty"`
	DocSeriesID string `json:"doc_series_id,omitempty"`
}

// SearchRequest 定义了搜索请求的参数
type SearchRequest struct {
	Query string `json:"q" binding:"required"`
	Page  int    `json:"page"`
	Size  int    `json:"size"`
}

// SearchResponse 定义了搜索API的响应结构
type SearchResponse struct {
	Code    int           `json:"code"`
	Message string        `json:"message"`
	Data    *SearchResult `json:"data"`
}

// IndexedArticle 定义了用于索引的文章数据结构
type IndexedArticle struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	Author      string    `json:"author"`
	Category    string    `json:"category"`
	Tags        []string  `json:"tags"`
	PublishDate time.Time `json:"publish_date"`
	CoverURL    string    `json:"cover_url"`
	Abbrlink    string    `json:"abbrlink"`
	ViewCount   int       `json:"view_count"`
	WordCount   int       `json:"word_count"`
	ReadingTime int       `json:"reading_time"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
