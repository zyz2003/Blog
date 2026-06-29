/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-12 10:23:55
 * @LastEditTime: 2025-08-19 13:07:59
 * @LastEditors: 安知鱼
 */
// internal/app/task/job_comment_notification.go
package task

import (
	"context"
	"fmt"
	"log"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

// CommentNotificationJob 负责发送评论通知邮件。
type CommentNotificationJob struct {
	emailSvc     utility.EmailService
	commentRepo  repository.CommentRepository
	newCommentID uint
}

// NewCommentNotificationJob 是任务的构造函数
func NewCommentNotificationJob(
	emailSvc utility.EmailService,
	commentRepo repository.CommentRepository,
	newCommentID uint,
) *CommentNotificationJob {
	return &CommentNotificationJob{
		emailSvc:     emailSvc,
		commentRepo:  commentRepo,
		newCommentID: newCommentID,
	}
}

// Run 方法执行发送邮件的逻辑。
func (j *CommentNotificationJob) Run() {
	ctx := context.Background()

	// 1. 获取新评论的完整信息
	newComment, err := j.commentRepo.FindByID(ctx, j.newCommentID)
	if err != nil {
		log.Printf("错误: 任务 '%s' 获取新评论失败: %v", j.Name(), err)
		return
	}

	// 2. 如果是回复，获取父评论信息
	var parentComment *model.Comment
	if newComment.ParentID != nil {
		parentComment, err = j.commentRepo.FindByID(ctx, *newComment.ParentID)
		if err != nil {
			log.Printf("警告: 任务 '%s' 获取父评论失败: %v", j.Name(), err)
		}
	}

	// 3. 调用邮件服务，传递已有的通用元信息
	j.emailSvc.SendCommentNotification(newComment, parentComment)
}

// Name 方法返回任务的可读名称。
func (j *CommentNotificationJob) Name() string {
	return fmt.Sprintf("CommentNotificationJob(CommentID: %d)", j.newCommentID)
}
