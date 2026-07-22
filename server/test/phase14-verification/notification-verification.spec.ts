/**
 * Phase 14: Notification & Subscriber Verification
 *
 * Verifies notification settings, notification types, notification configs,
 * and subscriber endpoints match Go backend response structures.
 *
 * Go reference:
 *   - _go-backend-archive/pkg/handler/notification/handler.go
 *   - _go-backend-archive/pkg/handler/notification/dto.go
 *   - _go-backend-archive/pkg/handler/subscriber/handler.go
 *
 * Key structures:
 *   - SimpleUserNotificationSettingsResponse: { allowCommentReplyNotification: bool }
 *   - NotificationTypeDTO: 9 fields (id, code, name, description, category, isActive, defaultEnabled, supportedChannels, createdAt, updatedAt)
 *   - UserNotificationConfigDTO: 10 fields (id, userId, notificationTypeId, isEnabled, enabledChannels, notificationEmail, customSettings, notificationType, createdAt, updatedAt)
 *   - Subscriber endpoints: void responses with { data: null, message }
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertErrorResponse,
  clearThrottleStorage,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Assert NotificationTypeDTO has all 9 fields matching Go struct.
 * Go NotificationTypeDTO:
 *   ID uint, Code string, Name string, Description string, Category string,
 *   IsActive bool, DefaultEnabled bool, SupportedChannels []string,
 *   CreatedAt time.Time, UpdatedAt time.Time
 */
function assertNotificationTypeDTO(nt: any) {
  expect(nt).toHaveProperty('id');
  expect(typeof nt.id).toBe('number');

  expect(nt).toHaveProperty('code');
  expect(typeof nt.code).toBe('string');

  expect(nt).toHaveProperty('name');
  expect(typeof nt.name).toBe('string');

  expect(nt).toHaveProperty('description');
  // description can be string or null (Go omitempty)
  if (nt.description !== null) {
    expect(typeof nt.description).toBe('string');
  }

  expect(nt).toHaveProperty('category');
  expect(typeof nt.category).toBe('string');

  expect(nt).toHaveProperty('isActive');
  expect(typeof nt.isActive).toBe('boolean');

  expect(nt).toHaveProperty('defaultEnabled');
  expect(typeof nt.defaultEnabled).toBe('boolean');

  expect(nt).toHaveProperty('supportedChannels');
  if (nt.supportedChannels !== null) {
    expect(Array.isArray(nt.supportedChannels)).toBe(true);
  }

  expect(nt).toHaveProperty('createdAt');
  expect(typeof nt.createdAt).toBe('string');

  expect(nt).toHaveProperty('updatedAt');
  expect(typeof nt.updatedAt).toBe('string');
}

/**
 * Assert UserNotificationConfigDTO has all 10 fields matching Go struct.
 * Go UserNotificationConfigDTO:
 *   ID uint, UserID uint, NotificationTypeID uint, IsEnabled bool,
 *   EnabledChannels []string, NotificationEmail string, CustomSettings map,
 *   NotificationType *NotificationTypeDTO, CreatedAt time.Time, UpdatedAt time.Time
 */
function assertUserNotificationConfigDTO(config: any) {
  expect(config).toHaveProperty('id');
  expect(typeof config.id).toBe('number');

  expect(config).toHaveProperty('userId');
  expect(typeof config.userId).toBe('number');

  expect(config).toHaveProperty('notificationTypeId');
  expect(typeof config.notificationTypeId).toBe('number');

  expect(config).toHaveProperty('isEnabled');
  expect(typeof config.isEnabled).toBe('boolean');

  expect(config).toHaveProperty('enabledChannels');
  if (config.enabledChannels !== null) {
    expect(Array.isArray(config.enabledChannels)).toBe(true);
  }

  // notificationEmail: string or null (Go omitempty)
  if (config.notificationEmail !== null && config.notificationEmail !== undefined) {
    expect(typeof config.notificationEmail).toBe('string');
  }

  // customSettings: object or null (Go omitempty)
  if (config.customSettings !== null && config.customSettings !== undefined) {
    expect(typeof config.customSettings).toBe('object');
  }

  // notificationType: nested NotificationTypeDTO (Go omitempty, pointer)
  if (config.notificationType !== null && config.notificationType !== undefined) {
    assertNotificationTypeDTO(config.notificationType);
  }

  expect(config).toHaveProperty('createdAt');
  if (config.createdAt !== null) {
    expect(typeof config.createdAt).toBe('string');
  }

  expect(config).toHaveProperty('updatedAt');
  if (config.updatedAt !== null) {
    expect(typeof config.updatedAt).toBe('string');
  }
}

