import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageRepository } from '../../src/page/page.repository';
import {
  createMockPage,
  createMockCreatePageDto,
  createMockDb,
  TEST_IDS,
} from '../helpers/page-fixtures';

describe('PageRepository', () => {
  let repository: PageRepository;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    repository = new PageRepository(db as any);
  });

  describe('findById', () => {
    it('should return page when id matches and deletedAt is null', async () => {
      const mockPage = createMockPage();
      db._chain.returning = undefined;
      // select().from().where() returns array
      db._chain.where.mockResolvedValueOnce([mockPage]);

      const result = await repository.findById(TEST_IDS.PAGE_1);

      expect(result).toEqual(mockPage);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when page is soft-deleted', async () => {
      db._chain.where.mockResolvedValueOnce([]);

      const result = await repository.findById(TEST_IDS.PAGE_1);

      expect(result).toBeNull();
    });

    it('should return null when page does not exist', async () => {
      db._chain.where.mockResolvedValueOnce([]);

      const result = await repository.findById(TEST_IDS.NONEXISTENT);

      expect(result).toBeNull();
    });
  });

  describe('findByPath', () => {
    it('should return page matching path with deletedAt null', async () => {
      const mockPage = createMockPage({ path: '/privacy' });
      db._chain.where.mockResolvedValueOnce([mockPage]);

      const result = await repository.findByPath('/privacy');

      expect(result).toEqual(mockPage);
    });

    it('should return null when path not found', async () => {
      db._chain.where.mockResolvedValueOnce([]);

      const result = await repository.findByPath('/nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('existsByPath', () => {
    it('should return true when path exists', async () => {
      db._chain.where.mockResolvedValueOnce([{ id: 1 }]);

      const result = await repository.existsByPath('/privacy');

      expect(result).toBe(true);
    });

    it('should return false when path does not exist', async () => {
      db._chain.where.mockResolvedValueOnce([]);

      const result = await repository.existsByPath('/nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when only match is the excluded id', async () => {
      db._chain.where.mockResolvedValueOnce([]);

      const result = await repository.existsByPath('/privacy', TEST_IDS.PAGE_1);

      expect(result).toBe(false);
    });

    it('should return true when path exists but is different id', async () => {
      db._chain.where.mockResolvedValueOnce([{ id: 2 }]);

      const result = await repository.existsByPath('/privacy', TEST_IDS.PAGE_1);

      expect(result).toBe(true);
    });
  });

  describe('create', () => {
    it('should insert page and return the created row', async () => {
      const dto = createMockCreatePageDto();
      const createdPage = createMockPage({
        id: TEST_IDS.PAGE_2,
        title: dto.title,
        path: dto.path,
      });
      db._chain.returning.mockResolvedValueOnce([createdPage]);

      const result = await repository.create(dto);

      expect(result).toEqual(createdPage);
      expect(db.insert).toHaveBeenCalled();
      expect(db._chain.values).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update and return the updated row', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedPage = createMockPage({ title: 'Updated Title' });
      db._chain.returning.mockResolvedValueOnce([updatedPage]);

      const result = await repository.update(TEST_IDS.PAGE_1, updateData);

      expect(result).toEqual(updatedPage);
      expect(db.update).toHaveBeenCalled();
      expect(db._chain.set).toHaveBeenCalled();
    });

    it('should set updatedAt timestamp', async () => {
      const updateData = { title: 'Updated Title' };
      db._chain.returning.mockResolvedValueOnce([createMockPage()]);

      await repository.update(TEST_IDS.PAGE_1, updateData);

      // Verify set was called with updatedAt
      const setCall = db._chain.set.mock.calls[0][0];
      expect(setCall.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt to current timestamp', async () => {
      db._chain.where.mockResolvedValueOnce(undefined);

      await repository.softDelete(TEST_IDS.PAGE_1);

      expect(db.update).toHaveBeenCalled();
      const setCall = db._chain.set.mock.calls[0][0];
      expect(setCall.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('list', () => {
    it('should return { list, total } with basic pagination', async () => {
      const mockPages = [createMockPage(), createMockPage({ id: 2 })];
      // First call: count
      db._chain.where.mockResolvedValueOnce([{ count: 2 }]);
      // Second call: select rows
      db._chain.where.mockResolvedValueOnce(mockPages);

      const result = await repository.list({ page: 1, pageSize: 10 });

      expect(result).toEqual({ list: mockPages, total: 2 });
    });

    it('should apply search filter on title/path/description', async () => {
      // Count
      db._chain.where.mockResolvedValueOnce([{ count: 1 }]);
      // Rows
      db._chain.where.mockResolvedValueOnce([createMockPage()]);

      await repository.list({ page: 1, pageSize: 10, search: 'test' });

      // Verify where was called (filter applied)
      expect(db._chain.where).toHaveBeenCalled();
    });

    it('should apply isPublished filter', async () => {
      // Count
      db._chain.where.mockResolvedValueOnce([{ count: 1 }]);
      // Rows
      db._chain.where.mockResolvedValueOnce([createMockPage()]);

      await repository.list({ page: 1, pageSize: 10, isPublished: true });

      expect(db._chain.where).toHaveBeenCalled();
    });

    it('should order by sort desc then createdAt desc', async () => {
      // Count
      db._chain.where.mockResolvedValueOnce([{ count: 0 }]);
      // Rows
      db._chain.where.mockResolvedValueOnce([]);

      await repository.list({ page: 1, pageSize: 10 });

      expect(db._chain.orderBy).toHaveBeenCalled();
    });

    it('should paginate with offset and limit', async () => {
      // Count
      db._chain.where.mockResolvedValueOnce([{ count: 20 }]);
      // Rows
      db._chain.where.mockResolvedValueOnce([]);

      await repository.list({ page: 2, pageSize: 10 });

      expect(db._chain.limit).toHaveBeenCalledWith(10);
      expect(db._chain.offset).toHaveBeenCalledWith(10);
    });
  });
});
