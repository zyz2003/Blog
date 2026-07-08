import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { SearchService } from './search.service';
import { SettingsService } from '../settings/settings.service';
import { initSqidsEncoderWithSeed } from '../common/utils/sqids.util';

// Initialize Sqids encoder for tests that use generatePublicID
initSqidsEncoderWithSeed('test-seed');

describe('SearchService', () => {
  let service: SearchService;
  let mockDb: any;
  let mockSettingsService: any;

  // Track db.run() calls
  let runCalls: any[];

  beforeEach(async () => {
    runCalls = [];

    // Mock Drizzle db
    mockDb = {
      run: vi.fn((sqlObj) => {
        runCalls.push(sqlObj);
        return { changes: 1 };
      }),
      all: vi.fn(),
      get: vi.fn(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
    };

    mockSettingsService = {
      get: vi.fn((key: string) => {
        if (key === 'FRONT_DESK_SITE_OWNER_NAME') return '安知鱼';
        return undefined;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: 'DRIZZLE',
          useValue: mockDb,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  /**
   * Helper: extract SQL string from a Drizzle sql`` tagged template call.
   * Drizzle sql tag produces objects with queryChunks containing
   * StringChunk objects (with .value arrays) and raw parameter values.
   */
  function getSqlString(sqlObj: any): string {
    if (typeof sqlObj === 'string') return sqlObj;
    const chunks = sqlObj.queryChunks || [];
    const parts: string[] = [];
    for (const chunk of chunks) {
      if (chunk && typeof chunk === 'object' && Array.isArray(chunk.value)) {
        parts.push(chunk.value.join(''));
      } else if (typeof chunk === 'number' || typeof chunk === 'string') {
        parts.push('?');
      }
    }
    return parts.join('');
  }

  function getSqlParams(sqlObj: any): any[] {
    if (typeof sqlObj === 'string') return [];
    const chunks = sqlObj.queryChunks || [];
    const params: any[] = [];
    for (const chunk of chunks) {
      if (typeof chunk === 'number' || typeof chunk === 'string') {
        params.push(chunk);
      }
    }
    return params;
  }

  describe('ensureFts5Table', () => {
    it('Test 1: should create articles_fts virtual table with contentless mode and unicode61 tokenizer', async () => {
      // Mock select chain for rebuildAllIndexes (called by ensureFts5Table)
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      await service.ensureFts5Table();

      // Verify CREATE VIRTUAL TABLE was called
      const createCall = runCalls.find((c) => {
        const sql = getSqlString(c);
        return sql.includes('CREATE VIRTUAL TABLE') && sql.includes('articles_fts');
      });
      expect(createCall).toBeDefined();
      const sqlStr = getSqlString(createCall);
      expect(sqlStr).toContain("content=''");
      expect(sqlStr).toContain('unicode61');
    });
  });

  describe('rebuildAllIndexes', () => {
    it('Test 2: should insert all published articles into FTS5 with HTML-stripped content', async () => {
      const publishedArticles = [
        {
          id: 1,
          title: 'Test Article',
          contentHtml: '<p>Hello <strong>world</strong></p>',
          keywords: 'test, article',
        },
      ];

      // Mock the Drizzle select chain for published articles
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(publishedArticles),
        }),
      });

      await service.rebuildAllIndexes();

      // Verify INSERT INTO articles_fts was called
      const insertCall = runCalls.find((c) => {
        const sql = getSqlString(c);
        return sql.includes('INSERT INTO articles_fts');
      });
      expect(insertCall).toBeDefined();
      // Content should have HTML stripped
      const params = getSqlParams(insertCall);
      expect(params).toContain('Hello world');
    });
  });

  describe('indexArticle', () => {
    it('Test 3: should insert a single article into FTS5 with rowid=article.id', async () => {
      const article = {
        id: 42,
        title: 'Indexed Article',
        contentHtml: '<p>Some <em>content</em> here</p>',
        keywords: 'indexed',
      };

      await service.indexArticle(article);

      const insertCall = runCalls.find((c) => {
        const sql = getSqlString(c);
        return sql.includes('INSERT INTO articles_fts');
      });
      expect(insertCall).toBeDefined();
      // rowid should equal article.id
      const params = getSqlParams(insertCall);
      expect(params[0]).toBe(42);
      // Content should be HTML-stripped
      expect(params[2]).toBe('Some content here');
    });
  });

  describe('deleteArticle', () => {
    it('Test 4: should remove an article from FTS5 by rowid', async () => {
      await service.deleteArticle(42);

      const deleteCall = runCalls.find((c) => {
        const sql = getSqlString(c);
        return sql.includes('DELETE FROM articles_fts');
      });
      expect(deleteCall).toBeDefined();
      const params = getSqlParams(deleteCall);
      expect(params[0]).toBe(42);
    });
  });

  describe('search', () => {
    it('Test 5: should return matching articles with bm25 ranking, paginated', async () => {
      // Mock FTS5 MATCH query results
      const ftsResults = [
        { id: 1, rank: -2.5 },
        { id: 5, rank: -1.8 },
      ];

      // Mock the all() call for FTS5 search
      mockDb.all = vi.fn().mockResolvedValue(ftsResults);

      // Mock count query
      mockDb.get = vi.fn().mockResolvedValue({ total: 2 });

      // Mock article data
      const articlesData = [
        {
          id: 1,
          title: 'First Match',
          contentHtml: '<p>Content one</p>',
          coverUrl: null,
          abbrlink: 'first-post',
          viewCount: 100,
          wordCount: 500,
          readingTime: 3,
          isDoc: false,
          docSeriesId: null,
          keywords: 'test',
          ownerId: 1,
          copyrightAuthor: null,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 5,
          title: 'Second Match',
          contentHtml: '<p>Content two</p>',
          coverUrl: '/cover.jpg',
          abbrlink: 'second-post',
          viewCount: 50,
          wordCount: 300,
          readingTime: 2,
          isDoc: true,
          docSeriesId: 10,
          keywords: 'doc',
          ownerId: 1,
          copyrightAuthor: 'Author',
          createdAt: new Date('2026-02-01'),
        },
      ];

      // Mock select for article data — needs to handle multiple select calls
      let selectCallIndex = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallIndex++;
        const chain = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              if (selectCallIndex === 1) {
                // Article data query
                return Promise.resolve(articlesData);
              }
              // Category/tag queries return empty
              return Promise.resolve([]);
            }),
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return chain;
      });

      const result = await service.search('test query', 1, 10);

      expect(result).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.size).toBe(10);
      expect(result.hits).toBeDefined();
      expect(Array.isArray(result.hits)).toBe(true);
    });

    it('Test 6: should return empty results for empty query', async () => {
      const result = await service.search('', 1, 10);

      expect(result).toBeDefined();
      expect(result.pagination.total).toBe(0);
      expect(result.hits).toEqual([]);
    });
  });

  describe('extractSnippet', () => {
    it('Test 7: should strip HTML tags and truncate to 150 chars with ellipsis', () => {
      // Short content — no truncation
      const short = service.extractSnippet('<p>Hello world</p>');
      expect(short).toBe('Hello world');

      // Long content — truncation with ellipsis
      const longContent = '<p>' + 'A'.repeat(200) + '</p>';
      const longSnippet = service.extractSnippet(longContent);
      expect(longSnippet.length).toBeLessThanOrEqual(153); // 150 + "..."
      expect(longSnippet.endsWith('...')).toBe(true);

      // Verify HTML is stripped
      const htmlContent = '<div><p>Bold <strong>text</strong></p><br/><a href="#">link</a></div>';
      const stripped = service.extractSnippet(htmlContent);
      expect(stripped).not.toContain('<');
      expect(stripped).not.toContain('>');
    });
  });

  describe('normalizeSearchHits', () => {
    it('Test 8: should fill type="post" and url="/posts/{abbrlink}" for non-doc articles, type="doc" and url="/doc/{id}" for doc articles', () => {
      // Non-doc article with abbrlink
      const postHit = {
        id: 'abc123',
        type: '',
        url: '',
        title: 'Test Post',
        snippet: 'test',
        author: 'Author',
        category: 'Tech',
        tags: ['js'],
        publish_date: '2026-01-01T00:00:00.000Z',
        cover_url: null,
        abbrlink: 'my-post',
        view_count: 10,
        word_count: 100,
        reading_time: 1,
        is_doc: false,
        doc_series_id: '',
      };

      // Doc article
      const docHit = {
        id: 'def456',
        type: '',
        url: '',
        title: 'Test Doc',
        snippet: 'doc',
        author: 'Author',
        category: 'Guide',
        tags: [],
        publish_date: '2026-01-01T00:00:00.000Z',
        cover_url: null,
        abbrlink: '',
        view_count: 5,
        word_count: 50,
        reading_time: 1,
        is_doc: true,
        doc_series_id: 'xyz789',
      };

      const hits = service.normalizeSearchHits([postHit, docHit]);

      // Post: type="post", url="/posts/{abbrlink}"
      expect(hits[0].type).toBe('post');
      expect(hits[0].url).toBe('/posts/my-post');

      // Doc: type="doc", url="/doc/{id}"
      expect(hits[1].type).toBe('doc');
      expect(hits[1].url).toBe('/doc/def456');
    });

    it('should use id as fallback when abbrlink is empty for post type', () => {
      const hit = {
        id: 'abc123',
        type: '',
        url: '',
        title: 'No Abbrlink',
        snippet: 'test',
        author: 'Author',
        category: '',
        tags: [],
        publish_date: '2026-01-01T00:00:00.000Z',
        cover_url: null,
        abbrlink: '',
        view_count: 0,
        word_count: 0,
        reading_time: 0,
        is_doc: false,
        doc_series_id: '',
      };

      const [result] = service.normalizeSearchHits([hit]);
      expect(result.type).toBe('post');
      expect(result.url).toBe('/posts/abc123');
    });

    it('should skip normalization when type is already set', () => {
      const hit = {
        id: 'abc123',
        type: 'album',
        url: '/album/1',
        title: 'Album',
        snippet: '',
        author: '',
        category: '',
        tags: [],
        publish_date: '',
        cover_url: null,
        abbrlink: '',
        view_count: 0,
        word_count: 0,
        reading_time: 0,
        is_doc: false,
        doc_series_id: '',
      };

      const [result] = service.normalizeSearchHits([hit]);
      expect(result.type).toBe('album');
      expect(result.url).toBe('/album/1');
    });
  });
});
