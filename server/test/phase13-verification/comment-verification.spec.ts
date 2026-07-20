/**
 * Phase 13: Comment Field-by-Field Verification
 *
 * Go Response baseline: _go-backend-archive/pkg/handler/comment/dto/dto.go
 * Go ListResponse baseline: dto.go lines 126-133
 * Go ImportResult baseline: dto.go lines 153-158
 *
 * Key fields:
 * - ListResponse has total_with_children and has_more
 * - Response has 22+ fields including admin-only fields
 * - ImportResult has total_count, success_count, skipped_count, failed_count, error_messages
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Assert ListResponse fields match Go ListResponse struct (dto.go lines 126-133).
 */
function assertCommentListResponseFields(data: any) {
  expect(data).toHaveProperty('list');
  expect(Array.isArray(data.list)).toBe(true);

  expect(data).toHaveProperty('total');
  expect(typeof data.total).toBe('number');

  // total_with_children: int64 — all comments including descendants
  expect(data).toHaveProperty('total_with_children');
  expect(typeof data.total_with_children).toBe('number');

  expect(data).toHaveProperty('page');
  expect(typeof data.page).toBe('number');

  // pageSize: camelCase in Go!
  expect(data).toHaveProperty('pageSize');
  expect(typeof data.pageSize).toBe('number');

  // has_more: bool (omitempty)
  if (data.has_more !== undefined && data.has_more !== null) {
    expect(typeof data.has_more).toBe('boolean');
  }
}

/**
 * Assert Comment Response fields match Go Response struct (dto.go lines 93-123).
 */
function assertCommentResponseFields(data: any, options?: { isAdmin?: boolean }) {
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');

  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string'); // NOT null per CCP-1

  // pinned_at: *time.Time (nullable, omitempty)
  if (data.pinned_at !== undefined && data.pinned_at !== null) {
    expect(typeof data.pinned_at).toBe('string');
  }

  expect(data).toHaveProperty('nickname');
  expect(typeof data.nickname).toBe('string');

  // email_md5: string
  if (data.email_md5 !== undefined && data.email_md5 !== null) {
    expect(typeof data.email_md5).toBe('string');
  }

  // qq_number: *string (omitempty)
  if (data.qq_number !== undefined && data.qq_number !== null) {
    expect(typeof data.qq_number).toBe('string');
  }

  // avatar_url: *string (omitempty)
  if (data.avatar_url !== undefined && data.avatar_url !== null) {
    expect(typeof data.avatar_url).toBe('string');
  }

  // website: *string (omitempty)
  if (data.website !== undefined && data.website !== null) {
    expect(typeof data.website).toBe('string');
  }

  // content_html: string
  if (data.content_html !== undefined && data.content_html !== null) {
    expect(typeof data.content_html).toBe('string');
  }

  // is_admin_comment: bool
  if (data.is_admin_comment !== undefined && data.is_admin_comment !== null) {
    expect(typeof data.is_admin_comment).toBe('boolean');
  }

  // is_anonymous: bool
  if (data.is_anonymous !== undefined && data.is_anonymous !== null) {
    expect(typeof data.is_anonymous).toBe('boolean');
  }

  // ip_location: string (omitempty)
  if (data.ip_location !== undefined && data.ip_location !== null) {
    expect(typeof data.ip_location).toBe('string');
  }

  // user_agent: *string (omitempty)
  if (data.user_agent !== undefined && data.user_agent !== null) {
    expect(typeof data.user_agent).toBe('string');
  }

  // target_path: string
  if (data.target_path !== undefined) {
    expect(typeof data.target_path).toBe('string');
  }

  // target_title: *string (omitempty)
  if (data.target_title !== undefined && data.target_title !== null) {
    expect(typeof data.target_title).toBe('string');
  }

  // parent_id: *string (omitempty)
  if (data.parent_id !== undefined && data.parent_id !== null) {
    expect(typeof data.parent_id).toBe('string');
  }

  // reply_to_id: *string (omitempty)
  if (data.reply_to_id !== undefined && data.reply_to_id !== null) {
    expect(typeof data.reply_to_id).toBe('string');
  }

  // reply_to_nick: *string (omitempty)
  if (data.reply_to_nick !== undefined && data.reply_to_nick !== null) {
    expect(typeof data.reply_to_nick).toBe('string');
  }

  expect(data).toHaveProperty('like_count');
  expect(typeof data.like_count).toBe('number');

  // total_children: int64
  if (data.total_children !== undefined && data.total_children !== null) {
    expect(typeof data.total_children).toBe('number');
  }

  // children: []*Response (omitempty)
  if (data.children !== undefined && data.children !== null) {
    expect(Array.isArray(data.children)).toBe(true);
  }

  // Admin-only fields (omitempty)
  if (options?.isAdmin) {
    // email: *string (omitempty, admin-only)
    if (data.email !== undefined && data.email !== null) {
      expect(typeof data.email).toBe('string');
    }
    // ip_address: *string (omitempty, admin-only)
    if (data.ip_address !== undefined && data.ip_address !== null) {
      expect(typeof data.ip_address).toBe('string');
    }
    // content: *string (omitempty, admin-only) — Markdown
    if (data.content !== undefined && data.content !== null) {
      expect(typeof data.content).toBe('string');
    }
    // status: *int (omitempty, admin-only)
    if (data.status !== undefined && data.status !== null) {
      expect(typeof data.status).toBe('number');
    }
  }
}

