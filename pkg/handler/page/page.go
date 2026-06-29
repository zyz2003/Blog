package page

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/page"
)

// Handler 页面处理器
type Handler struct {
	pageService page.Service
}

// NewHandler 创建页面处理器
func NewHandler(pageService page.Service) *Handler {
	return &Handler{
		pageService: pageService,
	}
}

// Create 创建页面
// @Summary      创建页面
// @Description  创建新的页面
// @Tags         页面管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object{title=string,path=string,content=string,markdown_content=string,description=string,is_published=bool,sort=int}  true  "页面信息"
// @Success      200  {object}  response.Response{data=model.Page}  "创建成功"
// @Failure      400  {object}  response.Response  "请求参数错误"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /pages [post]
func (h *Handler) Create(c *gin.Context) {
	var req struct {
		Title           string `json:"title" binding:"required"`
		Path            string `json:"path" binding:"required"`
		Content         string `json:"content" binding:"required"`
		MarkdownContent string `json:"markdown_content"`
		CustomJS        string `json:"custom_js"`
		CustomCSS       string `json:"custom_css"`
		Description     string `json:"description"`
		IsPublished     bool   `json:"is_published"`
		ShowComment     bool   `json:"show_comment"`
		Sort            int    `json:"sort"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	options := &model.CreatePageOptions{
		Title:           req.Title,
		Path:            req.Path,
		Content:         req.Content,
		MarkdownContent: req.MarkdownContent,
		CustomJS:        req.CustomJS,
		CustomCSS:       req.CustomCSS,
		Description:     req.Description,
		IsPublished:     req.IsPublished,
		ShowComment:     req.ShowComment,
		Sort:            req.Sort,
	}

	page, err := h.pageService.Create(c.Request.Context(), options)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "创建页面失败")
		return
	}

	response.Success(c, page, "创建页面成功")
}

// GetByID 根据ID获取页面
// @Summary      获取页面（通过ID）
// @Description  根据ID获取页面详情
// @Tags         页面管理
// @Security     BearerAuth
// @Produce      json
// @Param        id  path  string  true  "页面ID"
// @Success      200  {object}  response.Response{data=model.Page}  "获取成功"
// @Failure      400  {object}  response.Response  "页面ID不能为空"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /pages/{id} [get]
func (h *Handler) GetByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "页面ID不能为空")
		return
	}

	page, err := h.pageService.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取页面失败")
		return
	}

	response.Success(c, page, "获取页面成功")
}

// GetByPath 根据路径获取页面
// @Summary      获取页面（通过路径）
// @Description  根据路径获取已发布的页面详情
// @Tags         公开页面
// @Produce      json
// @Param        path  path  string  true  "页面路径"
// @Success      200  {object}  response.Response{data=model.Page}  "获取成功"
// @Failure      400  {object}  response.Response  "页面路径不能为空"
// @Failure      404  {object}  response.Response  "页面不存在"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /public/pages/{path} [get]
func (h *Handler) GetByPath(c *gin.Context) {
	path := c.Param("path")
	if path == "" {
		response.Fail(c, http.StatusBadRequest, "页面路径不能为空")
		return
	}

	page, err := h.pageService.GetByPath(c.Request.Context(), path)
	if err != nil {
		// 检查是否是"页面不存在"错误
		if strings.Contains(err.Error(), "页面不存在") {
			response.Fail(c, http.StatusNotFound, "页面不存在")
			return
		}
		response.Fail(c, http.StatusInternalServerError, "获取页面失败")
		return
	}

	// 公开接口仅允许访问已发布页面
	if !page.IsPublished {
		response.Fail(c, http.StatusNotFound, "页面不存在")
		return
	}

	response.Success(c, page, "获取页面成功")
}

// List 列出页面
// @Summary      获取页面列表
// @Description  获取页面列表，支持分页和搜索
// @Tags         页面管理
// @Security     BearerAuth
// @Produce      json
// @Param        page          query  int     false  "页码"  default(1)
// @Param        page_size     query  int     false  "每页数量"  default(10)
// @Param        search        query  string  false  "搜索关键词"
// @Param        is_published  query  bool    false  "是否已发布"
// @Success      200  {object}  response.Response{data=object{pages=[]model.Page,total=int,page=int,size=int}}  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /pages [get]
func (h *Handler) List(c *gin.Context) {
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "10")
	search := c.Query("search")
	isPublishedStr := c.Query("is_published")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	var isPublished *bool
	if isPublishedStr != "" {
		val, err := strconv.ParseBool(isPublishedStr)
		if err == nil {
			isPublished = &val
		}
	}

	options := &model.ListPagesOptions{
		Page:        page,
		PageSize:    pageSize,
		Search:      search,
		IsPublished: isPublished,
	}

	pages, total, err := h.pageService.List(c.Request.Context(), options)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取页面列表失败")
		return
	}

	response.Success(c, gin.H{
		"pages": pages,
		"total": total,
		"page":  page,
		"size":  pageSize,
	}, "获取页面列表成功")
}

// Update 更新页面
// @Summary      更新页面
// @Description  更新指定页面的信息
// @Tags         页面管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  string  true  "页面ID"
// @Param        body  body  object{title=string,path=string,content=string,markdown_content=string,description=string,is_published=bool,sort=int}  true  "页面信息（所有字段可选）"
// @Success      200  {object}  response.Response{data=model.Page}  "更新成功"
// @Failure      400  {object}  response.Response  "请求参数错误"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /pages/{id} [put]
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "页面ID不能为空")
		return
	}

	var req struct {
		Title           *string `json:"title"`
		Path            *string `json:"path"`
		Content         *string `json:"content"`
		MarkdownContent *string `json:"markdown_content"`
		CustomJS        *string `json:"custom_js"`
		CustomCSS       *string `json:"custom_css"`
		Description     *string `json:"description"`
		IsPublished     *bool   `json:"is_published"`
		ShowComment     *bool   `json:"show_comment"`
		Sort            *int    `json:"sort"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	options := &model.UpdatePageOptions{
		Title:           req.Title,
		Path:            req.Path,
		Content:         req.Content,
		MarkdownContent: req.MarkdownContent,
		CustomJS:        req.CustomJS,
		CustomCSS:       req.CustomCSS,
		Description:     req.Description,
		IsPublished:     req.IsPublished,
		ShowComment:     req.ShowComment,
		Sort:            req.Sort,
	}

	page, err := h.pageService.Update(c.Request.Context(), id, options)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新页面失败")
		return
	}

	response.Success(c, page, "更新页面成功")
}

// Delete 删除页面
// @Summary      删除页面
// @Description  删除指定页面
// @Tags         页面管理
// @Security     BearerAuth
// @Param        id  path  string  true  "页面ID"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "页面ID不能为空"
// @Failure      500  {object}  response.Response  "删除失败"
// @Router       /pages/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.Fail(c, http.StatusBadRequest, "页面ID不能为空")
		return
	}

	err := h.pageService.Delete(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "删除页面失败")
		return
	}

	response.Success(c, nil, "删除页面成功")
}

// InitializeDefaultPages 初始化默认页面
// @Summary      初始化默认页面
// @Description  初始化系统默认页面（如关于、友链等）
// @Tags         页面管理
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Response  "初始化成功"
// @Failure      500  {object}  response.Response  "初始化失败"
// @Router       /pages/initialize [post]
func (h *Handler) InitializeDefaultPages(c *gin.Context) {
	err := h.pageService.InitializeDefaultPages(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "初始化默认页面失败")
		return
	}

	response.Success(c, nil, "初始化默认页面成功")
}
