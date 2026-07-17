import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Search API Compatibility Tests
 * Verifies the search endpoint matches Go backend response format.
 */
describe('Search API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/search?q=... (Public) ──────────────────────────────

  describe('GET /api/search', () => {
    it('returns search results with pagination and hits', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/search?q=test&page=1&size=10');

      assertSuccessResponse(res);
      const data = res.body.data;

      // Search results have pagination and hits
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('hits');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('size');
      expect(Array.isArray(data.hits)).toBe(true);
    });

    it('returns empty results for nonsense query', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/search?q=zzzznonexistent12345');

      assertSuccessResponse(res);
      expect(res.body.data.pagination.total).toBe(0);
      expect(res.body.data.hits).toHaveLength(0);
    });

    it('returns 400 without q parameter', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/search');

      // Search query is required
      expect(res.status).toBe(400);
    });
  });
});
