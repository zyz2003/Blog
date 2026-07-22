/**
 * Phase 14: User Management & User Center Field-by-Field Verification
 *
 * Verifies user management and user center endpoints match Go handler response structures.
 * Go AdminUserDTO: _go-backend-archive/pkg/handler/user/handler.go lines 307-320
 * Go GetUserInfoResponse: _go-backend-archive/pkg/handler/user/handler.go lines 67-80
 * Go UserGroup: _go-backend-archive/pkg/handler/user/handler.go lines 59-64
 * Go SimpleUserNotificationSettingsResponse: _go-backend-archive/pkg/handler/notification/dto.go lines 57-59
 *
 * Key findings from RESEARCH:
 * - UserGroup.description: Go returns "" (string zero value), NestJS may return null when DB has null.
 *   Fix: default to empty string with `group.description ?? ''`.
 * - GetUserInfoResponse.userGroupID: Go uses uint (raw number), AdminUserDTO.userGroupID: Go uses string (Sqids).
 *   This is a Go design inconsistency that NestJS must replicate.
 *
 * Endpoints tested: #147-158
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';
import { decodePublicID, EntityType } from '../../src/common/utils/sqids.util';

/**
 * Asserts that an object has all AdminUserDTO fields with correct types,
 * matching Go AdminUserDTO struct (handler/user/handler.go lines 307-320).
 *
 * Go AdminUserDTO has 11 fields:
 *   ID (string, Sqids), CreatedAt (string), UpdatedAt (string),
 *   Username (string), Nickname (string), Avatar (string), Email (string),
 *   Website (string), LastLoginAt (*string), UserGroupID (string, Sqids),
 *   UserGroup (UserGroup), Status (int)
 */
function assertAdminUserDTOFields(data: any) {
  // id: string (Sqids-encoded)
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');

  // created_at: string
  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string');

  // updated_at: string
  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string');

  // username: string
  expect(data).toHaveProperty('username');
  expect(typeof data.username).toBe('string');

  // nickname: string
  expect(data).toHaveProperty('nickname');
  expect(typeof data.nickname).toBe('string');

  // avatar: string (Go always sets avatar — gravatar URL or direct URL)
  expect(data).toHaveProperty('avatar');
  if (data.avatar !== null) {
    expect(typeof data.avatar).toBe('string');
  }

  // email: string
  expect(data).toHaveProperty('email');
  expect(typeof data.email).toBe('string');

  // website: string | null
  expect(data).toHaveProperty('website');
  if (data.website !== null) {
    expect(typeof data.website).toBe('string');
  }

  // lastLoginAt: string | null
  expect(data).toHaveProperty('lastLoginAt');
  if (data.lastLoginAt !== null) {
    expect(typeof data.lastLoginAt).toBe('string');
  }

  // userGroupID: string (Sqids-encoded) in AdminUserDTO
  expect(data).toHaveProperty('userGroupID');
  expect(typeof data.userGroupID).toBe('string');

  // userGroup: UserGroup object
  expect(data).toHaveProperty('userGroup');
  assertUserGroupFields(data.userGroup);

  // status: number
  expect(data).toHaveProperty('status');
  expect(typeof data.status).toBe('number');
}

/**
 * Asserts UserGroup fields matching Go UserGroup struct (handler/user/handler.go lines 59-64).
 * Go UserGroup has 3 fields: ID (string, Sqids), Name (string), Description (string).
 * Description is string type in Go — Go string zero value is "", NOT null.
 * NestJS must return "" for null DB values to match Go behavior.
 */
function assertUserGroupFields(data: any) {
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');

  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  // description: string (NOT null — Go string zero value is "")
  expect(data).toHaveProperty('description');
  expect(typeof data.description).toBe('string');
  // Critical: description must NOT be null, even if DB has null
  expect(data.description).not.toBeNull();
}

