/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-02 00:00:25
 * @LastEditTime: 2025-07-12 15:19:39
 * @LastEditors: 安知鱼
 */
// internal/app/handler/file/handler.go
package file

import (
	file_service "github.com/anzhiyu-c/anheyu-app/pkg/service/file"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// Handler 负责处理所有与文件相关的HTTP请求
type FileHandler struct {
	fileSvc    file_service.FileService
	uploadSvc  file_service.IUploadService
	settingSvc setting.SettingService
}

// NewHandler 是 FileHandler 的构造函数
func NewHandler(
	fileSvc file_service.FileService,
	uploadSvc file_service.IUploadService,
	settingSvc setting.SettingService,
) *FileHandler {
	return &FileHandler{
		fileSvc:    fileSvc,
		uploadSvc:  uploadSvc,
		settingSvc: settingSvc,
	}
}
