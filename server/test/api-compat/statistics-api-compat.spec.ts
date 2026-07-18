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
 * Statistics API Compatibility Tests
 * Verifies all 7 statistics endpoints match Go backend response format.
 */
describe('Statistics API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/public/statistics/basic ──────────────────────────────

  describe('GET /api/public/statistics/basic', () => {
    it('returns { code, data: { today, yesterday, ... }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/statistics/basic');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Basic stats has today_visitors/yesterday_visitors counts (Go field names)
      expect(data).toHaveProperty('today_visitors');
      expect(data).toHaveProperty('yesterday_visitors');
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/statistics/basic');

      // Should succeed without JWT
      expect(res.status).toBe(200);
    });
  });

  // ─── 2. POST /api/public/statistics/visit ─────────────────────────────

  describe('POST /api/public/statistics/visit', () => {
    it('returns { code, data, message } for visit recording (fire-and-forget)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/statistics/visit')
        .send({
          url_path: '/test',
          referer: '',
        });

      // NestJS POST returns 201; Go returns 200
      // Visit recording returns immediately (fire-and-forget per D-160)
      assertSuccessResponse(res, 201);
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/statistics/visit')
        .send({ url_path: '/test' });

      // Should respond (not 401) — may be validation error
      expect(res.status).not.toBe(401);
    });
  });

  // ─── 3. GET /api/statistics/analytics (JWT+Admin) ─────────────────────

  describe('GET /api/statistics/analytics', () => {
    it('returns analytics data for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/analytics')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/analytics');

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. GET /api/statistics/top-pages (JWT+Admin) ─────────────────────

  describe('GET /api/statistics/top-pages', () => {
    it('returns top pages for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/top-pages')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/top-pages');

      expect(res.status).toBe(401);
    });
  });

  // ─── 5. GET /api/statistics/trend (JWT+Admin) ─────────────────────────

  describe('GET /api/statistics/trend', () => {
    it('returns trend data for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/trend')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/trend');

      expect(res.status).toBe(401);
    });
  });

  // ─── 6. GET /api/statistics/summary (JWT+Admin) ───────────────────────

  describe('GET /api/statistics/summary', () => {
    it('returns summary data for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/summary')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/summary');

      expect(res.status).toBe(401);
    });
  });

  // ─── 7. GET /api/statistics/visitor-logs (JWT+Admin) ──────────────────

  describe('GET /api/statistics/visitor-logs', () => {
    it('returns visitor logs for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/visitor-logs')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/statistics/visitor-logs');

      expect(res.status).toBe(401);
    });
  });
});
