import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscriberService } from './subscriber.service';
import { CaptchaService } from '../captcha/captcha.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { Public } from '../common/decorators/public.decorator';

/**
 * SubscriberController — matches Go SubscriberHandler.
 * Reference: pkg/handler/subscriber/handler.go
 *
 * All endpoints are @Public() (no auth required).
 * Per D-208: subscribe and send-code endpoints have rate limiting (3/60s).
 * Response format is wrapped by global ResponseInterceptor as { code, data, message }.
 * CR-02 fix: Return { data: null, message } with Chinese success messages matching Go backend.
 */
@Controller('public')
@Public()
export class SubscriberController {
  constructor(
    private readonly subscriberService: SubscriberService,
    private readonly captchaService: CaptchaService,
  ) {}

  /**
   * POST /api/public/subscribe
   * Per D-208: Rate limited @Throttle(3/60s).
   * Accepts { email, code }, verifies code, creates/reactivates subscriber.
   */
  @Post('subscribe')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async subscribe(@Body() dto: SubscribeDto) {
    await this.subscriberService.subscribe(dto.email, dto.code);
    return { data: null, message: '订阅成功！您将在新文章发布时收到邮件通知' };
  }

  /**
   * POST /api/public/subscribe/code
   * Per D-208: Rate limited @Throttle(3/60s).
   * Per D-207: CaptchaService verification before sending code.
   * Accepts { email, captcha params }, verifies captcha, sends verification code.
   */
  @Post('subscribe/code')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    // CaptchaService verification — throws BadRequestException on failure
    this.captchaService.verify({
      image_captcha_id: dto.image_captcha_id,
      image_captcha_answer: dto.image_captcha_answer,
    });

    await this.subscriberService.sendVerificationCode(dto.email);
    return { data: null, message: '验证码已发送，请查收邮件' };
  }

  /**
   * POST /api/public/unsubscribe
   * Accepts { email }, deactivates subscriber.
   */
  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.subscriberService.unsubscribe(dto.email);
    return { data: null, message: '退订成功' };
  }

  /**
   * GET /api/public/unsubscribe/:token
   * Accepts token from URL path, deactivates subscriber.
   * WR-03 fix: Validate empty token (Go backend returns 400).
   */
  @Get('unsubscribe/:token')
  async unsubscribeByToken(@Param('token') token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('令牌不能为空');
    }
    await this.subscriberService.unsubscribeByToken(token);
    return { data: null, message: '退订成功' };
  }
}
