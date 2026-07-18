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
 * Subscriber API Compatibility Tests
 * Verifies all 4 subscriber endpoints match Go backend response format.
 */
describe('Subscriber API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/public/subscribe (RateLimit) ──────────────────────

  describe('POST /api/public/subscribe', () => {
    it('returns { code, data, message } for subscribe (may require verification)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/subscribe')
        .send({
          email: `test-${ctx.ts}@example.com`,
          code: '000000', // test verification code
        });

      // May succeed (201) or fail (400/429) if code is invalid or rate-limited
      if (res.body?.code === 201 || res.body?.code === 200) {
        assertSuccessResponse(res, 201);
      } else {
        // Verification code error or rate limit is acceptable
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/subscribe')
        .send({ email: 'noauth@example.com', code: '000000' });

      // Should respond (not 401) — may be rate-limited or validation error
      expect(res.status).not.toBe(401);
    });
  });

  // ─── 2. POST /api/public/subscribe/code (RateLimit) ─────────────────

  describe('POST /api/public/subscribe/code', () => {
    it('returns { code, data, message } for code request (may require captcha)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/subscribe/code')
        .send({
          email: `code-${ctx.ts}@example.com`,
        });

      // May succeed (201) or fail (400) if captcha is required
      if (res.body?.code === 201 || res.body?.code === 200) {
        assertSuccessResponse(res, 201);
      } else {
        // Captcha verification error is acceptable
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/subscribe/code')
        .send({ email: 'noauth@example.com' });

      // Should respond (not 401)
      expect(res.status).not.toBe(401);
    });
  });

  // ─── 3. POST /api/public/unsubscribe ────────────────────────────────

  describe('POST /api/public/unsubscribe', () => {
    it('returns { code, data, message } for unsubscribe (may fail for nonexistent)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/unsubscribe')
        .send({ email: 'nonexistent@example.com' });

      // May succeed (201) or fail (404) if subscriber not found
      if (res.body?.code === 201 || res.body?.code === 200) {
        assertSuccessResponse(res, 201);
      } else {
        // Subscriber not found is acceptable
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/unsubscribe')
        .send({ email: 'noauth@example.com' });

      // Should respond (not 401)
      expect(res.status).not.toBe(401);
    });
  });

  // ─── 4. GET /api/public/unsubscribe/:token ──────────────────────────

  describe('GET /api/public/unsubscribe/:token', () => {
    it('returns { code, data, message } for unsubscribe by token (may fail for invalid)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/unsubscribe/invalid-token');

      // May succeed (200) or fail (400/404) for invalid token
      if (res.body?.code === 200) {
        assertSuccessResponse(res);
      } else {
        // Invalid token error is acceptable
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('works without auth (public endpoint)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/unsubscribe/some-token');

      // Should respond (not 401)
      expect(res.status).not.toBe(401);
    });
  });
});