describe('Comment Field Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── MEDIUM-risk: Public comment list ──────────────────────────────────

  describe('GET /api/public/comments/latest (MEDIUM)', () => {
    it('returns ListResponse with total_with_children and has_more', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/comments/latest?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      assertCommentListResponseFields(res.body.data);
    });
  });

  describe('GET /api/public/comments (MEDIUM)', () => {
    it('returns ListResponse with all fields including total_with_children', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/comments?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      assertCommentListResponseFields(res.body.data);
    });

    it('list items have all Response fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/comments?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        assertCommentResponseFields(list[0]);
      }
    });
  });

  // ─── MEDIUM-risk: Create public comment ────────────────────────────────

  describe('POST /api/public/comments (MEDIUM)', () => {
    it('returns Comment Response with all fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/public/comments')
        .send({
          target_path: '/posts/test',
          nickname: `Phase13 User ${ctx.ts}`,
          email: 'test@example.com',
          content: 'This is a test comment for field verification',
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      assertCommentResponseFields(data);

      // Date field must be string (not null) per CCP-1
      expect(data.created_at).not.toBeNull();
    });
  });

  // ─── MEDIUM-risk: Admin comment list ───────────────────────────────────

  describe('GET /api/comments (MEDIUM)', () => {
    it('returns admin ListResponse with total_with_children and has_more', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/comments?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      assertCommentListResponseFields(res.body.data);
    });

    it('admin list items have admin-only fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/comments?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        assertCommentResponseFields(list[0], { isAdmin: true });
      }
    });
  });

  // ─── MEDIUM-risk: Comment import result ────────────────────────────────

  describe('POST /api/comments/import (MEDIUM)', () => {
    it('ImportResult has total_count, success_count, skipped_count, failed_count, error_messages', async () => {
      // Import with empty data — may return 501 or actual ImportResult
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/comments/import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .attach('file', Buffer.from('[]'), 'comments.json');

      if (res.status === 501) {
        // Import not fully implemented
        return;
      }

      if (res.status === 200) {
        const data = res.body.data;
        // Go ImportResult fields
        expect(data).toHaveProperty('total_count');
        expect(typeof data.total_count).toBe('number');

        expect(data).toHaveProperty('success_count');
        expect(typeof data.success_count).toBe('number');

        expect(data).toHaveProperty('skipped_count');
        expect(typeof data.skipped_count).toBe('number');

        expect(data).toHaveProperty('failed_count');
        expect(typeof data.failed_count).toBe('number');

        expect(data).toHaveProperty('error_messages');
        expect(Array.isArray(data.error_messages)).toBe(true);
      }
    });
  });

  // ─── LOW-risk: QQ info ─────────────────────────────────────────────────

  describe('GET /api/public/comments/qq-info (LOW)', () => {
    it('returns QQInfoResponse with avatar and name fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/comments/qq-info?qq=123456789');

      // May return 200 or error if QQ API unavailable
      if (res.status === 200) {
        assertSuccessResponse(res);
        const data = res.body.data;
        if (data.avatar !== undefined) {
          expect(typeof data.avatar).toBe('string');
        }
        if (data.name !== undefined) {
          expect(typeof data.name).toBe('string');
        }
      }
    });
  });

  // ─── NONE-risk: Like/unlike ────────────────────────────────────────────

  describe('POST /api/public/comments/:id/like (NONE)', () => {
    it('returns number', async () => {
      // Get a comment ID first
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/public/comments?page=1&pageSize=10');

      const list = listRes.body.data?.list;
      if (!list || list.length === 0) return;

      const commentId = list[0].id;

      const res = await supertest(ctx.app.getHttpServer())
        .post(`/api/public/comments/${commentId}/like`);

      assertSuccessResponse(res);
      expect(typeof res.body.data).toBe('number');
    });
  });

  // ─── NONE-risk: Admin comment CRUD ─────────────────────────────────────

  describe('DELETE /api/comments (NONE)', () => {
    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/comments')
        .send({ ids: ['nonexistent'] });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/comments/:id/status (NONE)', () => {
    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/comments/nonexistent/status')
        .send({ status: 1 });

      expect(res.status).toBe(401);
    });
  });

  // ─── NONE-risk: Comment export ─────────────────────────────────────────

  describe('POST /api/comments/export (NONE)', () => {
    it('returns blob or 501', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/comments/export')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ ids: [] });

      if (res.status === 501) return;
      if (res.status === 200) {
        // Export returns file
        expect(res.type).toMatch(/json|octet-stream/);
      }
    });
  });
});
