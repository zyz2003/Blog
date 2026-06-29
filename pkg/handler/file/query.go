package file

import (
	"errors"
	"log"
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/uri"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"

	"github.com/gin-gonic/gin"
)

// GetFilesByPath 处理获取文件列表的请求 (GET /api/files?uri=...)
//
// 此方法是获取文件列表API的入口点。它的核心职责是：
// 1.  解析URL中的`uri`参数，以确定要访问的虚拟路径。
// 2.  将所有顶层的查询参数（主要是分页用的`next_token`）设置到解析后的URI对象中。
// 3.  进行用户身份验证和权限检查。
// 4.  调用`fileService.QueryByURI`方法来执行核心的业务逻辑。
// 5.  将服务层返回的结果封装成标准的API响应并发送给客户端。
//
// 注意：此 Handler 不再关心`order`或`direction`等业务参数，这些已由Service层内部处理。
// 它只负责透传必要的上下文参数。
//
// @Summary      获取文件列表
// @Description  通过虚拟路径获取文件和文件夹列表，支持分页
// @Tags         文件管理
// @Security     BearerAuth
// @Produce      json
// @Param        uri         query  string  false  "虚拟路径URI"  default(anzhiyu://my/)
// @Param        next_token  query  string  false  "分页令牌"
// @Success      200  {object}  response.Response  "获取成功"
// @Failure      400  {object}  response.Response  "URI格式无效"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /files [get]
func (h *FileHandler) GetFilesByPath(c *gin.Context) {
	// 1. 解析基础的URI字符串
	uriStr := c.DefaultQuery("uri", "anzhiyu://my/")
	parsedURI, err := uri.Parse(uriStr)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "URI格式无效: "+err.Error())
		return
	}

	// 2. 进行用户身份验证
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	viewerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	// 3. 将所有顶层查询参数（如 next_token）合并到URI对象中，以便传递给服务层
	parsedURI.Query = c.Request.URL.Query()

	// 4. 解析目标文件所有者ID
	ownerID, err := h.resolveMyFSTarget(c, claims, parsedURI)
	if err != nil {
		// 错误响应已在 resolveMyFSTarget 中处理
		return
	}

	// 5. 调用服务层执行核心逻辑
	fileListResponse, err := h.fileSvc.QueryByURI(c.Request.Context(), ownerID, viewerID, parsedURI)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取文件列表失败: "+err.Error())
		return
	}

	// 6. 返回成功响应
	response.Success(c, fileListResponse, "文件列表获取成功")
}

// GetFileInfo 处理获取单个文件或文件夹详细信息的请求 (GET /api/file/:id)
// @Summary      获取文件信息
// @Description  获取单个文件或文件夹的详细信息
// @Tags         文件管理
// @Security     BearerAuth
// @Produce      json
// @Param        id  path  string  true  "文件公共ID"
// @Success      200  {object}  response.Response  "获取成功"
// @Failure      400  {object}  response.Response  "文件ID不能为空"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "无权访问此文件"
// @Failure      404  {object}  response.Response  "文件不存在"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /file/{id} [get]
func (h *FileHandler) GetFileInfo(c *gin.Context) {
	publicFileID := c.Param("id")
	if publicFileID == "" {
		response.Fail(c, http.StatusBadRequest, "文件ID不能为空")
		return
	}

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	viewerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	fileInfo, err := h.fileSvc.GetFileInfo(c.Request.Context(), viewerID, publicFileID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "文件不存在")
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "无权访问此文件")
		} else {
			response.Fail(c, http.StatusInternalServerError, "获取文件信息失败: "+err.Error())
		}
		return
	}

	response.Success(c, fileInfo, "文件信息获取成功")
}

// GetFolderSize 处理计算文件夹大小的请求。
// @Summary      计算文件夹大小
// @Description  递归计算文件夹内所有文件的总大小
// @Tags         文件管理
// @Security     BearerAuth
// @Produce      json
// @Param        id  path  string  true  "文件夹公共ID"
// @Success      200  {object}  response.Response  "计算成功"
// @Failure      400  {object}  response.Response  "文件夹ID不能为空"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "无权访问此文件夹"
// @Failure      404  {object}  response.Response  "文件夹未找到"
// @Failure      500  {object}  response.Response  "计算失败"
// @Router       /file/folder-size/{id} [get]
func (h *FileHandler) GetFolderSize(c *gin.Context) {
	publicFolderID := c.Param("id")
	if publicFolderID == "" {
		response.Fail(c, http.StatusBadRequest, "文件夹ID不能为空")
		return
	}

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	ownerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	folderSize, err := h.fileSvc.GetFolderSize(c.Request.Context(), ownerID, publicFolderID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "文件夹未找到")
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "无权访问此文件夹")
		} else {
			response.Fail(c, http.StatusInternalServerError, "计算失败: "+err.Error())
		}
		return
	}

	response.Success(c, folderSize, "计算成功")
}

// GetFolderTree 为浏览器端打包准备文件夹内的所有文件列表
// @Summary      获取文件夹树
// @Description  获取文件夹内的所有文件和子文件夹列表（用于打包下载）
// @Tags         文件管理
// @Security     BearerAuth
// @Produce      json
// @Param        id  path  string  true  "文件夹公共ID"
// @Success      200  {object}  response.Response  "获取成功"
// @Failure      400  {object}  response.Response  "文件夹ID不能为空"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "无权访问此文件夹"
// @Failure      404  {object}  response.Response  "文件夹不存在"
// @Failure      500  {object}  response.Response  "获取失败"
// @Router       /file/folder-tree/{id} [get]
func (h *FileHandler) GetFolderTree(c *gin.Context) {
	publicFolderID := c.Param("id")
	if publicFolderID == "" {
		response.Fail(c, http.StatusBadRequest, "文件夹ID不能为空")
		return
	}
	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}
	viewerID, _, err := idgen.DecodePublicID(claims.UserID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无效的用户凭证")
		return
	}

	folderTreeResponse, err := h.fileSvc.GetFolderTree(c.Request.Context(), viewerID, publicFolderID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "文件夹不存在")
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "无权访问此文件夹")
		} else {
			response.Fail(c, http.StatusInternalServerError, "获取文件夹内容失败: "+err.Error())
		}
		return
	}

	response.Success(c, folderTreeResponse, "文件夹内容列表获取成功")
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

