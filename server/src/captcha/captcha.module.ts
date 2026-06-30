import { Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { ImageCaptchaService } from './image-captcha.service';
import { CaptchaController } from './captcha.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [CaptchaService, ImageCaptchaService],
  controllers: [CaptchaController],
  exports: [CaptchaService],
})
export class CaptchaModule {}
