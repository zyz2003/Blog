import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ArticleService } from '../../src/article/article.service';
import { ArticleRepository, calculatePostStats, diffIDs } from '../../src/article/article.repository';
import { PostCategoryRepository } from '../../src/post-category/post-category.repository';
import { PostTagRepository } from '../../src/post-tag/post-tag.repository';
import { ArticleHistoryService } from '../../src/article-history/article-history.service';
import { DRIZZLE } from '../../src/database/database.module';
import { generatePublicID, decodePublicID, EntityType } from '../../src/common/utils/sqids.util';
import {
  createMockArticle,
  createMockCategory,
  createMockTag,
  createMockCreateArticleDto,
  createMockUpdateArticleDto,
  createMockDb,
  TEST_IDS,
} from '../helpers/article-fixtures';

describe('ArticleService', () => {
  let service: ArticleService;
  let articleRepo: ArticleRepository;
  let categoryRepo: PostCategoryRepository;
  let tagRepo: PostTagRepository;
  let historyService: ArticleHistoryService;

  beforeEach(async () => {
    const mockDb = createMockDb();

    const module = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: ArticleRepository, useValue: {
          findByIdWithRelations: vi.fn(),
          createWithAssociations: vi.fn(),
          updateWithAssociations: vi.fn(),
          softDelete: vi.fn(),
          existsByAbbrlink: vi.fn(),
          list: vi.fn(),
          listPublic: vi.fn(),
          listHome: vi.fn(),
          getRandom: vi.fn(),
          listArchives: vi.fn(),
          getArticleStatistics: vi.fn(),
          findByAbbrlinkOrId: vi.fn(),
          findPrevNextArticles: vi.fn(),
          incrementViewCount: vi.fn(),
        }},
        { provide: PostCategoryRepository, useValue: {
          incrementCount: vi.fn(),
          decrementCount: vi.fn(),
        }},
        { provide: PostTagRepository, useValue: {
          incrementCount: vi.fn(),
          decrementCount: vi.fn(),
        }},
        { provide: ArticleHistoryService, useValue: {
          createHistory: vi.fn(),
        }},
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get(ArticleService);
    articleRepo = module.get(ArticleRepository);
    categoryRepo = module.get(PostCategoryRepository);
    tagRepo = module.get(PostTagRepository);
    historyService = module.get(ArticleHistoryService);
  });

  // ─── toApiResponse ────────────────────────────────────────────────

  describe('toApiResponse', () => {
    it('maps all article fields correctly', () => {
      const article = createMockArticle();
      const result = service.toApiResponse(article, false, true);

      // ID should be Sqids-encoded
      expect(result.id).toBe(TEST_IDS.article1);
      // Dates should be formatted strings
      expect(typeof result.created_at).toBe('string');
      expect(typeof result.updated_at).toBe('string');
      // Core fields
      expect(result.title).toBe('Test Article');
      expect(result.content_md).toBe('# Hello World\nThis is test content.');
      expect(result.content_html).toBe('<h1>Hello World</h1><p>This is test content.</p>');
      expect(result.cover_url).toBe('https://example.com/cover.jpg');
      expect(result.status).toBe('PUBLISHED');
      expect(result.view_count).toBe(100);
      expect(result.word_count).toBe(8);
      expect(result.reading_time).toBe(1);
      expect(result.abbrlink).toBe('test-article');
      // Default fields
      expect(result.comment_count).toBe(0);
      expect(result.is_takedown).toBe(false);
      expect(result.is_doc).toBe(false);
    });

    it('uses abbrlink as ID when useAbbrlinkAsID=true and abbrlink exists', () => {
      const article = createMockArticle({ abbrlink: 'my-post' });
      const result = service.toApiResponse(article, true, false);
      expect(result.id).toBe('my-post');
    });

    it('uses Sqids ID when useAbbrlinkAsID=true but abbrlink is null', () => {
      const article = createMockArticle({ abbrlink: null });
      const result = service.toApiResponse(article, true, false);
      expect(result.id).toBe(TEST_IDS.article1);
    });

    it('excludes content_html when includeHTML=false', () => {
      const article = createMockArticle();
      const result = service.toApiResponse(article, false, false);
      expect(result.content_html).toBeNull();
    });

    it('includes content_html when includeHTML=true', () => {
      const article = createMockArticle();
      const result = service.toApiResponse(article, false, true);
      expect(result.content_html).toBe('<h1>Hello World</h1><p>This is test content.</p>');
    });

    it('top_img_url falls back to cover_url when topImgUrl is null', () => {
      const article = createMockArticle({ topImgUrl: null, coverUrl: 'https://example.com/cover.jpg' });
      const result = service.toApiResponse(article, false, true);
      expect(result.top_img_url).toBe('https://example.com/cover.jpg');
    });

    it('top_img_url is null when both topImgUrl and coverUrl are null', () => {
      const article = createMockArticle({ topImgUrl: null, coverUrl: null });
      const result = service.toApiResponse(article, false, true);
      expect(result.top_img_url).toBeNull();
    });

    it('maps nested postTags with Sqids IDs', () => {
      const tag = createMockTag();
      const article = createMockArticle({ postTags: [tag] });
      const result = service.toApiResponse(article, false, true);
      expect(result.post_tags).toHaveLength(1);
      expect(result.post_tags[0].id).toBe(TEST_IDS.tag1);
      expect(result.post_tags[0].name).toBe('JavaScript');
    });

    it('maps nested postCategories with Sqids IDs', () => {
      const category = createMockCategory();
      const article = createMockArticle({ postCategories: [category] });
      const result = service.toApiResponse(article, false, true);
      expect(result.post_categories).toHaveLength(1);
      expect(result.post_categories[0].id).toBe(TEST_IDS.category1);
      expect(result.post_categories[0].name).toBe('Technology');
    });

    it('maps owner info correctly', () => {
      const article = createMockArticle();
      const result = service.toApiResponse(article, false, true);
      expect(result.owner_nickname).toBe('Admin');
      expect(result.owner_avatar).toBe('https://example.com/avatar.jpg');
      expect(result.owner_email).toBe('admin@test.com');
    });

    it('handles null owner gracefully', () => {
      const article = createMockArticle({ owner: null });
      const result = service.toApiResponse(article, false, true);
      expect(result.owner_nickname).toBeNull();
      expect(result.owner_avatar).toBeNull();
      expect(result.owner_email).toBeNull();
    });

    it('encodes doc_series_id via Sqids when present', () => {
      const article = createMockArticle({ docSeriesId: 1 });
      const result = service.toApiResponse(article, false, true);
      expect(result.doc_series_id).toBe(TEST_IDS.docSeries1);
    });

    it('returns null doc_series_id when docSeriesId is null', () => {
      const article = createMockArticle({ docSeriesId: null });
      const result = service.toApiResponse(article, false, true);
      expect(result.doc_series_id).toBeNull();
    });
  });

  // ─── create ───────────────────────────────────────────────────────

  describe('create', () => {
    it('creates article with category/tag associations and count sync', async () => {
      const dto = createMockCreateArticleDto({
        post_category_ids: [TEST_IDS.category1],
        post_tag_ids: [TEST_IDS.tag1],
      });
      const mockArticle = createMockArticle({ id: 1 });
      const mockWithRelations = createMockArticle({ id: 1 });

      (articleRepo.createWithAssociations as vi.Mock).mockResolvedValue(mockArticle);
      (articleRepo.findByIdWithRelations as vi.Mock).mockResolvedValue(mockWithRelations);
      (historyService.createHistory as vi.Mock).mockResolvedValue(undefined);

      const result = await service.create(dto, 1);

      // Verify category/tag IDs were decoded
      expect(articleRepo.createWithAssociations).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 1, title: 'New Article' }),
        [1], // category DB ID decoded from Sqids
        [1], // tag DB ID decoded from Sqids
      );
      // Verify count sync
      expect(categoryRepo.incrementCount).toHaveBeenCalledWith(1);
      expect(tagRepo.incrementCount).toHaveBeenCalledWith(1);
      // Verify history creation
      expect(historyService.createHistory).toHaveBeenCalled();
    });

    it('calculates wordCount and readingTime from content_md', async () => {
      const dto = createMockCreateArticleDto({ content_md: 'Hello world test content' });
      const mockArticle = createMockArticle({ id: 1 });
      (articleRepo.createWithAssociations as vi.Mock).mockResolvedValue(mockArticle);
      (articleRepo.findByIdWithRelations as vi.Mock).mockResolvedValue(createMockArticle());

      await service.create(dto, 1);

      const callData = (articleRepo.createWithAssociations as vi.Mock).mock.calls[0][0];
      expect(callData.wordCount).toBeGreaterThan(0);
      expect(callData.readingTime).toBeGreaterThan(0);
    });

    it('validates abbrlink when provided', async () => {
      const dto = createMockCreateArticleDto({ abbrlink: 'admin' });
      // 'admin' is a reserved path — should throw
      await expect(service.create(dto, 1)).rejects.toThrow();
    });

    it('does not block on history creation failure', async () => {
      const dto = createMockCreateArticleDto();
      const mockArticle = createMockArticle({ id: 1 });
      (articleRepo.createWithAssociations as vi.Mock).mockResolvedValue(mockArticle);
      (articleRepo.findByIdWithRelations as vi.Mock).mockResolvedValue(createMockArticle());
      (historyService.createHistory as vi.Mock).mockRejectedValue(new Error('DB error'));

      // Should NOT throw — history failure is non-blocking
      const result = await service.create(dto, 1);
      expect(result).toBeDefined();
    });
  });

  // ─── update ───────────────────────────────────────────────────────

  describe('update', () => {
    it('updates article and syncs category/tag counts via diff', async () => {
      const existingArticle = createMockArticle({
        id: 1,
        postCategories: [createMockCategory({ id: 1 })],
        postTags: [createMockTag({ id: 1 })],
      });
      const updatedArticle = createMockArticle({ id: 1 });

      (articleRepo.findByIdWithRelations as vi.Mock).mockResolvedValue(existingArticle);
      (articleRepo.updateWithAssociations as vi.Mock).mockResolvedValue(updatedArticle);
      // Second call returns updated article
      (articleRepo.findByIdWithRelations as vi.Mock)
        .mockResolvedValueOnce(existingArticle)
        .mockResolvedValueOnce(updatedArticle);

      const dto = createMockUpdateArticleDto({
        post_category_ids: [TEST_IDS.category2], // Changed from category1 to category2
        post_tag_ids: [TEST_IDS.tag1], // Same tag
      });

      const result = await service.update(TEST_IDS.article1, dto, 1);

      // Category diff: inc=[2], dec=[1]
      expect(categoryRepo.incrementCount).toHaveBeenCalledWith(2);
      expect(categoryRepo.decrementCount).toHaveBeenCalledWith(1);
      // Tag diff: no change (same tag)
    });

    it('throws NotFoundException when article does not exist', async () => {
      (articleRepo.findByIdWithRelations as vi.Mock).mockResolvedValue(null);

      await expect(service.update(TEST_IDS.article1, createMockUpdateArticleDto(), 1))
        .rejects.toThrow('文章不存在');
    });
  });

  // ─── delete ───────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes article and decrements category/tag counts', async () => {
      const existingArticle = createMockArticle({
        id: 1,
        postCategories: [createMockCategory({ id: 1 })],
        postTags: [createMockTag({ id: 1 })],
      });

      (articleRepo.findByIdWithRelations as vi.Mock).mockResolvedValue(existingArticle);
      (articleRepo.softDelete as vi.Mock).mockResolvedValue(existingArticle);

      await service.delete(TEST_IDS.article1);

      expect(articleRepo.softDelete).toHaveBeenCalledWith(1);
      expect(categoryRepo.decrementCount).toHaveBeenCalledWith(1);
      expect(tagRepo.decrementCount).toHaveBeenCalledWith(1);
    });

    it('throws NotFoundException when article does not exist', async () => {
      (articleRepo.findByIdWithRelations as vi.Mock).mockResolvedValue(null);

      await expect(service.delete(TEST_IDS.article1))
        .rejects.toThrow('文章不存在');
    });
  });

  // ─── list ─────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated article list', async () => {
      const mockList = [createMockArticle({ id: 1 })];
      (articleRepo.list as vi.Mock).mockResolvedValue({ list: mockList, total: 1 });

      const result = await service.list({ page: 1, pageSize: 10 });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(10);
    });
  });

  // ─── validateAbbrlink ─────────────────────────────────────────────

  describe('validateAbbrlink', () => {
    it('rejects reserved paths', async () => {
      await expect(service.validateAbbrlink('admin')).rejects.toThrow('系统保留路径');
    });

    it('rejects paths with forward slashes', async () => {
      await expect(service.validateAbbrlink('posts/test')).rejects.toThrow('斜杠');
    });

    it('rejects abbrlink exceeding 200 characters', async () => {
      const longAbbrlink = 'a'.repeat(201);
      await expect(service.validateAbbrlink(longAbbrlink)).rejects.toThrow('200');
    });

    it('rejects duplicate abbrlink', async () => {
      (articleRepo.existsByAbbrlink as vi.Mock).mockResolvedValue(true);
      await expect(service.validateAbbrlink('my-post')).rejects.toThrow('已被其他文章使用');
    });

    it('accepts unique abbrlink', async () => {
      (articleRepo.existsByAbbrlink as vi.Mock).mockResolvedValue(false);
      // Should not throw
      await expect(service.validateAbbrlink('my-unique-post')).resolves.toBeUndefined();
    });

    it('accepts duplicate abbrlink when excluded by same article', async () => {
      (articleRepo.existsByAbbrlink as vi.Mock).mockResolvedValue(false);
      await expect(service.validateAbbrlink('my-post', 1)).resolves.toBeUndefined();
    });
  });

  // ─── calculatePostStats (exported from repository) ────────────────

  describe('calculatePostStats', () => {
    it('counts Chinese characters', () => {
      const { wordCount } = calculatePostStats('你好世界测试');
      // 6 Chinese chars + 1 whitespace-split token = 7
      expect(wordCount).toBe(7);
    });

    it('counts English words', () => {
      const { wordCount } = calculatePostStats('Hello World Test');
      expect(wordCount).toBe(3);
    });

    it('counts mixed Chinese and English', () => {
      const { wordCount } = calculatePostStats('你好 World 测试 Test');
      // Chinese chars: 你好(2)+测试(2)=4, whitespace-split tokens: 4 = total 8
      expect(wordCount).toBe(8);
    });

    it('calculates reading time (ceil wordCount / 200)', () => {
      const { readingTime } = calculatePostStats('a '.repeat(200).trim());
      expect(readingTime).toBe(1);
    });

    it('returns 0 for empty content', () => {
      const { wordCount, readingTime } = calculatePostStats('');
      expect(wordCount).toBe(0);
      expect(readingTime).toBe(0);
    });

    it('returns 0 for null content', () => {
      const { wordCount, readingTime } = calculatePostStats(null as any);
      expect(wordCount).toBe(0);
      expect(readingTime).toBe(0);
    });

    it('minimum reading time is 1 when wordCount > 0', () => {
      const { readingTime } = calculatePostStats('Hello');
      expect(readingTime).toBe(1);
    });
  });

  // ─── diffIDs (exported from repository) ───────────────────────────

  describe('diffIDs', () => {
    it('detects added IDs', () => {
      const result = diffIDs([1, 2], [1, 2, 3]);
      expect(result.inc).toEqual([3]);
      expect(result.dec).toEqual([]);
    });

    it('detects removed IDs', () => {
      const result = diffIDs([1, 2, 3], [1, 2]);
      expect(result.inc).toEqual([]);
      expect(result.dec).toEqual([3]);
    });

    it('detects both added and removed IDs', () => {
      const result = diffIDs([1, 2], [2, 3]);
      expect(result.inc).toEqual([3]);
      expect(result.dec).toEqual([1]);
    });

    it('returns empty arrays when no change', () => {
      const result = diffIDs([1, 2], [1, 2]);
      expect(result.inc).toEqual([]);
      expect(result.dec).toEqual([]);
    });

    it('handles empty old set', () => {
      const result = diffIDs([], [1, 2]);
      expect(result.inc).toEqual([1, 2]);
      expect(result.dec).toEqual([]);
    });

    it('handles empty new set', () => {
      const result = diffIDs([1, 2], []);
      expect(result.inc).toEqual([]);
      expect(result.dec).toEqual([1, 2]);
    });
  });
});