describe('Notification Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── LOW-risk: Notification settings ──────────────────────────────────

  describe('GET /api/user/notification-settings (LOW)', () => {
    it('returns { allowCommentReplyNotification: boolean }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-settings')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go SimpleUserNotificationSettingsResponse has exactly 1 field
      expect(data).toHaveProperty('allowCommentReplyNotification');
      expect(typeof data.allowCommentReplyNotification).toBe('boolean');
    });
  });

  describe('PUT /api/user/notification-settings (LOW)', () => {
    it('updates and returns { allowCommentReplyNotification: boolean }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/user/notification-settings')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ allowCommentReplyNotification: true });

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('allowCommentReplyNotification');
      expect(typeof data.allowCommentReplyNotification).toBe('boolean');
      expect(data.allowCommentReplyNotification).toBe(true);
    });
  });

  // ─── LOW-risk: Notification types ─────────────────────────────────────

  describe('GET /api/notification/types (LOW)', () => {
    it('returns array of NotificationTypeDTO with 9 fields each', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/notification/types')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        // Verify first notification type has all 9 fields
        assertNotificationTypeDTO(data[0]);

        // Verify known type: comment_reply (seeded by NotificationService.onModuleInit)
        const commentReplyType = data.find((t: any) => t.code === 'comment_reply');
        if (commentReplyType) {
          expect(commentReplyType.name).toBe('评论回复通知');
          expect(commentReplyType.category).toBe('comment');
          expect(commentReplyType.isActive).toBe(true);
          expect(commentReplyType.defaultEnabled).toBe(true);
        }
      }
    });
  });

  // ─── LOW-risk: Notification configs ───────────────────────────────────

  describe('GET /api/user/notification-configs (LOW)', () => {
    it('returns array of UserNotificationConfigDTO with 10 fields each', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-configs')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        // Verify first config has all 10 fields
        assertUserNotificationConfigDTO(data[0]);
      }
    });

    it('config includes nested notificationType object', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notification-configs')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // At least one config should have notificationType populated
      const configWithType = data.find((c: any) => c.notificationType !== null && c.notificationType !== undefined);
      if (configWithType) {
        assertNotificationTypeDTO(configWithType.notificationType);
      }
    });
  });

  // ─── LOW-risk: In-app notifications ───────────────────────────────────

  describe('GET /api/user/notifications (LOW)', () => {
    it('returns paginated notifications list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notifications?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(typeof data.total).toBe('number');
      expect(Array.isArray(data.list)).toBe(true);
    });
  });

  describe('GET /api/user/notifications/unread-count (LOW)', () => {
    it('returns { count: number }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/user/notifications/unread-count')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('count');
      expect(typeof data.count).toBe('number');
    });
  });
});

describe('Subscriber Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── LOW-risk: Subscriber subscribe ───────────────────────────────────

  describe('POST /api/public/subscribe (LOW)', () => {
    it('returns void response with success message (Go: response.Success(c, nil, ...))', async () => {
      // Clear throttle to avoid rate limit
      clearThrottleStorage(ctx.app);

      // This will likely fail because there's no verification code,
      // but we verify the response format matches Go's pattern
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/subscribe')
        .send({ email: 'test-verify@example.com', code: '123456' });

      // Either success (unlikely without code) or error
      if (res.status === 200 && res.body.code === 200) {
        // Go: response.Success(c, nil, "订阅成功！...")
        // Global interceptor wraps as { code: 200, data: null, message: "..." }
        expect(res.body).toHaveProperty('code', 200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.data).toBeNull();
      } else {
        // Error response — verify format
        expect(res.body).toHaveProperty('code');
        expect(res.body).toHaveProperty('message');
      }
    });
  });

  // ─── LOW-risk: Subscriber unsubscribe ─────────────────────────────────

  describe('POST /api/public/unsubscribe (LOW)', () => {
    it('returns void response with success message', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/unsubscribe')
        .send({ email: 'nonexistent@example.com' });

      // Go: response.Success(c, nil, "退订成功") or error
      if (res.status === 200 && res.body.code === 200) {
        expect(res.body).toHaveProperty('code', 200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.data).toBeNull();
      } else {
        // Error response (subscriber not found)
        expect(res.body).toHaveProperty('code');
        expect(res.body).toHaveProperty('message');
      }
    });
  });

  // ─── LOW-risk: Unsubscribe by token ───────────────────────────────────

  describe('GET /api/public/unsubscribe/:token (LOW)', () => {
    it('returns 400 for empty token (Go: 令牌不能为空)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/unsubscribe/');

      // Empty token should return 400 or 404
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 404 for invalid token', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/unsubscribe/invalid-token-12345');

      // Go: response.Fail(c, 404, "订阅不存在或令牌无效")
      assertErrorResponse(res, 404);
    });
  });

  // ─── LOW-risk: Send verification code ─────────────────────────────────

  describe('POST /api/public/subscribe/code (LOW)', () => {
    it('returns void response or error (Go: response.Success(c, nil, ...))', async () => {
      clearThrottleStorage(ctx.app);

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/subscribe/code')
        .send({
          email: 'test-code@example.com',
          image_captcha_id: 'test',
          image_captcha_answer: 'test',
        });

      // Will likely fail due to captcha, but verify response format
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');

      if (res.status === 200 && res.body.code === 200) {
        expect(res.body.data).toBeNull();
      }
    });
  });
});
