/*
 * @Description: RSS Feed 服务
 * @Author: 安知鱼
 * @Date: 2025-09-30 00:00:00
 * @LastEditTime: 2025-09-30 00:00:00
 * @LastEditors: 安知鱼
 */
package rss

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/parser"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/strutil"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	article_service "github.com/anzhiyu-c/anheyu-app/pkg/service/article"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

// Service RSS 服务接口
type Service interface {
	// GenerateFeed 生成 RSS feed
	GenerateFeed(ctx context.Context, opts *RSSOptions) (*RSSFeed, error)
	// GenerateXML 生成 RSS XML 字符串
	GenerateXML(feed *RSSFeed) string
	// InvalidateCache 清除 RSS 缓存
	InvalidateCache(ctx context.Context) error
}

// service RSS 服务实现
type service struct {
	articleSvc article_service.Service
	settingSvc setting.SettingService
	cacheSvc   utility.CacheService
}

// NewService 创建 RSS 服务
func NewService(
	articleSvc article_service.Service,
	settingSvc setting.SettingService,
	cacheSvc utility.CacheService,
) Service {
	return &service{
		articleSvc: articleSvc,
		settingSvc: settingSvc,
		cacheSvc:   cacheSvc,
	}
}

// rssCacheKey RSS feed 缓存键
const rssCacheKey = "rss:feed:latest"

// rssCacheTTL RSS feed 缓存过期时间（1小时）
const rssCacheTTL = 3600

// GenerateFeed 生成 RSS feed（支持缓存）
func (s *service) GenerateFeed(ctx context.Context, opts *RSSOptions) (*RSSFeed, error) {
	// 尝试从缓存获取
	if cachedData, err := s.cacheSvc.Get(ctx, rssCacheKey); err == nil && cachedData != "" {
		var feed RSSFeed
		if err := json.Unmarshal([]byte(cachedData), &feed); err == nil {
			return &feed, nil
		}
	}

	// 获取站点配置
	siteTitle := s.settingSvc.Get(constant.KeyAppName.String())
	siteDescription := s.settingSvc.Get(constant.KeySiteDescription.String())

	// 设置默认值
	if opts.ItemCount <= 0 {
		opts.ItemCount = 20
	}
	if opts.BuildTime.IsZero() {
		opts.BuildTime = time.Now()
	}

	// 获取最新的公开文章
	options := &model.ListPublicArticlesOptions{
		Page:     1,
		PageSize: opts.ItemCount,
	}

	articlesResp, err := s.articleSvc.ListPublic(ctx, options)
	if err != nil {
		return nil, fmt.Errorf("获取文章列表失败: %w", err)
	}

	// 构建 RSS feed
	feed := &RSSFeed{
		Title:         siteTitle,
		Link:          opts.BaseURL,
		Description:   siteDescription,
		Language:      "zh-CN",
		PubDate:       opts.BuildTime.Format(time.RFC1123Z),
		LastBuildDate: opts.BuildTime.Format(time.RFC1123Z),
		Items:         make([]RSSItem, 0, len(articlesResp.List)),
	}

	// 添加文章到 feed
	for _, article := range articlesResp.List {
		item := s.buildRSSItem(&article, opts.BaseURL)
		feed.Items = append(feed.Items, item)
	}

	// 缓存生成的 feed
	if feedData, err := json.Marshal(feed); err == nil {
		_ = s.cacheSvc.Set(ctx, rssCacheKey, string(feedData), rssCacheTTL*time.Second)
	}

	return feed, nil
}

// InvalidateCache 清除 RSS 缓存
func (s *service) InvalidateCache(ctx context.Context) error {
	return s.cacheSvc.Delete(ctx, rssCacheKey)
}

