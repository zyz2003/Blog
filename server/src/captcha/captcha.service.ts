import { Injectable, BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { ImageCaptchaService } from './image-captcha.service';
import { MemoryCache } from '../common/cache/memory-cache.util';

@Injectable()
export class CaptchaService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly imageCaptchaService: ImageCaptchaService,
    private readonly cache: MemoryCache,
  ) {}

  getConfig(): { provider: string; image_captcha_length?: number } {
    const provider =
      this.settingsService.get('captcha.provider') || 'none';

    if (provider === 'image') {
      const lengthStr =
        this.settingsService.get('captcha.image_captcha_length');
      const imageCaptchaLength = lengthStr
        ? parseInt(lengthStr, 10)
        : 4;
      return { provider, image_captcha_length: imageCaptchaLength };
    }

    return { provider };
  }

  generateImage(): { captcha_id: string; image_base64: string } {
    const lengthStr =
      this.settingsService.get('captcha.image_captcha_length');
    const length = lengthStr ? parseInt(lengthStr, 10) : 4;

    const result = this.imageCaptchaService.generate(length);
    return {
      captcha_id: result.captchaId,
      image_base64: result.imageBase64,
    };
  }

  verify(captchaParams: {
    image_captcha_id?: string;
    image_captcha_answer?: string;
  }): boolean {
    const provider =
      this.settingsService.get('captcha.provider') || 'none';

    if (provider === 'none') {
      return true;
    }

    if (provider === 'image') {
      if (!captchaParams.image_captcha_id || !captchaParams.image_captcha_answer) {
        throw new BadRequestException('验证码参数缺失');
      }

      const cachedAnswer = this.cache.get<string>(captchaParams.image_captcha_id);
      this.cache.delete(captchaParams.image_captcha_id);

      if (!cachedAnswer) {
        throw new BadRequestException('验证码已过期');
      }

      if (cachedAnswer !== captchaParams.image_captcha_answer.toLowerCase()) {
        throw new BadRequestException('验证码错误');
      }

      return true;
    }

    // Turnstile/Geetest deferred per D-34
    return true;
  }
}
