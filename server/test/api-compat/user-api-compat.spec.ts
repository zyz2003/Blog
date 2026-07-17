import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  assertPaginatedResponse,
  uploadFile,
  TestContext,
  ADMIN_PASSWORD,
} from '../helpers/api-compat-helpers';
import { generatePublicID, EntityType } from '../../src/common/utils/sqids.util';

/**
 * User API Compatibility Tests
 * Verifies all 11 user endpoints match Go backend response format.
 */
describe('User API Compat', () => {
  let ctx: TestContext;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. GET /api/user/info (JWT) ────────────────────────────────────

  describe('GET /api/user/info', () => {
    it('returns user object with id, username, nickname, email, avatar, userGroupID', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/info')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // User info has expected fields
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string'); // Sqids public ID
      expect(data).toHaveProperty('username');
      expect(data).toHaveProperty('nickname');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('avatar');
      expect(data).toHaveProperty('userGroupID');
      expect(data).toHaveProperty('userGroup');
      expect(data).toHaveProperty('status');

      // Snake_case date fields
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');

      // userGroupID is raw DB ID number for GetUserInfo (Go inconsistency)
      expect(typeof data.userGroupID).toBe('number');

      // userGroup object
      expect(data.userGroup).toHaveProperty('id');
      expect(data.userGroup).toHaveProperty('name');
    });
  });

  // ─── 2. PUT /api/user/profile (JWT) ─────────────────────────────────

  describe('PUT /api/user/profile', () => {
    it('updates profile and returns success response', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/user/profile')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ nickname: 'UpdatedAdmin' });

      assertSuccessResponse(res, 200);

      // Restore
      await supertest(ctx.app.getHttpServer())
        .put('/api/user/profile')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ nickname: 'Admin' });
    });
  });

  // ─── 3. POST /api/user/avatar (JWT) ─────────────────────────────────

  describe('POST /api/user/avatar', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const buffer = Buffer.from('fake-image-data');
      const res = await uploadFile(
        ctx.app,
        '/api/user/avatar',
        'file',
        buffer,
        ctx.adminToken,
      );

      expect(res.status).toBe(501);
    });
  });

  // ─── 4. POST /api/user/update-password (JWT) ────────────────────────

  describe('POST /api/user/update-password', () => {
    it('returns success response shape', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/user/update-password')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ oldPassword: ADMIN_PASSWORD, newPassword: 'newPassword456' });

      // NestJS POST returns 201
      assertSuccessResponse(res, 201);

      // Restore original password
      await supertest(ctx.app.getHttpServer())
        .post('/api/user/update-password')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ oldPassword: 'newPassword456', newPassword: ADMIN_PASSWORD });
    });
  });

  // ─── 5. GET /api/admin/users (JWT+Admin) ────────────────────────────

  describe('GET /api/admin/users', () => {
    it('returns paginated user list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Paginated with { users, total, page, size }
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('size');
      expect(Array.isArray(data.users)).toBe(true);
    });
  });

  // ─── 6. POST /api/admin/users (JWT+Admin) ───────────────────────────

  describe('POST /api/admin/users', () => {
    it('creates user and returns user object', async () => {
      const groupId = generatePublicID(1, EntityType.UserGroup);
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/admin/users')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          username: `testuser-${ctx.ts}`,
          password: 'testpass123',
          email: `test-${ctx.ts}@test.com`,
          nickname: 'TestUser',
          userGroupID: groupId,
        });

      assertSuccessResponse(res, 201);
      const data = res.body.data;

      // User object has expected fields
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string'); // Sqids public ID
      expect(data).toHaveProperty('username');
      expect(data).toHaveProperty('nickname');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('userGroupID');
      expect(data).toHaveProperty('userGroup');
      expect(data).toHaveProperty('status');

      testUserId = data.id;
    });
  });

  // ─── 7. PUT /api/admin/users/:id (JWT+Admin) ────────────────────────

  describe('PUT /api/admin/users/:id', () => {
    it('updates user and returns success', async () => {
      if (!testUserId) return; // Skip if create failed

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/admin/users/${testUserId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ nickname: 'UpdatedTestUser' });

      assertSuccessResponse(res, 200);
    });
  });

  // ─── 8. DELETE /api/admin/users/:id (JWT+Admin) ─────────────────────

  describe('DELETE /api/admin/users/:id', () => {
    it('soft-deletes user and returns success', async () => {
      if (!testUserId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/admin/users/${testUserId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res, 200);
    });
  });

  // ─── 9. POST /api/admin/users/:id/reset-password (JWT+Admin) ────────

  describe('POST /api/admin/users/:id/reset-password', () => {
    it('resets password and returns success', async () => {
      // Create a fresh user for this test
      const groupId = generatePublicID(1, EntityType.UserGroup);
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/admin/users')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          username: `resetuser-${ctx.ts}`,
          password: 'oldpass123',
          email: `reset-${ctx.ts}@test.com`,
          nickname: 'ResetUser',
          userGroupID: groupId,
        });

      const userId = createRes.body.data?.id;
      if (!userId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .post(`/api/admin/users/${userId}/reset-password`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ newPassword: 'newResetPass123' });

      assertSuccessResponse(res, 201);
    });
  });

  // ─── 10. PUT /api/admin/users/:id/status (JWT+Admin) ────────────────

  describe('PUT /api/admin/users/:id/status', () => {
    it('updates status and returns success', async () => {
      // Create a fresh user for this test
      const groupId = generatePublicID(1, EntityType.UserGroup);
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/admin/users')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          username: `statususer-${ctx.ts}`,
          password: 'pass123',
          email: `status-${ctx.ts}@test.com`,
          nickname: 'StatusUser',
          userGroupID: groupId,
        });

      const userId = createRes.body.data?.id;
      if (!userId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/admin/users/${userId}/status`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ status: 2 }); // Disable (1=active, 2=disabled, 3=locked)

      assertSuccessResponse(res, 200);
    });
  });

  // ─── 11. GET /api/admin/user-groups (JWT+Admin) ─────────────────────

  describe('GET /api/admin/user-groups', () => {
    it('returns user group list as array', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/user-groups')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const group = data[0];
        expect(group).toHaveProperty('id');
        expect(typeof group.id).toBe('string'); // Sqids public ID
        expect(group).toHaveProperty('name');
        expect(group).toHaveProperty('description');
      }
    });
  });
});
