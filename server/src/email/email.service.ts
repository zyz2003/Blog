import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
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
   * Reads SMTP config from SettingsService. Returns null if SMTP not configured.
   * Caches the transporter for reuse.
   */
  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.settingsService.get('smtp.host');
    const port = this.settingsService.get('smtp.port');
    const user = this.settingsService.get('smtp.user');
    const pass = this.settingsService.get('smtp.pass');

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

  /**
   * Send verification code email for subscriber verification.
   * Per D-206: silently skips when SMTP is not configured.
   */
  async sendVerificationEmail(email: string, code: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return;
    }

    const appName =
      this.settingsService.get('APP_NAME') || 'Anheyu Blog';
    const smtpFrom =
      this.settingsService.get('smtp.from') ||
      this.settingsService.get('smtp.user');

    try {
      await transporter.sendMail({
        from: `"${appName}" <${smtpFrom}>`,
        to: email,
        subject: `${appName} - 邮箱验证码`,
        html: verificationEmailTemplate({
          appName,
          code,
          expiryMinutes: 5,
        }),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${error}`,
      );
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
  ): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return;
    }

    const appName =
      this.settingsService.get('APP_NAME') || 'Anheyu Blog';
    const smtpFrom =
      this.settingsService.get('smtp.from') ||
      this.settingsService.get('smtp.user');

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
    } catch (error) {
      this.logger.error(
        `Failed to send article push email to ${email}: ${error}`,
      );
    }
  }

  /**
   * Generic send method for future use.
   * Same SMTP config and silent-skip logic.
   */
  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return;
    }

    const appName =
      this.settingsService.get('APP_NAME') || 'Anheyu Blog';
    const smtpFrom =
      this.settingsService.get('smtp.from') ||
      this.settingsService.get('smtp.user');

    try {
      await transporter.sendMail({
        from: `"${appName}" <${smtpFrom}>`,
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
    }
  }
}

// Inline import for templates to keep email.service.ts self-contained
import {
  verificationEmailTemplate,
  articlePushEmailTemplate,
} from './email.templates';
