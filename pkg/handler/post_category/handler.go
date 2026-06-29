package post_category

import (
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"

	post_category_service "github.com/anzhiyu-c/anheyu-app/pkg/service/post_category"

	"github.com/gin-gonic/gin"
)

// Handler 封装了所有与文章分类相关的 HTTP 处理器。
type Handler struct {
	svc *post_category_service.Service
}

// NewHandler 是 Handler 的构造函数。
func NewHandler(svc *post_category_service.Service) *Handler {
	return &Handler{svc: svc}
}

// Create
// @Summary      创建新文章分类
// @Description  根据提供的请求体创建一个新文章分类
// @Tags         文章分类
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        category body model.CreatePostCategoryRequest true "创建文章分类的请求体"
// @Success      200 {object} response.Response{data=model.PostCategoryResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-categories [post]
func (h *Handler) Create(c *gin.Context) {
	var req model.CreatePostCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	category, err := h.svc.Create(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建分类失败: "+err.Error())
		return
	}

	response.Success(c, category, "创建成功")
}

// List
// @Summary      获取文章分类列表
// @Description  获取所有文章分类
// @Tags         文章分类
// @Produce      json
// @Success      200 {object} response.Response{data=[]model.PostCategoryResponse} "成功响应"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-categories [get]
func (h *Handler) List(c *gin.Context) {
	categories, err := h.svc.List(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取分类列表失败: "+err.Error())
		return
	}

	response.Success(c, categories, "获取列表成功")
}

// Update
// @Summary      更新文章分类
// @Description  根据文章分类ID和请求体更新信息
// @Tags         文章分类
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "文章分类ID"
// @Param        category body model.UpdatePostCategoryRequest true "更新文章分类的请求体"
// @Success      200 {object} response.Response{data=model.PostCategoryResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-categories/{id} [put]
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "分类ID不能为空")
		return
	}

	var req model.UpdatePostCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	category, err := h.svc.Update(c.Request.Context(), id, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新分类失败: "+err.Error())
		return
	}

	response.Success(c, category, "更新成功")
}

// Delete
// @Summary      删除文章分类
// @Description  根据文章分类ID删除
// @Tags         文章分类
// @Security     BearerAuth
// @Produce      json
// @Param        id path string true "文章分类ID"
// @Success      200 {object} response.Response "成功响应"
// @Failure      400 {object} response.Response "分类ID不能为空"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-categories/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "分类ID不能为空")
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, http.StatusInternalServerError, "删除分类失败: "+err.Error())
		return
	}

	response.Success(c, nil, "删除成功")
}
