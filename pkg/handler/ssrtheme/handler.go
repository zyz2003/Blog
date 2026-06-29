/*
 * SSR 主题 API 处理器
 * 提供 SSR 主题的安装、启动、停止、卸载等功能
 * 统一管理 SSR 主题状态，与普通主题状态同步
 */
package ssrtheme

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/theme"
	"github.com/anzhiyu-c/anheyu-app/pkg/ssr"
	"github.com/gin-gonic/gin"
)

// Handler SSR 主题处理器
type Handler struct {
	manager      *ssr.Manager
	themeService theme.ThemeService
}

// NewHandler 创建 SSR 主题处理器
func NewHandler(manager *ssr.Manager, themeService theme.ThemeService) *Handler {
	return &Handler{
		manager:      manager,
		themeService: themeService,
	}
}

// GetManager 获取 SSR 管理器（供中间件使用）
func (h *Handler) GetManager() *ssr.Manager {
	return h.manager
}

// InstallThemeRequest 安装主题请求
type InstallThemeRequest struct {
	ThemeName   string `json:"themeName" binding:"required"`
	DownloadURL string `json:"downloadUrl" binding:"required"`
	Version     string `json:"version"`
	MarketID    int    `json:"marketId"`
}

// StartThemeRequest 启动主题请求
type StartThemeRequest struct {
	Port int `json:"port"`
}

// InstallTheme 安装 SSR 主题
// @Summary 安装 SSR 主题
// @Description 从指定 URL 下载并安装 SSR 主题
// @Tags SSR主题管理
// @Accept json
// @Produce json
// @Param request body InstallThemeRequest true "安装请求"
// @Success 200 {object} response.Response
// @Router /api/admin/ssr-theme/install [post]
func (h *Handler) InstallTheme(c *gin.Context) {
	var req InstallThemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 1. 下载并安装 SSR 主题文件
	if err := h.manager.Install(c.Request.Context(), req.ThemeName, req.DownloadURL); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	// 2. 在数据库中创建记录
	// 使用固定的 userID=1（管理员），实际应该从 context 中获取
	userID := uint(1)
	if err := h.themeService.InstallSSRTheme(c.Request.Context(), userID, req.ThemeName, req.Version, req.MarketID); err != nil {
		// 如果数据库写入失败，尝试回滚（卸载已安装的文件）
		h.manager.Uninstall(req.ThemeName)
		response.Fail(c, http.StatusInternalServerError, "写入数据库失败: "+err.Error())
		return
	}

	response.Success(c, nil, "主题安装成功")
}

// UninstallTheme 卸载 SSR 主题
// @Summary 卸载 SSR 主题
// @Description 卸载指定的 SSR 主题
// @Tags SSR主题管理
// @Produce json
// @Param name path string true "主题名称"
// @Success 200 {object} response.Response
// @Router /api/admin/ssr-theme/{name} [delete]
func (h *Handler) UninstallTheme(c *gin.Context) {
	themeName := c.Param("name")
	if themeName == "" {
		response.Fail(c, http.StatusBadRequest, "主题名称不能为空")
		return
	}

	userID := uint(1) // 使用固定的 userID=1（管理员）

	// 1. 先从数据库删除记录
	if err := h.themeService.UninstallSSRTheme(c.Request.Context(), userID, themeName); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	// 2. 卸载文件系统中的主题
	if err := h.manager.Uninstall(themeName); err != nil {
		// 文件删除失败不影响整体流程，只记录日志
		c.Error(err)
	}

	response.Success(c, nil, "主题卸载成功")
}

// StartTheme 启动/切换到 SSR 主题
// @Summary 启动 SSR 主题
// @Description 启动指定的 SSR 主题，并将其设为当前主题
// @Tags SSR主题管理
// @Accept json
// @Produce json
// @Param name path string true "主题名称"
// @Param request body StartThemeRequest false "启动参数"
// @Success 200 {object} response.Response
// @Router /api/admin/ssr-theme/{name}/start [post]
func (h *Handler) StartTheme(c *gin.Context) {
	themeName := c.Param("name")
	if themeName == "" {
		response.Fail(c, http.StatusBadRequest, "主题名称不能为空")
		return
	}

	var req StartThemeRequest
	c.ShouldBindJSON(&req) // 忽略绑定错误，使用默认值
	if req.Port == 0 {
		req.Port = 3000
	}

	userID := uint(1) // 使用固定的 userID=1（管理员）

	// 使用 ThemeService 统一处理主题切换
	// 这会：1. 停止其他 SSR 主题 2. 更新数据库状态 3. 启动目标主题
	if err := h.themeService.SwitchToSSRTheme(c.Request.Context(), userID, themeName, h.manager); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{"port": req.Port}, "主题切换成功")
}

