/*
 * @Description: 访问统计API处理器
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-08-26 20:02:33
 * @LastEditors: 安知鱼
 */
package statistics

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/statistics"

	"github.com/gin-gonic/gin"
)

// StatisticsHandler 统计API处理器
type StatisticsHandler struct {
	statService statistics.VisitorStatService
}

// NewStatisticsHandler 创建统计处理器实例
func NewStatisticsHandler(statService statistics.VisitorStatService) *StatisticsHandler {
	return &StatisticsHandler{
		statService: statService,
	}
}

// GetBasicStatistics 获取基础统计数据（前台接口）
// @Summary      获取基础统计数据
// @Description  获取今日、昨日、月、年访问统计数据
// @Tags         访问统计
// @Produce      json
// @Success      200  {object}  response.Response{data=model.VisitorStatistics}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/statistics/basic [get]
func (h *StatisticsHandler) GetBasicStatistics(c *gin.Context) {
	stats, err := h.statService.GetBasicStatistics(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取统计数据失败")
		return
	}

	response.Success(c, stats, "获取统计数据成功")
}

// RecordVisit 记录访问（前台接口）
// @Summary      记录访问
// @Description  记录用户访问行为（异步处理，快速响应）
// @Tags         访问统计
// @Accept       json
// @Produce      json
// @Param        request  body  model.VisitorLogRequest  true  "访问记录请求"
// @Success      200  {object}  response.Response  "记录成功"
// @Failure      400  {object}  response.Response  "请求参数错误"
// @Failure      500  {object}  response.Response  "记录失败"
// @Router       /public/statistics/visit [post]
func (h *StatisticsHandler) RecordVisit(c *gin.Context) {
	var req model.VisitorLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	// 调用优化后的服务方法（异步处理，立即返回）
	if err := h.statService.RecordVisit(c.Request.Context(), c, &req); err != nil {
		log.Printf("[statistics] RecordVisit service error: %v", err)
		response.Fail(c, http.StatusInternalServerError, "记录访问失败")
		return
	}

	// 快速响应（数据持久化在后台异步处理）
	response.Success(c, nil, "记录访问成功")
}

// GetVisitorAnalytics 获取访客分析数据（后台接口）
// @Summary      获取访客分析数据
// @Description  获取指定时间范围内的访客分析数据（默认最近7天）
// @Tags         统计管理
// @Security     BearerAuth
// @Produce      json
// @Param        start_date  query  string  false  "开始日期 (YYYY-MM-DD)"
// @Param        end_date    query  string  false  "结束日期 (YYYY-MM-DD)"
// @Success      200  {object}  response.Response{data=model.VisitorAnalytics}  "获取成功"
// @Failure      400  {object}  response.Response  "日期格式错误"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /statistics/analytics [get]
func (h *StatisticsHandler) GetVisitorAnalytics(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	// 默认查询最近 7 个自然日（含今天），按中国时区闭区间
	nowCN := utils.NowInChina()
	endDate := utils.EndOfDayInChina(nowCN)
	startDate := utils.StartOfDayInChina(nowCN.AddDate(0, 0, -6))

	var err error
	if startDateStr != "" {
		startDate, err = utils.ParseInChina("2006-01-02", startDateStr)
		if err != nil {
			response.Fail(c, http.StatusBadRequest, "开始日期格式错误")
			return
		}
		startDate = utils.StartOfDayInChina(startDate)
	}

	if endDateStr != "" {
		var endDay time.Time
		endDay, err = utils.ParseInChina("2006-01-02", endDateStr)
		if err != nil {
			response.Fail(c, http.StatusBadRequest, "结束日期格式错误")
			return
		}
		endDate = utils.EndOfDayInChina(endDay)
	}

	analytics, err := h.statService.GetVisitorAnalytics(c.Request.Context(), startDate, endDate)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取访客分析数据失败")
		return
	}

	response.Success(c, analytics, "获取访客分析数据成功")
}

// GetTopPages 获取热门页面（后台接口）
// @Summary      获取热门页面
// @Description  获取访问量最高的页面列表（最多100个）
// @Tags         统计管理
// @Security     BearerAuth
// @Produce      json
// @Param        limit  query  int  false  "返回数量限制"  default(10)
// @Success      200  {object}  response.Response{data=[]model.URLStatistics}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /statistics/top-pages [get]
func (h *StatisticsHandler) GetTopPages(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 10
	}

	if limit > 100 {
		limit = 100 // 限制最大返回数量
	}

	pages, err := h.statService.GetTopPages(c.Request.Context(), limit)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取热门页面失败")
		return
	}

	response.Success(c, pages, "获取热门页面成功")
}

// GetVisitorTrend 获取访客趋势数据（后台接口）
// @Summary      获取访客趋势数据
// @Description  获取指定时间段的访客趋势数据（最多365天）
// @Tags         统计管理
// @Security     BearerAuth
// @Produce      json
// @Param        period  query  string  false  "时间周期 (daily/weekly/monthly)"  default(daily)
// @Param        days    query  int     false  "查询天数"  default(30)
// @Success      200  {object}  response.Response{data=model.VisitorTrendData}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /statistics/trend [get]
func (h *StatisticsHandler) GetVisitorTrend(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")
	daysStr := c.DefaultQuery("days", "30")

	days, err := strconv.Atoi(daysStr)
	if err != nil || days <= 0 {
		days = 30
	}

	if days > 365 {
		days = 365 // 限制最大查询天数
	}

	trendData, err := h.statService.GetVisitorTrend(c.Request.Context(), period, days)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取访客趋势数据失败")
		return
	}

	response.Success(c, trendData, "获取访客趋势数据成功")
}

