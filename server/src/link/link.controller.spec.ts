import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkController } from './link.controller';
import { LinkService } from './link.service';
import { BadRequestException } from '@nestjs/common';

describe('LinkController', () => {
  let controller: LinkController;
  let service: LinkService;

  const mockLinkResponse = {
    id: 'sqid_1_22',
    name: 'Test Link',
    url: 'https://example.com',
    status: 'PENDING',
    category: null,
    tag: null,
  };

  beforeEach(() => {
    service = {
      applyLink: vi.fn(),
      listPublicLinks: vi.fn(),
      getRandomLinks: vi.fn(),
      listApplications: vi.fn(),
      checkLinkExists: vi.fn(),
      listPublicCategories: vi.fn(),
      adminCreateLink: vi.fn(),
      adminListLinks: vi.fn(),
      adminUpdateLink: vi.fn(),
      adminDeleteLink: vi.fn(),
      adminBatchDeleteLinks: vi.fn(),
      reviewLink: vi.fn(),
      importLinks: vi.fn(),
      exportLinks: vi.fn(),
      healthCheck: vi.fn(),
      getHealthCheckStatus: vi.fn(),
      batchUpdateSort: vi.fn(),
      listCategories: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      listTags: vi.fn(),
      createTag: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn(),
    } as any;

    controller = new LinkController(service);
  });

  // ─── Public endpoints ─────────────────────────────────────────────

  describe('applyLink', () => {
    it('should call service.applyLink with IP from request', async () => {
      const dto = { type: 'NEW', name: 'Test', url: 'https://example.com', email: 'test@example.com' };
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        ip: '127.0.0.1',
        connection: {},
      };
      vi.mocked(service.applyLink).mockResolvedValue(mockLinkResponse as any);

      const result = await controller.applyLink(dto, req);

      expect(service.applyLink).toHaveBeenCalledWith(dto, '1.2.3.4');
      expect(result).toEqual(mockLinkResponse);
    });

    it('should fall back to req.ip when x-forwarded-for is missing', async () => {
      const dto = { type: 'NEW', name: 'Test', url: 'https://example.com', email: 'test@example.com' };
      const req = { headers: {}, ip: '127.0.0.1', connection: {} };
      vi.mocked(service.applyLink).mockResolvedValue(mockLinkResponse as any);

      await controller.applyLink(dto, req);

      expect(service.applyLink).toHaveBeenCalledWith(dto, '127.0.0.1');
    });
  });

  describe('listPublicLinks', () => {
    it('should call service.listPublicLinks', async () => {
      vi.mocked(service.listPublicLinks).mockResolvedValue([]);

      const result = await controller.listPublicLinks();

      expect(service.listPublicLinks).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getRandomLinks', () => {
    it('should call service.getRandomLinks with parsed num', async () => {
      vi.mocked(service.getRandomLinks).mockResolvedValue([]);

      await controller.getRandomLinks('5');

      expect(service.getRandomLinks).toHaveBeenCalledWith(5);
    });

    it('should default to 0 when num is not provided', async () => {
      vi.mocked(service.getRandomLinks).mockResolvedValue([]);

      await controller.getRandomLinks();

      expect(service.getRandomLinks).toHaveBeenCalledWith(0);
    });
  });

  describe('listApplications', () => {
    it('should call service.listApplications', async () => {
      vi.mocked(service.listApplications).mockResolvedValue([]);

      const result = await controller.listApplications();

      expect(service.listApplications).toHaveBeenCalled();
    });
  });

  describe('checkLinkExists', () => {
    it('should call service.checkLinkExists with url', async () => {
      vi.mocked(service.checkLinkExists).mockResolvedValue({ exists: false, url: 'https://example.com' });

      const result = await controller.checkLinkExists('https://example.com');

      expect(service.checkLinkExists).toHaveBeenCalledWith('https://example.com');
      expect(result).toEqual({ exists: false, url: 'https://example.com' });
    });
  });

  describe('listPublicCategories', () => {
    it('should call service.listPublicCategories', async () => {
      vi.mocked(service.listPublicCategories).mockResolvedValue([]);

      const result = await controller.listPublicCategories();

      expect(service.listPublicCategories).toHaveBeenCalled();
    });
  });

  // ─── Admin endpoints ──────────────────────────────────────────────

  describe('adminCreateLink', () => {
    it('should call service.adminCreateLink', async () => {
      const dto = { name: 'Test', url: 'https://example.com', category_id: 2, status: 'APPROVED' };
      vi.mocked(service.adminCreateLink).mockResolvedValue(mockLinkResponse as any);

      const result = await controller.adminCreateLink(dto);

      expect(service.adminCreateLink).toHaveBeenCalledWith(dto);
    });
  });

  describe('adminListLinks', () => {
    it('should call service.adminListLinks with parsed params', async () => {
      vi.mocked(service.adminListLinks).mockResolvedValue({
        list: [], total: 0, page: 1, pageSize: 10,
      });

      await controller.adminListLinks('2', '20', 'APPROVED', '3', '5');

      expect(service.adminListLinks).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        status: 'APPROVED',
        categoryId: 3,
        tagId: 5,
      });
    });

    it('should use defaults when no params provided', async () => {
      vi.mocked(service.adminListLinks).mockResolvedValue({
        list: [], total: 0, page: 1, pageSize: 10,
      });

      await controller.adminListLinks();

      expect(service.adminListLinks).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        status: undefined,
        categoryId: undefined,
        tagId: undefined,
      });
    });
  });

  describe('adminBatchDeleteLinks', () => {
    it('should call service.adminBatchDeleteLinks', async () => {
      const dto = { ids: ['sqid_1_22'] };
      vi.mocked(service.adminBatchDeleteLinks).mockResolvedValue({
        total: 1, success: 1, failed: 0, failed_list: [],
      });

      const result = await controller.adminBatchDeleteLinks(dto);

      expect(service.adminBatchDeleteLinks).toHaveBeenCalledWith(dto);
    });
  });

  describe('adminUpdateLink', () => {
    it('should call service.adminUpdateLink with id and dto', async () => {
      const dto = { name: 'Updated' };
      vi.mocked(service.adminUpdateLink).mockResolvedValue(mockLinkResponse as any);

      const result = await controller.adminUpdateLink('sqid_1_22', dto);

      expect(service.adminUpdateLink).toHaveBeenCalledWith('sqid_1_22', dto);
    });
  });

  describe('adminDeleteLink', () => {
    it('should call service.adminDeleteLink with id', async () => {
      vi.mocked(service.adminDeleteLink).mockResolvedValue(undefined);

      await controller.adminDeleteLink('sqid_1_22');

      expect(service.adminDeleteLink).toHaveBeenCalledWith('sqid_1_22');
    });
  });

  describe('reviewLink', () => {
    it('should call service.reviewLink with id and dto', async () => {
      const dto = { status: 'APPROVED' };
      vi.mocked(service.reviewLink).mockResolvedValue(undefined);

      await controller.reviewLink('sqid_1_22', dto);

      expect(service.reviewLink).toHaveBeenCalledWith('sqid_1_22', dto);
    });
  });

  describe('importLinks', () => {
    it('should call service.importLinks', async () => {
      const dto = { links: [] };
      vi.mocked(service.importLinks).mockResolvedValue({
        total: 0, success: 0, failed: 0, skipped: 0,
        success_list: [], failed_list: [], skipped_list: [],
      });

      await controller.importLinks(dto);

      expect(service.importLinks).toHaveBeenCalledWith(dto);
    });
  });

  describe('exportLinks', () => {
    it('should call service.exportLinks with filters', async () => {
      vi.mocked(service.exportLinks).mockResolvedValue({ links: [], total: 0 });

      await controller.exportLinks('APPROVED', '2', '5');

      expect(service.exportLinks).toHaveBeenCalledWith({
        status: 'APPROVED',
        categoryId: 2,
        tagId: 5,
      });
    });
  });

  describe('triggerHealthCheck', () => {
    it('should call service.healthCheck and return status message', async () => {
      vi.mocked(service.healthCheck).mockResolvedValue(undefined);

      const result = await controller.triggerHealthCheck();

      expect(service.healthCheck).toHaveBeenCalled();
      expect(result.status).toBe('started');
    });

    it('should propagate LINK_HEALTH_CHECK_RUNNING error', async () => {
      vi.mocked(service.healthCheck).mockRejectedValue(
        new BadRequestException('友链健康检查任务正在执行中'),
      );

      await expect(controller.triggerHealthCheck()).rejects.toThrow(
        '友链健康检查任务正在执行中',
      );
    });
  });

  describe('getHealthCheckStatus', () => {
    it('should call service.getHealthCheckStatus', async () => {
      const status = { is_running: false, start_time: null, end_time: null, result: null, error: '' };
      vi.mocked(service.getHealthCheckStatus).mockReturnValue(status);

      const result = await controller.getHealthCheckStatus();

      expect(service.getHealthCheckStatus).toHaveBeenCalled();
      expect(result).toEqual(status);
    });
  });

  describe('batchUpdateSort', () => {
    it('should call service.batchUpdateSort', async () => {
      const dto = { items: [{ id: 'sqid_1_22', sort_order: 5 }] };
      vi.mocked(service.batchUpdateSort).mockResolvedValue(undefined);

      await controller.batchUpdateSort(dto);

      expect(service.batchUpdateSort).toHaveBeenCalledWith(dto);
    });
  });

  // ─── Category CRUD ────────────────────────────────────────────────

  describe('listCategories', () => {
    it('should call service.listCategories', async () => {
      vi.mocked(service.listCategories).mockResolvedValue([]);

      const result = await controller.listCategories();

      expect(service.listCategories).toHaveBeenCalled();
    });
  });

  describe('createCategory', () => {
    it('should call service.createCategory', async () => {
      const dto = { name: 'New Cat', style: 'card' };
      vi.mocked(service.createCategory).mockResolvedValue({ id: 1, name: 'New Cat', style: 'card', description: '' });

      const result = await controller.createCategory(dto);

      expect(service.createCategory).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateCategory', () => {
    it('should call service.updateCategory with id and dto', async () => {
      const dto = { name: 'Updated' };
      vi.mocked(service.updateCategory).mockResolvedValue({ id: 1, name: 'Updated', style: 'card', description: '' });

      const result = await controller.updateCategory('1', dto);

      expect(service.updateCategory).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('deleteCategory', () => {
    it('should call service.deleteCategory with id', async () => {
      vi.mocked(service.deleteCategory).mockResolvedValue(undefined);

      await controller.deleteCategory('1');

      expect(service.deleteCategory).toHaveBeenCalledWith('1');
    });
  });

  // ─── Tag CRUD ─────────────────────────────────────────────────────

  describe('listTags', () => {
    it('should call service.listTags', async () => {
      vi.mocked(service.listTags).mockResolvedValue([]);

      const result = await controller.listTags();

      expect(service.listTags).toHaveBeenCalled();
    });
  });

  describe('createTag', () => {
    it('should call service.createTag', async () => {
      const dto = { name: 'New Tag', color: '#FF0000' };
      vi.mocked(service.createTag).mockResolvedValue({ id: 1, name: 'New Tag', color: '#FF0000' });

      const result = await controller.createTag(dto);

      expect(service.createTag).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateTag', () => {
    it('should call service.updateTag with id and dto', async () => {
      const dto = { name: 'Updated' };
      vi.mocked(service.updateTag).mockResolvedValue({ id: 1, name: 'Updated', color: '#666666' });

      const result = await controller.updateTag('1', dto);

      expect(service.updateTag).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('deleteTag', () => {
    it('should call service.deleteTag with id', async () => {
      vi.mocked(service.deleteTag).mockResolvedValue(undefined);

      await controller.deleteTag('1');

      expect(service.deleteTag).toHaveBeenCalledWith('1');
    });
  });
});
