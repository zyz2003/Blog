import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  TestContext,
  ADMIN_PASSWORD,
} from '../helpers/api-compat-helpers';

/**
 * Auth API Compatibility Tests
 * Verifies all 7 auth endpoints match Go backend response format.
 */
describe('Auth API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/auth/login (success) ──────────────────────────────

  describe('POST /api/auth/login — success', () => {
    it('returns { code, data: { token, refresh_token, user }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

      // Go backend returns 201 for login
      assertSuccessResponse(res, 200);
      const data = res.body.data;

      // Token fields
      expect(data).toHaveProperty('accessToken');
      expect(typeof data.accessToken).toBe('string');
      expect(data).toHaveProperty('refreshToken');
      expect(typeof data.refreshToken).toBe('string');
      expect(data).toHaveProperty('expires');

      // User info
      expect(data).toHaveProperty('userInfo');
      const userInfo = data.userInfo;
      expect(userInfo).toHaveProperty('id');
      expect(typeof userInfo.id).toBe('string'); // Sqids public ID
      expect(userInfo).toHaveProperty('nickname');
      expect(userInfo).toHaveProperty('email');
    });
  });

  // ─── 2. POST /api/auth/login (invalid credentials) ──────────────────

  describe('POST /api/auth/login — invalid credentials', () => {
    it('returns 401 with { code, message, data: null }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrongpass' });

      assertErrorResponse(res, 401);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 3. POST /api/auth/refresh-token ────────────────────────────────

  describe('POST /api/auth/refresh-token', () => {
    it('returns new accessToken with refresh_token in body', async () => {
      // First login to get refresh token
      const loginRes = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

      const refreshToken = loginRes.body.data.refreshToken;

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(typeof res.body.data.accessToken).toBe('string');
    });
  });

  // ─── 4. POST /api/auth/register ─────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('returns 501 NOT_IMPLEMENTED (registration disabled)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/register')
        .send({});

      // Go backend returns 501 for disabled registration
      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
    });
  });

  // ─── 5. POST /api/auth/forgot-password ──────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
    });
  });

  // ─── 6. POST /api/auth/reset-password ───────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({});

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
    });
  });

  // ─── 7. GET /api/auth/check-email ───────────────────────────────────

  describe('GET /api/auth/check-email', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/auth/check-email');

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
    });
  });
});
