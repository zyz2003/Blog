import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkRepository } from './link.repository';
import { links } from '../database/schemas/link.schema';
import { linkCategories } from '../database/schemas/link-category.schema';
import { linkTags } from '../database/schemas/link-tag.schema';
import { linkTagPivot } from '../database/schemas/link-tag-pivot.schema';

describe('LinkRepository', () => {
  let repository: LinkRepository;
  let mockDb: any;

  beforeEach(() => {
    repository = new LinkRepository(mockDb);
  });

  // ─── Test 1: create ─────────────────────────────────────────────
  describe('create', () => {
    it('should insert a link record and return it', async () => {
      const params = {
        name: 'Test Link',
        url: 'https://example.com',
        status: 'PENDING',
        categoryId: 1,
      };
      const mockCreated = { id: 1, ...params };

      mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockCreated]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.create(params);

      expect(mockDb.insert).toHaveBeenCalledWith(links);
      expect(result).toEqual(mockCreated);
    });
  });

  // ─── Test 2: findById ───────────────────────────────────────────
  describe('findById', () => {
    it('should return a single non-deleted link by DB ID', async () => {
      const mockLink = { id: 1, name: 'Test', url: 'https://example.com' };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockLink]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findById(1);

      expect(result).toEqual(mockLink);
    });

    it('should return undefined when link not found', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findById(999);

      expect(result).toBeUndefined();
    });
  });

  // ─── Test 3: findByUrl ──────────────────────────────────────────
  describe('findByUrl', () => {
    it('should return a link matching a URL string', async () => {
      const mockLink = { id: 1, url: 'https://example.com' };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockLink]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findByUrl('https://example.com');

      expect(result).toEqual(mockLink);
    });

    it('should return undefined when URL not found', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findByUrl('https://notfound.com');

      expect(result).toBeUndefined();
    });
  });

  // ─── Test 4: hasApplicationByEmail ──────────────────────────────
  describe('hasApplicationByEmail', () => {
    it('should return true if any link exists with given email', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.hasApplicationByEmail('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false if no link exists with given email', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.hasApplicationByEmail('none@example.com');

      expect(result).toBe(false);
    });
  });

  // ─── Test 5: findApprovedLinks ──────────────────────────────────
  describe('findApprovedLinks', () => {
    it('should return all APPROVED links with category and tag joins', async () => {
      const mockResult = [
        {
          link: { id: 1, status: 'APPROVED' },
          category: { id: 1, name: 'Tech' },
          tag: { id: 1, name: 'Blog' },
        },
      ];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockResolvedValue(mockResult),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findApprovedLinks();

      expect(result).toEqual(mockResult);
    });
  });

  // ─── Test 6: findRandomApproved ─────────────────────────────────
  describe('findRandomApproved', () => {
    it('should return N random APPROVED links', async () => {
      const mockResult = [
        { link: { id: 1, status: 'APPROVED' }, category: null, tag: null },
      ];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue(mockResult),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findRandomApproved(5);

      expect(result).toEqual(mockResult);
    });
  });

  // ─── Test 7: adminList ──────────────────────────────────────────
  describe('adminList', () => {
    it('should return paginated links with optional status/category/tag filters', async () => {
      const mockLinks = [
        { link: { id: 1 }, category: { id: 1 }, tag: null },
      ];

      let selectCallCount = 0;
      mockDb = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 1 }]),
              }),
            };
          }
          // List query with joins
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          offset: vi.fn().mockResolvedValue(mockLinks),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.adminList({
        page: 1,
        pageSize: 10,
        status: 'APPROVED',
        categoryId: 1,
      });

      expect(result).toEqual({ list: mockLinks, total: 1 });
    });

    it('should work with no filters', async () => {
      let selectCallCount = 0;
      mockDb = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 0 }]),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          offset: vi.fn().mockResolvedValue([]),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.adminList({ page: 1, pageSize: 10 });

      expect(result).toEqual({ list: [], total: 0 });
    });
  });

  // ─── Test 8: update ─────────────────────────────────────────────
  describe('update', () => {
    it('should modify link fields by DB ID', async () => {
      const mockUpdated = { id: 1, name: 'Updated Link' };

      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdated]),
            }),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.update(1, { name: 'Updated Link' });

      expect(mockDb.update).toHaveBeenCalledWith(links);
      expect(result).toEqual(mockUpdated);
    });
  });

  // ─── Test 9: updateStatus ───────────────────────────────────────
  describe('updateStatus', () => {
    it('should set status field for a link', async () => {
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      await repository.updateStatus(1, 'APPROVED');

      expect(mockDb.update).toHaveBeenCalledWith(links);
    });

    it('should optionally update siteshot', async () => {
      let capturedSet: any;
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((data: any) => {
            capturedSet = data;
            return {
              where: vi.fn().mockResolvedValue({}),
            };
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      await repository.updateStatus(1, 'APPROVED', 'https://shot.png');

      expect(capturedSet.siteshot).toBe('https://shot.png');
      expect(capturedSet.status).toBe('APPROVED');
    });
  });

  // ─── Test 10: softDelete ────────────────────────────────────────
  describe('softDelete', () => {
    it('should set deletedAt on links matching given DB IDs', async () => {
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      await repository.softDelete([1, 2, 3]);

      expect(mockDb.update).toHaveBeenCalledWith(links);
    });
  });

  // ─── Test 11: batchUpdateSort ───────────────────────────────────
  describe('batchUpdateSort', () => {
    it('should update sortOrder for multiple links', async () => {
      mockDb = {
        run: vi.fn().mockResolvedValue({}),
      };

      repository = new LinkRepository(mockDb);
      await repository.batchUpdateSort([
        { id: 1, sortOrder: 0 },
        { id: 2, sortOrder: 1 },
      ]);

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should do nothing for empty items array', async () => {
      mockDb = { run: vi.fn() };

      repository = new LinkRepository(mockDb);
      await repository.batchUpdateSort([]);

      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  // ─── Test 12: findLinksForHealthCheck ───────────────────────────
  describe('findLinksForHealthCheck', () => {
    it('should return APPROVED + INVALID links where skipHealthCheck=false', async () => {
      const mockLinks = [
        { id: 1, status: 'APPROVED', skipHealthCheck: false },
        { id: 2, status: 'INVALID', skipHealthCheck: false },
      ];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockLinks),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findLinksForHealthCheck();

      expect(result).toEqual(mockLinks);
    });
  });

  // ─── Test 13: Category CRUD ─────────────────────────────────────
  describe('Category CRUD', () => {
    it('createCategory should insert and return a category', async () => {
      const mockCategory = { id: 1, name: 'Tech', style: 'card' };

      mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockCategory]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.createCategory({ name: 'Tech', style: 'card' });

      expect(mockDb.insert).toHaveBeenCalledWith(linkCategories);
      expect(result).toEqual(mockCategory);
    });

    it('findAllCategories should return all categories', async () => {
      const mockCategories = [{ id: 1, name: 'Tech' }, { id: 2, name: 'Life' }];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockResolvedValue(mockCategories),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findAllCategories();

      expect(result).toEqual(mockCategories);
    });

    it('findCategoryById should return a single category', async () => {
      const mockCategory = { id: 1, name: 'Tech' };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockCategory]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findCategoryById(1);

      expect(result).toEqual(mockCategory);
    });

    it('updateCategory should update specified fields', async () => {
      const mockUpdated = { id: 1, name: 'Updated' };

      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdated]),
            }),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.updateCategory(1, { name: 'Updated' });

      expect(result).toEqual(mockUpdated);
    });

    it('deleteCategoryIfUnused should delete if no links reference it', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      };

      repository = new LinkRepository(mockDb);
      await repository.deleteCategoryIfUnused(1);

      expect(mockDb.delete).toHaveBeenCalledWith(linkCategories);
    });

    it('deleteCategoryIfUnused should throw if links reference it', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      await expect(repository.deleteCategoryIfUnused(1)).rejects.toThrow('友链分类正在使用中，无法删除');
    });
  });

  // ─── Test 14: Tag CRUD ──────────────────────────────────────────────────────────────────────────
  describe('Tag CRUD', () => {
    it('createTag should insert and return a tag with default color', async () => {
      const mockTag = { id: 1, name: 'Blog', color: '#666666' };

      mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockTag]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.createTag({ name: 'Blog' });

      expect(mockDb.insert).toHaveBeenCalledWith(linkTags);
      expect(result).toEqual(mockTag);
    });

    it('findAllTags should return all tags', async () => {
      const mockTags = [{ id: 1, name: 'Blog' }];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockResolvedValue(mockTags),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findAllTags();

      expect(result).toEqual(mockTags);
    });

    it('findTagById should return a single tag', async () => {
      const mockTag = { id: 1, name: 'Blog' };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockTag]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findTagById(1);

      expect(result).toEqual(mockTag);
    });

    it('findTagByName should return a tag by name', async () => {
      const mockTag = { id: 1, name: 'Blog' };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockTag]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findTagByName('Blog');

      expect(result).toEqual(mockTag);
    });

    it('updateTag should update specified fields', async () => {
      const mockUpdated = { id: 1, name: 'Updated' };

      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdated]),
            }),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.updateTag(1, { name: 'Updated' });

      expect(result).toEqual(mockUpdated);
    });

    it('deleteTagIfUnused should delete if no pivot references it', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      };

      repository = new LinkRepository(mockDb);
      await repository.deleteTagIfUnused(1);

      expect(mockDb.delete).toHaveBeenCalledWith(linkTags);
    });

    it('deleteTagIfUnused should throw if pivot references it', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      await expect(repository.deleteTagIfUnused(1)).rejects.toThrow('友链标签正在使用中，无法删除');
    });
  });

  // ─── Test 15: Link-Tag Pivot ────────────────────────────────────
  describe('Link-Tag Pivot', () => {
    it('setLinkTag should delete old pivot and insert new', async () => {
      mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue({}),
        }),
      };

      repository = new LinkRepository(mockDb);
      await repository.setLinkTag(1, 5);

      expect(mockDb.delete).toHaveBeenCalledWith(linkTagPivot);
      expect(mockDb.insert).toHaveBeenCalledWith(linkTagPivot);
    });

    it('setLinkTag should only delete when tagId is null', async () => {
      mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
        insert: vi.fn(),
      };

      repository = new LinkRepository(mockDb);
      await repository.setLinkTag(1, null);

      expect(mockDb.delete).toHaveBeenCalledWith(linkTagPivot);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('getLinkTag should return single tag for a link', async () => {
      const mockTag = { id: 5, name: 'Blog', color: '#666666' };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ tag: mockTag }]),
            }),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.getLinkTag(1);

      expect(result).toEqual(mockTag);
    });

    it('getLinkTag should return null when no tag found', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.getLinkTag(1);

      expect(result).toBeNull();
    });
  });

  // ─── Test 16: findPublicCategories ──────────────────────────────
  describe('findPublicCategories', () => {
    it('should return categories that have at least one APPROVED link', async () => {
      const mockCategories = [{ id: 1, name: 'Tech' }];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCategories),
          }),
        }),
      };

      repository = new LinkRepository(mockDb);
      const result = await repository.findPublicCategories();

      expect(result).toEqual(mockCategories);
    });
  });
});