// StopTheme 停止 SSR 主题
// @Summary 停止 SSR 主题
// @Description 停止指定的 SSR 主题
// @Tags SSR主题管理
// @Produce json
// @Param name path string true "主题名称"
// @Success 200 {object} response.Response
// @Router /api/admin/ssr-theme/{name}/stop [post]
func (h *Handler) StopTheme(c *gin.Context) {
	themeName := c.Param("name")
	if themeName == "" {
		response.Fail(c, http.StatusBadRequest, "主题名称不能为空")
		return
	}

	if err := h.manager.Stop(themeName); err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, nil, "主题停止成功")
}

// GetThemeStatus 获取主题状态
// @Summary 获取 SSR 主题状态
// @Description 获取指定 SSR 主题的状态信息
// @Tags SSR主题管理
// @Produce json
// @Param name path string true "主题名称"
// @Success 200 {object} response.Response
// @Router /api/admin/ssr-theme/{name}/status [get]
func (h *Handler) GetThemeStatus(c *gin.Context) {
	themeName := c.Param("name")
	if themeName == "" {
		response.Fail(c, http.StatusBadRequest, "主题名称不能为空")
		return
	}

	status := h.manager.GetStatus(themeName)
	response.Success(c, status, "获取成功")
}

// SSRThemeWithCurrent SSR 主题信息（包含 is_current 状态）
type SSRThemeWithCurrent struct {
	ssr.ThemeInfo
	IsCurrent bool `json:"is_current"`
}

// ListInstalledThemes 列出已安装的 SSR 主题
// @Summary 列出已安装的 SSR 主题
// @Description 获取所有已安装的 SSR 主题列表
// @Tags SSR主题管理
// @Produce json
// @Success 200 {object} response.Response
// @Router /api/admin/ssr-theme/list [get]
func (h *Handler) ListInstalledThemes(c *gin.Context) {
	// #region agent log
	debugLog := func(msg string, data map[string]interface{}) {
		f, _ := os.OpenFile("/Users/anzhiyu/Project/2025/anheyu-work/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if f != nil {
			defer f.Close()
			entry := map[string]interface{}{"location": "handler.go:ListInstalledThemes", "message": msg, "data": data, "timestamp": time.Now().UnixMilli(), "sessionId": "debug-session", "hypothesisId": "C"}
			jsonData, _ := json.Marshal(entry)
			f.Write(append(jsonData, '\n'))
		}
	}
	// #endregion

	themes, err := h.manager.ListInstalled()
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	// #region agent log
	debugLog("从文件系统获取SSR主题列表", map[string]interface{}{"count": len(themes)})
	// #endregion

	// 从数据库获取 SSR 主题的 is_current 状态
	userID := uint(1) // TODO: 从上下文获取实际用户 ID
	dbCurrentStatus, err := h.themeService.GetSSRThemeCurrentStatus(c.Request.Context(), userID)
	if err != nil {
		// #region agent log
		debugLog("获取数据库is_current状态失败", map[string]interface{}{"error": err.Error()})
		// #endregion
		// 即使获取失败也继续返回主题列表，只是没有 is_current 信息
		dbCurrentStatus = make(map[string]bool)
	}

	// #region agent log
	debugLog("数据库is_current状态", map[string]interface{}{"dbCurrentStatus": dbCurrentStatus})
	// #endregion

	// 合并文件系统数据和数据库状态
	result := make([]SSRThemeWithCurrent, len(themes))
	for i, t := range themes {
		result[i] = SSRThemeWithCurrent{
			ThemeInfo: t,
			IsCurrent: dbCurrentStatus[t.Name],
		}
	}

	// #region agent log
	debugLog("返回合并后的SSR主题列表", map[string]interface{}{"result": result})
	// #endregion

	response.Success(c, result, "获取成功")
}