// buildRSSItem 构建单个 RSS 条目
func (s *service) buildRSSItem(article *model.ArticleResponse, baseURL string) RSSItem {
	// 构建文章链接
	articleLink := fmt.Sprintf("%s/posts/%s", baseURL, article.ID)

	// 生成描述（使用摘要或从内容提取）
	description := s.getArticleDescription(article)

	// 获取分类和标签
	categories := make([]string, 0)
	for _, cat := range article.PostCategories {
		categories = append(categories, cat.Name)
	}
	for _, tag := range article.PostTags {
		categories = append(categories, tag.Name)
	}

	return RSSItem{
		Title:       article.Title,
		Link:        articleLink,
		Description: description,
		PubDate:     article.CreatedAt.Format(time.RFC1123Z),
		GUID:        articleLink,
		Author:      article.CopyrightAuthor,
		Categories:  categories,
	}
}

// getArticleDescription 获取文章描述
func (s *service) getArticleDescription(article *model.ArticleResponse) string {
	// 优先使用第一条摘要
	if len(article.Summaries) > 0 && article.Summaries[0] != "" {
		return article.Summaries[0]
	}

	// 如果有 HTML 内容，从中提取纯文本
	if article.ContentHTML != "" {
		plainText := parser.StripHTML(article.ContentHTML)
		plainText = strings.Join(strings.Fields(plainText), " ")
		return strutil.Truncate(plainText, 200)
	}

	// 如果有 Markdown 内容，提取前200字
	if article.ContentMd != "" {
		plainText := strings.Join(strings.Fields(article.ContentMd), " ")
		return strutil.Truncate(plainText, 200)
	}

	return ""
}

// GenerateXML 生成 RSS XML 字符串
func (s *service) GenerateXML(feed *RSSFeed) string {
	var sb strings.Builder

	// XML 声明
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	sb.WriteString("\n")

	// RSS 根元素
	sb.WriteString(`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">`)
	sb.WriteString("\n")

	// Channel 元素
	sb.WriteString("  <channel>\n")
	sb.WriteString(fmt.Sprintf("    <title>%s</title>\n", xmlEscape(feed.Title)))
	sb.WriteString(fmt.Sprintf("    <link>%s</link>\n", xmlEscape(feed.Link)))
	sb.WriteString(fmt.Sprintf("    <description>%s</description>\n", xmlEscape(feed.Description)))
	sb.WriteString(fmt.Sprintf("    <language>%s</language>\n", feed.Language))
	sb.WriteString(fmt.Sprintf("    <lastBuildDate>%s</lastBuildDate>\n", feed.LastBuildDate))
	sb.WriteString(fmt.Sprintf("    <atom:link href=\"%s/rss.xml\" rel=\"self\" type=\"application/rss+xml\"/>\n", xmlEscape(feed.Link)))

	// 添加条目
	for _, item := range feed.Items {
		sb.WriteString("    <item>\n")
		sb.WriteString(fmt.Sprintf("      <title>%s</title>\n", xmlEscape(item.Title)))
		sb.WriteString(fmt.Sprintf("      <link>%s</link>\n", xmlEscape(item.Link)))
		sb.WriteString(fmt.Sprintf("      <guid isPermaLink=\"true\">%s</guid>\n", xmlEscape(item.GUID)))
		sb.WriteString(fmt.Sprintf("      <pubDate>%s</pubDate>\n", item.PubDate))

		if item.Description != "" {
			sb.WriteString(fmt.Sprintf("      <description>%s</description>\n", xmlEscape(item.Description)))
		}

		if item.Author != "" {
			sb.WriteString(fmt.Sprintf("      <author>%s</author>\n", xmlEscape(item.Author)))
		}

		// 添加分类和标签
		for _, category := range item.Categories {
			sb.WriteString(fmt.Sprintf("      <category>%s</category>\n", xmlEscape(category)))
		}

		sb.WriteString("    </item>\n")
	}

	sb.WriteString("  </channel>\n")
	sb.WriteString("</rss>")

	return sb.String()
}

// xmlEscape 转义 XML 特殊字符
func xmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}
