/*
 * @Description: 配置导入导出 Handler
 * @Author: 安知鱼
 * @Date: 2025-10-19
 */
package config_handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/config"
	"github.com/gin-gonic/gin"
)

// ConfigImportExportHandler 处理配置导入导出相关的HTTP请求
type ConfigImportExportHandler struct {
	importExportSvc config.ImportExportService
}

// NewConfigImportExportHandler 创建一个新的配置导入导出Handler实例
func NewConfigImportExportHandler(importExportSvc config.ImportExportService) *ConfigImportExportHandler {
	return &ConfigImportExportHandler{
		importExportSvc: importExportSvc,
	}
}

// ExportConfig 导出配置数据
// @Summary      导出配置数据
// @Description  导出数据库中的所有配置项（JSON 格式）
// @Tags         配置管理
// @Produce      application/json
// @Success      200 {file} file "配置文件"
// @Failure      500 {object} response.Response "导出失败"
// @Security     BearerAuth
// @Router       /config/export [get]
func (h *ConfigImportExportHandler) ExportConfig(c *gin.Context) {
	content, err := h.importExportSvc.ExportConfig(c.Request.Context())
	if err != nil {
		log.Printf("导出配置失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "导出配置失败: "+err.Error())
		return
	}

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", "attachment; filename=anheyu-settings.json")
	c.Header("Content-Type", "application/json")
	c.Header("Content-Transfer-Encoding", "binary")
	var count int
	var ext struct {
		Settings       map[string]string   `json:"settings"`
		PaymentConfigs []json.RawMessage  `json:"payment_configs"`
	}
	if json.Unmarshal(content, &ext) == nil && ext.Settings != nil {
		count = len(ext.Settings) + len(ext.PaymentConfigs)
	} else if m := make(map[string]string); json.Unmarshal(content, &m) == nil {
		count = len(m)
	}
	c.Header("X-Exported-Keys-Count", strconv.Itoa(count))
	c.Data(http.StatusOK, "application/json", content)
}

// ImportConfig 导入配置数据
// @Summary      导入配置数据
// @Description  导入配置数据到数据库（JSON 格式）
// @Tags         配置管理
// @Accept       multipart/form-data
// @Produce      json
// @Param        file formData file true "配置文件（JSON格式）"
// @Success      200 {object} response.Response "导入成功"
// @Failure      400 {object} response.Response "参数错误"
// @Failure      500 {object} response.Response "导入失败"
// @Security     BearerAuth
// @Router       /config/import [post]
func (h *ConfigImportExportHandler) ImportConfig(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, http.StatusBadRequest, "请上传配置文件")
		return
	}

	if len(file.Filename) < 5 || file.Filename[len(file.Filename)-5:] != ".json" {
		response.Fail(c, http.StatusBadRequest, "配置文件必须是 .json 格式")
		return
	}

	const maxImportSize = 10 * 1024 * 1024
	if file.Size > maxImportSize {
		response.Fail(c, http.StatusBadRequest, "配置文件大小不能超过 10MB")
		return
	}

	fileContent, err := file.Open()
	if err != nil {
		log.Printf("读取上传文件失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "读取文件失败: "+err.Error())
		return
	}
	defer fileContent.Close()

	if err := h.importExportSvc.ImportConfig(c.Request.Context(), fileContent); err != nil {
		log.Printf("导入配置失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "导入配置失败: "+err.Error())
		return
	}

	response.Success(c, nil, "配置导入成功，已更新到数据库")
}
