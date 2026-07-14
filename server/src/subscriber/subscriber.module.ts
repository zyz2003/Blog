import { Module } from '@nestjs/common';
import { SubscriberController } from './subscriber.controller';
import { SubscriberService } from './subscriber.service';
import { SubscriberRepository } from './subscriber.repository';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { CaptchaModule } from '../captcha/captcha.module';

/**
 * SubscriberModule — matches Go subscriber module.
 *
 * Imports:
 * - DatabaseModule: provides DRIZZLE injection token for repository
 * - CommonModule: provides MemoryCache for verification code storage
 * - CaptchaModule: provides CaptchaService for human verification on /subscribe/code
 *
 * EmailService and SettingsService are @Global modules, no explicit import needed.
 *
 * Exports SubscriberService so ArticleService can call notifyArticlePublished in Plan 07.
 */
@Module({
  imports: [DatabaseModule, CommonModule, CaptchaModule],
  controllers: [SubscriberController],
  providers: [SubscriberService, SubscriberRepository],
  exports: [SubscriberService],
})
export class SubscriberModule {}