describe('UserManagement Field Verification', () => {
  let ctx: TestContext;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── GET /api/admin/users: AdminListUsersResponse ──────────────────────

  describe('GET /api/admin/users', () => {
    it('returns AdminListUsersResponse { users, total, page, size }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go AdminListUsersResponse: { users: []AdminUserDTO, total: int64, page: int, size: int }
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('size');
      expect(typeof data.total).toBe('number');
      expect(typeof data.page).toBe('number');
      expect(typeof data.size).toBe('number');
      expect(Array.isArray(data.users)).toBe(true);
    });

    it('users have all 11 AdminUserDTO fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const users = res.body.data.users;

      if (users.length > 0) {
        assertAdminUserDTOFields(users[0]);
      }
    });

    it('returns users with userGroupID as Sqids string', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const users = res.body.data.users;

      if (users.length > 0) {
        const userGroupID = users[0].userGroupID;
        expect(typeof userGroupID).toBe('string');
        // Verify it's a valid Sqids-encoded ID for UserGroup entity type
        const decoded = decodePublicID(userGroupID);
        expect(decoded.entityType).toBe(EntityType.UserGroup);
      }
    });

    it('returns UserGroup with description as string (not null)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const users = res.body.data.users;

      if (users.length > 0) {
        const userGroup = users[0].userGroup;
        // Go UserGroup.Description is string type — zero value is ""
        expect(userGroup).toHaveProperty('description');
        expect(typeof userGroup.description).toBe('string');
        expect(userGroup.description).not.toBeNull();
      }
    });
  });

  // ─── POST /api/admin/users: Create user ────────────────────────────────

  describe('POST /api/admin/users', () => {
    it('returns AdminUserDTO with Sqids userGroupID', async () => {
      // Get a valid userGroupID first
      const groupsRes = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/user-groups')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const groups = groupsRes.body.data;
      const groupID = groups[0]?.id;
      if (!groupID) return;

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/admin/users')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          username: `testuser${ctx.ts}`,
          password: 'password123',
          email: `test${ctx.ts}@test.com`,
          nickname: 'Test User',
          userGroupID: groupID,
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      assertAdminUserDTOFields(data);

      // Verify userGroupID is Sqids string
      const decoded = decodePublicID(data.userGroupID);
      expect(decoded.entityType).toBe(EntityType.UserGroup);

      // Store for subsequent tests
      testUserId = data.id;
    });
  });

  // ─── PUT /api/admin/users/:id: Update user ─────────────────────────────

  describe('PUT /api/admin/users/:id', () => {
    it('returns void response (success with null data)', async () => {
      if (!testUserId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/admin/users/${testUserId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          nickname: 'Updated Nickname',
        });

      assertSuccessResponse(res);
    });
  });

  // ─── DELETE /api/admin/users/:id: Delete user ──────────────────────────

  describe('DELETE /api/admin/users/:id', () => {
    it('returns void response', async () => {
      if (!testUserId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/admin/users/${testUserId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });

  // ─── POST /api/admin/users/:id/reset-password ──────────────────────────

  describe('POST /api/admin/users/:id/reset-password', () => {
    it('returns void response', async () => {
      // Use admin user ID (always exists from seed data)
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const adminId = listRes.body.data.users[0]?.id;
      if (!adminId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .post(`/api/admin/users/${adminId}/reset-password`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ newPassword: 'newpassword123' });

      assertSuccessResponse(res);
    });
  });

  // ─── PUT /api/admin/users/:id/status ───────────────────────────────────

  describe('PUT /api/admin/users/:id/status', () => {
    it('returns void response', async () => {
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const adminId = listRes.body.data.users[0]?.id;
      if (!adminId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/admin/users/${adminId}/status`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ status: 1 });

      assertSuccessResponse(res);
    });
  });

  // ─── GET /api/admin/user-groups: UserGroup array ───────────────────────

  describe('GET /api/admin/user-groups', () => {
    it('returns UserGroup array with description as string (not null)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/user-groups')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const groups = res.body.data;

      expect(Array.isArray(groups)).toBe(true);
      if (groups.length > 0) {
        const group = groups[0];
        assertUserGroupFields(group);
      }
    });

    it('returns groups with Sqids string id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/user-groups')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const groups = res.body.data;

      if (groups.length > 0) {
        const decoded = decodePublicID(groups[0].id);
        expect(decoded.entityType).toBe(EntityType.UserGroup);
      }
    });
  });

  // ─── User Center Endpoints (same TestContext) ──────────────────────────

  // ─── GET /api/user/info: GetUserInfoResponse ───────────────────────────

  describe('GET /api/user/info', () => {
    it('returns GetUserInfoResponse with userGroupID as raw number (Go inconsistency)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/info')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go GetUserInfoResponse has same fields as AdminUserDTO EXCEPT:
      // userGroupID is uint (raw number) in GetUserInfoResponse
      // vs string (Sqids) in AdminUserDTO — this is a Go design inconsistency
      expect(data).toHaveProperty('userGroupID');
      expect(typeof data.userGroupID).toBe('number');

      // Other fields should match
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');

      expect(data).toHaveProperty('created_at');
      expect(typeof data.created_at).toBe('string');

      expect(data).toHaveProperty('updated_at');
      expect(typeof data.updated_at).toBe('string');

      expect(data).toHaveProperty('username');
      expect(typeof data.username).toBe('string');

      expect(data).toHaveProperty('nickname');
      expect(typeof data.nickname).toBe('string');

      expect(data).toHaveProperty('avatar');
      if (data.avatar !== null) {
        expect(typeof data.avatar).toBe('string');
      }

      expect(data).toHaveProperty('email');
      expect(typeof data.email).toBe('string');

      expect(data).toHaveProperty('website');
      if (data.website !== null) {
        expect(typeof data.website).toBe('string');
      }

      expect(data).toHaveProperty('lastLoginAt');
      if (data.lastLoginAt !== null) {
        expect(typeof data.lastLoginAt).toBe('string');
      }

      expect(data).toHaveProperty('userGroup');
      assertUserGroupFields(data.userGroup);

      expect(data).toHaveProperty('status');
      expect(typeof data.status).toBe('number');
    });
  });

  // ─── PUT /api/user/profile: Update profile ─────────────────────────────

  describe('PUT /api/user/profile', () => {
    it('returns void response (null data)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/user/profile')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          nickname: 'Updated Admin',
        });

      assertSuccessResponse(res);
      // Go returns response.Success(c, nil, "用户信息更新成功")
      // NestJS returns null which global interceptor wraps as data: null
    });
  });

  // ─── POST /api/user/update-password ────────────────────────────────────

  describe('POST /api/user/update-password', () => {
    it('returns void response', async () => {
      // First, reset password to a known value via admin endpoint
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const adminId = listRes.body.data.users[0]?.id;
      if (!adminId) return;

      // Reset to known password first
      await supertest(ctx.app.getHttpServer())
        .post(`/api/admin/users/${adminId}/reset-password`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ newPassword: 'password123' });

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/user/update-password')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          oldPassword: 'password123',
          newPassword: 'password456',
        });

      assertSuccessResponse(res);

      // Reset password back for other tests
      await supertest(ctx.app.getHttpServer())
        .post('/api/user/update-password')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          oldPassword: 'password456',
          newPassword: 'password123',
        });
    });
  });

  // ─── POST /api/user/avatar: 501 stub ───────────────────────────────────

  describe('POST /api/user/avatar', () => {
    it('returns 501 Not Implemented (avatar upload not yet available)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/user/avatar')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .attach('file', Buffer.from('test'), 'test.png');

      // NestJS returns 501 for avatar upload (not yet implemented)
      expect(res.status).toBe(501);
    });
  });

  // ─── GET /api/user/notification-settings ───────────────────────────────

  describe('GET /api/user/notification-settings', () => {
    it('returns SimpleUserNotificationSettingsResponse { allowCommentReplyNotification: boolean }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-settings')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go SimpleUserNotificationSettingsResponse has 1 field:
      // AllowCommentReplyNotification bool `json:"allowCommentReplyNotification"`
      expect(data).toHaveProperty('allowCommentReplyNotification');
      expect(typeof data.allowCommentReplyNotification).toBe('boolean');
    });
  });

  // ─── PUT /api/user/notification-settings ───────────────────────────────

  describe('PUT /api/user/notification-settings', () => {
    it('returns SimpleUserNotificationSettingsResponse after update', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/user/notification-settings')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          allowCommentReplyNotification: true,
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go UpdateUserNotificationSettings returns SimpleUserNotificationSettingsResponse
      expect(data).toHaveProperty('allowCommentReplyNotification');
      expect(typeof data.allowCommentReplyNotification).toBe('boolean');
    });
  });

  // ─── UserGroup.description edge case ───────────────────────────────────

  describe('UserGroup.description nullability edge case', () => {
    it('returns empty string for null description in DB (Go string zero value)', async () => {
      // Insert a user group with null description directly into DB
      const { userGroups } = await import('../../src/database/schemas/user-group.schema');
      await ctx.db.insert(userGroups).values({
        name: `NullDescGroup ${ctx.ts}`,
        description: null, // Explicitly null
        permissions: JSON.stringify([]),
        maxStorage: 0,
        speedLimit: 0,
        settings: JSON.stringify({}),
      }).onConflictDoNothing().run();

      // Fetch user groups via API
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/user-groups')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const groups = res.body.data;

      // Find the group with null description
      const nullDescGroup = groups.find((g: any) => g.name === `NullDescGroup ${ctx.ts}`);
      if (nullDescGroup) {
        // Go UserGroup.Description is string type — zero value is ""
        // NestJS must return "" for null DB values
        expect(nullDescGroup.description).toBe('');
        expect(typeof nullDescGroup.description).toBe('string');
      }
    });
  });

  // ─── GetUserInfoResponse.userGroupID inconsistency ─────────────────────

  describe('GetUserInfoResponse.userGroupID type inconsistency', () => {
    it('userGroupID is raw number in GetUserInfoResponse (Go uint inconsistency)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/info')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go GetUserInfoResponse.userGroupID is uint (raw number)
      // This differs from AdminUserDTO.userGroupID which is string (Sqids)
      // This is a Go design inconsistency that NestJS replicates
      expect(data).toHaveProperty('userGroupID');
      expect(typeof data.userGroupID).toBe('number');
    });

    it('AdminUserDTO.userGroupID is Sqids string (different from GetUserInfo)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/admin/users?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const users = res.body.data.users;

      if (users.length > 0) {
        // AdminUserDTO.userGroupID is string (Sqids) — different from GetUserInfo
        expect(typeof users[0].userGroupID).toBe('string');
        const decoded = decodePublicID(users[0].userGroupID);
        expect(decoded.entityType).toBe(EntityType.UserGroup);
      }
    });
  });
});