// resolveMyFSTarget 解析 "my" 文件系统，确定操作目标的用户ID
func (h *FileHandler) resolveMyFSTarget(c *gin.Context, claims *auth.CustomClaims, parsedURI *uri.ParsedURI) (uint, error) {
	// 如果URI中没有指定FSID，则默认为是当前用户自己
	if parsedURI.FSID == "" {
		ownerID, _, err := idgen.DecodePublicID(claims.UserID)
		if err != nil {
			response.Fail(c, http.StatusUnauthorized, "无效的用户凭证或ID")
			return 0, err
		}
		return ownerID, nil
	}
	// 如果指定了FSID，则需要权限校验（例如，是否是管理员）
	userGroupID, _, err := idgen.DecodePublicID(claims.UserGroupID)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, "无法解码用户组ID")
		return 0, err
	}
	if userGroupID != 1 { // 1是管理员组
		err := errors.New("权限不足，无法访问他人文件")
		response.Fail(c, http.StatusForbidden, err.Error())
		return 0, err
	}
	// 管理员可以访问指定用户的FS
	ownerID, _, err := idgen.DecodePublicID(parsedURI.FSID)
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "无效的目标用户ID")
		return 0, err
	}
	return ownerID, nil
}

// GetPreviewURLs 处理获取文件预览URL列表的请求
// @Summary      获取文件预览URL列表
// @Description  获取文件所在文件夹的所有可预览文件的URL列表
// @Tags         文件管理
// @Security     BearerAuth
// @Produce      json
// @Param        id  query  string  true  "文件公共ID"
// @Success      200  {object}  response.Response{data=object{urls=[]string,initialIndex=int}}  "获取成功"
// @Failure      400  {object}  response.Response  "缺少id参数"
// @Failure      401  {object}  response.Response  "未授权"
// @Failure      403  {object}  response.Response  "访问被拒绝"
// @Failure      404  {object}  response.Response  "文件或目录未找到"
// @Failure      500  {object}  response.Response  "生成预览列表失败"
// @Router       /file/preview-urls [get]
func (h *FileHandler) GetPreviewURLs(c *gin.Context) {
	publicID := c.Query("id")
	if publicID == "" {
		response.Fail(c, http.StatusBadRequest, "Missing required 'id' parameter")
		return
	}

	log.Printf("[HANDLER-DEBUG] GetPreviewURLs: 收到 publicID: '%s'", publicID)

	claims, err := getClaims(c)
	if err != nil {
		response.Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	urls, initialIndex, err := h.fileSvc.GetPreviewURLs(c, claims.UserID, publicID)
	if err != nil {
		if errors.Is(err, constant.ErrNotFound) {
			response.Fail(c, http.StatusNotFound, "File or its directory not found")
		} else if errors.Is(err, constant.ErrForbidden) {
			response.Fail(c, http.StatusForbidden, "Access denied")
		} else {
			log.Printf("[Handler-ERROR] GetPreviewURLs failed: %v", err)
			response.Fail(c, http.StatusInternalServerError, "Failed to generate preview list")
		}
		return
	}

	response.Success(c, gin.H{
		"urls":         urls,
		"initialIndex": initialIndex,
	}, "Success")
}

// ServeSignedContent 处理带签名的内容服务请求
// @Summary      提供签名内容
// @Description  通过签名令牌访问文件内容（用于预览）
// @Tags         文件管理
// @Produce      octet-stream
// @Param        sign  query  string  true  "签名令牌"
// @Success      200  {file}    file  "文件内容"
// @Failure      400  {object}  response.Response  "缺少sign参数"
// @Failure      403  {object}  response.Response  "签名无效或已过期"
// @Failure      404  {object}  response.Response  "资源未找到"
// @Failure      500  {object}  response.Response  "提供内容失败"
// @Router       /file/serve-content [get]
func (h *FileHandler) ServeSignedContent(c *gin.Context) {
	// 从查询参数 ?sign=... 获取 token
	signedToken := c.Query("sign")
	if signedToken == "" {
		response.Fail(c, http.StatusBadRequest, "Missing required 'sign' parameter")
		return
	}

	// 在 Service 层处理响应头的设置
	err := h.fileSvc.ServeSignedContent(c, signedToken, c.Writer, c.Request)

	if err != nil {
		// 在Service层失败且未写入响应时，在这里统一处理错误响应
		if c.Writer.Status() == http.StatusOK { // 检查是否已开始写入响应
			if errors.Is(err, constant.ErrLinkExpired) || errors.Is(err, constant.ErrSignatureInvalid) {
				response.Fail(c, http.StatusForbidden, err.Error())
			} else if errors.Is(err, constant.ErrNotFound) {
				response.Fail(c, http.StatusNotFound, "Resource not found")
			} else {
				log.Printf("[Handler-ERROR] ServeSignedContent failed: %v", err)
				response.Fail(c, http.StatusInternalServerError, "Failed to serve content")
			}
		}
		return
	}
}
