package album_handler

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/album"

	"github.com/gin-gonic/gin"
)

// AlbumHandler 封装了相册相关的控制器方法
type AlbumHandler struct {
	albumSvc album.AlbumService
}

// NewAlbumHandler 是 AlbumHandler 的构造函数
func NewAlbumHandler(albumSvc album.AlbumService) *AlbumHandler {
	return &AlbumHandler{
		albumSvc: albumSvc,
	}
}

// GetAlbums 处理获取图片列表的请求
// @Summary      获取相册图片列表
// @Description  获取相册图片列表，支持分页、分类筛选、标签筛选、时间筛选和排序
// @Tags         相册管理
// @Security     BearerAuth
// @Produce      json
// @Param        page          query  int     false  "页码"  default(1)
// @Param        pageSize      query  int     false  "每页数量"  default(10)
// @Param        categoryId    query  int     false  "分类ID筛选"
// @Param        tag           query  string  false  "标签筛选"
// @Param        createdAt[0]  query  string  false  "开始时间 (2006/01/02 15:04:05)"
// @Param        createdAt[1]  query  string  false  "结束时间 (2006/01/02 15:04:05)"
// @Param        sort          query  string  false  "排序方式"  default(display_order_asc)
// @Success      200  {object}  response.Response  "获取成功"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /albums [get]
func (h *AlbumHandler) GetAlbums(c *gin.Context) {
	// 1. 解析参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	categoryIdStr := c.Query("categoryId")
	tag := c.Query("tag")
	startStr := c.Query("createdAt[0]")
	endStr := c.Query("createdAt[1]")
	sort := c.DefaultQuery("sort", "display_order_asc")

	// 解析 categoryId
	var categoryID *uint
	if categoryIdStr != "" {
		if id, err := strconv.ParseUint(categoryIdStr, 10, 32); err == nil {
			categoryIDVal := uint(id)
			categoryID = &categoryIDVal
		}
	}

	var startTime, endTime *time.Time
	const layout = "2006/01/02 15:04:05"
	if t, err := utils.ParseInChina(layout, startStr); err == nil {
		startTime = &t
	}
	if t, err := utils.ParseInChina(layout, endStr); err == nil {
		endTime = &t
	}

	// 2. 调用更新后的 Service 方法
	pageResult, err := h.albumSvc.FindAlbums(c.Request.Context(), album.FindAlbumsParams{
		Page:       page,
		PageSize:   pageSize,
		CategoryID: categoryID,
		Tag:        tag,
		Start:      startTime,
		End:        endTime,
		Sort:       sort,
	})
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取图片列表失败: "+err.Error())
		return
	}

	// 3. 准备响应 DTO (Data Transfer Object)
	type AlbumResponse struct {
		ID             uint       `json:"id"`
		CategoryID     *uint      `json:"categoryId"`
		ImageUrl       string     `json:"imageUrl"`
		BigImageUrl    string     `json:"bigImageUrl"`
		DownloadUrl    string     `json:"downloadUrl"`
		ThumbParam     string     `json:"thumbParam"`
		BigParam       string     `json:"bigParam"`
		Tags           string     `json:"tags"`
		ViewCount      int        `json:"viewCount"`
		DownloadCount  int        `json:"downloadCount"`
		FileSize       int64      `json:"fileSize"`
		Format         string     `json:"format"`
		AspectRatio    string     `json:"aspectRatio"`
		CreatedAt      time.Time  `json:"created_at"`
		UpdatedAt      time.Time  `json:"updated_at"`
		PublishedAt    *time.Time `json:"published_at"`
		Width          int        `json:"width"`
		Height         int        `json:"height"`
		WidthAndHeight string     `json:"widthAndHeight"`
		DisplayOrder   int        `json:"displayOrder"`
		Title          string     `json:"title"`
		Description    string     `json:"description"`
		Location       string     `json:"location"`
	}

	// 从 PageResult 中获取 Items
	responseList := make([]AlbumResponse, 0, len(pageResult.Items))
	for _, album := range pageResult.Items {
		responseList = append(responseList, AlbumResponse{
			ID:             album.ID,
			CategoryID:     album.CategoryID,
			ImageUrl:       album.ImageUrl,
			BigImageUrl:    album.BigImageUrl,
			DownloadUrl:    album.DownloadUrl,
			ThumbParam:     album.ThumbParam,
			BigParam:       album.BigParam,
			Tags:           album.Tags,
			ViewCount:      album.ViewCount,
			DownloadCount:  album.DownloadCount,
			CreatedAt:      album.CreatedAt,
			UpdatedAt:      album.UpdatedAt,
			PublishedAt:    album.PublishedAt,
			FileSize:       album.FileSize,
			Format:         album.Format,
			AspectRatio:    album.AspectRatio,
			Width:          album.Width,
			Height:         album.Height,
			WidthAndHeight: fmt.Sprintf("%dx%d", album.Width, album.Height),
			DisplayOrder:   album.DisplayOrder,
			Title:          album.Title,
			Description:    album.Description,
			Location:       album.Location,
		})
	}

	response.Success(c, gin.H{
		"list":     responseList,
		"total":    pageResult.Total,
		"pageNum":  page,
		"pageSize": pageSize,
	}, "获取图片列表成功")
}

