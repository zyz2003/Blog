import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PublicPageController } from '../../src/page/public-page.controller';
import { PageService } from '../../src/page/page.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';

describe('PublicPageController', () => {
  let controller: PublicPageController;
  let reflector: Reflector;
  let service: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicPageController],
      providers: [
        {
          provide: PageService,
          useValue: {
            getByPath: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PublicPageController);
    reflector = module.get(Reflector);
    service = module.get(PageService);
  });

  // ─── @Public() Decorator ──────────────────────────────────────────

  describe('public access', () => {
    it('PublicPageController class has @Public() decorator', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, PublicPageController);
      expect(isPublic).toBe(true);
    });

    it('getByPath is public via class decorator', () => {
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        controller.getByPath,
        PublicPageController,
      ]);
      expect(isPublic).toBe(true);
    });
  });

  // ─── getByPath ────────────────────────────────────────────────────

  describe('getByPath', () => {
    it('prepends / to path param', async () => {
      const mockPage = { path: '/privacy', is_published: true };
      service.getByPath.mockResolvedValue(mockPage);

      await controller.getByPath('privacy');

      expect(service.getByPath).toHaveBeenCalledWith('/privacy');
    });

    it('does not double-prepend / if path already has it', async () => {
      const mockPage = { path: '/privacy', is_published: true };
      service.getByPath.mockResolvedValue(mockPage);

      await controller.getByPath('/privacy');

      expect(service.getByPath).toHaveBeenCalledWith('/privacy');
    });

    it('returns published page', async () => {
      const mockPage = { path: '/privacy', is_published: true };
      service.getByPath.mockResolvedValue(mockPage);

      const result = await controller.getByPath('privacy');

      expect(result).toEqual(mockPage);
    });

    it('throws NotFoundException for unpublished page', async () => {
      const mockPage = { path: '/draft', is_published: false };
      service.getByPath.mockResolvedValue(mockPage);

      await expect(controller.getByPath('draft')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException with correct message for unpublished page', async () => {
      const mockPage = { path: '/draft', is_published: false };
      service.getByPath.mockResolvedValue(mockPage);

      try {
        await controller.getByPath('draft');
      } catch (e: any) {
        expect(e.message).toBe('页面不存在');
      }
    });

    it('propagates NotFoundException from service when page not found', async () => {
      service.getByPath.mockRejectedValue(new NotFoundException('页面不存在'));

      await expect(controller.getByPath('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('handles multi-level paths like docs/guide', async () => {
      const mockPage = { path: '/docs/guide', is_published: true };
      service.getByPath.mockResolvedValue(mockPage);

      await controller.getByPath('docs/guide');

      expect(service.getByPath).toHaveBeenCalledWith('/docs/guide');
    });
  });
});
