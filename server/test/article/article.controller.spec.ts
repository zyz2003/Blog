import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ArticleController } from '../../src/article/article.controller';
import { PublicArticleController } from '../../src/article/public-article.controller';
import { ArticleService } from '../../src/article/article.service';
import { StoragePolicyService } from '../../src/storage-policy/storage-policy.service';
import { ThumbnailService } from '../../src/thumbnail/thumbnail.service';
import { DRIZZLE } from '../../src/database/database.module';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';

describe('ArticleController', () => {
  let controller: ArticleController;
  let publicController: PublicArticleController;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ArticleController, PublicArticleController],
      providers: [
        { provide: ArticleService, useValue: {
          create: vi.fn(),
          list: vi.fn(),
          get: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          listPublic: vi.fn(),
          listHome: vi.fn(),
          getRandom: vi.fn(),
          listArchives: vi.fn(),
          getArticleStatistics: vi.fn(),
          getByURL: vi.fn(),
          getPublic: vi.fn(),
        }},
        { provide: StoragePolicyService, useValue: {
          findByFlag: vi.fn(),
        }},
        { provide: ThumbnailService, useValue: {
          generateThumbnail: vi.fn(),
        }},
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    controller = module.get(ArticleController);
    publicController = module.get(PublicArticleController);
    reflector = module.get(Reflector);
  });

  // ─── Route Registration ───────────────────────────────────────────

  describe('route registration', () => {
    it('ArticleController is defined', () => {
      expect(controller).toBeDefined();
    });

    it('PublicArticleController is defined', () => {
      expect(publicController).toBeDefined();
    });
  });

  // ─── Auth Guard on Admin Endpoints ────────────────────────────────

  describe('admin endpoints require auth', () => {
    it('POST /articles is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.create);
      expect(isPublic).toBeFalsy();
    });

    it('GET /articles is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.list);
      expect(isPublic).toBeFalsy();
    });

    it('GET /articles/:id is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.get);
      expect(isPublic).toBeFalsy();
    });

    it('PUT /articles/:id is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.update);
      expect(isPublic).toBeFalsy();
    });

    it('DELETE /articles/:id is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.delete);
      expect(isPublic).toBeFalsy();
    });
  });

  // ─── Public Endpoints ─────────────────────────────────────────────

  describe('public endpoints are accessible without auth', () => {
    it('PublicArticleController class has @Public() decorator', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, PublicArticleController);
      expect(isPublic).toBe(true);
    });

    it('GET /public/articles is public via class decorator', () => {
      // @Public() is on the class, so individual method reflector.get returns undefined
      // The guard uses getAllAndOverride which checks class + method
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        publicController.listPublic,
        PublicArticleController,
      ]);
      expect(isPublic).toBe(true);
    });

    it('GET /public/articles/home is public via class decorator', () => {
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        publicController.listHome,
        PublicArticleController,
      ]);
      expect(isPublic).toBe(true);
    });

    it('GET /public/articles/random is public via class decorator', () => {
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        publicController.getRandom,
        PublicArticleController,
      ]);
      expect(isPublic).toBe(true);
    });

    it('GET /public/articles/archives is public via class decorator', () => {
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        publicController.listArchives,
        PublicArticleController,
      ]);
      expect(isPublic).toBe(true);
    });

    it('GET /public/articles/statistics is public via class decorator', () => {
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        publicController.getArticleStatistics,
        PublicArticleController,
      ]);
      expect(isPublic).toBe(true);
    });

    it('GET /public/articles/:id is public via class decorator', () => {
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        publicController.getPublic,
        PublicArticleController,
      ]);
      expect(isPublic).toBe(true);
    });
  });

  // ─── Controller Method Behavior ───────────────────────────────────

  describe('controller methods', () => {
    it('create calls service.create with decoded owner ID', async () => {
      const mockUser = { dbId: 1 };
      const mockDto = { title: 'Test' };
      const mockResult = { id: 'abc', title: 'Test' };
      const serviceSpy = controller['articleService'].create as vi.Mock;
      serviceSpy.mockResolvedValue(mockResult);

      const result = await controller.create(mockDto as any, mockUser);

      expect(serviceSpy).toHaveBeenCalledWith(mockDto, 1);
      expect(result).toEqual(mockResult);
    });

    it('list calls service.list with parsed query params', async () => {
      const mockResult = { list: [], total: 0, page: 1, pageSize: 10 };
      const serviceSpy = controller['articleService'].list as vi.Mock;
      serviceSpy.mockResolvedValue(mockResult);

      const result = await controller.list({ page: '2', pageSize: '5', query: 'test' });

      expect(serviceSpy).toHaveBeenCalledWith({
        page: 2,
        pageSize: 5,
        query: 'test',
        status: undefined,
        category: undefined,
        tag: undefined,
      });
    });

    it('get calls service.get with public ID', async () => {
      const mockResult = { id: 'abc', title: 'Test' };
      const serviceSpy = controller['articleService'].get as vi.Mock;
      serviceSpy.mockResolvedValue(mockResult);

      const result = await controller.get('abc123');

      expect(serviceSpy).toHaveBeenCalledWith('abc123');
    });

    it('delete calls service.delete with public ID', async () => {
      const serviceSpy = controller['articleService'].delete as vi.Mock;
      serviceSpy.mockResolvedValue(null);

      await controller.delete('abc123');

      expect(serviceSpy).toHaveBeenCalledWith('abc123');
    });
  });
});
