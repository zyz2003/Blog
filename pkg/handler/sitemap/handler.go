/*
 * @Description: 站点地图处理器
 * @Author: 安知鱼
 * @Date: 2025-09-21 00:00:00
 * @LastEditTime: 2025-09-21 00:00:00
 * @LastEditors: 安知鱼
 */
package sitemap

import (
	"encoding/xml"
	"net/http"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/service/sitemap"
	"github.com/gin-gonic/gin"
)

// Handler 站点地图处理器
type Handler struct {
	sitemapService sitemap.Service
}

// NewHandler 创建站点地图处理器
func NewHandler(sitemapService sitemap.Service) *Handler {
	return &Handler{
		sitemapService: sitemapService,
	}
}

// GetSitemap 获取站点地图
// @Summary      获取站点地图
// @Description  获取XML格式的站点地图
// @Tags         辅助工具
// @Produce      xml
// @Success      200  {string}  string  "XML格式的站点地图"
// @Failure      500  {string}  string  "生成失败"
// @Router       /sitemap.xml [get]
func (h *Handler) GetSitemap(c *gin.Context) {
	ctx := c.Request.Context()

	// 生成站点地图
	sitemapData, err := h.sitemapService.GenerateSitemap(ctx)
	if err != nil {
		c.String(http.StatusInternalServerError, "生成站点地图失败")
		return
	}

	// 设置缓存头，站点地图可以缓存较长时间
	c.Header("Content-Type", "text/xml; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=3600") // 1小时缓存
	c.Header("Last-Modified", time.Now().Format(http.TimeFormat))

	// 返回XML格式的站点地图
	xmlData, err := xml.MarshalIndent(sitemapData, "", "  ")
	if err != nil {
		c.String(http.StatusInternalServerError, "生成XML失败")
		return
	}

	// 添加XML声明
	xmlHeader := `<?xml version="1.0" encoding="UTF-8"?>` + "\n"
	c.String(http.StatusOK, xmlHeader+string(xmlData))
}

// GetRobots 获取robots.txt
// @Summary      获取robots.txt
// @Description  获取搜索引擎爬虫规则文件
// @Tags         辅助工具
// @Produce      plain
// @Success      200  {string}  string  "robots.txt内容"
// @Failure      500  {string}  string  "生成失败"
// @Router       /robots.txt [get]
func (h *Handler) GetRobots(c *gin.Context) {
	ctx := c.Request.Context()

	// 生成robots.txt内容
	robotsContent, err := h.sitemapService.GenerateRobots(ctx)
	if err != nil {
		c.String(http.StatusInternalServerError, "生成robots.txt失败")
		return
	}

	// 设置响应头
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=86400") // 24小时缓存

	c.String(http.StatusOK, robotsContent)
}
