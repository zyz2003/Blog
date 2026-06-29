/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-10 15:24:00
 * @LastEditTime: 2025-07-31 10:03:29
 * @LastEditors: 安知鱼
 */
// internal/app/task/job_thumbnail.go
package task

import (
	"context"
	"fmt"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/service/thumbnail"
)

// ThumbnailGenerationJob 负责执行单个文件的缩略图生成
type ThumbnailGenerationJob struct {
	thumbnailService *thumbnail.ThumbnailService
	fileID           uint
}

// NewThumbnailGenerationJob 是任务的构造函数
func NewThumbnailGenerationJob(thumbnailService *thumbnail.ThumbnailService, fileID uint) *ThumbnailGenerationJob {
	return &ThumbnailGenerationJob{
		thumbnailService: thumbnailService,
		fileID:           fileID,
	}
}

// Run 是 Job 接口要求实现的方法
func (j *ThumbnailGenerationJob) Run() {
	// 创建一个带超时的 context，例如 5 分钟
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel() // 确保资源被释放

	// 使用带超时的 ctx 调用 ThumbnailService
	j.thumbnailService.Generate(ctx, j.fileID)
}

// Name 方法让日志包装器可以打印出更有意义的任务名
func (j *ThumbnailGenerationJob) Name() string {
	return fmt.Sprintf("ThumbnailGenerationJob(FileID: %d)", j.fileID)
}
