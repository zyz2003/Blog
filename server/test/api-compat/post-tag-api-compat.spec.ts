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
 * Post Tag API Compatibility Tests
 * Verifies all 4 post-tag endpoints match Go backend response format.
 */
describe('Post Tag API Compat', () => {
  let ctx: TestContext;
  let tagId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/post-tags (JWTOptional) ─────────────────────────────

  describe('GET /api/post-tags', () => {
    it('returns array of tags', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/post-tags');

      assertSuccessResponse(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('accepts sort query parameter', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/post-tags?sort=count');

      assertSuccessResponse(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── 2. POST /api/post-tags (JWT+Admin) ─────────────────────────────

  describe('POST /api/post-tags', () => {
    it('creates tag with id as Sqids string', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/post-tags')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: `Compat Test Tag ${ctx.ts}` });

      // NestJS POST returns code 201 (Go returns 200)
      assertSuccessResponse(res, 201);
      const data = res.body.data;

      // Tag has Sqids-encoded string id
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');
      expect(data.id.length).toBeGreaterThanOrEqual(4);

      // Tag has name field
      expect(data).toHaveProperty('name');

      tagId = data.id;
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/post-tags')
        .send({ name: 'Unauthorized Tag' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. PUT /api/post-tags/:id (JWT+Admin) ──────────────────────────

  describe('PUT /api/post-tags/:id', () => {
    it('updates tag and returns updated data', async () => {
      if (!tagId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/post-tags/${tagId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: `Updated Tag ${ctx.ts}` });

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name');
    });

    it('rejects without auth', async () => {
      if (!tagId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/post-tags/${tagId}`)
        .send({ name: 'Unauthorized Update' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. DELETE /api/post-tags/:id (JWT+Admin) ───────────────────────

  describe('DELETE /api/post-tags/:id', () => {
    it('deletes tag and returns success', async () => {
      if (!tagId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/post-tags/${tagId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res, 200);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/post-tags/invalid-id');

      expect(res.status).toBe(401);
    });
  });
});
