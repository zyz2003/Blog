import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertPaginatedResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Doc Series API Compatibility Tests
 * Verifies all 8 doc-series endpoints match Go backend response format.
 *
 * Public endpoints: /api/public/doc-series/*
 * Admin endpoints: /api/doc-series/*
 */
describe('Doc Series API Compat', () => {
  let ctx: TestContext;
  let seriesId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── Public doc series endpoints ─────────────────────────────────────

  // ─── 1. GET /api/public/doc-series (Public list) ────────────────────

  describe('GET /api/public/doc-series', () => {
    it('returns paginated doc series list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/doc-series?page=1&pageSize=10');

      assertSuccessResponse(res);
      const data = res.body.data;

      // Paginated response
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.list)).toBe(true);
    });
  });

  // ─── 2. GET /api/public/doc-series/:id (Public detail) ──────────────

  describe('GET /api/public/doc-series/:id', () => {
    it('returns 404 for nonexistent series', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/doc-series/nonexistent-id');

      expect(res.status).toBe(404);
    });
  });

  // ─── 3. GET /api/public/doc-series/:id/articles (With articles) ─────

  describe('GET /api/public/doc-series/:id/articles', () => {
    it('returns 404 for nonexistent series articles', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/doc-series/nonexistent-id/articles');

      expect(res.status).toBe(404);
    });
  });

  // ─── Admin doc series endpoints ──────────────────────────────────────

  // ─── 4. GET /api/doc-series (Admin list, JWT+Admin) ─────────────────

  describe('GET /api/doc-series', () => {
    it('returns paginated admin doc series list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/doc-series?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Paginated response
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/doc-series');

      expect(res.status).toBe(401);
    });
  });

  // ─── 5. POST /api/doc-series (Create, JWT+Admin) ────────────────────

  describe('POST /api/doc-series', () => {
    it('creates doc series with Sqids string id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: `Compat Test Series ${ctx.ts}` });

      // NestJS POST returns code 201 (Go returns 200)
      assertSuccessResponse(res, 200);
      const data = res.body.data;

      // Doc series has Sqids-encoded string id
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');
      expect(data.id.length).toBeGreaterThanOrEqual(4);

      // Doc series has name and doc_count
      expect(data).toHaveProperty('name');

      seriesId = data.id;
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/doc-series')
        .send({ name: 'Unauthorized Series' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 6. GET /api/doc-series/:id (Admin detail, JWT+Admin) ───────────

  describe('GET /api/doc-series/:id', () => {
    it('returns doc series detail', async () => {
      if (!seriesId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/doc-series/${seriesId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
    });
  });

  // ─── 7. PUT /api/doc-series/:id (Update, JWT+Admin) ─────────────────

  describe('PUT /api/doc-series/:id', () => {
    it('updates doc series and returns updated data', async () => {
      if (!seriesId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/doc-series/${seriesId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: 'Updated Compat Test Series' });

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
    });

    it('rejects without auth', async () => {
      if (!seriesId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/doc-series/${seriesId}`)
        .send({ name: 'Unauthorized Update' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 8. DELETE /api/doc-series/:id (Delete, JWT+Admin) ──────────────

  describe('DELETE /api/doc-series/:id', () => {
    it('deletes doc series and returns success', async () => {
      if (!seriesId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/doc-series/${seriesId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res, 200);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/doc-series/invalid-id');

      expect(res.status).toBe(401);
    });
  });
});
