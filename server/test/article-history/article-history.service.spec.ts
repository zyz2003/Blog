import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ArticleHistoryService } from '../../src/article-history/article-history.service';
import { ArticleHistoryRepository } from '../../src/article-history/article-history.repository';
import { DRIZZLE } from '../../src/database/database.module';
import { generatePublicID, decodePublicID, EntityType } from '../../src/common/utils/sqids.util';
import { createMockHistory, createMockArticle, createMockDb, TEST_IDS } from '../helpers/article-fixtures';

describe('ArticleHistoryService', () => {
  let service: ArticleHistoryService;
  let historyRepo: ArticleHistoryRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = createMockDb();

    const module = await Test.createTestingModule({
      providers: [
        ArticleHistoryService,
        { provide: ArticleHistoryRepository, useValue: {
          getLatestVersion: vi.fn(),
          create: vi.fn(),
          listByArticle: vi.fn(),
          getCount: vi.fn(),
          getByVersion: vi.fn(),
          deleteOldVersions: vi.fn(),
        }},
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get(ArticleHistoryService);
    historyRepo = module.get(ArticleHistoryRepository);
  });

  // ─── createHistory ────────────────────────────────────────────────

  describe('createHistory', () => {
    it('creates version=1 for first history record', async () => {
      const article = createMockArticle();
      (historyRepo.getLatestVersion as vi.Mock).mockResolvedValue(0);
      (historyRepo.create as vi.Mock).mockResolvedValue(createMockHistory({ version: 1 }));
      (historyRepo.deleteOldVersions as vi.Mock).mockResolvedValue(undefined);

      // Mock user lookup for editor nickname
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ nickname: 'Admin' }]),
          }),
        }),
      });

      await service.createHistory(article, 1, '创建文章');

      expect(historyRepo.getLatestVersion).toHaveBeenCalledWith(1);
      expect(historyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          articleId: 1,
          version: 1,
          title: 'Test Article',
          editorId: 1,
          changeNote: '创建文章',
        }),
      );
    });

    it('increments version for subsequent history records', async () => {
      const article = createMockArticle();
      (historyRepo.getLatestVersion as vi.Mock).mockResolvedValue(3);
      (historyRepo.create as vi.Mock).mockResolvedValue(createMockHistory({ version: 4 }));
      (historyRepo.deleteOldVersions as vi.Mock).mockResolvedValue(undefined);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ nickname: 'Admin' }]),
          }),
        }),
      });

      await service.createHistory(article, 1, '更新文章');

      expect(historyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 4,
        }),
      );
    });

    it('calls deleteOldVersions after creation', async () => {
      const article = createMockArticle();
      (historyRepo.getLatestVersion as vi.Mock).mockResolvedValue(0);
      (historyRepo.create as vi.Mock).mockResolvedValue(createMockHistory());
      (historyRepo.deleteOldVersions as vi.Mock).mockResolvedValue(undefined);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ nickname: 'Admin' }]),
          }),
        }),
      });

      await service.createHistory(article, 1);

      expect(historyRepo.deleteOldVersions).toHaveBeenCalledWith(1, 10);
    });

    it('snapshots article fields into history', async () => {
      const article = createMockArticle({
        title: 'Snapshot Title',
        contentMd: '# Content',
        coverUrl: 'https://example.com/cover.jpg',
        topImgUrl: 'https://example.com/top.jpg',
        primaryColor: '#ff0000',
        summaries: 'Summary text',
        wordCount: 42,
        keywords: 'key1,key2',
      });
      (historyRepo.getLatestVersion as vi.Mock).mockResolvedValue(0);
      (historyRepo.create as vi.Mock).mockResolvedValue(createMockHistory());
      (historyRepo.deleteOldVersions as vi.Mock).mockResolvedValue(undefined);

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ nickname: 'Admin' }]),
          }),
        }),
      });

      await service.createHistory(article, 1);

      expect(historyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Snapshot Title',
          contentMd: '# Content',
          coverUrl: 'https://example.com/cover.jpg',
          topImgUrl: 'https://example.com/top.jpg',
          primaryColor: '#ff0000',
          summaries: 'Summary text',
          wordCount: 42,
          keywords: 'key1,key2',
        }),
      );
    });
  });

  // ─── listHistory ──────────────────────────────────────────────────

  describe('listHistory', () => {
    it('returns paginated history list', async () => {
      const mockHistories = [
        createMockHistory({ id: 1, version: 2 }),
        createMockHistory({ id: 2, version: 1 }),
      ];
      (historyRepo.listByArticle as vi.Mock).mockResolvedValue({
        list: mockHistories,
        total: 2,
      });

      const result = await service.listHistory(TEST_IDS.article1, 1, 20);

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(20);
    });

    it('decodes Sqids article ID to DB ID', async () => {
      (historyRepo.listByArticle as vi.Mock).mockResolvedValue({
        list: [],
        total: 0,
      });

      await service.listHistory(TEST_IDS.article1, 1, 20);

      expect(historyRepo.listByArticle).toHaveBeenCalledWith(1, 1, 20);
    });

    it('maps history items without full content', async () => {
      const mockHistory = createMockHistory({ id: 1, version: 1 });
      (historyRepo.listByArticle as vi.Mock).mockResolvedValue({
        list: [mockHistory],
        total: 1,
      });

      const result = await service.listHistory(TEST_IDS.article1, 1, 20);

      const item = result.list[0];
      expect(item.id).toBe(TEST_IDS.history1);
      expect(item.version).toBe(1);
      expect(item.title).toBe('Test Article');
      expect(item.word_count).toBe(8);
      expect(item.editor_nickname).toBe('Admin');
      expect(item.change_note).toBe('Initial version');
      // List items should NOT have full content fields
      expect(item).not.toHaveProperty('content_md');
      expect(item).not.toHaveProperty('content_html');
    });
  });

  // ─── getHistoryVersion ────────────────────────────────────────────

  describe('getHistoryVersion', () => {
    it('returns specific version with full content', async () => {
      const mockHistory = createMockHistory({ id: 1, version: 1 });
      (historyRepo.getByVersion as vi.Mock).mockResolvedValue(mockHistory);

      const result = await service.getHistoryVersion(TEST_IDS.article1, 1);

      expect(result.version).toBe(1);
      expect(result.content_md).toBe('# Hello World\nThis is test content.');
      expect(result.content_html).toBe('<h1>Hello World</h1><p>This is test content.</p>');
      expect(result.article_id).toBe(TEST_IDS.article1);
    });

    it('throws NotFoundException when version does not exist', async () => {
      (historyRepo.getByVersion as vi.Mock).mockResolvedValue(null);

      await expect(service.getHistoryVersion(TEST_IDS.article1, 999))
        .rejects.toThrow('历史版本不存在');
    });
  });

  // ─── compareVersions ──────────────────────────────────────────────

  describe('compareVersions', () => {
    it('returns both versions with old/new ordering', async () => {
      const v1 = createMockHistory({ id: 1, version: 1, title: 'V1' });
      const v2 = createMockHistory({ id: 2, version: 2, title: 'V2' });
      (historyRepo.getByVersion as vi.Mock)
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await service.compareVersions(TEST_IDS.article1, 1, 2);

      expect(result.old_version.title).toBe('V1');
      expect(result.new_version.title).toBe('V2');
    });

    it('swaps versions so old_version is the smaller number', async () => {
      const v1 = createMockHistory({ id: 1, version: 1, title: 'V1' });
      const v2 = createMockHistory({ id: 2, version: 2, title: 'V2' });
      (historyRepo.getByVersion as vi.Mock)
        .mockResolvedValueOnce(v2) // v1=2
        .mockResolvedValueOnce(v1); // v2=1

      const result = await service.compareVersions(TEST_IDS.article1, 2, 1);

      expect(result.old_version.title).toBe('V1');
      expect(result.new_version.title).toBe('V2');
    });

    it('throws BadRequestException when both versions are the same', async () => {
      await expect(service.compareVersions(TEST_IDS.article1, 1, 1))
        .rejects.toThrow('两个版本号不能相同');
    });

    it('throws NotFoundException when first version does not exist', async () => {
      (historyRepo.getByVersion as vi.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockHistory());

      await expect(service.compareVersions(TEST_IDS.article1, 999, 1))
        .rejects.toThrow('版本 999 不存在');
    });

    it('throws NotFoundException when second version does not exist', async () => {
      (historyRepo.getByVersion as vi.Mock)
        .mockResolvedValueOnce(createMockHistory())
        .mockResolvedValueOnce(null);

      await expect(service.compareVersions(TEST_IDS.article1, 1, 999))
        .rejects.toThrow('版本 999 不存在');
    });
  });

  // ─── restoreVersion ───────────────────────────────────────────────

  describe('restoreVersion', () => {
    it('returns version data without modifying article', async () => {
      const mockHistory = createMockHistory({ id: 1, version: 1 });
      (historyRepo.getByVersion as vi.Mock).mockResolvedValue(mockHistory);

      const result = await service.restoreVersion(TEST_IDS.article1, 1);

      expect(result.version).toBe(1);
      expect(result.title).toBe('Test Article');
      expect(result.article_id).toBe(TEST_IDS.article1);
    });

    it('throws NotFoundException when version does not exist', async () => {
      (historyRepo.getByVersion as vi.Mock).mockResolvedValue(null);

      await expect(service.restoreVersion(TEST_IDS.article1, 999))
        .rejects.toThrow('历史版本不存在');
    });
  });

  // ─── getHistoryCount ──────────────────────────────────────────────

  describe('getHistoryCount', () => {
    it('returns count of history records', async () => {
      (historyRepo.getCount as vi.Mock).mockResolvedValue(5);

      const result = await service.getHistoryCount(TEST_IDS.article1);

      expect(result).toEqual({ count: 5 });
    });

    it('returns 0 when no history exists', async () => {
      (historyRepo.getCount as vi.Mock).mockResolvedValue(0);

      const result = await service.getHistoryCount(TEST_IDS.article1);

      expect(result).toEqual({ count: 0 });
    });
  });
});
