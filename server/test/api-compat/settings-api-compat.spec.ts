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
 * Settings API Compatibility Tests
 * Verifies all 5 settings endpoints match Go backend response format.
 */
describe('Settings API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/settings/get-by-keys (JWT) ────────────────────────

  describe('POST /api/settings/get-by-keys', () => {
    it('returns { code, data: { ...keyValuePairs }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keys: ['APP_NAME', 'GRAVATAR_URL'] });

      // NestJS POST returns 201; Go backend returns 200 for all success
      assertSuccessResponse(res, 200);
      const data = res.body.data;
      expect(data).toHaveProperty('APP_NAME');
      expect(data).toHaveProperty('GRAVATAR_URL');
    });

    it('admin can read private keys (JWT_SECRET, id_seed)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keys: ['JWT_SECRET', 'id_seed'] });

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('JWT_SECRET');
      expect(res.body.data).toHaveProperty('id_seed');
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .send({ keys: ['APP_NAME'] });

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. POST /api/settings/update (JWT+Admin) ───────────────────────

  describe('POST /api/settings/update', () => {
    it('returns { code, data, message } for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/update')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ settings: { APP_NAME: 'UpdatedTestApp' } });

      // NestJS POST returns 201; Go backend returns 200 for all success
      assertSuccessResponse(res, 200);

      // Restore original value
      await supertest(ctx.app.getHttpServer())
        .post('/api/settings/update')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ settings: { APP_NAME: 'TestApp' } });
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/update')
        .send({ settings: { APP_NAME: 'Hacked' } });

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. POST /api/settings/test-email (JWT+Admin) ───────────────────

  describe('POST /api/settings/test-email', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/test-email')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
    });
  });

  // ─── 4. GET /api/public/site-config ─────────────────────────────────

  describe('GET /api/public/site-config', () => {
    it('returns { code, data: { ...publicSettings }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Should have public keys
      expect(data).toHaveProperty('_config_version');
    });

    it('does NOT contain private keys (JWT_SECRET, id_seed)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      const data = res.body.data;
      // Flatten keys to check for private settings
      const allKeys = Object.keys(data);
      // JWT_SECRET and id_seed should NOT appear in any key path
      const hasPrivate = allKeys.some(k =>
        k === 'JWT_SECRET' || k === 'id_seed' ||
        k.includes('JWT_SECRET') || k.includes('id_seed'),
      );
      expect(hasPrivate).toBe(false);
    });
  });

  // ─── 5. GET /api/public/site-config/version ─────────────────────────

  describe('GET /api/public/site-config/version', () => {
    it('returns { code, data: { version }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config/version');

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('version');
      expect(typeof res.body.data.version).toBe('number');
    });
  });
});
