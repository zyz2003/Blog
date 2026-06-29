/*
 * @Description: 负责处理所有与缩略图相关的HTTP请求。
 *               实现了统一的“获取签名”模式，分离了URL生成和内容服务。
 * @Author: 安知鱼
 * @Date: 2025-07-18 20:00:00
 * @LastEditTime: 2025-07-30 16:54:02
 * @LastEditors: 安知鱼
 */
package thumbnail_handler

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/app/task"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/thumbnail"

	"github.com/gin-gonic/gin"
)

// ThumbnailHandler 负责处理所有与预览/缩略图相关的HTTP请求。
type ThumbnailHandler struct {
	broker           *task.Broker
	metaService      *file_info.MetadataService
	fileService      file.FileService
	thumbnailService thumbnail.IThumbnailAccessService
	settingSvc       setting.SettingService
}

// NewThumbnailHandler 是 ThumbnailHandler 的构造函数。
func NewThumbnailHandler(
	broker *task.Broker,
	metaService *file_info.MetadataService,
	fileService file.FileService,
	thumbnailService thumbnail.IThumbnailAccessService,
	settingService setting.SettingService,
) *ThumbnailHandler {
	return &ThumbnailHandler{
		broker:           broker,
		metaService:      metaService,
		fileService:      fileService,
		thumbnailService: thumbnailService,
		settingSvc:       settingService,
	}
}

// RegenerateThumbnail 处理手动重新生成缩略图的请求
// @Summary      重新生成缩略图
// @Description  手动触发单个文件的缩略图重新生成
// @Tags         缩略管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object{id=string}  true  "文件公共ID"
// @Success      202  {object}  response.Response  "任务已启动"
// @Failure      400  {object}  response.Response  "请求参数无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "访问被拒绝"
// @Failure      404  {object}  response.Response  "文件未找到"
// @Failure      500  {object}  response.Response  "重置失败"
// @Router       /thumbnail/regenerate [post]
func (h *ThumbnailHandler) RegenerateThumbnail(c *gin.Context) {
	// 1. 解析请求体
	var req struct {
		ID string `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}
	publicID := req.ID

	// 2. 验证用户权限
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	viewerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "Invalid user credentials")
		return
	}

	// 权限验证委托给 FileService
	_, err = h.fileService.FindAndValidateFile(c, publicID, uint(viewerID))
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "File not found")
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "Access denied")
		} else {
			response.Fail(c, http.StatusInternalServerError, "Failed to retrieve file information")
		}
		return
	}

	// 3. 调用 Service 层执行核心逻辑
	err = h.thumbnailService.ResetThumbnailMetadata(c, publicID)
	if err != nil {
		log.Printf("[Handler-ERROR] ResetThumbnailMetadata for %s failed: %v", publicID, err)
		response.Fail(c, http.StatusInternalServerError, "Failed to reset thumbnail metadata.")
		return
	}

	// 手动派发任务
	fileID, _, _ := idgen.DecodePublicID(publicID)
	h.broker.DispatchThumbnailGeneration(uint(fileID))

	response.SuccessWithStatus(c, http.StatusAccepted, gin.H{
		"status": model.MetaValueStatusProcessing,
	}, "Thumbnail regeneration has been initiated.")
}

// RegenerateThumbnailsForDirectory 处理按目录批量重新生成缩略图的请求
// @Summary      批量重新生成缩略图
// @Description  为指定目录下的所有文件重新生成缩略图
// @Tags         缩略管理
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object{directoryId=string}  true  "目录公共ID"
// @Success      202  {object}  response.Response  "批量任务已启动"
// @Failure      400  {object}  response.Response  "请求参数无效或目标不是文件夹"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      404  {object}  response.Response  "目录未找到"
// @Failure      500  {object}  response.Response  "获取文件列表失败"
// @Router       /thumbnail/regenerate-directory [post]
func (h *ThumbnailHandler) RegenerateThumbnailsForDirectory(c *gin.Context) {
	// 1. 解析请求体
	var req struct {
		DirectoryID string `json:"directoryId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数无效: "+err.Error())
		return
	}
	publicDirectoryID := req.DirectoryID

	// 2. 验证用户权限和目标类型
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	viewerID, _, _ := idgen.DecodePublicID(claims.UserID)
	directory, err := h.fileService.FindAndValidateFile(c, publicDirectoryID, uint(viewerID))
	if err != nil {
		response.Fail(c, http.StatusNotFound, "找不到目录或无权访问")
		return
	}
	if directory.Type != model.FileTypeDir {
		response.Fail(c, http.StatusBadRequest, "目标不是一个文件夹。")
		return
	}

	// 3. 递归获取目录下所有文件
	files, err := h.fileService.ListAllDescendantFiles(c, directory.ID)
	if err != nil {
		log.Printf("[Handler-ERROR] RegenerateThumbnailsForDirectory: 无法获取目录 %d 下的文件列表: %v", directory.ID, err)
		response.Fail(c, http.StatusInternalServerError, "获取文件列表失败。")
		return
	}

	if len(files) == 0 {
		response.Success(c, nil, "该目录下没有需要处理的文件。")
		return
	}

	// 4. 提取所有文件ID，并进行一次性的批量元数据重置
	fileIDs := make([]uint, 0, len(files))
	for _, fileToProcess := range files {
		fileIDs = append(fileIDs, fileToProcess.ID)
	}

	// 调用新的批量重置 Service 方法
	if err := h.thumbnailService.ResetThumbnailMetadataForFiles(c, fileIDs); err != nil {
		log.Printf("[Handler-ERROR] 批量重置元数据失败 for directoryID %d: %v", directory.ID, err)
		response.Fail(c, http.StatusInternalServerError, "批量重置文件状态失败。")
		return
	}

	// 5. 将所有任务派发到后台队列（这一步在循环中是安全的，因为Broker是异步的）
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Handler-ERROR] 目录 %d 批量派发缩略图任务 panic: %v", directory.ID, r)
			}
		}()
		log.Printf("[Handler-INFO] 开始为目录 %d 下的 %d 个文件批量派发缩略图生成任务...", directory.ID, len(fileIDs))
		for _, id := range fileIDs {
			h.broker.DispatchThumbnailGeneration(id)
		}
		log.Printf("[Handler-INFO] 目录 %d 批量任务派发完成。", directory.ID)
	}()

	// 6. 立即返回 202 Accepted 响应
	response.SuccessWithStatus(c, http.StatusAccepted, gin.H{
		"message":        fmt.Sprintf("已开始为 %d 个文件重新生成缩略图，请稍后刷新查看。", len(fileIDs)),
		"filesToProcess": len(fileIDs),
	}, "后台任务已启动。")
}

