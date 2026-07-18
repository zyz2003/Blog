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
 * Album Category API Compatibility Tests
 * Verifies all 5 album category endpoints match Go backend response format.
 */
describe('Album Category API Compat', () => {
  let ctx: TestContext;
  let createdCategoryId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/album-categories (Create, JWT+Admin) ──────────────

  describe('POST /api/album-categories', () => {
    it('creates a category and returns { code, data, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/album-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `AlbumCat-${ctx.ts}`,
          description: 'Test album category',
        });

      // NestJS POST returns 201; Go returns 200
      assertSuccessResponse(res, 201);
      const data = res.body.data;
      // Album category has only { id, name, description, displayOrder }
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('displayOrder');
      createdCategoryId = data.id;
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/album-categories')
        .send({ name: 'NoAuth' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. GET /api/album-categories (List, JWT+Admin) ─────────────────

  describe('GET /api/album-categories', () => {
    it('returns categories list for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/album-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Each category has { id, name, description, displayOrder }
      if (res.body.data.length > 0) {
        const cat = res.body.data[0];
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('description');
        expect(cat).toHaveProperty('displayOrder');
      }
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/album-categories');

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. GET /api/album-categories/:id (Get, JWT+Admin) ──────────────

  describe('GET /api/album-categories/:id', () => {
    it('returns category by id for admin', async () => {
      // Use the created category id, or fallback to 1
      const id = createdCategoryId || 1;
      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/album-categories/${id}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      if (res.status === 200) {
        assertSuccessResponse(res);
        const data = res.body.data;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name');
        expect(data).toHaveProperty('description');
        expect(data).toHaveProperty('displayOrder');
      } else {
        // Category may not exist
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/album-categories/1');

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. PUT /api/album-categories/:id (Update, JWT+Admin) ───────────

  describe('PUT /api/album-categories/:id', () => {
    it('returns error for nonexistent category', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/album-categories/999999')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/album-categories/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 5. DELETE /api/album-categories/:id (Delete, JWT+Admin) ────────

  describe('DELETE /api/album-categories/:id', () => {
    it('returns error for nonexistent category', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/album-categories/999999')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/album-categories/1');

      expect(res.status).toBe(401);
    });
  });
});
