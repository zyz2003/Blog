import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { PostCategoryService } from '../../src/post-category/post-category.service';
import { PostCategoryRepository } from '../../src/post-category/post-category.repository';
import { generatePublicID, EntityType } from '../../src/common/utils/sqids.util';
import { createMockCategory, TEST_IDS } from '../helpers/article-fixtures';

describe('PostCategoryService', () => {
  let service: PostCategoryService;
  let repository: PostCategoryRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostCategoryService,
        { provide: PostCategoryRepository, useValue: {
          findAll: vi.fn(),
          findById: vi.fn(),
          findByName: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          softDelete: vi.fn(),
          incrementCount: vi.fn(),
          decrementCount: vi.fn(),
        }},
      ],
    }).compile();

    service = module.get(PostCategoryService);
    repository = module.get(PostCategoryRepository);
  });

  // ─── list ─────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns all non-deleted categories with Sqids IDs', async () => {
      const mockCategories = [
        createMockCategory({ id: 1, name: 'Technology' }),
        createMockCategory({ id: 2, name: 'Life', slug: 'life' }),
      ];
      (repository.findAll as vi.Mock).mockResolvedValue(mockCategories);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(TEST_IDS.category1);
      expect(result[0].name).toBe('Technology');
      expect(result[1].id).toBe(TEST_IDS.category2);
      expect(result[1].name).toBe('Life');
    });

    it('returns empty array when no categories exist', async () => {
      (repository.findAll as vi.Mock).mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });
  });

  // ─── create ───────────────────────────────────────────────────────

  describe('create', () => {
    it('creates category with name and auto-generated slug', async () => {
      const mockCategory = createMockCategory();
      (repository.findByName as vi.Mock).mockResolvedValue(null);
      (repository.create as vi.Mock).mockResolvedValue(mockCategory);

      const result = await service.create({ name: 'Technology' });

      expect(repository.findByName).toHaveBeenCalledWith('Technology');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Technology' }),
      );
      expect(result.id).toBe(TEST_IDS.category1);
      expect(result.name).toBe('Technology');
    });

    it('creates category with custom slug', async () => {
      const mockCategory = createMockCategory({ slug: 'custom-slug' });
      (repository.findByName as vi.Mock).mockResolvedValue(null);
      (repository.create as vi.Mock).mockResolvedValue(mockCategory);

      const result = await service.create({ name: 'Technology', slug: 'custom-slug' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'custom-slug' }),
      );
    });

    it('rejects duplicate category name', async () => {
      (repository.findByName as vi.Mock).mockResolvedValue(createMockCategory());

      await expect(service.create({ name: 'Technology' }))
        .rejects.toThrow('分类名称已存在');
    });
  });

  // ─── update ───────────────────────────────────────────────────────

  describe('update', () => {
    it('updates category fields', async () => {
      const existing = createMockCategory({ id: 1, name: 'Technology' });
      const updated = createMockCategory({ id: 1, name: 'Tech' });
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.findByName as vi.Mock).mockResolvedValue(null);
      (repository.update as vi.Mock).mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Tech' });

      expect(repository.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Tech' }));
      expect(result.name).toBe('Tech');
    });

    it('throws NotFoundException when category does not exist', async () => {
      (repository.findById as vi.Mock).mockResolvedValue(null);

      await expect(service.update(999, { name: 'New' }))
        .rejects.toThrow('分类不存在');
    });

    it('rejects duplicate name on update', async () => {
      const existing = createMockCategory({ id: 1, name: 'Technology' });
      const otherCategory = createMockCategory({ id: 2, name: 'Tech' });
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.findByName as vi.Mock).mockResolvedValue(otherCategory);

      await expect(service.update(1, { name: 'Tech' }))
        .rejects.toThrow('分类名称已存在');
    });

    it('allows updating to the same name (no conflict)', async () => {
      const existing = createMockCategory({ id: 1, name: 'Technology' });
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.update as vi.Mock).mockResolvedValue(existing);

      const result = await service.update(1, { name: 'Technology' });
      // Should NOT call findByName since name is same as existing
      expect(repository.findByName).not.toHaveBeenCalled();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes category', async () => {
      const existing = createMockCategory();
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.softDelete as vi.Mock).mockResolvedValue(existing);

      const result = await service.delete(1);

      expect(repository.softDelete).toHaveBeenCalledWith(1);
      expect(result).toBeNull();
    });

    it('throws NotFoundException when category does not exist', async () => {
      (repository.findById as vi.Mock).mockResolvedValue(null);

      await expect(service.delete(999))
        .rejects.toThrow('分类不存在');
    });
  });

  // ─── toApiResponse ────────────────────────────────────────────────

  describe('toApiResponse', () => {
    it('maps all fields correctly', async () => {
      const mockCategory = createMockCategory();
      (repository.findAll as vi.Mock).mockResolvedValue([mockCategory]);

      const result = await service.list();

      expect(result[0]).toEqual({
        id: TEST_IDS.category1,
        created_at: expect.any(String),
        updated_at: expect.any(String),
        name: 'Technology',
        slug: 'technology',
        description: 'Tech articles',
        count: 5,
        is_series: false,
        sort_order: 0,
      });
    });
  });
});
