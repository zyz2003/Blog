/*
 * @Description: 访问统计中间件
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-09-20 16:52:02
 * @LastEditors: 安知鱼
 */
package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/statistics"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/anzhiyu-c/anheyu-app/pkg/util"

	"github.com/gin-gonic/gin"
)

// StatisticsMiddleware 访问统计中间件
type StatisticsMiddleware struct {
	statService statistics.VisitorStatService
	cacheSvc    utility.CacheService
}

// NewStatisticsMiddleware 创建统计中间件实例（支持自动降级）
func NewStatisticsMiddleware(statService statistics.VisitorStatService, cacheSvc utility.CacheService) *StatisticsMiddleware {
	return &StatisticsMiddleware{
		statService: statService,
		cacheSvc:    cacheSvc,
	}
}

// StatisticsHandler 统计中间件处理函数
func (m *StatisticsMiddleware) StatisticsHandler() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		// 记录请求开始时间
		startTime := time.Now()

		// 处理请求
		c.Next()

		// 异步记录访问统计
		go func() {
			m.recordVisitAsync(c, startTime)
		}()
	})
}

// recordVisitAsync 异步记录访问统计
func (m *StatisticsMiddleware) recordVisitAsync(c *gin.Context, startTime time.Time) {
	// 跳过不需要统计的请求
	if m.shouldSkipPath(c.FullPath()) {
		return
	}

	// 计算页面停留时间（这里用请求处理时间作为估算）
	duration := int(time.Since(startTime).Seconds())

	// 获取页面标题（从响应头或其他方式获取）
	pageTitle := m.getPageTitle(c)

	// 构建访问日志请求
	req := &model.VisitorLogRequest{
		URLPath:   c.Request.URL.Path,
		PageTitle: pageTitle,
		Referer:   c.GetHeader("Referer"),
		Duration:  duration,
	}

	// 创建超时上下文
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 记录访问（如果失败，可以考虑缓存到Redis稍后重试）
	if err := m.statService.RecordVisit(ctx, c, req); err != nil {
		// 记录失败，尝试缓存到Redis
		m.cacheFailedRecord(ctx, req, c)
	}
}

// shouldSkipPath 判断是否应该跳过统计的路径
func (m *StatisticsMiddleware) shouldSkipPath(path string) bool {
	skipPaths := []string{
		"/api/",
		"/static/",
		"/assets/",
		"/favicon.ico",
		"/robots.txt",
		"/sitemap.xml",
		"/.well-known/",
		"/health",
		"/ping",
	}

	for _, skipPath := range skipPaths {
		if strings.HasPrefix(path, skipPath) {
			return true
		}
	}

	return false
}

// getPageTitle 获取页面标题
func (m *StatisticsMiddleware) getPageTitle(c *gin.Context) string {
	// 可以从响应头获取，或者根据路径推断
	if title := c.GetHeader("X-Page-Title"); title != "" {
		return title
	}

	// 根据路径推断标题
	path := c.Request.URL.Path
	switch {
	case path == "/" || path == "/index":
		return "首页"
	case strings.HasPrefix(path, "/post/"):
		return "文章详情"
	case strings.HasPrefix(path, "/album/"):
		return "相册"
	case strings.HasPrefix(path, "/link/"):
		return "友链"
	case strings.HasPrefix(path, "/about"):
		return "关于"
	default:
		return "页面"
	}
}

// cacheFailedRecord 缓存失败的记录（使用缓存服务，支持自动降级）
func (m *StatisticsMiddleware) cacheFailedRecord(ctx context.Context, req *model.VisitorLogRequest, c *gin.Context) {
	if m.cacheSvc == nil {
		return
	}

	// 构建完整的访问信息
	visitInfo := map[string]interface{}{
		"url_path":   req.URLPath,
		"page_title": req.PageTitle,
		"referer":    req.Referer,
		"duration":   req.Duration,
		"ip":         util.GetRealClientIP(c),
		"user_agent": c.GetHeader("User-Agent"),
		"timestamp":  time.Now().Unix(),
	}

	// 序列化为JSON
	data, err := json.Marshal(visitInfo)
	if err != nil {
		return
	}

	// 推送到缓存列表，用于后续批量处理
	if err := m.cacheSvc.RPush(ctx, "failed_visits", string(data)); err != nil {
		return
	}

	// 设置列表过期时间（7天）
	m.cacheSvc.Expire(ctx, "failed_visits", 7*24*time.Hour)
}

// ProcessFailedRecords 处理失败的记录（可以作为定时任务调用，支持自动降级）
func (m *StatisticsMiddleware) ProcessFailedRecords(ctx context.Context) error {
	if m.cacheSvc == nil {
		return nil
	}

	// 批量获取失败的记录
	records, err := m.cacheSvc.LRange(ctx, "failed_visits", 0, 99)
	if err != nil {
		return err
	}

	if len(records) == 0 {
		return nil
	}

	// 处理每条记录
	for _, record := range records {
		var visitInfo map[string]interface{}
		if err := json.Unmarshal([]byte(record), &visitInfo); err != nil {
			continue
		}

		// 重新构建请求
		req := &model.VisitorLogRequest{
			URLPath:   visitInfo["url_path"].(string),
			PageTitle: visitInfo["page_title"].(string),
			Referer:   visitInfo["referer"].(string),
			Duration:  int(visitInfo["duration"].(float64)),
		}

		// 创建虚拟的gin.Context（简化处理）
		// 实际使用中可能需要更完整的上下文信息
		c := &gin.Context{}
		c.Request = &http.Request{
			Header: make(http.Header),
		}
		c.Request.Header.Set("User-Agent", visitInfo["user_agent"].(string))

		// 尝试重新记录
		if err := m.statService.RecordVisit(ctx, c, req); err == nil {
			// 成功处理，从缓存中移除（这里简化处理，实际可能需要更复杂的删除逻辑）
			// 注意：内存缓存的 List 实现不支持 LRem，这里需要改进
		}
	}

	return nil
}
