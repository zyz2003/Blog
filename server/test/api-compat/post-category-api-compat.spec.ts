import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Post Category API Compatibility Tests
 * Verifies all 4 post-category endpoints match Go backend response format.
 */
describe('Post Category API Compat', () => {
  let ctx: TestContext;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/post-categories (Public) ────────────────────────────

  describe('GET /api/post-categories', () => {
    it('returns array of categories', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/post-categories');

      assertSuccessResponse(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── 2. POST /api/post-categories (JWT+Admin) ───────────────────────

  describe('POST /api/post-categories', () => {
    it('creates category with id as Sqids string', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/post-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: `Compat Test Category ${ctx.ts}` });

      // NestJS POST returns code 201 (Go returns 200)
      assertSuccessResponse(res, 201);
      const data = res.body.data;

      // Category has Sqids-encoded string id
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');
      expect(data.id.length).toBeGreaterThanOrEqual(4);

      // Category has name field
      expect(data).toHaveProperty('name');

      categoryId = data.id;
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/post-categories')
        .send({ name: 'Unauthorized Category' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. PUT /api/post-categories/:id (JWT+Admin) ────────────────────

  describe('PUT /api/post-categories/:id', () => {
    it('updates category and returns updated data', async () => {
      if (!categoryId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/post-categories/${categoryId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: `Updated Cat ${ctx.ts}` });

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
    });

    it('rejects without auth', async () => {
      if (!categoryId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/post-categories/${categoryId}`)
        .send({ name: 'Unauthorized Update' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. DELETE /api/post-categories/:id (JWT+Admin) ─────────────────

  describe('DELETE /api/post-categories/:id', () => {
    it('deletes category and returns success', async () => {
      if (!categoryId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/post-categories/${categoryId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res, 200);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/post-categories/invalid-id');

      expect(res.status).toBe(401);
    });
  });
});
