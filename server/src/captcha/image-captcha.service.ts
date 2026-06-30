import { Injectable } from '@nestjs/common';
import { MemoryCache } from '../common/cache/memory-cache.util';
import { SettingsService } from '../settings/settings.service';
import * as svgCaptcha from 'svg-captcha';
import * as crypto from 'crypto';

@Injectable()
export class ImageCaptchaService {
  constructor(
    private readonly cache: MemoryCache,
    private readonly settingsService: SettingsService,
  ) {}

  generate(length: number = 4): { captchaId: string; imageBase64: string } {
    const captchaId = crypto.randomUUID();

    const svg = svgCaptcha.create({
      size: length,
      noise: 2,
      color: true,
      background: '#f5f5f5',
      width: 240,
      height: 80,
      charPreset: '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ',
    });

    const ttlStr = this.settingsService.get('image_captcha.expire');
    const ttlMs = ttlStr ? parseInt(ttlStr, 10) * 1000 : 300000; // default 5 minutes

    this.cache.set(captchaId, svg.text.toLowerCase(), ttlMs);

    const imageBase64 =
      'data:image/svg+xml;base64,' +
      Buffer.from(svg.data).toString('base64');

    return { captchaId, imageBase64 };
  }
}
