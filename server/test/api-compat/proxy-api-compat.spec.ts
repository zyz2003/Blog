import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Proxy & Download API Compatibility Tests
 * Verifies proxy download and signed download endpoints match Go backend response format.
 *
 * Endpoints:
 *   GET /api/proxy/download — Proxy download (rate-limited, NOT YET IMPLEMENTED)
 *   GET /needcache/download/:public_id — Signed download (outside /api prefix)
 *
 * Note: proxy/download endpoint exists in Go backend but not yet implemented in NestJS.
 * The needcache/download route requires the global prefix exclude to match Go routing.
 */
describe('Proxy & Download API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/proxy/download (rate-limited, NOT YET IMPLEMENTED) ─

  describe('GET /api/proxy/download', () => {
    it('returns 404 (endpoint not yet implemented in NestJS)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/proxy/download?url=https://example.com/test.png');

      // Endpoint exists in Go backend but not yet in NestJS
      // Expected: 404 until implemented
      expect(res.status).toBe(404);
    });
  });

  // ─── 2. GET /needcache/download/:public_id (signed download) ────────

  describe('GET /needcache/download/:public_id', () => {
    it('returns 400 without sign query parameter', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/needcache/download/test-public-id');

      // sign parameter is required; without it should return 400
      expect(res.status).toBe(400);
    });

    it('returns error for invalid sign parameter', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/needcache/download/test-public-id?sign=invalid-signature');

      // Invalid sign — should return error (400 or 404 depending on verification)
      expect([400, 404]).toContain(res.status);
    });

    it('does not require JWT authentication (public route)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/needcache/download/test-public-id?sign=test');

      // Should not return 401 (no auth required)
      expect(res.status).not.toBe(401);
    });
  });
});