// AddAlbum 处理新增图片的请求
// @Summary      新增相册图片
// @Description  新增图片到相册
// @Tags         相册管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object{imageUrl=string,bigImageUrl=string,downloadUrl=string,thumbParam=string,bigParam=string,tags=[]string,width=int,height=int,fileSize=int,format=string,fileHash=string,displayOrder=int}  true  "图片信息"
// @Success      200  {object}  response.Response  "添加成功"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      500  {object}  response.Response  "添加失败"
// @Router       /albums [post]
func (h *AlbumHandler) AddAlbum(c *gin.Context) {
	var req struct {
		CategoryID   *uint      `json:"categoryId"`
		ImageUrl     string     `json:"imageUrl" binding:"required"`
		BigImageUrl  string     `json:"bigImageUrl"`
		DownloadUrl  string     `json:"downloadUrl"`
		ThumbParam   string     `json:"thumbParam"`
		BigParam     string     `json:"bigParam"`
		Tags         []string   `json:"tags"`
		Width        int        `json:"width"`
		Height       int        `json:"height"`
		FileSize     int64      `json:"fileSize"`
		Format       string     `json:"format"`
		FileHash     string     `json:"fileHash" binding:"required"`
		DisplayOrder int        `json:"displayOrder"`
		Title        string     `json:"title"`
		Description  string     `json:"description"`
		Location     string     `json:"location"`
		CreatedAt    *time.Time `json:"created_at"`
		PublishedAt  *time.Time `json:"published_at"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	_, err := h.albumSvc.CreateAlbum(c.Request.Context(), album.CreateAlbumParams{
		CategoryID:   req.CategoryID,
		ImageUrl:     req.ImageUrl,
		BigImageUrl:  req.BigImageUrl,
		DownloadUrl:  req.DownloadUrl,
		ThumbParam:   req.ThumbParam,
		BigParam:     req.BigParam,
		Tags:         req.Tags,
		Width:        req.Width,
		Height:       req.Height,
		FileSize:     req.FileSize,
		Format:       req.Format,
		FileHash:     req.FileHash,
		DisplayOrder: req.DisplayOrder,
		Title:        req.Title,
		Description:  req.Description,
		Location:     req.Location,
		CreatedAt:    req.CreatedAt,
		PublishedAt:  req.PublishedAt,
	})

	if err != nil {
		// Service 层返回的错误可以直接展示给前端
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, nil, "添加成功")
}

// DeleteAlbum 处理删除图片的请求
// @Summary      删除相册图片
// @Description  根据ID删除相册中的图片
// @Tags         相册管理
// @Security     BearerAuth
// @Param        id  path  int  true  "图片ID"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "ID非法"
// @Failure      500  {object}  response.Response  "删除失败"
// @Router       /albums/{id} [delete]
func (h *AlbumHandler) DeleteAlbum(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID非法")
		return
	}

	if err := h.albumSvc.DeleteAlbum(c.Request.Context(), uint(id)); err != nil {
		response.Fail(c, http.StatusInternalServerError, "删除失败: "+err.Error())
		return
	}

	response.Success(c, nil, "删除成功")
}

// BatchDeleteAlbums 处理批量删除图片的请求
// @Summary      批量删除相册图片
// @Description  根据ID列表批量删除相册中的图片
// @Tags         相册管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object{ids=[]int}  true  "图片ID列表"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      500  {object}  response.Response  "删除失败"
// @Router       /albums/batch-delete [delete]
func (h *AlbumHandler) BatchDeleteAlbums(c *gin.Context) {
	var req struct {
		IDs []uint `json:"ids" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	deleted, err := h.albumSvc.BatchDeleteAlbums(c.Request.Context(), req.IDs)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "批量删除失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"deleted": deleted,
	}, fmt.Sprintf("成功删除 %d 张图片", deleted))
}

