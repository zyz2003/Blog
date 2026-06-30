import { Controller, Get } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('public/captcha')
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  @Public()
  @Get('config')
  getConfig() {
    return this.captchaService.getConfig();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('image')
  generateImage() {
    return this.captchaService.generateImage();
  }
}
