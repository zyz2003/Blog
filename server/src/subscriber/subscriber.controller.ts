import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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
 */
@Controller('api/public')
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
   * Returns null (data: null) on success.
   */
  @Post('subscribe')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async subscribe(@Body() dto: SubscribeDto) {
    await this.subscriberService.subscribe(dto.email, dto.code);
    return null;
  }

  /**
   * POST /api/public/subscribe/code
   * Per D-208: Rate limited @Throttle(3/60s).
   * Per D-207: CaptchaService verification before sending code.
   * Accepts { email, captcha params }, verifies captcha, sends verification code.
   * Returns null (data: null) on success.
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
    return null;
  }

  /**
   * POST /api/public/unsubscribe
   * Accepts { email }, deactivates subscriber.
   * Returns null (data: null) on success.
   */
  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.subscriberService.unsubscribe(dto.email);
    return null;
  }

  /**
   * GET /api/public/unsubscribe/:token
   * Accepts token from URL path, deactivates subscriber.
   * Returns null (data: null) on success.
   */
  @Get('unsubscribe/:token')
  async unsubscribeByToken(@Param('token') token: string) {
    await this.subscriberService.unsubscribeByToken(token);
    return null;
  }
}
