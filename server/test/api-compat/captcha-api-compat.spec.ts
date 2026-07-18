import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Captcha API Compatibility Tests
 * Verifies all 2 captcha endpoints match Go backend response format.
 *
 * Endpoints:
 *   GET /api/public/captcha/config — Captcha config (public)
 *   GET /api/public/captcha/image  — Captcha image (public, rate-limited)
 */
describe('Captcha API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/public/captcha/config (public) ─────────────────────

  describe('GET /api/public/captcha/config', () => {
    it('returns { code, data: { provider }, message } without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/config');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Captcha config has provider field
      expect(data).toHaveProperty('provider');
      expect(typeof data.provider).toBe('string');
    });

    it('returns provider="none" when captcha is disabled', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/config');

      assertSuccessResponse(res);
      // Test seed sets captcha.provider to "none"
      expect(res.body.data.provider).toBe('none');
    });
  });

  // ─── 2. GET /api/public/captcha/image (public, rate-limited) ────────

  describe('GET /api/public/captcha/image', () => {
    it('returns { code, data: { captcha_id, image_base64 }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/image');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Captcha image response has captcha_id and image_base64
      expect(data).toHaveProperty('captcha_id');
      expect(data).toHaveProperty('image_base64');
      expect(typeof data.captcha_id).toBe('string');
      expect(typeof data.image_base64).toBe('string');
      // image_base64 should be a non-empty base64 string
      expect(data.image_base64.length).toBeGreaterThan(0);
    });

    it('does not require authentication (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/image');

      // Should not return 401
      expect(res.status).not.toBe(401);
    });
  });
});
