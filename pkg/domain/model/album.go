/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-20 13:01:45
 * @LastEditTime: 2025-07-16 10:58:31
 * @LastEditors: 安知鱼
 */
package model

import "time"

// Album 是核心业务模型
type Album struct {
	ID            uint       `json:"id"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	ImageUrl      string     `json:"imageUrl"`
	BigImageUrl   string     `json:"bigImageUrl"`
	DownloadUrl   string     `json:"downloadUrl"`
	ThumbParam    string     `json:"thumbParam"`
	BigParam      string     `json:"bigParam"`
	Tags          string     `json:"tags"`
	ViewCount     int        `json:"viewCount"`
	DownloadCount int        `json:"downloadCount"`
	Width         int        `json:"width"`
	Height        int        `json:"height"`
	FileSize      int64      `json:"fileSize"`
	Format        string     `json:"format"`
	AspectRatio   string     `json:"aspectRatio"`
	FileHash      string     `json:"fileHash"`
	DisplayOrder  int        `json:"displayOrder"`
	CategoryID    *uint      `json:"categoryId"`
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	Location      string     `json:"location"`
	PublishedAt   *time.Time `json:"published_at"`
}

// AlbumCategoryDTO 是相册分类的数据传输对象
type AlbumCategoryDTO struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description,omitempty"`
	DisplayOrder int    `json:"displayOrder"`
}

// CreateAlbumCategoryRequest 是创建相册分类的请求结构
type CreateAlbumCategoryRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	DisplayOrder int    `json:"displayOrder"`
}

// UpdateAlbumCategoryRequest 是更新相册分类的请求结构
type UpdateAlbumCategoryRequest struct {
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	DisplayOrder int    `json:"displayOrder"`
}