// UpdateAlbum 处理更新图片的请求
// @Summary      更新相册图片
// @Description  更新相册中图片的信息
// @Tags         相册管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  int     true  "图片ID"
// @Param        body  body  object{imageUrl=string,bigImageUrl=string,downloadUrl=string,thumbParam=string,bigParam=string,tags=[]string,displayOrder=int}  true  "图片信息"
// @Success      200  {object}  response.Response  "更新成功"
// @Failure      400  {object}  response.Response  "参数错误或ID非法"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /albums/{id} [put]
func (h *AlbumHandler) UpdateAlbum(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "ID非法")
		return
	}

	var req struct {
		CategoryID   *uint      `json:"categoryId"`
		ImageUrl     string     `json:"imageUrl" binding:"required"`
		BigImageUrl  string     `json:"bigImageUrl"`
		DownloadUrl  string     `json:"downloadUrl"`
		ThumbParam   string     `json:"thumbParam"`
		BigParam     string     `json:"bigParam"`
		Tags         []string   `json:"tags"`
		DisplayOrder *int       `json:"displayOrder"`
		Title        string     `json:"title"`
		Description  string     `json:"description"`
		Location     string     `json:"location"`
		PublishedAt  *time.Time `json:"published_at"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	_, err = h.albumSvc.UpdateAlbum(c.Request.Context(), uint(id), album.UpdateAlbumParams{
		CategoryID:   req.CategoryID,
		ImageUrl:     req.ImageUrl,
		BigImageUrl:  req.BigImageUrl,
		DownloadUrl:  req.DownloadUrl,
		ThumbParam:   req.ThumbParam,
		BigParam:     req.BigParam,
		Tags:         req.Tags,
		DisplayOrder: req.DisplayOrder,
		Title:        req.Title,
		Description:  req.Description,
		Location:     req.Location,
		PublishedAt:  req.PublishedAt,
	})

	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "更新失败: "+err.Error())
		return
	}

	response.Success(c, nil, "更新成功")
}

// BatchImportAlbums 处理批量导入图片的请求
// @Summary      批量导入相册图片
// @Description  批量导入图片到相册，后端自动获取图片元数据
// @Tags         相册管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object{urls=[]string,thumbParam=string,bigParam=string,tags=[]string,displayOrder=int}  true  "批量导入信息"
// @Success      200  {object}  response.Response  "导入完成"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      500  {object}  response.Response  "导入失败"
// @Router       /albums/batch-import [post]
func (h *AlbumHandler) BatchImportAlbums(c *gin.Context) {
	var req struct {
		CategoryID   *uint    `json:"categoryId"`
		URLs         []string `json:"urls" binding:"required,min=1,max=100"`
		ThumbParam   string   `json:"thumbParam"`
		BigParam     string   `json:"bigParam"`
		Tags         []string `json:"tags"`
		DisplayOrder int      `json:"displayOrder"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 调用Service层进行批量导入
	result, err := h.albumSvc.BatchImportAlbums(c.Request.Context(), album.BatchImportParams{
		CategoryID:   req.CategoryID,
		URLs:         req.URLs,
		ThumbParam:   req.ThumbParam,
		BigParam:     req.BigParam,
		Tags:         req.Tags,
		DisplayOrder: req.DisplayOrder,
	})

	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "批量导入失败: "+err.Error())
		return
	}

	// 构造详细的响应数据
	responseData := gin.H{
		"successCount": result.SuccessCount,
		"failCount":    result.FailCount,
		"skipCount":    result.SkipCount,
		"total":        len(req.URLs),
	}

	// 如果有错误，添加错误详情
	if len(result.Errors) > 0 {
		errors := make([]gin.H, 0, len(result.Errors))
		for _, e := range result.Errors {
			errors = append(errors, gin.H{
				"url":    e.URL,
				"reason": e.Reason,
			})
		}
		responseData["errors"] = errors
	}

	// 如果有重复，添加重复列表
	if len(result.Duplicates) > 0 {
		responseData["duplicates"] = result.Duplicates
	}

	message := fmt.Sprintf("批量导入完成！成功 %d 张，失败 %d 张，跳过 %d 张",
		result.SuccessCount, result.FailCount, result.SkipCount)

	response.Success(c, responseData, message)
}