// GetThumbnailSign 统一处理所有可提供内容的文件的签名请求。
// GET /api/thumbnail/sign/:publicID
// @Summary      获取缩略图签名
// @Description  获取文件缩略图的访问签名，如果缩略图未就绪会触发生成
// @Tags         缩略管理
// @Security     BearerAuth
// @Produce      json
// @Param        publicID  path  string  true  "文件公共ID"
// @Success      200  {object}  response.Response{data=object{sign=string,expires=string,obfuscated=bool}}  "签名获取成功"
// @Success      202  {object}  response.Response{data=object{status=string}}  "缩略图生成中"
// @Failure      400  {object}  response.Response  "无效的文件ID"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "访问被拒绝"
// @Failure      404  {object}  response.Response  "文件未找到"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /thumbnail/sign/{publicID} [get]
func (h *ThumbnailHandler) GetThumbnailSign(c *gin.Context) {
	publicID := c.Param("publicID")
	fileID, entityType, err := idgen.DecodePublicID(publicID)
	if err != nil || entityType != idgen.EntityTypeFile {
		response.Fail(c, http.StatusBadRequest, "Invalid public file ID")
		return
	}
	internalFileID := uint(fileID)

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	viewerID, userEntityType, err := idgen.DecodePublicID(claims.UserID)
	if err != nil || userEntityType != idgen.EntityTypeUser {
		response.Fail(c, http.StatusUnauthorized, "Invalid user credentials in token")
		return
	}

	// 权限验证
	file, err := h.fileService.FindAndValidateFile(c, publicID, uint(viewerID))
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "File not found")
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "Access denied")
		} else {
			response.Fail(c, http.StatusInternalServerError, "Failed to retrieve file information")
		}
		return
	}

	// 检查文件状态
	status, _ := h.metaService.Get(c, internalFileID, model.MetaKeyThumbStatus)

	// Case 1: 缩略图已就绪
	if status == model.MetaValueStatusReady || status == model.MetaValueStatusReadyDirect {
		sign, expiresAt, err := h.thumbnailService.GenerateSignedURL(c, file)
		if err != nil { // 包括之前添加的 ErrThumbDataInconsistent
			log.Printf("为文件 %d 生成签名时检测到问题，将重新生成: %v", internalFileID, err)
			h.resetAndDispatch(c, internalFileID)
			response.SuccessWithStatus(c, http.StatusAccepted, gin.H{"status": model.MetaValueStatusProcessing}, "Resource is being processed.")
			return
		}
		response.Success(c, gin.H{"sign": sign, "expires": expiresAt.Format(time.RFC3339), "obfuscated": true}, "Success")
		return
	}

	// Case 2: 缩略图生成已彻底失败
	// 生产环境中应从 SettingService 获取
	maxRetries, _ := strconv.Atoi(h.settingSvc.Get(constant.KeyQueueThumbMaxRetries.String()))
	if maxRetries <= 0 {
		maxRetries = 3
	}
	retryCountStr, _ := h.metaService.Get(c, internalFileID, model.MetaKeyThumbRetryCount)
	retryCount, _ := strconv.Atoi(retryCountStr)

	if status == model.MetaValueStatusFailed && retryCount >= maxRetries {
		errorMsg, _ := h.metaService.Get(c, internalFileID, model.MetaKeyThumbError)
		log.Printf("文件 %d 缩略图已达最大重试次数，直接返回失败状态。", internalFileID)
		response.Success(c, gin.H{
			"status": model.MetaValueStatusFailed,
			"error":  "Thumbnail generation failed: " + errorMsg,
		}, "Thumbnail generation has failed.")
		return
	}

	// Case 3: 缩略图正在处理中，或失败但仍可重试
	// (包括 status 为空, processing, 或者 failed 但 retryCount < maxRetries 的情况)
	if status == "" || status == model.MetaValueStatusFailed {
		// 只有在状态为空或失败时才需要重新派发，如果是processing则只需等待
		log.Printf("文件 %d 的访问凭证被请求，状态为 '%s'，将触发生成任务。", internalFileID, status)
		h.resetAndDispatch(c, internalFileID)
	}

	// 对所有未就绪但非最终失败的情况，都返回 processing
	response.SuccessWithStatus(c, http.StatusAccepted, gin.H{
		"status": model.MetaValueStatusProcessing,
	}, "Resource is being processed.")
}

