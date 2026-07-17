import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Version API Compatibility Tests
 * Verifies both version endpoints match Go backend response format.
 */
describe('Version API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/version ────────────────────────────────────────────

  describe('GET /api/version', () => {
    it('returns JSON version info: { code, data: { version, ... }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/version');

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('commit');
      expect(data).toHaveProperty('date');
      expect(data).toHaveProperty('node_version');
    });
  });

  // ─── 2. GET /api/version/string ─────────────────────────────────────

  describe('GET /api/version/string', () => {
    it('returns plain text version string (not JSON wrapped)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/version/string');

      // Version string endpoint returns { version: "..." } directly
      // (bypasses the global response interceptor via @Res())
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version');
      expect(typeof res.body.version).toBe('string');
    });
  });
});
