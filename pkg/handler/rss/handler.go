/*
 * @Description: RSS Feed 处理器
 * @Author: 安知鱼
 * @Date: 2025-09-30 00:00:00
 * @LastEditTime: 2025-11-08 18:48:25
 * @LastEditors: 安知鱼
 */
package rss

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/rss"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/gin-gonic/gin"
)

// Handler RSS 处理器
type Handler struct {
	rssService rss.Service
	settingSvc setting.SettingService
}

// NewHandler 创建 RSS 处理器
func NewHandler(rssService rss.Service, settingSvc setting.SettingService) *Handler {
	return &Handler{
		rssService: rssService,
		settingSvc: settingSvc,
	}
}

// GetRSSFeed 获取 RSS feed
// @Summary      获取RSS订阅源
// @Description  获取网站的RSS订阅源（XML格式）
// @Tags         辅助工具
// @Produce      xml
// @Success      200  {string}  string  "RSS XML内容"
// @Failure      500  {object}  response.Response  "生成RSS feed失败"
// @Router       /rss.xml [get]
func (h *Handler) GetRSSFeed(c *gin.Context) {
	ctx := c.Request.Context()

	// 获取站点 URL
	baseURL := h.getSiteURL(c)

	// 生成 RSS feed
	opts := &rss.RSSOptions{
		ItemCount: 20,
		BaseURL:   baseURL,
		BuildTime: time.Now(),
	}

	feed, err := h.rssService.GenerateFeed(ctx, opts)
	if err != nil {
		log.Printf("[RSS Handler] 生成 RSS feed 失败: %v", err)
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(http.StatusInternalServerError, "生成RSS feed失败")
		return
	}

	// 生成 XML
	xmlContent := h.rssService.GenerateXML(feed)

	// 按路径设置标准 Content-Type，便于阅读器识别
	contentType := "application/rss+xml; charset=utf-8"
	if c.Request.URL.Path == "/atom.xml" {
		contentType = "application/atom+xml; charset=utf-8"
	}
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=3600") // 缓存1小时
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Last-Modified", time.Now().Format(http.TimeFormat))

	c.String(http.StatusOK, xmlContent)
}

// getSiteURL 获取站点 URL
func (h *Handler) getSiteURL(c *gin.Context) string {
	// 优先从配置中获取站点 URL
	if siteURL := h.settingSvc.Get(constant.KeySiteURL.String()); siteURL != "" {
		// 移除末尾的斜杠
		return strings.TrimRight(siteURL, "/")
	}

	// 如果配置中没有，则从请求中获取
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	// 优先使用 X-Forwarded-Proto
	if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	}

	host := c.Request.Host
	return fmt.Sprintf("%s://%s", scheme, host)
}
