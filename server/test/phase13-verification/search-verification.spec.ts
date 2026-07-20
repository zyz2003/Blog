/**
 * Phase 13: Search Field-by-Field Verification + Schema Push
 *
 * Go SearchResult baseline: _go-backend-archive/pkg/domain/model/search.go
 * Go SearchPagination: { total, page, size, totalPages }
 * Go SearchHit: { id, type, url, title, snippet, author, category, tags,
 *                 publish_date, cover_url, abbrlink, view_count, word_count,
 *                 reading_time, is_doc, doc_series_id }
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

describe('Search Field Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Seed an article so FTS5 index has content to search
    await supertest(ctx.app.getHttpServer())
      .post('/api/articles')
      .set('authorization', `Bearer ${ctx.adminToken}`)
      .send({
        title: `Searchable Article ${ctx.ts}`,
        content_md: '# Search Test Content for Phase 13 Verification',
        content_html: '<h1>Search Test Content</h1>',
        status: 'PUBLISHED',
      });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  describe('GET /api/search (MEDIUM)', () => {
    it('returns SearchResult with hits and pagination', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/search?q=test&page=1&size=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // SearchResult has pagination and hits
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('hits');
      expect(Array.isArray(data.hits)).toBe(true);
    });

    it('pagination has total, page, size, totalPages fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/search?q=test&page=1&size=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const pagination = res.body.data.pagination;

      // Go SearchPagination: { total, page, size, totalPages }
      expect(pagination).toHaveProperty('total');
      expect(typeof pagination.total).toBe('number');

      expect(pagination).toHaveProperty('page');
      expect(typeof pagination.page).toBe('number');

      expect(pagination).toHaveProperty('size');
      expect(typeof pagination.size).toBe('number');

      expect(pagination).toHaveProperty('totalPages');
      expect(typeof pagination.totalPages).toBe('number');
    });

    it('hits have correct SearchHit fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/search?q=test&page=1&size=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const hits = res.body.data.hits;

      if (hits.length > 0) {
        const hit = hits[0];

        // Go SearchHit fields
        expect(hit).toHaveProperty('id');
        expect(typeof hit.id).toBe('string');

        expect(hit).toHaveProperty('title');
        expect(typeof hit.title).toBe('string');

        // snippet: string
        if (hit.snippet !== undefined && hit.snippet !== null) {
          expect(typeof hit.snippet).toBe('string');
        }

        // type: string (omitempty)
        if (hit.type !== undefined && hit.type !== null) {
          expect(typeof hit.type).toBe('string');
        }

        // url: string (omitempty)
        if (hit.url !== undefined && hit.url !== null) {
          expect(typeof hit.url).toBe('string');
        }

        // author: string
        if (hit.author !== undefined && hit.author !== null) {
          expect(typeof hit.author).toBe('string');
        }

        // category: string
        if (hit.category !== undefined && hit.category !== null) {
          expect(typeof hit.category).toBe('string');
        }

        // tags: []string
        if (hit.tags !== undefined && hit.tags !== null) {
          expect(Array.isArray(hit.tags)).toBe(true);
        }

        // publish_date: time.Time → string
        if (hit.publish_date !== undefined && hit.publish_date !== null) {
          expect(typeof hit.publish_date).toBe('string');
        }

        // cover_url: string
        if (hit.cover_url !== undefined && hit.cover_url !== null) {
          expect(typeof hit.cover_url).toBe('string');
        }

        // abbrlink: string
        if (hit.abbrlink !== undefined && hit.abbrlink !== null) {
          expect(typeof hit.abbrlink).toBe('string');
        }

        // view_count: int
        if (hit.view_count !== undefined && hit.view_count !== null) {
          expect(typeof hit.view_count).toBe('number');
        }

        // word_count: int
        if (hit.word_count !== undefined && hit.word_count !== null) {
          expect(typeof hit.word_count).toBe('number');
        }

        // reading_time: int
        if (hit.reading_time !== undefined && hit.reading_time !== null) {
          expect(typeof hit.reading_time).toBe('number');
        }
      }
    });
  });
});