// ExportAlbums 处理导出相册的请求
// @Summary      导出相册
// @Description  导出选定的相册数据，支持 JSON 和 ZIP 格式。如果不指定 album_ids，则导出所有相册
// @Tags         相册管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json,application/zip
// @Param        body  body  object{album_ids=[]int,format=string}  true  "导出信息"
// @Success      200  {file}  file  "导出文件"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      500  {object}  response.Response  "导出失败"
// @Router       /albums/export [post]
func (h *AlbumHandler) ExportAlbums(c *gin.Context) {
	var req struct {
		AlbumIDs []uint `json:"album_ids"` // 移除 required，支持导出所有
		Format   string `json:"format"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 如果没有指定 album_ids，则获取所有相册的 ID
	if len(req.AlbumIDs) == 0 {
		// 查询所有相册（使用大页面获取所有记录）
		result, err := h.albumSvc.FindAlbums(c.Request.Context(), album.FindAlbumsParams{
			Page:     1,
			PageSize: 100000, // 足够大的值获取所有记录
		})
		if err != nil {
			log.Printf("获取所有相册失败: %v", err)
			response.Fail(c, http.StatusInternalServerError, "获取相册列表失败: "+err.Error())
			return
		}
		// 提取所有相册的 ID
		for _, a := range result.Items {
			req.AlbumIDs = append(req.AlbumIDs, a.ID)
		}

		if len(req.AlbumIDs) == 0 {
			response.Fail(c, http.StatusBadRequest, "没有可导出的相册")
			return
		}
	}

	// 如果没有指定格式，默认为 JSON
	if req.Format == "" {
		req.Format = "json"
	}

	// 根据格式导出
	if strings.ToLower(req.Format) == "zip" {
		// 导出为 ZIP
		zipData, err := h.albumSvc.ExportAlbumsToZip(c.Request.Context(), req.AlbumIDs)
		if err != nil {
			log.Printf("导出相册为 ZIP 失败: %v", err)
			response.Fail(c, http.StatusInternalServerError, "导出失败: "+err.Error())
			return
		}

		// 设置文件下载响应头
		filename := fmt.Sprintf("albums-export-%s.zip", time.Now().Format("20060102-150405"))
		c.Header("Content-Description", "File Transfer")
		c.Header("Content-Disposition", "attachment; filename="+filename)
		c.Header("Content-Type", "application/zip")
		c.Header("Content-Transfer-Encoding", "binary")
		c.Data(http.StatusOK, "application/zip", zipData)
	} else {
		// 导出为 JSON
		exportData, err := h.albumSvc.ExportAlbums(c.Request.Context(), req.AlbumIDs)
		if err != nil {
			log.Printf("导出相册失败: %v", err)
			response.Fail(c, http.StatusInternalServerError, "导出失败: "+err.Error())
			return
		}

		// 设置文件下载响应头
		filename := fmt.Sprintf("albums-export-%s.json", time.Now().Format("20060102-150405"))
		c.Header("Content-Description", "File Transfer")
		c.Header("Content-Disposition", "attachment; filename="+filename)
		c.Header("Content-Type", "application/json")
		c.Header("Content-Transfer-Encoding", "binary")
		c.JSON(http.StatusOK, exportData)
	}
}

// ImportAlbums 处理导入相册的请求
// @Summary      导入相册
// @Description  从 JSON 或 ZIP 文件导入相册数据
// @Tags         相册管理
// @Security     BearerAuth
// @Accept       multipart/form-data
// @Produce      json
// @Param        file formData file true "相册数据文件（JSON或ZIP格式）"
// @Param        skip_existing formData bool false "是否跳过已存在的相册"
// @Param        overwrite_existing formData bool false "是否覆盖已存在的相册"
// @Param        default_category_id formData int false "默认分类ID"
// @Success      200  {object}  response.Response  "导入成功"
// @Failure      400  {object}  response.Response  "参数错误"
// @Failure      500  {object}  response.Response  "导入失败"
// @Router       /albums/import [post]
func (h *AlbumHandler) ImportAlbums(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "请上传相册数据文件")
		return
	}

	// 读取文件内容
	fileContent, err := file.Open()
	if err != nil {
		log.Printf("读取上传文件失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "读取文件失败: "+err.Error())
		return
	}
	defer fileContent.Close()

	data, err := io.ReadAll(fileContent)
	if err != nil {
		log.Printf("读取文件数据失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "读取文件数据失败: "+err.Error())
		return
	}

	// 解析参数
	skipExisting := c.DefaultPostForm("skip_existing", "true") == "true"
	overwriteExisting := c.DefaultPostForm("overwrite_existing", "false") == "true"

	var defaultCategoryID *uint
	if catIDStr := c.PostForm("default_category_id"); catIDStr != "" {
		if id, err := strconv.ParseUint(catIDStr, 10, 32); err == nil {
			categoryIDVal := uint(id)
			defaultCategoryID = &categoryIDVal
		}
	}

	// 构建导入请求
	req := &album.ImportAlbumRequest{
		SkipExisting:      skipExisting,
		OverwriteExisting: overwriteExisting,
		DefaultCategoryID: defaultCategoryID,
	}

	// 根据文件扩展名判断格式
	var result *album.ImportAlbumResult
	ext := strings.ToLower(filepath.Ext(file.Filename))

	if ext == ".zip" {
		// 从 ZIP 导入
		result, err = h.albumSvc.ImportAlbumsFromZip(c.Request.Context(), data, req)
	} else if ext == ".json" {
		// 从 JSON 导入
		result, err = h.albumSvc.ImportAlbumsFromJSON(c.Request.Context(), data, req)
	} else {
		response.Fail(c, http.StatusBadRequest, "不支持的文件格式，仅支持 .json 和 .zip 文件")
		return
	}

	if err != nil {
		log.Printf("导入相册失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "导入失败: "+err.Error())
		return
	}

	// 构造响应数据
	responseData := gin.H{
		"total_count":   result.TotalCount,
		"success_count": result.SuccessCount,
		"skipped_count": result.SkippedCount,
		"failed_count":  result.FailedCount,
		"created_ids":   result.CreatedIDs,
	}

	// 如果有错误，添加错误详情
	if len(result.Errors) > 0 {
		responseData["errors"] = result.Errors
	}

	message := fmt.Sprintf("导入完成！成功 %d 个，跳过 %d 个，失败 %d 个",
		result.SuccessCount, result.SkippedCount, result.FailedCount)

	response.Success(c, responseData, message)
}
