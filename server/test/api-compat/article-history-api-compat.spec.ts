import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Article History API Compatibility Tests
 * Verifies all 5 article-history endpoints match Go backend response format.
 * All endpoints require JWT auth (no @Public() decorator).
 */
describe('Article History API Compat', () => {
  let ctx: TestContext;
  let articleId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Create an article to test history endpoints
    const res = await supertest(ctx.app.getHttpServer())
      .post('/api/articles')
      .set('authorization', `Bearer ${ctx.adminToken}`)
      .send({
        title: `History Test Article ${ctx.ts}`,
        content_md: '# Test Content',
        content_html: '<h1>Test Content</h1>',
        status: 'DRAFT',
      });

    if (res.body?.data?.id) {
      articleId = res.body.data.id;
    }
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/articles/:id/history (List history, JWT) ───────────

  describe('GET /api/articles/:id/history', () => {
    it('returns paginated history list', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history?page=1&pageSize=10`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Paginated response
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('rejects without auth', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history`);

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. GET /api/articles/:id/history/count (History count, JWT) ────

  describe('GET /api/articles/:id/history/count', () => {
    it('returns history count', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history/count`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('count');
    });

    it('rejects without auth', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history/count`);

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. GET /api/articles/:id/history/compare (Compare, JWT) ────────

  describe('GET /api/articles/:id/history/compare', () => {
    it('returns 400 without version params', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history/compare`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBe(400);
    });

    it('rejects without auth', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history/compare?v1=1&v2=2`);

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. GET /api/articles/:id/history/:version (Get version, JWT) ───

  describe('GET /api/articles/:id/history/:version', () => {
    it('returns history version detail', async () => {
      if (!articleId) return;

      // Version 1 is auto-created when article is created
      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history/1`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // History version has key fields
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('created_at');
    });

    it('rejects without auth', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/articles/${articleId}/history/1`);

      expect(res.status).toBe(401);
    });
  });

  // ─── 5. POST /api/articles/:id/history/:version/restore (Restore, JWT)

  describe('POST /api/articles/:id/history/:version/restore', () => {
    it('restores history version', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .post(`/api/articles/${articleId}/history/1/restore`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // NestJS POST returns code 201 (Go returns 200)
      assertSuccessResponse(res, 201);
      const data = res.body.data;

      // Restored version has key fields
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('title');
    });

    it('rejects without auth', async () => {
      if (!articleId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .post(`/api/articles/${articleId}/history/1/restore`);

      expect(res.status).toBe(401);
    });
  });
});
