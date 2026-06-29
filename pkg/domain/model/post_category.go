/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-25 11:43:47
 * @LastEditTime: 2025-08-28 13:22:38
 * @LastEditors: 安知鱼
 */
package model

import "time"

// --- 核心领域对象 (Domain Object) ---

// PostCategory 是文章分类的核心领域模型。
type PostCategory struct {
	ID          string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Name        string
	Slug        string
	Description string
	Count       int
	IsSeries    bool
	SortOrder   int
}

// --- API 数据传输对象 (Data Transfer Objects) ---

// CreatePostCategoryRequest 定义了创建文章分类的请求体
type CreatePostCategoryRequest struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	IsSeries    bool   `json:"is_series"`
	SortOrder   int    `json:"sort_order"`
}

// UpdatePostCategoryRequest 定义了更新文章分类的请求体
type UpdatePostCategoryRequest struct {
	Name        *string `json:"name"`
	Slug        *string `json:"slug"`
	Description *string `json:"description"`
	IsSeries    *bool   `json:"is_series"`
	SortOrder   *int    `json:"sort_order"`
}

// PostCategoryResponse 定义了文章分类的标准 API 响应结构
type PostCategoryResponse struct {
	ID          string    `json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	Count       int       `json:"count"`
	IsSeries    bool      `json:"is_series"`
	SortOrder   int       `json:"sort_order"`
}
