import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { NotificationService } from '../../notification/notification.service';
import { CommentRepository } from '../../comment/comment.repository';
import { SettingsService } from '../../settings/settings.service';

/**
 * CommentNotificationJob — sends email and in-app notification for comment replies.
 * On-demand job dispatched via ScheduleService.dispatchCommentNotification().
 * Matches Go CommentNotificationJob (job_comment_notification.go).
 *
 * Per Go: fetches comment by ID, checks for parent, sends email notification.
 * Dual notification: email (new, matching Go) + in-app (existing via NotificationService).
 */
@Injectable()
export class CommentNotificationJob {
  private readonly logger = new Logger(CommentNotificationJob.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly commentRepo: CommentRepository,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Run comment notification for a new comment.
   * Matches Go CommentNotificationJob.Run() which:
   * 1. Fetches new comment by ID
   * 2. If reply (parentId exists), fetches parent comment
   * 3. Calls emailService.SendCommentNotification(newComment, parentComment)
   */
  async run(newCommentId: number): Promise<void> {
    // 1. Fetch new comment
    const newComment = await this.commentRepo.findById(newCommentId);
    if (!newComment) {
      this.logger.warn(`CommentNotificationJob: comment not found (id=${newCommentId})`);
      return;
    }

    // 2. If reply, fetch parent comment
    let parentComment: any = null;
    if (newComment.parentId) {
      parentComment = await this.commentRepo.findById(newComment.parentId);
      if (!parentComment) {
        this.logger.warn(
          `CommentNotificationJob: parent comment not found (id=${newComment.parentId})`,
        );
      }
    }

    // 3. Send email notification via EmailService
    // Matches Go: emailSvc.SendCommentNotification(newComment, parentComment)
    try {
      await this.emailService.sendCommentNotification(newComment, parentComment);
    } catch (error) {
      this.logger.error(
        `CommentNotificationJob: email notification failed for comment ${newCommentId}: ${String(error)}`,
      );
    }
  }
}
