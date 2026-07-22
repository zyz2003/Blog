import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  clearThrottleStorage,
  TestContext,
  ADMIN_PASSWORD,
  TEST_JWT_SECRET,
} from '../helpers/api-compat-helpers';
import * as bcryptjs from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../src/database/schemas/user.schema';

/**
 * Auth API Compatibility Tests
 * Verifies all auth endpoints match Go backend response format.
 *
 * ## Known Compatibility Gaps
 *
 * (1) expires format: Go returns number (int64 UnixMilli), NestJS returns string.
 *     Frontend type expects string (LoginResponseData.expires: string).
 *     NestJS matches frontend type; Go does not.
 *     **Risk: NONE** -- NestJS is correct per frontend contract.
 *     The frontend TokenManager.updateToken(accessToken, expires) treats expires
 *     as string throughout, and handleRefreshToken() checks `data?.expires` (truthy).
 *     Verified: frontend/src/lib/api/client.ts TokenManager.updateToken signature
 *     and handleRefreshToken() response validation both expect string.
 *
 * (2) 5 auth endpoints: Go implemented with real handlers, NestJS returns 501.
 *     register, activate, forgot-password, reset-password, check-email.
 *     **Risk: HIGH** -- functional gap. These endpoints work in Go but not in NestJS.
 *
 * (3) created_at/updated_at: Go uses time.Time (never null), NestJS can return null.
 *     Go's LoginUserInfoResponse has created_at/updated_at as time.Time which
 *     serializes to RFC3339 string. NestJS uses user.createdAt?.toISOString() || null,
 *     which returns null if the DB field is null.
 *     **Risk: MEDIUM** -- only if DB has null values for created_at/updated_at.
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

  describe('POST /api/auth/login -- success', () => {
    it('returns field-by-field LoginUserInfoResponse matching Go struct', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      // ── Top-level login response fields ──

      // accessToken: non-empty string (valid JWT)
      expect(data).toHaveProperty('accessToken');
      expect(typeof data.accessToken).toBe('string');
      expect(data.accessToken.length).toBeGreaterThan(0);

      // refreshToken: non-empty string (valid JWT)
      expect(data).toHaveProperty('refreshToken');
      expect(typeof data.refreshToken).toBe('string');
      expect(data.refreshToken.length).toBeGreaterThan(0);

      // expires: must be STRING type (not number) -- matches frontend contract
      expect(data).toHaveProperty('expires');
      expect(typeof data.expires).toBe('string');
      // Verify the string parses to a valid future timestamp
      expect(Number(data.expires)).toBeGreaterThan(Date.now() - 1000);

      // roles: string[] with at least one element
      expect(data).toHaveProperty('roles');
      expect(Array.isArray(data.roles)).toBe(true);
      expect(data.roles.length).toBeGreaterThan(0);

      // ── userInfo fields ──

      expect(data).toHaveProperty('userInfo');
      const userInfo = data.userInfo;

      // userInfo.id: must be string (Sqids public ID)
      expect(userInfo).toHaveProperty('id');
      expect(typeof userInfo.id).toBe('string');
      expect(userInfo.id.length).toBeGreaterThan(0);

      // userInfo.created_at: must be string (ISO 8601/RFC3339) or null
      expect(userInfo).toHaveProperty('created_at');
      if (userInfo.created_at !== null) {
        expect(typeof userInfo.created_at).toBe('string');
        expect(new Date(userInfo.created_at).toISOString()).toBe(userInfo.created_at);
      }

      // userInfo.updated_at: must be string (ISO 8601/RFC3339) or null
      expect(userInfo).toHaveProperty('updated_at');
      if (userInfo.updated_at !== null) {
        expect(typeof userInfo.updated_at).toBe('string');
        expect(new Date(userInfo.updated_at).toISOString()).toBe(userInfo.updated_at);
      }

      // userInfo.username: must be non-empty string
      expect(userInfo).toHaveProperty('username');
      expect(typeof userInfo.username).toBe('string');
      expect(userInfo.username.length).toBeGreaterThan(0);

      // userInfo.nickname: must be string or null
      expect(userInfo).toHaveProperty('nickname');
      if (userInfo.nickname !== null) {
        expect(typeof userInfo.nickname).toBe('string');
      }

      // userInfo.avatar: must be string or null
      expect(userInfo).toHaveProperty('avatar');
      if (userInfo.avatar !== null) {
        expect(typeof userInfo.avatar).toBe('string');
      }

      // userInfo.email: must be non-empty string matching the login email
      expect(userInfo).toHaveProperty('email');
      expect(typeof userInfo.email).toBe('string');
      expect(userInfo.email).toBe('admin@test.com');

      // userInfo.lastLoginAt: must be string (ISO 8601) or null
      expect(userInfo).toHaveProperty('lastLoginAt');
      if (userInfo.lastLoginAt !== null) {
        expect(typeof userInfo.lastLoginAt).toBe('string');
      }

      // userInfo.userGroupID: must be NUMBER (raw DB ID)
      // This is Go's inconsistency where userGroupID is uint while other IDs are Sqids strings
      expect(userInfo).toHaveProperty('userGroupID');
      expect(typeof userInfo.userGroupID).toBe('number');

      // userInfo.userGroup.id: must be string (Sqids public ID)
      expect(userInfo).toHaveProperty('userGroup');
      expect(userInfo.userGroup).toHaveProperty('id');
      expect(typeof userInfo.userGroup.id).toBe('string');
      expect(userInfo.userGroup.id.length).toBeGreaterThan(0);

      // userInfo.userGroup.name: must be non-empty string
      expect(userInfo.userGroup).toHaveProperty('name');
      expect(typeof userInfo.userGroup.name).toBe('string');
      expect(userInfo.userGroup.name.length).toBeGreaterThan(0);

      // userInfo.userGroup.description: must be string or null
      expect(userInfo.userGroup).toHaveProperty('description');
      if (userInfo.userGroup.description !== null) {
        expect(typeof userInfo.userGroup.description).toBe('string');
      }

      // userInfo.status: must be number (1 = active)
      expect(userInfo).toHaveProperty('status');
      expect(typeof userInfo.status).toBe('number');
      expect(userInfo.status).toBe(1);

      // ── Cross-field consistency ──

      // roles[0] should equal String(userInfo.userGroupID)
      expect(data.roles[0]).toBe(String(userInfo.userGroupID));
    });
  });

  // ─── 2. POST /api/auth/login (invalid credentials) ──────────────────

  describe('POST /api/auth/login -- invalid credentials', () => {
    it('returns 401 with { code, message, data: null }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrongpass' });

      assertErrorResponse(res, 401);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 3. POST /api/auth/refresh-token -- dual-channel ────────────────

  describe('POST /api/auth/refresh-token -- dual-channel', () => {
    // Re-seed admin user before refresh-token tests to ensure correct DB state.
    // In batch runs, other test files may modify admin user state (password, status),
    // causing login to fail and refresh-token tests to break.
    beforeAll(async () => {
      const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 10);
      await ctx.db
        .insert(users)
        .values({
          id: 1,
          username: 'admin',
          passwordHash,
          email: 'admin@test.com',
          nickname: 'Admin',
          userGroupId: 1,
          status: 1,
        })
        .onConflictDoUpdate({
          target: users.username,
          set: {
            passwordHash,
            email: 'admin@test.com',
            userGroupId: 1,
            status: 1,
          },
        })
        .run();
    });

    it('refreshes via Authorization header', async () => {
      // First login to get refresh token
      const loginRes = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

      const refreshToken = loginRes.body.data.refreshToken;

      // Refresh via Authorization header (no body)
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/refresh-token')
        .set('Authorization', `Bearer ${refreshToken}`)
        .send({});

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.accessToken.length).toBeGreaterThan(0);
      // Verify refresh response expires is string type
      expect(res.body.data).toHaveProperty('expires');
      expect(typeof res.body.data.expires).toBe('string');
      expect(Number(res.body.data.expires)).toBeGreaterThan(Date.now() - 1000);
    });

    it('refreshes via body refreshToken', async () => {
      // First login to get refresh token
      const loginRes = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

      const refreshToken = loginRes.body.data.refreshToken;

      // Refresh via body (no Authorization header)
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.accessToken.length).toBeGreaterThan(0);
      // Verify refresh response expires is string type
      expect(res.body.data).toHaveProperty('expires');
      expect(typeof res.body.data.expires).toBe('string');
      expect(Number(res.body.data.expires)).toBeGreaterThan(Date.now() - 1000);
    });

    it('returns 401 when no token provided at all', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/refresh-token')
        .send({});

      assertErrorResponse(res, 401);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 4. POST /api/auth/register ─────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('returns 501 NOT_IMPLEMENTED with correct format', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/register')
        .send({});

      // Go compatibility: Go backend DOES implement this endpoint with real handlers;
      // NestJS returns 501. See "Known Compatibility Gaps" at top of file.
      expect(res.status).toBe(501);
      expect(res.body.code).toBe(501);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 5. POST /api/auth/activate ─────────────────────────────────────

  describe('POST /api/auth/activate', () => {
    it('returns 501 NOT_IMPLEMENTED with correct format', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/activate')
        .send({});

      // Go compatibility: Go backend DOES implement this endpoint with real handlers;
      // NestJS returns 501. See "Known Compatibility Gaps" at top of file.
      expect(res.status).toBe(501);
      expect(res.body.code).toBe(501);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 6. POST /api/auth/forgot-password ──────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('returns 501 NOT_IMPLEMENTED with correct format', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({});

      // Go compatibility: Go backend DOES implement this endpoint with real handlers;
      // NestJS returns 501. See "Known Compatibility Gaps" at top of file.
      expect(res.status).toBe(501);
      expect(res.body.code).toBe(501);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 7. POST /api/auth/reset-password ───────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    it('returns 501 NOT_IMPLEMENTED with correct format', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({});

      // Go compatibility: Go backend DOES implement this endpoint with real handlers;
      // NestJS returns 501. See "Known Compatibility Gaps" at top of file.
      expect(res.status).toBe(501);
      expect(res.body.code).toBe(501);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 8. GET /api/auth/check-email ───────────────────────────────────

  describe('GET /api/auth/check-email', () => {
    it('returns 501 NOT_IMPLEMENTED with correct format', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/auth/check-email');

      // Go compatibility: Go backend DOES implement this endpoint with real handlers;
      // NestJS returns 501. See "Known Compatibility Gaps" at top of file.
      expect(res.status).toBe(501);
      expect(res.body.code).toBe(501);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── Captcha Structure Verification ─────────────────────────────────

  describe('Captcha Structure Verification', () => {
    it('GET /api/public/captcha/config returns { provider: "none" } when provider is none', async () => {
      // Ensure provider is "none" (default test data)
      await ctx.settingsService.update({ 'captcha.provider': 'none' });

      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/config');

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('provider', 'none');
    });

    it('captcha/config does not include image_captcha_length when provider is none', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/config');

      assertSuccessResponse(res);
      expect(res.body.data.provider).toBe('none');
      expect(res.body.data).not.toHaveProperty('image_captcha_length');
    });

    it('GET /api/public/captcha/image returns { captcha_id, image_base64 } when provider is image', async () => {
      // Set provider to "image"
      await ctx.settingsService.update({ 'captcha.provider': 'image' });

      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/image');

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('captcha_id');
      expect(typeof res.body.data.captcha_id).toBe('string');
      expect(res.body.data.captcha_id.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('image_base64');
      expect(typeof res.body.data.image_base64).toBe('string');
      expect(res.body.data.image_base64.length).toBeGreaterThan(0);

      // Reset provider back to "none"
      await ctx.settingsService.update({ 'captcha.provider': 'none' });
    });
  });

  // ─── Captcha Behavior Verification ──────────────────────────────────

  describe('Captcha Behavior Verification', () => {
    it('login succeeds without captcha fields when provider is none', async () => {
      // Ensure provider is "none"
      await ctx.settingsService.update({ 'captcha.provider': 'none' });
      // Clear throttle storage to avoid 429 from prior login calls
      clearThrottleStorage(ctx.app);

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

      assertSuccessResponse(res, 200);
    });

    it('login fails with wrong captcha answer when provider is image', async () => {
      // Set provider to "image"
      await ctx.settingsService.update({ 'captcha.provider': 'image' });
      clearThrottleStorage(ctx.app);

      // Generate a captcha image
      const captchaRes = await supertest(ctx.app.getHttpServer())
        .get('/api/public/captcha/image');

      const captchaId = captchaRes.body.data.captcha_id;

      // Login with wrong captcha answer
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: ADMIN_PASSWORD,
          image_captcha_id: captchaId,
          image_captcha_answer: 'wrong_answer',
        });

      assertErrorResponse(res, 400);
      expect(res.body.data).toBeNull();

      // Reset provider to "none"
      await ctx.settingsService.update({ 'captcha.provider': 'none' });
    });

    it('login accepts captcha fields in request body without error when provider is none', async () => {
      // Ensure provider is "none"
      await ctx.settingsService.update({ 'captcha.provider': 'none' });
      clearThrottleStorage(ctx.app);

      // Login with captcha fields present (should be ignored when provider=none)
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: ADMIN_PASSWORD,
          image_captcha_id: 'some-id',
          image_captcha_answer: 'some-answer',
        });

      assertSuccessResponse(res, 200);
    });
  });
});
