import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { PageRepository } from '../../src/page/page.repository';
import { DRIZZLE } from '../../src/database/database.module';
import {
  createMockPage,
  createMockCreatePageDto,
  TEST_IDS,
} from '../helpers/page-fixtures';

describe('PageRepository', () => {
  let repository: PageRepository;
  let db: any;

  beforeEach(async () => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PageRepository,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    repository = module.get(PageRepository);
  });

  /**
   * Create a chainable mock for Drizzle select queries.
   * where() resolves to `resolvedValue` (terminal for findById/findByPath/existsByPath)
   * but also supports chaining (orderBy, limit, offset) for list queries.
   */
  function createSelectChain(resolvedValue: any) {
    let resolveWith = resolvedValue;
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue(resolveWith),
      returning: vi.fn().mockResolvedValue(resolveWith),
    };
    // Make the chain thenable so `await chain` resolves
    chain.then = (resolve: any) => resolve(resolveWith);
    return chain;
  }

  /**
   * Create a chainable mock for Drizzle insert/update queries.
   */
  function createMutationChain(resolvedValue: any) {
    const chain: any = {
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(resolvedValue),
    };
    chain.then = (resolve: any) => resolve(resolvedValue);
    return chain;
  }

  describe('findById', () => {
    it('should return page when id matches and deletedAt is null', async () => {
      const mockPage = createMockPage();
      const chain = createSelectChain([mockPage]);
      db.select.mockReturnValue(chain);

      const result = await repository.findById(TEST_IDS.PAGE_1);

      expect(result).toEqual(mockPage);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when page is soft-deleted', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await repository.findById(TEST_IDS.PAGE_1);

      expect(result).toBeNull();
    });

    it('should return null when page does not exist', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await repository.findById(TEST_IDS.NONEXISTENT);

      expect(result).toBeNull();
    });
  });

  describe('findByPath', () => {
    it('should return page matching path with deletedAt null', async () => {
      const mockPage = createMockPage({ path: '/privacy' });
      const chain = createSelectChain([mockPage]);
      db.select.mockReturnValue(chain);

      const result = await repository.findByPath('/privacy');

      expect(result).toEqual(mockPage);
    });

    it('should return null when path not found', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await repository.findByPath('/nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('existsByPath', () => {
    it('should return true when path exists', async () => {
      const chain = createSelectChain([{ id: 1 }]);
      db.select.mockReturnValue(chain);

      const result = await repository.existsByPath('/privacy');

      expect(result).toBe(true);
    });

    it('should return false when path does not exist', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await repository.existsByPath('/nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when only match is the excluded id', async () => {
      const chain = createSelectChain([]);
      db.select.mockReturnValue(chain);

      const result = await repository.existsByPath('/privacy', TEST_IDS.PAGE_1);

      expect(result).toBe(false);
    });

    it('should return true when path exists but is different id', async () => {
      const chain = createSelectChain([{ id: 2 }]);
      db.select.mockReturnValue(chain);

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
      const chain = createMutationChain([createdPage]);
      db.insert.mockReturnValue(chain);

      const result = await repository.create(dto);

      expect(result).toEqual(createdPage);
      expect(db.insert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update and return the updated row', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedPage = createMockPage({ title: 'Updated Title' });
      const chain = createMutationChain([updatedPage]);
      db.update.mockReturnValue(chain);

      const result = await repository.update(TEST_IDS.PAGE_1, updateData);

      expect(result).toEqual(updatedPage);
      expect(db.update).toHaveBeenCalled();
    });

    it('should set updatedAt timestamp', async () => {
      const updateData = { title: 'Updated Title' };
      const chain = createMutationChain([createMockPage()]);
      db.update.mockReturnValue(chain);

      await repository.update(TEST_IDS.PAGE_1, updateData);

      const setCall = chain.set.mock.calls[0][0];
      expect(setCall.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt to current timestamp', async () => {
      const chain = createMutationChain(undefined);
      db.update.mockReturnValue(chain);

      await repository.softDelete(TEST_IDS.PAGE_1);

      expect(db.update).toHaveBeenCalled();
      const setCall = chain.set.mock.calls[0][0];
      expect(setCall.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('list', () => {
    it('should return { list, total } with basic pagination', async () => {
      const mockPages = [createMockPage(), createMockPage({ id: 2 })];
      const countChain = createSelectChain([{ count: 2 }]);
      const dataChain = createSelectChain(mockPages);
      db.select.mockReturnValueOnce(countChain).mockReturnValueOnce(dataChain);

      const result = await repository.list({ page: 1, pageSize: 10 });

      expect(result).toEqual({ list: mockPages, total: 2 });
    });

    it('should apply search filter on title/path/description', async () => {
      const countChain = createSelectChain([{ count: 1 }]);
      const dataChain = createSelectChain([createMockPage()]);
      db.select.mockReturnValueOnce(countChain).mockReturnValueOnce(dataChain);

      await repository.list({ page: 1, pageSize: 10, search: 'test' });

      expect(countChain.where).toHaveBeenCalled();
      expect(dataChain.where).toHaveBeenCalled();
    });

    it('should apply isPublished filter', async () => {
      const countChain = createSelectChain([{ count: 1 }]);
      const dataChain = createSelectChain([createMockPage()]);
      db.select.mockReturnValueOnce(countChain).mockReturnValueOnce(dataChain);

      await repository.list({ page: 1, pageSize: 10, isPublished: true });

      expect(countChain.where).toHaveBeenCalled();
      expect(dataChain.where).toHaveBeenCalled();
    });

    it('should order by sort desc then createdAt desc', async () => {
      const countChain = createSelectChain([{ count: 0 }]);
      const dataChain = createSelectChain([]);
      db.select.mockReturnValueOnce(countChain).mockReturnValueOnce(dataChain);

      await repository.list({ page: 1, pageSize: 10 });

      expect(dataChain.orderBy).toHaveBeenCalled();
    });

    it('should paginate with offset and limit', async () => {
      const countChain = createSelectChain([{ count: 20 }]);
      const dataChain = createSelectChain([]);
      db.select.mockReturnValueOnce(countChain).mockReturnValueOnce(dataChain);

      await repository.list({ page: 2, pageSize: 10 });

      expect(dataChain.limit).toHaveBeenCalledWith(10);
      expect(dataChain.offset).toHaveBeenCalledWith(10);
    });
  });
});
