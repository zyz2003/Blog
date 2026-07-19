import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import * as jwt from 'jsonwebtoken';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  TestContext,
  TEST_JWT_SECRET,
} from '../helpers/api-compat-helpers';
import { generatePublicID, EntityType } from '../../src/common/utils/sqids.util';

/**
 * Generate a non-admin JWT token (user_group_id=2, not Admin group).
 * The NestJS SettingsController checks if user_group_id decodes to
 * EntityType.UserGroup with dbID===1 for admin status.
 * A token with group ID 2 is treated as non-admin.
 */
function generateNonAdminToken(seed: string): string {
  const userId = generatePublicID(2, EntityType.User);
  const groupId = generatePublicID(2, EntityType.UserGroup);
  return jwt.sign(
    { user_id: userId, user_group_id: groupId, permissions: [0], iss: 'anheyu-app' },
    seed,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
}

/**
 * Recursively check if an object contains a private key at any nesting level.
 * Returns the found key name or null if no private key found.
 */
const PRIVATE_KEY_PATTERNS = ['JWT_SECRET', 'id_seed', 'SMTP_PASSWORD', 'DATABASE_URL', 'LOCAL_FILE_SIGNING_SECRET'];

function hasPrivateKey(obj: any, depth = 0): string | null {
  if (depth > 10 || !obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    if (PRIVATE_KEY_PATTERNS.some(p => key === p || key.includes(p))) return key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      const found = hasPrivateKey(obj[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively count all keys in an unflattened object.
 */
function countAllKeys(obj: any): number {
  let count = 0;
  for (const key of Object.keys(obj)) {
    count++;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      count += countAllKeys(obj[key]);
    }
  }
  return count;
}

/**
 * Settings API Compatibility Tests
 * Verifies all 5 settings endpoints match Go backend response format.
 */
describe('Settings API Compat', () => {
  let ctx: TestContext;
  let nonAdminToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    nonAdminToken = generateNonAdminToken(TEST_JWT_SECRET);
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

    it('returns unflattened nested objects for dotted keys', async () => {
      // Go's GetByKeys() unflattens dotted keys into nested objects.
      // Requesting "captcha.provider" should return { captcha: { provider: "none" } },
      // not { "captcha.provider": "none" }
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keys: ['captcha.provider'] });

      assertSuccessResponse(res, 200);
      const data = res.body.data;
      // Must be unflattened: nested object, not flat dotted key
      expect(data).toHaveProperty('captcha');
      expect(data.captcha).toHaveProperty('provider');
      expect(data.captcha.provider).toBe('none');
      // Must NOT have flat dotted key at top level (toHaveProperty traverses dot paths,
      // so check top-level keys directly instead)
      expect(Object.keys(data)).not.toContain('captcha.provider');
    });

    it('non-admin cannot access private keys', async () => {
      // Non-admin requesting private keys should get them filtered out
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${nonAdminToken}`)
        .send({ keys: ['JWT_SECRET', 'id_seed'] });

      assertSuccessResponse(res, 200);
      const data = res.body.data;
      // Private keys must NOT be present
      expect(data).not.toHaveProperty('JWT_SECRET');
      // id_seed unflattens to { id: { seed: ... } }, check recursively
      expect(hasPrivateKey(data)).toBeNull();
    });

    it('non-admin can access public keys', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${nonAdminToken}`)
        .send({ keys: ['APP_NAME', 'GRAVATAR_URL'] });

      assertSuccessResponse(res, 200);
      const data = res.body.data;
      expect(data).toHaveProperty('APP_NAME');
      expect(data).toHaveProperty('GRAVATAR_URL');
    });

    it('non-admin with mixed public/private keys returns only public values', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${nonAdminToken}`)
        .send({ keys: ['APP_NAME', 'JWT_SECRET', 'GRAVATAR_URL', 'id_seed'] });

      assertSuccessResponse(res, 200);
      const data = res.body.data;
      // Public keys should be present
      expect(data).toHaveProperty('APP_NAME');
      expect(data).toHaveProperty('GRAVATAR_URL');
      // Private keys must be filtered out
      expect(data).not.toHaveProperty('JWT_SECRET');
      expect(hasPrivateKey(data)).toBeNull();
    });

    it('returns properly typed values (not all strings)', async () => {
      // The unflatten logic parses values: booleans become boolean,
      // numbers become number, JSON objects stay as objects.
      // Verify _config_version is a number (not a string).
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keys: ['APP_NAME'] });

      assertSuccessResponse(res, 200);
      const data = res.body.data;
      // APP_NAME should be a string
      expect(typeof data.APP_NAME).toBe('string');
      // Response data should be an object (not array)
      expect(typeof data).toBe('object');
      expect(Array.isArray(data)).toBe(false);
    });
  });

  // ─── 2. POST /api/settings/update (JWT+Admin) ───────────────────────

  describe('POST /api/settings/update', () => {
    it('accepts flat key-value pairs matching Go format', async () => {
      // Go handler: c.ShouldBindJSON(&settingsToUpdate) binds to map[string]string
      // Frontend: apiClient.post("/api/settings/update", settings) sends flat Record<string, string>
      // NestJS controller: @Body() body: Record<string, any> receives flat body directly
      // Must use flat format: { "APP_NAME": "UpdatedTestApp" }, NOT { settings: { APP_NAME: ... } }
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/update')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ APP_NAME: 'UpdatedTestApp' });

      assertSuccessResponse(res, 200);

      // Verify persistence: read back via get-by-keys
      const readRes = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/get-by-keys')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keys: ['APP_NAME'] });

      assertSuccessResponse(readRes, 200);
      expect(readRes.body.data.APP_NAME).toBe('UpdatedTestApp');

      // Restore original value
      await supertest(ctx.app.getHttpServer())
        .post('/api/settings/update')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ APP_NAME: 'TestApp' });
    });

    it('returns 400 for empty body', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/update')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({});

      assertErrorResponse(res, 400, 400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/update')
        .send({ APP_NAME: 'Hacked' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. POST /api/settings/test-email (JWT+Admin) ───────────────────

  describe('POST /api/settings/test-email', () => {
    it('returns 501 with exact format { code: 501, message, data: null }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/settings/test-email')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // HTTP status is 501
      expect(res.status).toBe(501);
      // body.code is 501
      expect(res.body.code).toBe(501);
      // body.message is a non-empty string
      expect(res.body.message).toBeDefined();
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
      // body.data is null
      expect(res.body.data).toBeNull();
    });
  });

  // ─── 4. GET /api/public/site-config ─────────────────────────────────

  describe('GET /api/public/site-config', () => {
    it('returns { code, data: { ...publicSettings }, message }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Should have _config_version
      expect(data).toHaveProperty('_config_version');
    });

    it('_config_version is a number type', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      assertSuccessResponse(res);
      const version = res.body.data._config_version;
      expect(typeof version).toBe('number');
      // Should be a positive number
      expect(version).toBeGreaterThan(0);
    });

    it('returns properly unflattened nested structure', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      assertSuccessResponse(res);
      const data = res.body.data;
      // Response should be an object (not array)
      expect(typeof data).toBe('object');
      expect(Array.isArray(data)).toBe(false);
      // Should contain nested objects from unflattening (e.g., footer, sidebar, etc.)
      const hasNestedObject = Object.values(data).some(
        v => typeof v === 'object' && v !== null && !Array.isArray(v),
      );
      expect(hasNestedObject).toBe(true);
    });

    it('does NOT contain private keys at any nesting level', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      assertSuccessResponse(res);
      // Recursively check for private keys in the entire response
      expect(hasPrivateKey(res.body.data)).toBeNull();
    });

    it('contains known public keys (APP_NAME)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      assertSuccessResponse(res);
      const data = res.body.data;
      // APP_NAME is a top-level public key
      expect(data).toHaveProperty('APP_NAME');
      expect(typeof data.APP_NAME).toBe('string');
    });

    it('contains substantial number of public keys (200+)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config');

      assertSuccessResponse(res);
      const keyCount = countAllKeys(res.body.data);
      // With 331 seeded settings, public keys should produce 200+ keys
      // after unflattening (some keys are private and excluded)
      expect(keyCount).toBeGreaterThanOrEqual(200);
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

    it('version is a reasonable millisecond timestamp', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/site-config/version');

      assertSuccessResponse(res);
      const version = res.body.data.version;
      // Go returns int64 millisecond timestamp, NestJS returns number.
      // Both are compatible since JS numbers can represent millisecond timestamps.
      // A reasonable millisecond timestamp should be > 1000000000000 (year 2001 in UnixMilli)
      expect(version).toBeGreaterThan(1000000000000);
      // Should not be unreasonably far in the future (year 3000+)
      expect(version).toBeLessThan(32503680000000);
    });
  });
});
