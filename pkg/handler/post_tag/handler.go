package post_tag

import (
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"

	post_tag_service "github.com/anzhiyu-c/anheyu-app/pkg/service/post_tag"

	"github.com/gin-gonic/gin"
)

// requesterIsAdmin 判断当前请求是否已携带有效管理员 Token（依赖 JWTAuthOptional 注入的 Claims）。
func requesterIsAdmin(c *gin.Context) bool {
	claimsValue, exists := c.Get(auth.ClaimsKey)
	if !exists {
		return false
	}
	claims, ok := claimsValue.(*auth.CustomClaims)
	if !ok {
		return false
	}
	userGroupID, entityType, err := idgen.DecodePublicID(claims.UserGroupID)
	if err != nil || entityType != idgen.EntityTypeUserGroup {
		return false
	}
	return userGroupID == 1
}

// Handler 封装了所有与文章标签相关的 HTTP 处理器。
type Handler struct {
	svc *post_tag_service.Service
}

// NewHandler 是 Handler 的构造函数。
func NewHandler(svc *post_tag_service.Service) *Handler {
	return &Handler{svc: svc}
}

// Create
// @Summary      创建新文章标签
// @Description  根据提供的请求体创建一个新文章标签
// @Tags         文章标签
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        tag body model.CreatePostTagRequest true "创建文章标签的请求体"
// @Success      200 {object} response.Response{data=model.PostTagResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-tags [post]
func (h *Handler) Create(c *gin.Context) {
	var req model.CreatePostTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	tag, err := h.svc.Create(c.Request.Context(), &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建标签失败: "+err.Error())
		return
	}

	response.Success(c, tag, "创建成功")
}

// List
// @Summary      获取文章标签列表
// @Description  获取所有文章标签
// @Tags         文章标签
// @Param        sort query string false "排序方式，支持 'count' 或 'name'，默认为 'count'"
// @Produce      json
// @Success      200 {object} response.Response{data=[]model.PostTagResponse} "成功响应"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-tags [get]
func (h *Handler) List(c *gin.Context) {
	// 从查询参数中获取 sort 值
	sortBy := c.DefaultQuery("sort", model.SortByCount) // 默认为按 count 排序

	// 校验 sort 参数的合法性，防止无效值
	if sortBy != model.SortByCount && sortBy != model.SortByName {
		sortBy = model.SortByCount
	}

	options := model.ListPostTagsOptions{
		SortBy:             sortBy,
		ExcludeZeroCount:   !requesterIsAdmin(c),
	}

	tags, err := h.svc.List(c.Request.Context(), options)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取标签列表失败: "+err.Error())
		return
	}

	response.Success(c, tags, "获取列表成功")
}

// Update
// @Summary      更新文章标签
// @Description  根据文章标签ID和请求体更新信息
// @Tags         文章标签
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path string true "文章标签ID"
// @Param        tag body model.UpdatePostTagRequest true "更新文章标签的请求体"
// @Success      200 {object} response.Response{data=model.PostTagResponse} "成功响应"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-tags/{id} [put]
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "标签ID不能为空")
		return
	}

	var req model.UpdatePostTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	tag, err := h.svc.Update(c.Request.Context(), id, &req)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新标签失败: "+err.Error())
		return
	}

	response.Success(c, tag, "更新成功")
}

// Delete
// @Summary      删除文章标签
// @Description  根据文章标签ID删除
// @Tags         文章标签
// @Security     BearerAuth
// @Produce      json
// @Param        id path string true "文章标签ID"
// @Success      200 {object} response.Response "成功响应"
// @Failure      400 {object} response.Response "标签ID不能为空"
// @Failure      401 {object} response.Response "未授权"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /post-tags/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "标签ID不能为空")
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, http.StatusInternalServerError, "删除标签失败: "+err.Error())
		return
	}

	response.Success(c, nil, "删除成功")
}