// HandleThumbnailContent 处理带签名的、不透明的统一访问令牌请求。
// GET /t/:signedToken
// @Summary      访问缩略图内容
// @Description  通过签名令牌访问缩略图文件内容
// @Tags         缩略管理
// @Produce      octet-stream
// @Param        signedToken  path  string  true  "签名令牌"
// @Success      200  {file}    file  "缩略图内容"
// @Failure      403  {object}  response.Response  "签名无效或已过期"
// @Failure      404  {object}  response.Response  "资源未找到"
// @Failure      500  {object}  response.Response  "提供内容失败"
// @Router       /t/{signedToken} [get]
func (h *ThumbnailHandler) HandleThumbnailContent(c *gin.Context) {
	signedToken := c.Param("signedToken")

	// 将解析和验证的复杂逻辑委托给 ThumbnailService
	err := h.thumbnailService.ServeThumbnailContent(c, signedToken, c.Writer, c.Request)

	if err != nil {
		if errors.Is(err, constant.ErrLinkExpired) || errors.Is(err, constant.ErrSignatureInvalid) {
			response.Fail(c, http.StatusForbidden, err.Error())
		} else if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "Resource not found or has been moved.")
		} else {
			response.Fail(c, http.StatusInternalServerError, "Error serving content: "+err.Error())
		}
		return
	}
}

// resetAndDispatch 是一个辅助函数，用于清理旧元数据并派发新的缩略图生成任务。
func (h *ThumbnailHandler) resetAndDispatch(ctx context.Context, fileID uint) {
	bgCtx := context.Background()
	// 注意：这里只设置状态为 processing，旧的错误和重试次数由 ThumbnailService 自己在开始时清理
	go h.metaService.Set(bgCtx, fileID, model.MetaKeyThumbStatus, model.MetaValueStatusProcessing)
	h.broker.DispatchThumbnailGeneration(fileID)
}

// getClaims 从 gin.Context 中安全地提取 JWT Claims
func getClaims(c *gin.Context) (*auth.CustomClaims, error) {
	claimsValue, exists := c.Get(auth.ClaimsKey)
	if !exists {
		return nil, errors.New("无法获取用户信息，请确认是否已登录")
	}
	claims, ok := claimsValue.(*auth.CustomClaims)
	if !ok {
		return nil, errors.New("用户信息格式不正确")
	}
	return claims, nil
}
