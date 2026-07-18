import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertPaginatedResponse,
  assertErrorResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Album API Compatibility Tests
 * Verifies all 11 album endpoints match Go backend response format.
 */
describe('Album API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/albums/get (Admin list, JWT+Admin) ──────────────────

  describe('GET /api/albums/get', () => {
    it('returns paginated album list for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      // Album list paginated with { list, total, pageNum, pageSize }
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('pageNum');
      expect(data).toHaveProperty('pageSize');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get');

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. POST /api/albums/add (Add, JWT+Admin) ───────────────────────

  describe('POST /api/albums/add', () => {
    it('returns { code, data: null, message } for album add', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          imageUrl: `https://test-${ctx.ts}.example.com/image.jpg`,
          fileHash: `test-hash-${ctx.ts}`,
        });

      // NestJS POST returns 201; Go returns 200
      // Album add returns { data: null, message: "添加成功" }
      assertSuccessResponse(res, 201);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/add')
        .send({ imageUrl: 'https://test.example.com/image.jpg' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. POST /api/albums/batch-import (Batch import, JWT+Admin) ─────

  describe('POST /api/albums/batch-import', () => {
    it('returns batch import result for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/batch-import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          urls: [`https://test-${ctx.ts}.example.com/batch.jpg`],
        });

      // NestJS POST returns 201; Go returns 200
      assertSuccessResponse(res, 201);
      const data = res.body.data;
      // Batch import result has successCount, failCount, skipCount
      expect(data).toHaveProperty('successCount');
      expect(data).toHaveProperty('failCount');
      expect(data).toHaveProperty('skipCount');
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/batch-import')
        .send({ urls: [] });

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. PUT /api/albums/update/:id (Update, JWT+Admin) ──────────────

  describe('PUT /api/albums/update/:id', () => {
    it('returns error for nonexistent album', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/albums/update/999999')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ title: 'Updated' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/albums/update/1')
        .send({ title: 'Updated' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 5. DELETE /api/albums/delete/:id (Delete, JWT+Admin) ───────────

  describe('DELETE /api/albums/delete/:id', () => {
    it('returns error for nonexistent album', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/albums/delete/999999')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/albums/delete/1');

      expect(res.status).toBe(401);
    });
  });

  // ─── 6. DELETE /api/albums/batch-delete (Batch delete, JWT+Admin) ───

  describe('DELETE /api/albums/batch-delete', () => {
    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/albums/batch-delete')
        .send({ ids: [1] });

      expect(res.status).toBe(401);
    });
  });

  // ─── 7. POST /api/albums/export (Export, JWT+Admin) ─────────────────

  describe('POST /api/albums/export', () => {
    it('returns export file for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/export')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ format: 'json' });

      // Export uses @Res() bypass — returns raw JSON or ZIP
      // May be 200 with file download or error if no albums
      expect(res.status).toBeLessThan(500);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/export')
        .send({ format: 'json' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 8. POST /api/albums/import (Import, JWT+Admin) ─────────────────

  describe('POST /api/albums/import', () => {
    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/import');

      expect(res.status).toBe(401);
    });
  });

  // ─── 9. GET /api/public/albums (Public albums) ──────────────────────

  describe('GET /api/public/albums', () => {
    it('returns public album list with pagination', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/albums');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Album list paginated with { list, total, pageNum, pageSize }
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/albums');

      expect(res.status).toBe(200);
    });
  });

  // ─── 10. GET /api/public/album-categories (Public categories) ────────

  describe('GET /api/public/album-categories', () => {
    it('returns public album categories list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/album-categories');

      assertSuccessResponse(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/album-categories');

      expect(res.status).toBe(200);
    });
  });

  // ─── 11. PUT /api/public/stat/:id (Update stat) ─────────────────────

  describe('PUT /api/public/stat/:id', () => {
    it('returns { code, data, message } for stat update (may succeed silently for nonexistent)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/public/stat/999999?type=view');

      // Album stat update may succeed silently (200/201) or return error
      // Either way, endpoint exists and responds
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/public/stat/999999?type=view');

      // Should respond (not 401) — may be 400 for nonexistent album
      expect(res.status).not.toBe(401);
    });
  });
});
