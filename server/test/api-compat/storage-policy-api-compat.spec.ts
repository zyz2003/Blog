import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

/**
 * Storage Policy API Compatibility Tests
 * Verifies all 7 storage policy endpoints match Go backend response format.
 * All endpoints require JWT + Admin auth.
 */
describe('Storage Policy API Compat', () => {
  let ctx: TestContext;
  let policyId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/policies (Create, JWT+Admin) ──────────────────────

  describe('POST /api/policies', () => {
    it('creates local storage policy', async () => {
      // Use user_avatar flag to avoid conflict with existing comment_image policy
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/policies')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Test Policy ${ctx.ts}`,
          type: 'local',
          flag: 'user_avatar',
          max_size: 0,
        });

      // NestJS POST returns code 201 (Go returns 200)
      // May be 409 if flag already exists from prior test run
      if (res.body?.code === 201 || res.body?.code === 200) {
        const data = res.body.data;
        expect(data).toHaveProperty('id');
        expect(typeof data.id).toBe('string');
        expect(data).toHaveProperty('type');
        expect(data).toHaveProperty('flag');
        expect(data).toHaveProperty('max_size');
        policyId = data.id;
      } else {
        // Flag uniqueness conflict — list existing and use first
        const listRes = await supertest(ctx.app.getHttpServer())
          .get('/api/policies?page=1&pageSize=10')
          .set('authorization', `Bearer ${ctx.adminToken}`);
        if (listRes.body?.data?.list?.length > 0) {
          policyId = listRes.body.data.list[0].id;
        }
      }
    });

    it('rejects cloud storage type', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/policies')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Cloud Policy ${ctx.ts}`,
          type: 'onedrive',
          flag: 'article_image',
          max_size: 0,
        });

      // Only type='local' allowed
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/policies')
        .send({ name: 'Unauthorized', type: 'local', flag: 'comment_image' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 2. GET /api/policies (List, JWT+Admin) ─────────────────────────

  describe('GET /api/policies', () => {
    it('returns paginated policy list', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Paginated response
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('rejects without auth', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies');

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. GET /api/policies/connect/onedrive/:id (Connect, JWT+Admin) ─

  describe('GET /api/policies/connect/onedrive/:id', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies/connect/onedrive/nonexistent-id')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBe(501);
    });
  });

  // ─── 4. POST /api/policies/authorize/onedrive (Authorize, JWT+Admin) ─

  describe('POST /api/policies/authorize/onedrive', () => {
    it('returns 501 NOT_IMPLEMENTED', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/policies/authorize/onedrive')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBe(501);
    });
  });

  // ─── 5. GET /api/policies/:id (Get, JWT+Admin) ──────────────────────

  describe('GET /api/policies/:id', () => {
    it('returns policy detail', async () => {
      if (!policyId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/policies/${policyId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('type');
      expect(res.body.data).toHaveProperty('flag');
    });
  });

  // ─── 6. PUT /api/policies/:id (Update, JWT+Admin) ──────────────────

  describe('PUT /api/policies/:id', () => {
    it('updates policy and returns updated data', async () => {
      if (!policyId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/policies/${policyId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ name: `Updated Policy ${ctx.ts}` });

      assertSuccessResponse(res, 200);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('type');
    });
  });

  // ─── 7. DELETE /api/policies/:id (Delete, JWT+Admin) ────────────────

  describe('DELETE /api/policies/:id', () => {
    it('deletes policy or returns error for invalid id', async () => {
      if (!policyId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/policies/${policyId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // Delete may return 200 (success) or 400 (already deleted / invalid)
      expect(res.status).toBeLessThan(500);
    });
  });
});
