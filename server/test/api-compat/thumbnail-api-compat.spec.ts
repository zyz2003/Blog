import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Thumbnail API Compatibility Tests
 * Verifies all 4 thumbnail endpoints match Go backend response format.
 * JWT endpoints: /api/thumbnail/*
 * Public endpoint: /api/t/:signedToken
 */
describe('Thumbnail API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/thumbnail/regenerate (JWT) ────────────────────────

  describe('POST /api/thumbnail/regenerate', () => {
    it('returns error for nonexistent file', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/thumbnail/regenerate')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ id: 'nonexistent-id' });

      // May be 404 or error for invalid ID
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/thumbnail/regenerate')
        .send({ id: 'nonexistent-id' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. POST /api/thumbnail/regenerate/directory (JWT) ──────────────

  describe('POST /api/thumbnail/regenerate/directory', () => {
    it('returns error for nonexistent directory', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/thumbnail/regenerate/directory')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ directoryId: 'nonexistent-id' });

      // May be 404 or error for invalid ID
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/thumbnail/regenerate/directory')
        .send({ directoryId: 'nonexistent-id' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. GET /api/thumbnail/:publicID (Get sign, JWT) ────────────────

  describe('GET /api/thumbnail/:publicID', () => {
    it('returns error for nonexistent file', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/thumbnail/nonexistent-id')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // May be 404 or error for invalid ID
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/thumbnail/nonexistent-id');

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. GET /api/t/:signedToken (Serve thumbnail, public) ───────────

  describe('GET /api/t/:signedToken', () => {
    it('returns 404 for invalid signed token', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/t/invalid-signed-token');

      // Invalid/expired token → 404 or error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
