package model

import (
	"time"
)

// Page 自定义页面模型
type Page struct {
	ID              uint      `json:"id"`
	Title           string    `json:"title"`            // 页面标题
	Path            string    `json:"path"`             // 页面路径，如 /privacy
	Content         string    `json:"content"`          // HTML内容
	MarkdownContent string    `json:"markdown_content"` // Markdown原始内容
	CustomJS        string    `json:"custom_js"`        // 页面自定义JavaScript
	CustomCSS       string    `json:"custom_css"`       // 页面自定义CSS
	Description     string    `json:"description"`      // 页面描述
	IsPublished     bool      `json:"is_published"`     // 是否发布
	ShowComment     bool      `json:"show_comment"`     // 是否显示评论
	Sort            int       `json:"sort"`             // 排序
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CreatePageOptions 创建页面选项
type CreatePageOptions struct {
	Title           string `json:"title"`
	Path            string `json:"path"`
	Content         string `json:"content"`
	MarkdownContent string `json:"markdown_content"`
	CustomJS        string `json:"custom_js"`
	CustomCSS       string `json:"custom_css"`
	Description     string `json:"description"`
	IsPublished     bool   `json:"is_published"`
	ShowComment     bool   `json:"show_comment"`
	Sort            int    `json:"sort"`
}

// UpdatePageOptions 更新页面选项
type UpdatePageOptions struct {
	Title           *string `json:"title,omitempty"`
	Path            *string `json:"path,omitempty"`
	Content         *string `json:"content,omitempty"`
	MarkdownContent *string `json:"markdown_content,omitempty"`
	CustomJS        *string `json:"custom_js,omitempty"`
	CustomCSS       *string `json:"custom_css,omitempty"`
	Description     *string `json:"description,omitempty"`
	IsPublished     *bool   `json:"is_published,omitempty"`
	ShowComment     *bool   `json:"show_comment,omitempty"`
	Sort            *int    `json:"sort,omitempty"`
}

// ListPagesOptions 列出页面选项
type ListPagesOptions struct {
	Page        int    `json:"page"`
	PageSize    int    `json:"page_size"`
	Search      string `json:"search,omitempty"`
	IsPublished *bool  `json:"is_published,omitempty"`
}
