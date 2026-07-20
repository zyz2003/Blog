/**
 * Phase 13: Tag Field-by-Field Verification
 *
 * Go PostTagResponse baseline: _go-backend-archive/pkg/domain/model/post_tag.go
 * Fields: id (string), created_at (string NOT null), updated_at (string NOT null),
 *         name (string), slug (string), count (int)
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
 * Asserts that an object has all PostTagResponse fields with correct types,
 * matching Go PostTagResponse struct (model/post_tag.go).
 */
function assertPostTagFields(data: any) {
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string'); // Sqids encoded

  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string'); // NOT null per CCP-1

  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string'); // NOT null per CCP-1

  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  expect(data).toHaveProperty('slug');
  expect(typeof data.slug).toBe('string');

  // count may be present (Go PostTagResponse has Count int)
  if (data.count !== undefined) {
    expect(typeof data.count).toBe('number');
  }
}

describe('Tag Field Verification', () => {
  let ctx: TestContext;
  let tagId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── MEDIUM-risk: GET tags ─────────────────────────────────────────────

  describe('GET /api/post-tags (MEDIUM)', () => {
    it('returns PostTag[] with all fields and correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/post-tags')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Response may be array directly or wrapped in { list }
      const tags = Array.isArray(data) ? data : (data.list || []);
      expect(Array.isArray(tags)).toBe(true);

      if (tags.length > 0) {
        assertPostTagFields(tags[0]);
      }
    });
  });

  // ─── MEDIUM-risk: POST tag ─────────────────────────────────────────────

  describe('POST /api/post-tags (MEDIUM)', () => {
    it('returns PostTag with all fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/post-tags')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Phase13 Tag ${ctx.ts}`,
          slug: `phase13-tag-${ctx.ts}`,
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      assertPostTagFields(data);

      // Date fields must be strings (not null) per CCP-1
      expect(data.created_at).not.toBeNull();
      expect(data.updated_at).not.toBeNull();

      tagId = data.id;
    });
  });

  // ─── MEDIUM-risk: PUT tag ──────────────────────────────────────────────

  describe('PUT /api/post-tags/:id (MEDIUM)', () => {
    it('returns PostTag with all fields', async () => {
      if (!tagId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/post-tags/${tagId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Updated Tag ${ctx.ts}`,
          slug: `updated-tag-${ctx.ts}`,
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      assertPostTagFields(data);
    });
  });

  // ─── NONE-risk: DELETE tag ─────────────────────────────────────────────

  describe('DELETE /api/post-tags/:id (NONE)', () => {
    it('returns success response', async () => {
      // Create a throwaway tag for deletion
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/post-tags')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Delete Target Tag ${ctx.ts}`,
          slug: `del-tag-${ctx.ts}`,
        });

      const deleteId = createRes.body.data.id;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/post-tags/${deleteId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });
});
