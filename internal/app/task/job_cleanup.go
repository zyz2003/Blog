/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-10 15:23:10
 * @LastEditTime: 2025-07-11 12:29:31
 * @LastEditors: 安知鱼
 */
// internal/app/task/job_cleanup.go
package task

import (
	"context"
	"log"

	"github.com/anzhiyu-c/anheyu-app/pkg/service/file"
)

// CleanupAbandonedUploadsJob 负责清理被遗弃的上传任务
type CleanupAbandonedUploadsJob struct {
	uploadSvc file.IUploadService
}

// NewCleanupAbandonedUploadsJob 是任务的构造函数
func NewCleanupAbandonedUploadsJob(uploadSvc file.IUploadService) *CleanupAbandonedUploadsJob {
	return &CleanupAbandonedUploadsJob{
		uploadSvc: uploadSvc,
	}
}

// Run 是 Job 接口要求实现的方法
func (j *CleanupAbandonedUploadsJob) Run() {
	cleanedCount, err := j.uploadSvc.CleanupAbandonedUploads(context.Background())
	if err != nil {
		// 日志由 wrapper 统一处理，这里可以只处理错误本身
		log.Printf("任务 '%s' 在执行业务逻辑时捕获到错误: %v", j.Name(), err)
	} else {
		log.Printf("任务 '%s' 业务逻辑执行完毕，共清理了 %d 条记录。", j.Name(), cleanedCount)
	}
}

// Name 方法让日志包装器可以打印出更有意义的任务名
func (j *CleanupAbandonedUploadsJob) Name() string {
	return "CleanupAbandonedUploadsJob"
}
