import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SubscriberRepository } from './subscriber.repository';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { MemoryCache } from '../common/cache/memory-cache.util';
import { ErrorCodes } from '../common/constants/error-codes';
import * as crypto from 'crypto';

/**
 * SubscriberService — matches Go pkg/service/subscriber/service.go
 *
 * Per D-205: Verification codes stored in MemoryCache with 5-minute TTL.
 * Per D-207: CaptchaService verification handled in controller.
 * Per D-208: Full Go backend endpoint replication with reactivation logic.
 */
@Injectable()
export class SubscriberService {
  private readonly logger = new Logger(SubscriberService.name);

  constructor(
    private readonly repo: SubscriberRepository,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
    private readonly cache: MemoryCache,
  ) {}

  /**
   * Subscribe an email with verification code validation.
   * Per D-208: Full Go Subscribe logic.
   *
   * 1. Verify code from MemoryCache (one-time use, delete after verification)
   * 2. If subscriber not found: create new with isActive=true
   * 3. If found and isActive=true: throw ConflictException
   * 4. If found and isActive=false: reactivate by setting isActive=true
   */
  async subscribe(email: string, code: string): Promise<void> {
    // Step 1: Verify code from MemoryCache
    const cacheKey = `subscribe:code:${email}`;
    const cachedCode = this.cache.get<string>(cacheKey);

    if (!cachedCode) {
      throw new BadRequestException(ErrorCodes.SUBSCRIBER_CODE_EXPIRED);
    }

    if (cachedCode !== code) {
      throw new BadRequestException(ErrorCodes.SUBSCRIBER_CODE_INVALID);
    }

    // Delete code after successful verification (one-time use)
    // WR-05 fix: Delete code AFTER DB operations succeed to prevent code loss on DB failure

    // Step 2: Check if subscriber already exists
    const existing = await this.repo.findByEmail(email);

    if (!existing) {
      // Create new subscriber with generated token
      const token = this.generateToken();
      await this.repo.create({ email, isActive: true, token });
      this.cache.delete(cacheKey);
      return;
    }

    if (existing.isActive) {
      // Already subscribed — still delete code to prevent reuse
      this.cache.delete(cacheKey);
      throw new ConflictException(ErrorCodes.SUBSCRIBER_ALREADY_SUBSCRIBED);
    }

    // Reactivate inactive subscriber
    await this.repo.updateIsActive(existing.id, true);
    this.cache.delete(cacheKey);
  }

  /**
   * Unsubscribe by email address.
   * Per Go Unsubscribe: find by email, set isActive=false.
   */
  async unsubscribe(email: string): Promise<void> {
    const subscriber = await this.repo.findByEmail(email);

    if (!subscriber) {
      throw new NotFoundException(ErrorCodes.SUBSCRIBER_NOT_FOUND);
    }

    await this.repo.updateIsActive(subscriber.id, false);
  }

  /**
   * Unsubscribe by token (from email link).
   * Per Go UnsubscribeByToken: find by token, set isActive=false.
   */
  async unsubscribeByToken(token: string): Promise<void> {
    const subscriber = await this.repo.findByToken(token);

    if (!subscriber) {
      throw new NotFoundException(ErrorCodes.SUBSCRIBER_TOKEN_INVALID);
    }

    await this.repo.updateIsActive(subscriber.id, false);
  }

  /**
   * Send verification code to email.
   * Per D-205 and D-207: CaptchaService verification is handled in the controller.
   *
   * 1. Generate 6-digit code (matches Go's crypto/rand + BigEndian algorithm)
   * 2. Store in MemoryCache with 5-minute TTL
   * 3. Send verification email (silently skips if SMTP not configured)
   */
  async sendVerificationCode(email: string): Promise<void> {
    const code = this.generateVerificationCode();

    // Store in MemoryCache with 5-minute TTL per D-205
    const cacheKey = `subscribe:code:${email}`;
    this.cache.set(cacheKey, code, 300000); // 5 minutes = 300000ms

    // Send verification email (silently skips if SMTP not configured)
    await this.emailService.sendVerificationEmail(email, code);
  }

  /**
   * Notify all active subscribers about a new article.
   * Per Go NotifyArticlePublished: fire-and-forget (goroutine in Go).
   *
   * WR-04 fix: Use fire-and-forget pattern matching Go's goroutine —
   * each email is sent asynchronously without blocking the caller.
   * - Get active subscribers
   * - For each subscriber, send email asynchronously with 100ms delay
   * - Wrap each email send in try-catch, log failures but continue
   * - If SMTP not configured, silently skip (EmailService handles this)
   */
  notifyArticlePublished(article: {
    title: string;
    url: string;
  }): void {
    // Fire-and-forget: do not await — matches Go goroutine behavior
    (async () => {
      try {
        const activeSubscribers = await this.repo.findActiveSubscribers();

        if (activeSubscribers.length === 0) {
          return;
        }

        const siteURL =
          this.settingsService.get('SITE_URL') || 'https://blog.anheyu.com';

        for (const subscriber of activeSubscribers) {
          // Send each email in try-catch, don't await to avoid blocking
          this.emailService.sendArticlePushEmail(
            subscriber.email,
            article.title,
            article.url,
            `${siteURL}/api/public/unsubscribe/${subscriber.token}`,
          ).catch((error) => {
            this.logger.error(
              `Failed to send article push email to ${subscriber.email}: ${error}`,
            );
          });

          // 100ms delay between emails to prevent SMTP rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        this.logger.error(`Failed to notify subscribers: ${error}`);
      }
    })();
  }

  /**
   * Generate a 64-char hex token for unsubscribe links.
   * Per Go generateToken: crypto.randomBytes(32).toString('hex')
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a 6-digit verification code.
   * Per Go SendVerificationCode: crypto/rand → 4 bytes → BigEndian Uint32 % 1000000 → zero-pad to 6 digits
   */
  private generateVerificationCode(): string {
    const buf = crypto.randomBytes(4);
    const code = buf.readUInt32BE(0) % 1000000;
    return code.toString().padStart(6, '0');
  }
}
