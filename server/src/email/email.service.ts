import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  verificationEmailTemplate,
  articlePushEmailTemplate,
  commentReplyEmailTemplate,
  commentAdminEmailTemplate,
} from './email.templates';
import * as nodemailer from 'nodemailer';

/**
 * EmailService provides SMTP email sending capabilities.
 * Per D-206: uses nodemailer + SMTP, reads config from SettingsService,
 * silently skips when SMTP is not configured.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Lazy-init nodemailer transporter.
   * Reads SMTP config from SettingsService using Go backend setting keys.
   * Returns null if SMTP not configured.
   * Caches the transporter for reuse (WR-01: cache invalidated on config change is
   * deferred since SettingsService has no change notification — restart picks up changes).
   */
  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    // CR-01 fix: Use Go backend setting keys (SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD)
    const host = this.settingsService.get('SMTP_HOST');
    const port = this.settingsService.get('SMTP_PORT');
    const user = this.settingsService.get('SMTP_USERNAME');
    const pass = this.settingsService.get('SMTP_PASSWORD');

    // If any required field is missing, SMTP is not configured
    if (!host || !port || !user || !pass) {
      return null;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        auth: { user, pass },
        secure: port === '465',
      });
      return this.transporter;
    } catch (error) {
      this.logger.error(`Failed to create SMTP transporter: ${error}`);
      return null;
    }
  }

  /** Read common email config: appName and smtpFrom */
  private getEmailConfig(): { appName: string; smtpFrom: string } {
    const appName =
      this.settingsService.get('APP_NAME') || 'Anheyu Blog';
    const smtpFrom =
      this.settingsService.get('SMTP_SENDER_EMAIL') ||
      this.settingsService.get('SMTP_USERNAME');
    return { appName, smtpFrom };
  }

  /**
   * Send verification code email for subscriber verification.
   * Per D-206: silently skips when SMTP is not configured.
   * WR-03 fix: Returns boolean indicating success (Go backend returns errors to caller).
   */
  async sendVerificationEmail(email: string, code: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    const { appName, smtpFrom } = this.getEmailConfig();

    try {
      await transporter.sendMail({
        from: `"${appName}" <${smtpFrom}>`,
        to: email,
        subject: `${appName} - 邮箱验证码: ${code}`,
        html: verificationEmailTemplate({
          appName,
          code,
          expiryMinutes: 5,
        }),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Send article push notification email to subscriber.
   * Per D-206: silently skips when SMTP is not configured.
   */
  async sendArticlePushEmail(
    email: string,
    articleTitle: string,
    articleUrl: string,
    unsubscribeUrl: string,
  ): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    const { appName, smtpFrom } = this.getEmailConfig();

    try {
      await transporter.sendMail({
        from: `"${appName}" <${smtpFrom}>`,
        to: email,
        subject: `${appName} - 新文章发布: ${articleTitle}`,
        html: articlePushEmailTemplate({
          appName,
          articleTitle,
          articleUrl,
          unsubscribeUrl,
        }),
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send article push email to ${email}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Send comment notification email.
   * Matches Go SendCommentNotification (email_service.go lines 173-370).
   *
   * Two scenarios matching Go:
   * 1. Notify admin of new comment (when not admin's own comment)
   * 2. Notify parent commenter of reply (when parent exists with email)
   *
   * Per Go: checks notify settings, avoids self-notification, avoids duplicate admin notification.
   */
  async sendCommentNotification(newComment: any, parentComment: any | null): Promise<boolean> {
    const siteName = this.settingsService.get('APP_NAME') || 'Anheyu Blog';
    let siteUrl = this.settingsService.get('SITE_URL') || 'https://anheyu.com';
    // Sanitize siteURL matching Go
    if (!siteUrl || siteUrl === 'https://' || siteUrl === 'http://') {
      siteUrl = 'https://anheyu.com';
    }
    siteUrl = siteUrl.replace(/\/+$/, '');

    const pageUrl = siteUrl + (newComment.targetPath || '');
    const targetTitle = newComment.targetTitle || '一个页面';

    const newCommenterEmail = newComment.email || '';
    const newCommenterNick = newComment.nickname || '匿名';

    // --- Scenario 1: Notify admin of new comment ---
    const adminEmail = this.settingsService.get('front_desk.site_owner_email') || '';
    const bloggerEmail = this.settingsService.get('comment_blogger_email') || '';
    const primaryAdminEmail = bloggerEmail || adminEmail;

    const notifyAdmin = this.settingsService.get('comment_notify_admin') === 'true';
    const pushChannel = this.settingsService.get('pushoo_channel') || '';
    const scMailNotify = this.settingsService.get('sc_mail_notify') === 'true';

    // Email notification logic matching Go:
    // 1. If no instant notification configured, send email
    // 2. If instant notification configured but dual notification enabled, send email
    // 3. If instant notification configured but dual notification disabled, skip email
    const shouldSendEmail = notifyAdmin && (!pushChannel || scMailNotify);

    const isAdminEmail = (email: string): boolean => {
      if (!email) return false;
      if (bloggerEmail && email.toLowerCase() === bloggerEmail.toLowerCase()) return true;
      if (adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) return true;
      return false;
    };

    // Check if new comment is from admin
    let isAdminComment = newComment.isAdminComment || false;
    if (!isAdminComment && newCommenterEmail) {
      isAdminComment = isAdminEmail(newCommenterEmail);
    }

    if (primaryAdminEmail && shouldSendEmail && !isAdminComment) {
      try {
        const subject = `${siteName} - 新评论: ${targetTitle}`;
        const html = commentAdminEmailTemplate({
          appName: siteName,
          siteUrl,
          pageUrl,
          targetTitle,
          commenterNick: newCommenterNick,
          commentContent: newComment.content || '',
        });
        // Fire-and-forget matching Go: go func() { _ = s.send(...) }()
        this.sendMail(primaryAdminEmail, subject, html);
      } catch (error) {
        this.logger.error(`Failed to send admin comment notification: ${error}`);
      }
    }

    // --- Scenario 2: Notify parent commenter of reply ---
    const notifyReply = this.settingsService.get('comment_notify_reply') === 'true';
    const shouldSendReplyEmail = notifyReply && (!pushChannel || scMailNotify);

    if (shouldSendReplyEmail && parentComment && parentComment.email) {
      const parentEmail = parentComment.email;

      // Skip self-reply
      if (newCommenterEmail && newCommenterEmail.toLowerCase() === parentEmail.toLowerCase()) {
        return true;
      }

      // Skip if parent is admin and already got admin notification
      if (isAdminEmail(parentEmail) && shouldSendEmail && !isAdminComment) {
        return true;
      }

      try {
        const subject = `${siteName} - 新回复通知: ${targetTitle}`;
        const html = commentReplyEmailTemplate({
          appName: siteName,
          siteUrl,
          pageUrl,
          targetTitle,
          parentNick: parentComment.nickname || '评论者',
          replyNick: newCommenterNick,
          replyContent: newComment.content || '',
        });
        // Fire-and-forget matching Go
        this.sendMail(parentEmail, subject, html);
      } catch (error) {
        this.logger.error(`Failed to send reply comment notification: ${error}`);
      }
    }

    return true;
  }

  /**
   * Generic send method for future use.
   * Same SMTP config and silent-skip logic.
   */
  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    const { appName, smtpFrom } = this.getEmailConfig();

    try {
      await transporter.sendMail({
        from: `"${appName}" <${smtpFrom}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
      return false;
    }
  }
}
