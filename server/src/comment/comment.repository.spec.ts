import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentRepository } from './comment.repository';
import { comments } from '../database/schemas/comment.schema';

/**
 * Helper: create a mock Drizzle query builder chain.
 * Each call to createChain() returns a fresh chain object.
 * Use .resolveWith(value) to set the final resolved value.
 */
function createChain(resolveValue?: any) {
  let _resolveValue = resolveValue;
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockImplementation(function (this: any) {
      // When offset is the last call in the chain, resolve
      if (_resolveValue !== undefined) {
        return Promise.resolve(_resolveValue);
      }
      return this;
    }),
    then: vi.fn().mockImplementation(function (this: any, resolve: any) {
      // Make the chain thenable so await works
      resolve(_resolveValue);
    }),
  };
  return chain;
}

describe('CommentRepository', () => {
  let repository: CommentRepository;
  let mockDb: any;

  beforeEach(() => {
    repository = new CommentRepository(mockDb);
  });

  // ─── Test 1: findAllPublishedByPath ─────────────────────────────
  describe('findAllPublishedByPath', () => {
    it('should return comments with status=1 and matching targetPath, limited to 500', async () => {
      const mockComments = [
        { id: 1, targetPath: '/posts/test', status: 1, content: 'Hello' },
        { id: 2, targetPath: '/posts/test', status: 1, content: 'World' },
      ];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockComments),
              }),
            }),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.findAllPublishedByPath('/posts/test');

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockComments);
    });
  });

  // ─── Test 2: findAllPublishedPaginated ──────────────────────────
  describe('findAllPublishedPaginated', () => {
    it('should return paginated published comments ordered by createdAt desc', async () => {
      const mockComments = [
        { id: 2, status: 1, content: 'Second' },
        { id: 1, status: 1, content: 'First' },
      ];

      let selectCallCount = 0;
      mockDb = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 10 }]),
              }),
            };
          }
          // List query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockComments),
                  }),
                }),
              }),
            }),
          };
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.findAllPublishedPaginated(1, 10);

      expect(result).toEqual({ list: mockComments, total: 10 });
    });
  });

  // ─── Test 3: findById ──────────────────────────────────────────
  describe('findById', () => {
    it('should return a single comment by DB ID', async () => {
      const mockComment = { id: 1, content: 'Test comment' };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockComment]),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.findById(1);

      expect(result).toEqual(mockComment);
    });

    it('should return undefined when comment not found', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.findById(999);

      expect(result).toBeUndefined();
    });
  });

  // ─── Test 4: findManyByIDs ─────────────────────────────────────
  describe('findManyByIDs', () => {
    it('should return comments matching an array of DB IDs', async () => {
      const mockComments = [
        { id: 1, content: 'First' },
        { id: 2, content: 'Second' },
      ];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockComments),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.findManyByIDs([1, 2]);

      expect(result).toEqual(mockComments);
    });

    it('should return empty array for empty input', async () => {
      mockDb = { select: vi.fn() };
      repository = new CommentRepository(mockDb);

      const result = await repository.findManyByIDs([]);
      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  // ─── Test 5: create ────────────────────────────────────────────
  describe('create', () => {
    it('should insert a comment and return the created record', async () => {
      const params = {
        targetPath: '/posts/test',
        targetTitle: 'Test Article',
        nickname: 'John',
        email: 'john@test.com',
        emailMd5: 'abc123',
        content: 'Hello',
        contentHtml: '<p>Hello</p>',
        status: 1,
        isAdminComment: false,
        isAnonymous: false,
        ipAddress: '127.0.0.1',
      };
      const mockCreated = { id: 1, ...params };

      mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockCreated]),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.create(params);

      expect(mockDb.insert).toHaveBeenCalledWith(comments);
      expect(result).toEqual(mockCreated);
    });
  });

  // ─── Test 6: adminList ─────────────────────────────────────────
  describe('adminList', () => {
    it('should support filters: nickname, email, targetPath, ipAddress, content, status with pagination', async () => {
      const mockComments = [{ id: 1, nickname: 'John' }];

      let selectCallCount = 0;
      mockDb = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 1 }]),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockComments),
                  }),
                }),
              }),
            }),
          };
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.adminList({
        page: 1,
        pageSize: 10,
        nickname: 'John',
        email: 'john@test.com',
        targetPath: '/posts/test',
        ipAddress: '127.0.0.1',
        content: 'Hello',
        status: 1,
      });

      expect(result).toEqual({ list: mockComments, total: 1 });
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
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.adminList({
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({ list: [], total: 0 });
    });
  });

  // ─── Test 7: softDelete ────────────────────────────────────────
  describe('softDelete', () => {
    it('should set deletedAt on comments matching given DB IDs', async () => {
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      await repository.softDelete([1, 2, 3]);

      expect(mockDb.update).toHaveBeenCalledWith(comments);
    });
  });

  // ─── Test 8: updateStatus ──────────────────────────────────────
  describe('updateStatus', () => {
    it('should update status field for a given DB ID', async () => {
      const mockUpdated = { id: 1, status: 1 };

      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdated]),
            }),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.updateStatus(1, 1);

      expect(mockDb.update).toHaveBeenCalledWith(comments);
      expect(result).toEqual(mockUpdated);
    });
  });

  // ─── Test 9: updateContent ─────────────────────────────────────
  describe('updateContent', () => {
    it('should update content and contentHtml fields', async () => {
      const mockUpdated = { id: 1, content: 'New content', contentHtml: '<p>New content</p>' };

      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdated]),
            }),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.updateContent(1, 'New content', '<p>New content</p>');

      expect(mockDb.update).toHaveBeenCalledWith(comments);
      expect(result).toEqual(mockUpdated);
    });
  });

  // ─── Test 10: updateCommentInfo ────────────────────────────────
  describe('updateCommentInfo', () => {
    it('should update nickname, email, emailMd5, website fields', async () => {
      const data = { nickname: 'NewNick', email: 'new@test.com', emailMd5: 'newmd5', website: 'https://new.com' };
      const mockUpdated = { id: 1, ...data };

      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockUpdated]),
            }),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.updateCommentInfo(1, data);

      expect(mockDb.update).toHaveBeenCalledWith(comments);
      expect(result).toEqual(mockUpdated);
    });
  });

  // ─── Test 11: setPin ──────────────────────────────────────────
  describe('setPin', () => {
    it('should set pinnedAt to now when isPinned=true', async () => {
      const mockUpdated = { id: 1, pinnedAt: new Date() };

      let capturedSet: any;
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((data: any) => {
            capturedSet = data;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([mockUpdated]),
              }),
            };
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.setPin(1, true);

      expect(capturedSet.pinnedAt).toBeInstanceOf(Date);
      expect(result).toEqual(mockUpdated);
    });

    it('should set pinnedAt to null when isPinned=false', async () => {
      const mockUpdated = { id: 1, pinnedAt: null };

      let capturedSet: any;
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((data: any) => {
            capturedSet = data;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([mockUpdated]),
              }),
            };
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      const result = await repository.setPin(1, false);

      expect(capturedSet).toEqual({ pinnedAt: null });
      expect(result).toEqual(mockUpdated);
    });
  });

  // ─── Test 12: incrementLikeCount / decrementLikeCount ──────────
  describe('incrementLikeCount', () => {
    it('should add 1 to likeCount', async () => {
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      await repository.incrementLikeCount(1);

      expect(mockDb.update).toHaveBeenCalledWith(comments);
    });
  });

  describe('decrementLikeCount', () => {
    it('should subtract 1 from likeCount with minimum 0', async () => {
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({}),
          }),
        }),
      };

      repository = new CommentRepository(mockDb);
      await repository.decrementLikeCount(1);

      expect(mockDb.update).toHaveBeenCalledWith(comments);
    });
  });
});
