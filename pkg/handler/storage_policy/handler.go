/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-15 11:30:55
 * @LastEditTime: 2025-08-23 01:39:07
 * @LastEditors: 安知鱼
 */
package storage_policy_handler

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"
)

// CreatePolicyRequest 定义了创建策略时请求体的结构
type CreatePolicyRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Type        string                 `json:"type" binding:"required"`
	Server      string                 `json:"server"`
	Flag        string                 `json:"flag"`
	BucketName  string                 `json:"bucket_name"`
	IsPrivate   bool                   `json:"is_private"`
	AccessKey   string                 `json:"access_key"`
	SecretKey   string                 `json:"secret_key"`
	MaxSize     int64                  `json:"max_size"`
	BasePath    string                 `json:"base_path"`
	VirtualPath string                 `json:"virtual_path"`
	Settings    map[string]interface{} `json:"settings"`
}

// UpdatePolicyRequest 定义了更新策略时请求体的结构
type UpdatePolicyRequest CreatePolicyRequest

// PaginationRequest 定义了分页查询的请求参数
type PaginationRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"pageSize"`
}

// PolicyListResponse 定义了存储策略列表的响应结构
type PolicyListResponse struct {
	List  []*model.StoragePolicyResponse `json:"list"`
	Total int64                          `json:"total"`
}

// StoragePolicyHandler 负责处理所有与存储策略相关的HTTP请求
type StoragePolicyHandler struct {
	svc volume.IStoragePolicyService
}

// NewStoragePolicyHandler 是 StoragePolicyHandler 的构造函数
func NewStoragePolicyHandler(svc volume.IStoragePolicyService) *StoragePolicyHandler {
	return &StoragePolicyHandler{svc: svc}
}

// Create 处理创建存储策略的请求
// @Summary      创建存储策略
// @Description  创建新的存储策略
// @Tags         存储策略
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  CreatePolicyRequest  true  "存储策略信息"
// @Success      200  {object}  response.Response  "创建成功"
// @Failure      400  {object}  response.Response  "参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      500  {object}  response.Response  "创建失败"
// @Router       /storage-policies [post]
func (h *StoragePolicyHandler) Create(c *gin.Context) {
	var req CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	claims, exists := c.Get(auth.ClaimsKey)
	if !exists {
		response.Fail(c, http.StatusUnauthorized, "无法获取用户信息")
		return
	}

	authClaims, ok := claims.(*auth.CustomClaims)
	if !ok {
		response.Fail(c, http.StatusInternalServerError, "用户信息格式不正确")
		return
	}

	ownerID, _, err := idgen.DecodePublicID(authClaims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}
	policy := &model.StoragePolicy{
		Name:        req.Name,
		Type:        constant.StoragePolicyType(req.Type),
		Flag:        req.Flag,
		Server:      req.Server,
		BucketName:  req.BucketName,
		IsPrivate:   req.IsPrivate,
		AccessKey:   req.AccessKey,
		SecretKey:   req.SecretKey,
		MaxSize:     req.MaxSize,
		BasePath:    req.BasePath,
		VirtualPath: req.VirtualPath,
		Settings:    req.Settings,
	}

	if err := h.svc.CreatePolicy(c.Request.Context(), ownerID, policy); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	responseItem, err := h.buildStoragePolicyResponseItem(policy)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "构建响应失败: "+err.Error())
		return
	}
	response.Success(c, responseItem, "创建成功")
}

// Get 处理获取存储策略的请求
// @Summary      获取存储策略
// @Description  根据ID获取存储策略详情
// @Tags         存储策略
// @Security     BearerAuth
// @Produce      json
// @Param        id  path  string  true  "策略公共ID"
// @Success      200  {object}  response.Response  "获取成功"
// @Failure      400  {object}  response.Response  "ID不能为空"
// @Failure      404  {object}  response.Response  "策略未找到"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /storage-policies/{id} [get]
func (h *StoragePolicyHandler) Get(c *gin.Context) {
	publicID := c.Param("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "ID 不能为空")
		return
	}

	policy, err := h.svc.GetPolicyByID(c.Request.Context(), publicID)
	if err != nil {
		if errors.Is(err, constant.ErrPolicyNotFound) {
			response.Fail(c, http.StatusNotFound, "策略未找到")
			return
		}
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	responseItem, err := h.buildStoragePolicyResponseItem(policy)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "构建响应失败: "+err.Error())
		return
	}
	response.Success(c, responseItem, "获取成功")
}

// List 处理获取存储策略列表的请求
// @Summary      获取存储策略列表
// @Description  获取存储策略列表，支持分页
// @Tags         存储策略
// @Security     BearerAuth
// @Produce      json
// @Param        page      query  int  false  "页码"  default(1)
// @Param        pageSize  query  int  false  "每页数量"  default(10)
// @Success      200  {object}  response.Response{data=PolicyListResponse}  "获取成功"
// @Failure      400  {object}  response.Response  "分页参数错误"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /storage-policies [get]
func (h *StoragePolicyHandler) List(c *gin.Context) {
	const (
		defaultPageSize = 10
		maxPageSize     = 100
	)

	var req PaginationRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "分页参数错误")
		return
	}

	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = defaultPageSize
	}
	if req.PageSize > maxPageSize {
		req.PageSize = maxPageSize
	}

	policies, total, err := h.svc.ListPolicies(c.Request.Context(), req.Page, req.PageSize)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	responseList := make([]*model.StoragePolicyResponse, len(policies))
	for i, policy := range policies {
		item, buildErr := h.buildStoragePolicyResponseItem(policy)
		if buildErr != nil {
			response.Fail(c, http.StatusInternalServerError, "构建策略列表项失败: "+buildErr.Error())
			return
		}
		responseList[i] = item
	}

	response.Success(c, PolicyListResponse{
		List:  responseList,
		Total: total,
	}, "获取列表成功")
}

// Delete 处理删除存储策略的请求
// @Summary      删除存储策略
// @Description  根据ID删除存储策略
// @Tags         存储策略
// @Security     BearerAuth
// @Param        id  path  string  true  "策略公共ID"
// @Success      200  {object}  response.Response  "删除成功"
// @Failure      400  {object}  response.Response  "ID不能为空"
// @Failure      500  {object}  response.Response  "删除失败"
// @Router       /storage-policies/{id} [delete]
func (h *StoragePolicyHandler) Delete(c *gin.Context) {
	publicID := c.Param("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "ID 不能为空")
		return
	}

	if err := h.svc.DeletePolicy(c.Request.Context(), publicID); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, nil, "删除成功")
}

// Update 处理更新存储策略的请求
// @Summary      更新存储策略
// @Description  更新存储策略信息
// @Tags         存储策略
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path  string                true  "策略公共ID"
// @Param        body  body  UpdatePolicyRequest  true  "策略信息"
// @Success      200  {object}  response.Response  "更新成功"
// @Failure      400  {object}  response.Response  "参数无效或ID格式错误"
// @Failure      500  {object}  response.Response  "更新失败"
// @Router       /storage-policies/{id} [put]
func (h *StoragePolicyHandler) Update(c *gin.Context) {
	publicID := c.Param("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "ID 不能为空")
		return
	}

	internalID, entityType, err := idgen.DecodePublicID(publicID)
	if err != nil || entityType != idgen.EntityTypeStoragePolicy {
		response.Fail(c, http.StatusBadRequest, "无效的ID格式")
		return
	}

	var req UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数无效: "+err.Error())
		return
	}

	// 获取原始策略，以便在 VirtualPath 为空时使用原始值
	existingPolicy, err := h.svc.GetPolicyByID(c.Request.Context(), publicID)
	if err != nil {
		response.Fail(c, http.StatusNotFound, "存储策略不存在")
		return
	}

	// 如果 VirtualPath 为空字符串（前端未发送或为空），使用原始值
	virtualPath := req.VirtualPath
	if virtualPath == "" {
		virtualPath = existingPolicy.VirtualPath
	}

	policy := &model.StoragePolicy{
		ID:          internalID,
		Name:        req.Name,
		Flag:        req.Flag,
		Type:        constant.StoragePolicyType(req.Type),
		Server:      req.Server,
		BucketName:  req.BucketName,
		IsPrivate:   req.IsPrivate,
		AccessKey:   req.AccessKey,
		SecretKey:   req.SecretKey,
		MaxSize:     req.MaxSize,
		BasePath:    req.BasePath,
		VirtualPath: virtualPath,
		Settings:    req.Settings,
	}

	if err := h.svc.UpdatePolicy(c.Request.Context(), policy); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	updatedPolicy, err := h.svc.GetPolicyByID(c.Request.Context(), publicID)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取更新后的策略信息失败: "+err.Error())
		return
	}

	responseItem, err := h.buildStoragePolicyResponseItem(updatedPolicy)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "构建响应失败: "+err.Error())
		return
	}

	response.Success(c, responseItem, "更新成功")
}

// ConnectOneDrive 获取 OneDrive 授权链接
// @Summary      获取OneDrive授权链接
// @Description  生成OneDrive OAuth授权链接
// @Tags         存储策略
// @Security     BearerAuth
// @Produce      json
// @Param        id  path  string  true  "策略公共ID"
// @Success      200  {object}  response.Response{data=object{url=string}}  "获取成功"
// @Failure      400  {object}  response.Response  "策略不支持授权"
// @Failure      404  {object}  response.Response  "策略未找到"
// @Failure      500  {object}  response.Response  "生成失败"
// @Router       /storage-policies/{id}/onedrive/connect [get]
func (h *StoragePolicyHandler) ConnectOneDrive(c *gin.Context) {
	publicID := c.Param("id")
	authURL, err := h.svc.GenerateAuthURL(c.Request.Context(), publicID)
	if err != nil {
		if errors.Is(err, constant.ErrPolicyNotFound) {
			response.Fail(c, http.StatusNotFound, "策略未找到")
			return
		}
		if errors.Is(err, constant.ErrPolicyNotSupportAuth) {
			response.Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		response.Fail(c, http.StatusInternalServerError, "生成授权链接失败: "+err.Error())
		return
	}
	response.Success(c, gin.H{"url": authURL}, "获取成功")
}

// AuthorizeRequest 是接收前端 code 和 state 的请求体
type AuthorizeRequest struct {
	Code  string `json:"code" binding:"required"`
	State string `json:"state" binding:"required"`
}

// AuthorizeOneDrive 完成 OneDrive 授权
// @Summary      完成OneDrive授权
// @Description  使用授权码完成OneDrive OAuth流程
// @Tags         存储策略
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  AuthorizeRequest  true  "授权信息"
// @Success      200  {object}  response.Response  "授权成功"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      500  {object}  response.Response  "授权处理失败"
// @Router       /storage-policies/onedrive/authorize [post]
func (h *StoragePolicyHandler) AuthorizeOneDrive(c *gin.Context) {
	var req AuthorizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}

	err := h.svc.FinalizeAuth(c.Request.Context(), req.Code, req.State)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "授权处理失败: "+err.Error())
		return
	}
	response.Success(c, nil, "授权成功")
}

// buildStoragePolicyResponseItem 辅助函数，将 model.StoragePolicy 转换为 model.StoragePolicyResponse
func (h *StoragePolicyHandler) buildStoragePolicyResponseItem(policy *model.StoragePolicy) (*model.StoragePolicyResponse, error) {
	if policy == nil {
		return nil, nil
	}

	publicID, err := idgen.GeneratePublicID(policy.ID, idgen.EntityTypeStoragePolicy)
	if err != nil {
		return nil, fmt.Errorf("生成存储策略公共ID失败: %w", err)
	}

	return &model.StoragePolicyResponse{
		ID:          publicID,
		CreatedAt:   policy.CreatedAt,
		UpdatedAt:   policy.UpdatedAt,
		Name:        policy.Name,
		Flag:        policy.Flag,
		Type:        string(policy.Type),
		Server:      policy.Server,
		BucketName:  policy.BucketName,
		IsPrivate:   policy.IsPrivate,
		AccessKey:   maskStoragePolicySecret(policy.AccessKey),
		SecretKey:   maskStoragePolicySecret(policy.SecretKey),
		MaxSize:     policy.MaxSize,
		BasePath:    policy.BasePath,
		VirtualPath: policy.VirtualPath,
		Settings:    policy.Settings,
	}, nil
}

func maskStoragePolicySecret(value string) string {
	if value == "" {
		return ""
	}
	return constant.SecretValueMask
}
