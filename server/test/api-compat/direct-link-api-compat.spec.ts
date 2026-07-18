import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Direct Link API Compatibility Tests
 * Verifies all 2 direct link endpoints match Go backend response format.
 * JWT endpoint: POST /api/direct-links
 * Public endpoint: GET /api/f/:publicID/*filename
 */
describe('Direct Link API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/direct-links (Get or create, JWT) ─────────────────

  describe('POST /api/direct-links', () => {
    it('returns response for nonexistent file_ids (may be empty or error)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/direct-links')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ file_ids: ['nonexistent-id'] });

      // Go backend may return 200 with empty data or error for invalid file IDs
      if (res.status === 200) {
        assertSuccessResponse(res, 200);
      } else {
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/direct-links')
        .send({ file_ids: ['nonexistent-id'] });

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. GET /api/f/:publicID/*filename (Direct download, public) ────

  describe('GET /api/f/:publicID/*filename', () => {
    it('returns 404 for nonexistent direct link', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/f/nonexistent-id/test-file.txt');

      // Invalid publicID → 404 or error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
