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
 * Notification API Compatibility Tests
 * Verifies all 4 notification endpoints match Go backend response format.
 */
describe('Notification API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/user/notification-settings (JWT) ───────────────────

  describe('GET /api/user/notification-settings', () => {
    it('returns { code, data: { ...settings }, message } for authenticated user', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-settings')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      // Notification settings has type-based enable/disable flags
      expect(data).toBeDefined();
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-settings');

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. PUT /api/user/notification-settings (JWT) ───────────────────

  describe('PUT /api/user/notification-settings', () => {
    it('returns { code, data, message } for settings update', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/user/notification-settings')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          allowCommentReplyNotification: true,
        });

      assertSuccessResponse(res);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/user/notification-settings')
        .send({ allowCommentReplyNotification: true });

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. GET /api/user/notification-configs (JWT) ────────────────────

  describe('GET /api/user/notification-configs', () => {
    it('returns { code, data: [ ...configs ], message } for authenticated user', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-configs')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      // Notification configs is an array of config objects
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-configs');

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. GET /api/notification/types (JWT+Admin) ─────────────────────

  describe('GET /api/notification/types', () => {
    it('returns { code, data: [ ...types ], message } for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/notification/types')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      // Notification types list has id, name, description
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        const type = data[0];
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('description');
      }
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/notification/types');

      expect(res.status).toBe(401);
    });
  });
});
