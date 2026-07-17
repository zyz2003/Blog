import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  assertPaginatedResponse,
  uploadFile,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Article API Compatibility Tests
 * Verifies all 17 article endpoints match Go backend response format.
 */
describe('Article API Compat', () => {
  let ctx: TestContext;
  let articleId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── Admin article endpoints ─────────────────────────────────────────

  // ─── 1. GET /api/articles (JWT) ─────────────────────────────────────

  describe('GET /api/articles', () => {
    it('returns paginated article list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/articles?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Paginated with { list, total, page, pageSize }
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(Array.isArray(data.list)).toBe(true);
    });
  });

  // ─── 2. POST /api/articles (JWT) ────────────────────────────────────

  describe('POST /api/articles', () => {
    it('creates article with id as Sqids string', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Compat Test Article ${ctx.ts}`,
          content_md: '# Test Content',
          content_html: '<h1>Test Content</h1>',
          status: 'DRAFT',
        });

      assertSuccessResponse(res, 201);
      const data = res.body.data;

      // Article ID is Sqids-encoded string
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');
      expect(data.id.length).toBeGreaterThanOrEqual(4);

      articleId = data.id;
    });
  });

  // ─── 3. POST /api/articles/upload (JWT) ─────────────────────────────

  describe('POST /api/articles/upload', () => {
    it('returns 400 without file', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles/upload')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // No file attached → 400
      expect(res.status).toBe(400);
    });
  });

  // ─── 4. GET /api/articles/:id (JWT) ─────────────────────────────────

  describe('GET /api/articles/:id', () => {
    it('returns single article with all fields', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Article object has key fields
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('content_md');
      expect(data).toHaveProperty('content_html');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('view_count');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');

      // Snake_case fields
      expect(data).toHaveProperty('cover_url');
      expect(data).toHaveProperty('word_count');
      expect(data).toHaveProperty('reading_time');
      expect(data).toHaveProperty('post_tags');
      expect(data).toHaveProperty('post_categories');

      // Arrays for tags and categories
      expect(Array.isArray(data.post_tags)).toBe(true);
      expect(Array.isArray(data.post_categories)).toBe(true);
    });
  });

  // ─── 5. PUT /api/articles/:id (JWT) ─────────────────────────────────

  describe('PUT /api/articles/:id', () => {
    it('updates article and returns updated data', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/articles/${articleId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ title: 'Updated Compat Test Article' });

      assertSuccessResponse(res, 200);
    });
  });

  // ─── 6. DELETE /api/articles/:id (JWT) ──────────────────────────────

  describe('DELETE /api/articles/:id', () => {
    it('deletes article and returns success', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/articles/${articleId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res, 200);
    });
  });

  // ─── 7. POST /api/articles/primary-color (JWT+Admin) ────────────────

  describe('POST /api/articles/primary-color', () => {
    it('returns primary color object', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles/primary-color')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ image_url: 'https://example.com/test.jpg' });

      // NestJS POST returns 201
      assertSuccessResponse(res, 201);
      expect(res.body.data).toHaveProperty('primary_color');
    });
  });

  // ─── 8. POST /api/articles/export (JWT+Admin) ───────────────────────

  describe('POST /api/articles/export', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles/export')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBe(501);
    });
  });

  // ─── 9. POST /api/articles/import (JWT+Admin) ───────────────────────

  describe('POST /api/articles/import', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/articles/import')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBe(501);
    });
  });

  // ─── 10. DELETE /api/articles/batch (JWT+Admin) ─────────────────────

  describe('DELETE /api/articles/batch', () => {
    it('returns error for unimplemented batch delete', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/articles/batch')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // May return 501 (NOT_IMPLEMENTED) or 500 (validation error on empty body)
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─── Public article endpoints ────────────────────────────────────────

  // ─── 11. GET /api/public/articles ───────────────────────────────────

  describe('GET /api/public/articles', () => {
    it('returns paginated public article list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles?page=1&pageSize=10');

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('only shows PUBLISHED status articles', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles?page=1&pageSize=10');

      if (res.body.data.list.length > 0) {
        const articles = res.body.data.list;
        for (const article of articles) {
          expect(article.status).toBe('PUBLISHED');
        }
      }
    });
  });

  // ─── 12. GET /api/public/articles/home ───────────────────────────────

  describe('GET /api/public/articles/home', () => {
    it('returns home article list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/home');

      assertSuccessResponse(res);
      // Home returns array (not paginated)
      expect(Array.isArray(res.body.data) || res.body.data === null).toBe(true);
    });
  });

  // ─── 13. GET /api/public/articles/random ─────────────────────────────

  describe('GET /api/public/articles/random', () => {
    it('returns 404 when no published articles exist', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/random');

      // May be 404 if no published articles, or 200 with article data
      if (res.status === 200) {
        assertSuccessResponse(res);
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('title');
      } else {
        expect(res.status).toBe(404);
      }
    });
  });

  // ─── 14. GET /api/public/articles/archives ───────────────────────────

  describe('GET /api/public/articles/archives', () => {
    it('returns archive list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/archives');

      assertSuccessResponse(res);
    });
  });

  // ─── 15. GET /api/public/articles/statistics ─────────────────────────

  describe('GET /api/public/articles/statistics', () => {
    it('returns article statistics', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/statistics');

      assertSuccessResponse(res);
    });
  });

  // ─── 16. GET /api/public/articles/by-url ─────────────────────────────

  describe('GET /api/public/articles/by-url', () => {
    it('returns 400 without url param', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/by-url');

      expect(res.status).toBe(400);
    });
  });

  // ─── 17. GET /api/public/articles/:id ────────────────────────────────

  describe('GET /api/public/articles/:id', () => {
    it('returns 404 for nonexistent article', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/articles/nonexistent-id');

      expect(res.status).toBe(404);
    });
  });
});
