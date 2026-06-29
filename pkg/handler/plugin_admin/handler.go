/*
 * @Description: 插件管理后台 API Handler
 * @Author: 安知鱼
 * @Date: 2026-04-09
 */
package plugin_admin

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/plugin"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
)

// Handler 插件管理 HTTP 处理器
type Handler struct {
	manager *plugin.Manager
}

// NewHandler 创建插件管理处理器
func NewHandler(manager *plugin.Manager) *Handler {
	return &Handler{manager: manager}
}

// List 获取所有已加载插件列表
// @Summary 获取插件列表
// @Tags 管理端-插件
// @Router /admin/plugins [GET]
func (h *Handler) List(c *gin.Context) {
	if h.manager == nil {
		response.Success(c, []plugin.PluginInfo{}, "插件系统未初始化")
		return
	}
	response.Success(c, h.manager.List(), "获取插件列表成功")
}

// Reload 重新加载指定插件
// @Summary 重新加载插件
// @Tags 管理端-插件
// @Router /admin/plugins/:id/reload [POST]
func (h *Handler) Reload(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	if err := h.manager.ReloadByID(id); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件已重新加载")
}

// Disable 禁用指定插件
// @Summary 禁用插件
// @Tags 管理端-插件
// @Router /admin/plugins/:id/disable [POST]
func (h *Handler) Disable(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	if err := h.manager.DisableByID(id); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件已禁用")
}

// Enable 启用已禁用的插件
// @Summary 启用插件
// @Tags 管理端-插件
// @Router /admin/plugins/:id/enable [POST]
func (h *Handler) Enable(c *gin.Context) {
	id := c.Param("id")
	if h.manager == nil {
		response.Fail(c, http.StatusServiceUnavailable, "插件系统未初始化")
		return
	}

	if err := h.manager.EnableByID(id); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, nil, "插件已启用")
}
