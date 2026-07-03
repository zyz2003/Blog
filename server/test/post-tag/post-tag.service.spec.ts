import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { PostTagService } from '../../src/post-tag/post-tag.service';
import { PostTagRepository } from '../../src/post-tag/post-tag.repository';
import { createMockTag, TEST_IDS } from '../helpers/article-fixtures';

describe('PostTagService', () => {
  let service: PostTagService;
  let repository: PostTagRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostTagService,
        { provide: PostTagRepository, useValue: {
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

    service = module.get(PostTagService);
    repository = module.get(PostTagRepository);
  });

  // ─── list ─────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns all non-deleted tags with Sqids IDs', async () => {
      const mockTags = [
        createMockTag({ id: 1, name: 'JavaScript' }),
        createMockTag({ id: 2, name: 'TypeScript', slug: 'typescript' }),
      ];
      (repository.findAll as vi.Mock).mockResolvedValue(mockTags);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(TEST_IDS.tag1);
      expect(result[0].name).toBe('JavaScript');
      expect(result[1].id).toBe(TEST_IDS.tag2);
      expect(result[1].name).toBe('TypeScript');
    });

    it('returns empty array when no tags exist', async () => {
      (repository.findAll as vi.Mock).mockResolvedValue([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });
  });

  // ─── create ───────────────────────────────────────────────────────

  describe('create', () => {
    it('creates tag with name and auto-generated slug', async () => {
      const mockTag = createMockTag();
      (repository.findByName as vi.Mock).mockResolvedValue(null);
      (repository.create as vi.Mock).mockResolvedValue(mockTag);

      const result = await service.create({ name: 'JavaScript' });

      expect(repository.findByName).toHaveBeenCalledWith('JavaScript');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'JavaScript' }),
      );
      expect(result.id).toBe(TEST_IDS.tag1);
      expect(result.name).toBe('JavaScript');
    });

    it('creates tag with custom slug', async () => {
      const mockTag = createMockTag({ slug: 'custom-slug' });
      (repository.findByName as vi.Mock).mockResolvedValue(null);
      (repository.create as vi.Mock).mockResolvedValue(mockTag);

      const result = await service.create({ name: 'JavaScript', slug: 'custom-slug' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'custom-slug' }),
      );
    });

    it('rejects duplicate tag name', async () => {
      (repository.findByName as vi.Mock).mockResolvedValue(createMockTag());

      await expect(service.create({ name: 'JavaScript' }))
        .rejects.toThrow('标签名称已存在');
    });
  });

  // ─── update ───────────────────────────────────────────────────────

  describe('update', () => {
    it('updates tag fields', async () => {
      const existing = createMockTag({ id: 1, name: 'JavaScript' });
      const updated = createMockTag({ id: 1, name: 'JS' });
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.findByName as vi.Mock).mockResolvedValue(null);
      (repository.update as vi.Mock).mockResolvedValue(updated);

      const result = await service.update(1, { name: 'JS' });

      expect(repository.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'JS' }));
      expect(result.name).toBe('JS');
    });

    it('throws NotFoundException when tag does not exist', async () => {
      (repository.findById as vi.Mock).mockResolvedValue(null);

      await expect(service.update(999, { name: 'New' }))
        .rejects.toThrow('标签不存在');
    });

    it('rejects duplicate name on update', async () => {
      const existing = createMockTag({ id: 1, name: 'JavaScript' });
      const otherTag = createMockTag({ id: 2, name: 'JS' });
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.findByName as vi.Mock).mockResolvedValue(otherTag);

      await expect(service.update(1, { name: 'JS' }))
        .rejects.toThrow('标签名称已存在');
    });

    it('allows updating to the same name (no conflict)', async () => {
      const existing = createMockTag({ id: 1, name: 'JavaScript' });
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.update as vi.Mock).mockResolvedValue(existing);

      const result = await service.update(1, { name: 'JavaScript' });
      expect(repository.findByName).not.toHaveBeenCalled();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes tag', async () => {
      const existing = createMockTag();
      (repository.findById as vi.Mock).mockResolvedValue(existing);
      (repository.softDelete as vi.Mock).mockResolvedValue(existing);

      const result = await service.delete(1);

      expect(repository.softDelete).toHaveBeenCalledWith(1);
      expect(result).toBeNull();
    });

    it('throws NotFoundException when tag does not exist', async () => {
      (repository.findById as vi.Mock).mockResolvedValue(null);

      await expect(service.delete(999))
        .rejects.toThrow('标签不存在');
    });
  });

  // ─── toApiResponse ────────────────────────────────────────────────

  describe('toApiResponse', () => {
    it('maps all fields correctly', async () => {
      const mockTag = createMockTag();
      (repository.findAll as vi.Mock).mockResolvedValue([mockTag]);

      const result = await service.list();

      expect(result[0]).toEqual({
        id: TEST_IDS.tag1,
        created_at: expect.any(String),
        updated_at: expect.any(String),
        name: 'JavaScript',
        slug: 'javascript',
        count: 3,
      });
    });
  });
});
