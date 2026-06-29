/*
 * @Description: 文档系列 HTTP 处理器
 * @Author: 安知鱼
 * @Date: 2025-12-30 10:00:00
 * @LastEditTime: 2025-12-30 10:00:00
 * @LastEditors: 安知鱼
 */
package doc_series

import (
	"net/http"
	"strconv"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"

	doc_series_service "github.com/anzhiyu-c/anheyu-app/pkg/service/doc_series"

	"github.com/gin-gonic/gin"
)

// Handler 封装了所有与文档系列相关的 HTTP 处理器。
type Handler struct {
	svc *doc_series_service.Service
}

// NewHandler 是 Handler 的构造函数。
func NewHandler(svc *doc_series_service.Service) *Handler {
	return &Handler{svc: svc}
}

// Create
// @Summary      创建新文档系列
// @Description  根据提供的请求体创建一个新文档系列
// @Tags         文档系列
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        series body model.CreateDocSeriesRequest true "创建文档系列的请求体"
// @Success      200 {object} response.Response{data=model.DocSeriesResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /doc-series [post]
func (h *Handler) Create(c *gin.Context) {
	var req model.CreateDocSeriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	series, err := h.svc.Create(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建系列失败: "+err.Error())
		return
	}

	response.Success(c, series, "创建成功")
}

// List
// @Summary      获取文档系列列表
// @Description  获取所有文档系列
// @Tags         文档系列
// @Produce      json
// @Param        page query int false "页码" default(1)
// @Param        pageSize query int false "每页数量" default(20)
// @Success      200 {object} response.Response{data=model.DocSeriesListResponse} "成功响应"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /doc-series [get]
func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	opts := &model.ListDocSeriesOptions{
		Page:     page,
		PageSize: pageSize,
	}

	result, err := h.svc.List(c.Request.Context(), opts)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取系列列表失败: "+err.Error())
		return
	}

	response.Success(c, result, "获取列表成功")
}

// Get
// @Summary      获取单个文档系列
// @Description  根据ID获取文档系列详情
// @Tags         文档系列
// @Produce      json
// @Param        id path string true "文档系列ID"
// @Success      200 {object} response.Response{data=model.DocSeriesResponse} "成功响应"
// @Failure      400 {object} response.Response "ID不能为空"
// @Failure      404 {object} response.Response "系列不存在"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /doc-series/{id} [get]
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "系列ID不能为空")
		return
	}

	series, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "系列不存在: "+err.Error())
		return
	}

	response.Success(c, series, "获取成功")
}

// GetWithArticles
// @Summary      获取文档系列及其包含的文章
// @Description  根据ID获取文档系列详情，包括该系列下的所有文章列表
// @Tags         文档系列
// @Produce      json
// @Param        id path string true "文档系列ID"
// @Success      200 {object} response.Response{data=model.DocSeriesWithArticles} "成功响应"
// @Failure      400 {object} response.Response "ID不能为空"
// @Failure      404 {object} response.Response "系列不存在"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /doc-series/{id}/articles [get]
func (h *Handler) GetWithArticles(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "系列ID不能为空")
		return
	}

	series, err := h.svc.GetByIDWithArticles(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "系列不存在: "+err.Error())
		return
	}

	response.Success(c, series, "获取成功")
}

// Update
// @Summary      更新文档系列
// @Description  根据文档系列ID和请求体更新信息
// @Tags         文档系列
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "文档系列ID"
// @Param        series body model.UpdateDocSeriesRequest true "更新文档系列的请求体"
// @Success      200 {object} response.Response{data=model.DocSeriesResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /doc-series/{id} [put]
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "系列ID不能为空")
		return
	}

	var req model.UpdateDocSeriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	series, err := h.svc.Update(c.Request.Context(), id, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新系列失败: "+err.Error())
		return
	}

	response.Success(c, series, "更新成功")
}

// Delete
// @Summary      删除文档系列
// @Description  根据文档系列ID删除
// @Tags         文档系列
// @Security     BearerAuth
// @Produce      json
// @Param        id path string true "文档系列ID"
// @Success      200 {object} response.Response "成功响应"
// @Failure      400 {object} response.Response "系列ID不能为空"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /doc-series/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "系列ID不能为空")
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, http.StatusInternalServerError, "删除系列失败: "+err.Error())
		return
	}

	response.Success(c, nil, "删除成功")
}
