/*
 * @Description: 相册分类 Handler
 * @Author: 安知鱼
 * @Date: 2025-10-12
 */
package album_category

import (
	"net/http"
	"strconv"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/album_category"
	"github.com/gin-gonic/gin"
)

// Handler 封装了相册分类相关的控制器方法
type Handler struct {
	albumCategorySvc album_category.Service
}

// NewHandler 创建相册分类 Handler 实例
func NewHandler(albumCategorySvc album_category.Service) *Handler {
	return &Handler{
		albumCategorySvc: albumCategorySvc,
	}
}

// CreateCategory 处理创建相册分类的请求
// @Summary      创建相册分类
// @Description  创建新的相册分类
// @Tags         相册分类管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  model.CreateAlbumCategoryRequest  true  "分类信息"
// @Success      201  {object}  response.Response{data=model.AlbumCategoryDTO}  "创建成功"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /album-categories [post]
func (h *Handler) CreateCategory(c *gin.Context) {
	var req model.CreateAlbumCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	category, err := h.albumCategorySvc.CreateCategory(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建分类失败: "+err.Error())
		return
	}

	response.SuccessWithStatus(c, http.StatusCreated, category, "创建成功")
}

// ListCategories 处理获取相册分类列表的请求
// @Summary      获取相册分类列表
// @Description  获取所有相册分类列表
// @Tags         相册分类管理
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Response{data=[]model.AlbumCategoryDTO}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /album-categories [get]
func (h *Handler) ListCategories(c *gin.Context) {
	categories, err := h.albumCategorySvc.ListCategories(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取分类列表失败: "+err.Error())
		return
	}

	response.Success(c, categories, "获取成功")
}

// GetCategory 处理获取单个相册分类的请求
// @Summary      获取相册分类详情
// @Description  根据ID获取相册分类详情
// @Tags         相册分类管理
// @Security     BearerAuth
// @Produce      json
// @Param        id  path  int  true  "分类ID"
// @Success      200  {object}  response.Response{data=model.AlbumCategoryDTO}  "获取成功"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      404  {object}  response.Response  "分类不存在"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /album-categories/{id} [get]
func (h *Handler) GetCategory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID非法")
		return
	}

	category, err := h.albumCategorySvc.GetCategory(c.Request.Context(), uint(id))
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取分类失败: "+err.Error())
		return
	}

	response.Success(c, category, "获取成功")
}

// UpdateCategory 处理更新相册分类的请求
// @Summary      更新相册分类
// @Description  更新相册分类信息
// @Tags         相册分类管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  int  true  "分类ID"
// @Param        body  body  model.UpdateAlbumCategoryRequest  true  "分类信息"
// @Success      200  {object}  response.Response{data=model.AlbumCategoryDTO}  "更新成功"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /album-categories/{id} [put]
func (h *Handler) UpdateCategory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID非法")
		return
	}

	var req model.UpdateAlbumCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	category, err := h.albumCategorySvc.UpdateCategory(c.Request.Context(), uint(id), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新分类失败: "+err.Error())
		return
	}

	response.Success(c, category, "更新成功")
}

// DeleteCategory 处理删除相册分类的请求
// @Summary      删除相册分类
// @Description  删除相册分类
// @Tags         相册分类管理
// @Security     BearerAuth
// @Param        id  path  int  true  "分类ID"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "参数错误或删除失败"
// @Failure      500  {object}  response.Response  "删除失败"
// @Router       /album-categories/{id} [delete]
func (h *Handler) DeleteCategory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID非法")
		return
	}

	err = h.albumCategorySvc.DeleteCategory(c.Request.Context(), uint(id))
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "删除分类失败: "+err.Error())
		return
	}

	response.Success(c, nil, "删除成功")
}
