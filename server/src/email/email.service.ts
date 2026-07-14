import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  verificationEmailTemplate,
  articlePushEmailTemplate,
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