// GetStatisticsSummary 获取统计概览（后台接口）
// @Summary      获取统计概览
// @Description  获取完整的统计概览数据，包括基础统计、热门页面、访客分析、趋势数据等
// @Tags         统计管理
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Response{data=StatisticsSummary}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /statistics/summary [get]
func (h *StatisticsHandler) GetStatisticsSummary(c *gin.Context) {
	ctx := c.Request.Context()

	// 获取基础统计
	basicStats, err := h.statService.GetBasicStatistics(ctx)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取基础统计数据失败")
		return
	}

	// 获取热门页面
	topPages, err := h.statService.GetTopPages(ctx, 10)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取热门页面失败")
		return
	}

	// 最近 7 个自然日（含今天），中国时区，与概览「访问来源」一致
	nowCN := utils.NowInChina()
	endDate := utils.EndOfDayInChina(nowCN)
	startDate := utils.StartOfDayInChina(nowCN.AddDate(0, 0, -6))
	analytics, err := h.statService.GetVisitorAnalytics(ctx, startDate, endDate)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取访客分析数据失败")
		return
	}

	// 获取最近30天的趋势数据
	trendData, err := h.statService.GetVisitorTrend(ctx, "daily", 30)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取趋势数据失败")
		return
	}

	summary := StatisticsSummary{
		BasicStats: basicStats,
		TopPages:   topPages,
		Analytics:  analytics,
		TrendData:  trendData,
	}

	response.Success(c, summary, "获取统计概览成功")
}

// GetVisitorLogs 获取访客访问日志（后台接口）
// @Summary      获取访客访问日志
// @Description  获取指定时间范围内的访客访问日志，支持分页（默认最近7天，每页最多200条）
// @Tags         统计管理
// @Security     BearerAuth
// @Produce      json
// @Param        start_date  query  string  false  "开始日期 (YYYY-MM-DD)"
// @Param        end_date    query  string  false  "结束日期 (YYYY-MM-DD)"
// @Param        page        query  int     false  "页码，从1开始"  default(1)
// @Param        page_size   query  int     false  "每页数量"  default(20)
// @Success      200  {object}  response.Response{data=object{list=[]object{user_agent=string,ip_address=string,city=string,url_path=string,duration=int,created_at=string},total=int,page=int,page_size=int}}  "获取成功"
// @Failure      400  {object}  response.Response  "日期格式错误"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /statistics/visitor-logs [get]
func (h *StatisticsHandler) GetVisitorLogs(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page <= 0 {
		page = 1
	}
	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}

	// 默认查询最近7天
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -7)

	if startDateStr != "" {
		if t, err := time.Parse("2006-01-02", startDateStr); err == nil {
			startDate = t
		} else {
			response.Fail(c, http.StatusBadRequest, "开始日期格式错误")
			return
		}
	}
	if endDateStr != "" {
		if t, err := time.Parse("2006-01-02", endDateStr); err == nil {
			endDate = t
		} else {
			response.Fail(c, http.StatusBadRequest, "结束日期格式错误")
			return
		}
	}

	logs, err := h.statService.GetVisitorLogs(c.Request.Context(), startDate, endDate)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取访客日志失败")
		return
	}

	total := len(logs)
	offset := (page - 1) * pageSize
	if offset > total {
		offset = total
	}
	end := offset + pageSize
	if end > total {
		end = total
	}
	pageItems := logs[offset:end]

	// 精简字段返回
	type VisitorLogDTO struct {
		UserAgent string `json:"user_agent"`
		IPAddress string `json:"ip_address"`
		City      string `json:"city"`
		URLPath   string `json:"url_path"`
		Duration  int    `json:"duration"`
		CreatedAt string `json:"created_at"`
	}

	list := make([]VisitorLogDTO, 0, len(pageItems))
	for _, lg := range pageItems {
		ua := ""
		if lg.UserAgent != nil {
			ua = *lg.UserAgent
		}
		city := ""
		if lg.City != nil {
			city = *lg.City
		}
		list = append(list, VisitorLogDTO{
			UserAgent: ua,
			IPAddress: lg.IPAddress,
			City:      city,
			URLPath:   lg.URLPath,
			Duration:  int(lg.Duration),
			CreatedAt: lg.CreatedAt.Format(time.RFC3339),
		})
	}

	response.Success(c, gin.H{
		"list":      list,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}, "获取访客日志成功")
}

// StatisticsSummary 统计概览数据结构
type StatisticsSummary struct {
	BasicStats *model.VisitorStatistics `json:"basic_stats"`
	TopPages   []*model.URLStatistics   `json:"top_pages"`
	Analytics  *model.VisitorAnalytics  `json:"analytics"`
	TrendData  *model.VisitorTrendData  `json:"trend_data"`
}
