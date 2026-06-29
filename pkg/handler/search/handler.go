/*
 * @Description: 搜索处理器
 * @Author: 安知鱼
 * @Date: 2025-01-27 10:00:00
 * @LastEditTime: 2025-01-27 10:00:00
 * @LastEditors: 安知鱼
 */
package search

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/search"
)

type Handler struct {
	searchService *search.SearchService
}

func NewHandler(searchService *search.SearchService) *Handler {
	return &Handler{
		searchService: searchService,
	}
}

// Search 搜索接口
// @Summary      搜索
// @Description  全站搜索文章、页面等内容
// @Tags         全站搜索
// @Produce      json
// @Param        q     query  string  true   "搜索关键词"
// @Param        page  query  int     false  "页码"  default(1)
// @Param        size  query  int     false  "每页数量"  default(10)
// @Success      200  {object}  response.Response  "搜索成功"
// @Failure      400  {object}  response.Response  "搜索关键词不能为空"
// @Failure      500  {object}  response.Response  "搜索失败"
// @Router       /public/search [get]
func (h *Handler) Search(c *gin.Context) {
	// 获取查询参数
	query := c.Query("q")
	if query == "" {
		response.Fail(c, http.StatusBadRequest, "搜索关键词不能为空")
		return
	}

	// 获取分页参数
	pageStr := c.DefaultQuery("page", "1")
	sizeStr := c.DefaultQuery("size", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	size, err := strconv.Atoi(sizeStr)
	if err != nil || size < 1 || size > 100 {
		size = 10
	}

	// 执行搜索
	result, err := h.searchService.Search(c.Request.Context(), query, page, size)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "搜索失败: "+err.Error())
		return
	}

	// 返回结果
	response.Success(c, result, "搜索成功")
}
