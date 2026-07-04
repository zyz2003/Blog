import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { PageController } from '../../src/page/page.controller';
import { PublicPageController } from '../../src/page/public-page.controller';
import { PageService } from '../../src/page/page.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import {
  createMockPage,
  createMockCreatePageDto,
  createMockUpdatePageDto,
  TEST_IDS,
} from '../helpers/page-fixtures';

describe('PageController', () => {
  let controller: PageController;
  let publicController: PublicPageController;
  let reflector: Reflector;
  let service: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PageController, PublicPageController],
      providers: [
        {
          provide: PageService,
          useValue: {
            create: vi.fn(),
            list: vi.fn(),
            getById: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            getByPath: vi.fn(),
            initializeDefaultPages: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PageController);
    publicController = module.get(PublicPageController);
    reflector = module.get(Reflector);
    service = module.get(PageService);
  });

  // ─── Route Registration ───────────────────────────────────────────

  describe('route registration', () => {
    it('PageController is defined', () => {
      expect(controller).toBeDefined();
    });

    it('PublicPageController is defined', () => {
      expect(publicController).toBeDefined();
    });
  });

  // ─── Auth Guard on Admin Endpoints ────────────────────────────────

  describe('admin endpoints require auth', () => {
    it('POST /pages is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.create);
      expect(isPublic).toBeFalsy();
    });

    it('GET /pages is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.list);
      expect(isPublic).toBeFalsy();
    });

    it('POST /pages/initialize is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.initializeDefaultPages);
      expect(isPublic).toBeFalsy();
    });

    it('GET /pages/:id is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.get);
      expect(isPublic).toBeFalsy();
    });

    it('PUT /pages/:id is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.update);
      expect(isPublic).toBeFalsy();
    });

    it('DELETE /pages/:id is NOT public', () => {
      const isPublic = reflector.get(IS_PUBLIC_KEY, controller.delete);
      expect(isPublic).toBeFalsy();
    });
  });

  // ─── Controller Method Behavior ───────────────────────────────────

  describe('controller methods', () => {
    it('create calls service.create with dto', async () => {
      const dto = createMockCreatePageDto();
      const mockResult = { id: 1, title: dto.title, path: dto.path };
      service.create.mockResolvedValue(mockResult);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });

    it('list calls service.list with parsed query params', async () => {
      const mockResult = { pages: [], total: 0, page: 1, size: 10 };
      service.list.mockResolvedValue(mockResult);

      const result = await controller.list({
        page: '2',
        page_size: '5',
        search: 'test',
        is_published: 'true',
      });

      expect(service.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 5,
        search: 'test',
        isPublished: true,
      });
      expect(result).toEqual(mockResult);
    });

    it('list uses defaults when query params missing', async () => {
      const mockResult = { pages: [], total: 0, page: 1, size: 10 };
      service.list.mockResolvedValue(mockResult);

      await controller.list({});

      expect(service.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        search: undefined,
        isPublished: undefined,
      });
    });

    it('list clamps page to minimum 1', async () => {
      service.list.mockResolvedValue({ pages: [], total: 0, page: 1, size: 10 });

      await controller.list({ page: '0' });

      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });

    it('list clamps pageSize to 10 when out of range', async () => {
      service.list.mockResolvedValue({ pages: [], total: 0, page: 1, size: 10 });

      await controller.list({ page_size: '0' });

      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 10 }),
      );
    });

    it('list clamps pageSize to 10 when above 100', async () => {
      service.list.mockResolvedValue({ pages: [], total: 0, page: 1, size: 10 });

      await controller.list({ page_size: '200' });

      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 10 }),
      );
    });

    it('initializeDefaultPages calls service.initializeDefaultPages', async () => {
      service.initializeDefaultPages.mockResolvedValue(undefined);

      const result = await controller.initializeDefaultPages();

      expect(service.initializeDefaultPages).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('get calls service.getById with parsed numeric id', async () => {
      const mockResult = { id: 1, title: 'Test' };
      service.getById.mockResolvedValue(mockResult);

      const result = await controller.get('1');

      expect(service.getById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResult);
    });

    it('update calls service.update with parsed numeric id and dto', async () => {
      const dto = createMockUpdatePageDto();
      const mockResult = { id: 1, title: 'Updated' };
      service.update.mockResolvedValue(mockResult);

      const result = await controller.update('1', dto as any);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(mockResult);
    });

    it('delete calls service.delete with parsed numeric id', async () => {
      service.delete.mockResolvedValue(undefined);

      const result = await controller.delete('1');

      expect(service.delete).toHaveBeenCalledWith(1);
      expect(result).toBeNull();
    });
  });
});
