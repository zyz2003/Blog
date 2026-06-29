/*
 * @Description: RSS Feed 类型定义
 * @Author: 安知鱼
 * @Date: 2025-09-30 00:00:00
 * @LastEditTime: 2025-09-30 00:00:00
 * @LastEditors: 安知鱼
 */
package rss

import "time"

// RSSItem RSS 条目结构
type RSSItem struct {
	Title       string
	Link        string
	Description string
	PubDate     string
	GUID        string
	Author      string
	Categories  []string
}

// RSSFeed RSS Feed 结构
type RSSFeed struct {
	Title         string
	Link          string
	Description   string
	Language      string
	PubDate       string
	LastBuildDate string
	Items         []RSSItem
}

// RSSOptions RSS 生成选项
type RSSOptions struct {
	// ItemCount 返回的文章数量
	ItemCount int
	// BaseURL 站点基础 URL
	BaseURL string
	// BuildTime Feed 构建时间
	BuildTime time.Time
}
