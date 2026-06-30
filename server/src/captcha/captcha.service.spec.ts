import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaptchaService } from './captcha.service';
import { ImageCaptchaService } from './image-captcha.service';
import { MemoryCache } from '../common/cache/memory-cache.util';
import { BadRequestException } from '@nestjs/common';

vi.mock('svg-captcha', () => ({
  create: vi.fn().mockReturnValue({
    data: '<svg>test</svg>',
    text: 'Ab2C',
  }),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return { ...actual, randomUUID: () => 'test-uuid-1234' };
});

describe('CaptchaService', () => {
  let service: CaptchaService;
  let cache: MemoryCache;
  let mockSettingsService: any;
  let imageCaptchaService: ImageCaptchaService;

  beforeEach(() => {
    cache = new MemoryCache();
    mockSettingsService = { get: vi.fn().mockReturnValue('none') };
    imageCaptchaService = new ImageCaptchaService(cache, mockSettingsService);
    service = new CaptchaService(mockSettingsService, imageCaptchaService, cache);
  });

  describe('getCaptchaConfig', () => {
    it('Test 1: returns { provider: "none" } when captcha.provider is "none"', () => {
      mockSettingsService.get.mockReturnValue('none');
      expect(service.getConfig()).toEqual({ provider: 'none' });
    });

    it('Test 2: returns { provider: "image", image_captcha_length: 4 } when setting is "image"', () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'captcha.provider') return 'image';
        if (key === 'captcha.image_captcha_length') return '4';
        return undefined;
      });
      expect(service.getConfig()).toEqual({ provider: 'image', image_captcha_length: 4 });
    });
  });

  describe('generateImageCaptcha', () => {
    it('Test 3: returns { captcha_id, image_base64 }', () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'captcha.image_captcha_length') return '4';
        if (key === 'image_captcha.expire') return '300';
        return undefined;
      });
      const result = service.generateImage();
      expect(result.captcha_id).toBe('test-uuid-1234');
      expect(result.image_base64).toContain('data:image/svg+xml;base64,');
    });

    it('Test 4: answer stored in cache with TTL', () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'captcha.image_captcha_length') return '4';
        if (key === 'image_captcha.expire') return '300';
        return undefined;
      });
      service.generateImage();
      expect(cache.get('test-uuid-1234')).toBe('ab2c');
    });
  });

  describe('verify', () => {
    it('Test 5: verify succeeds case-insensitively and deletes cache', () => {
      mockSettingsService.get.mockReturnValue('image');
      cache.set('captcha-1', 'ab2c', 300000);
      expect(service.verify({ image_captcha_id: 'captcha-1', image_captcha_answer: 'Ab2C' })).toBe(true);
      expect(cache.get('captcha-1')).toBeUndefined();
    });

    it('Test 6: verify with wrong answer returns false and deletes cache', () => {
      mockSettingsService.get.mockReturnValue('image');
      cache.set('captcha-2', 'xyz', 300000);
      expect(() => service.verify({ image_captcha_id: 'captcha-2', image_captcha_answer: 'wrong' })).toThrow(BadRequestException);
      expect(cache.get('captcha-2')).toBeUndefined();
    });

    it('Test 7: verify with expired/missing captcha_id returns false', () => {
      mockSettingsService.get.mockReturnValue('image');
      expect(() => service.verify({ image_captcha_id: 'missing', image_captcha_answer: 'any' })).toThrow(BadRequestException);
    });

    it('Test 8: verify skips when provider is "none"', () => {
      mockSettingsService.get.mockReturnValue('none');
      expect(service.verify({})).toBe(true);
    });
  });
});

import { CaptchaController } from './captcha.controller';

describe('CaptchaController', () => {
  let controller: CaptchaController;
  let mockService: any;

  beforeEach(() => {
    mockService = { getConfig: vi.fn().mockReturnValue({ provider: 'none' }), generateImage: vi.fn() };
    controller = new CaptchaController(mockService);
  });

  it('getConfig calls service', () => {
    controller.getConfig();
    expect(mockService.getConfig).toHaveBeenCalled();
  });

  it('generateImage calls service', () => {
    controller.generateImage();
    expect(mockService.generateImage).toHaveBeenCalled();
  });
});
