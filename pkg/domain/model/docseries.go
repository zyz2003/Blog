/*
 * @Description: 文档系列领域模型
 * @Author: 安知鱼
 * @Date: 2025-12-30 10:00:00
 * @LastEditTime: 2025-12-30 10:00:00
 * @LastEditors: 安知鱼
 */
package model

import "time"

// --- 核心领域对象 (Domain Object) ---

// DocSeries 是文档系列的核心领域模型
type DocSeries struct {
	ID          string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Name        string
	Description string
	CoverURL    string
	Sort        int
	DocCount    int
}

// --- API 数据传输对象 (Data Transfer Objects) ---

// CreateDocSeriesRequest 定义了创建文档系列的请求体
type CreateDocSeriesRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	CoverURL    string `json:"cover_url"`
	Sort        int    `json:"sort"`
}

// UpdateDocSeriesRequest 定义了更新文档系列的请求体
type UpdateDocSeriesRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	CoverURL    *string `json:"cover_url"`
	Sort        *int    `json:"sort"`
}

// DocSeriesResponse 定义了文档系列的 API 响应结构
type DocSeriesResponse struct {
	ID          string    `json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CoverURL    string    `json:"cover_url"`
	Sort        int       `json:"sort"`
	DocCount    int       `json:"doc_count"`
}

// DocSeriesListResponse 定义了文档系列列表的 API 响应结构
type DocSeriesListResponse struct {
	List     []DocSeriesResponse `json:"list"`
	Total    int64               `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"pageSize"`
}

// DocSeriesWithArticles 用于文档详情页，包含系列信息和该系列下的所有文档
type DocSeriesWithArticles struct {
	DocSeriesResponse
	Articles []DocArticleItem `json:"articles"`
}

// DocArticleItem 用于文档系列中的文章列表项
type DocArticleItem struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Abbrlink  string    `json:"abbrlink"`
	DocSort   int       `json:"doc_sort"`
	CreatedAt time.Time `json:"created_at"`
}

// ListDocSeriesOptions 定义了获取文档系列列表的选项
type ListDocSeriesOptions struct {
	Page     int
	PageSize int
}
