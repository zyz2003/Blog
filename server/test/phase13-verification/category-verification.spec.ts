/**
 * Phase 13: Category Field-by-Field Verification
 *
 * Go PostCategoryResponse baseline: _go-backend-archive/pkg/domain/model/post_category.go
 * Fields: id (string), created_at (string NOT null), updated_at (string NOT null),
 *         name (string), slug (string), description (string), count (int),
 *         is_series (bool), sort_order (int)
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
 * Asserts that an object has all PostCategoryResponse fields with correct types,
 * matching Go PostCategoryResponse struct (model/post_category.go).
 */
function assertPostCategoryFields(data: any) {
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

  expect(data).toHaveProperty('description');
  expect(typeof data.description).toBe('string');

  // count may be present (Go PostCategoryResponse has Count int)
  if (data.count !== undefined) {
    expect(typeof data.count).toBe('number');
  }

  expect(data).toHaveProperty('is_series');
  expect(typeof data.is_series).toBe('boolean');

  expect(data).toHaveProperty('sort_order');
  expect(typeof data.sort_order).toBe('number');
}

describe('Category Field Verification', () => {
  let ctx: TestContext;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── MEDIUM-risk: GET categories ───────────────────────────────────────

  describe('GET /api/post-categories (MEDIUM)', () => {
    it('returns PostCategory[] with all fields and correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/post-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Response may be array directly or wrapped in { list }
      const categories = Array.isArray(data) ? data : (data.list || []);
      expect(Array.isArray(categories)).toBe(true);

      if (categories.length > 0) {
        assertPostCategoryFields(categories[0]);
      }
    });
  });

  // ─── D-314 pattern: description null coalescing ──────────────────────

  describe('PostCategory.description null coalescing (D-314 pattern)', () => {
    it('returns empty string for null description, never null', async () => {
      // Create a category without description (DB column will be null)
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/post-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Null Desc Cat ${ctx.ts}`,
          slug: `null-desc-cat-${ctx.ts}`,
          // description intentionally omitted → DB column is null
          is_series: false,
          sort_order: 0,
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      // Per D-314: description must be string (empty string for null DB values),
      // matching Go string zero value — never null
      expect(data).toHaveProperty('description');
      expect(typeof data.description).toBe('string');
    });
  });

  // ─── MEDIUM-risk: POST category ────────────────────────────────────────

  describe('POST /api/post-categories (MEDIUM)', () => {
    it('returns PostCategory with all fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/post-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Phase13 Category ${ctx.ts}`,
          slug: `phase13-cat-${ctx.ts}`,
          description: 'Test category for field verification',
          is_series: false,
          sort_order: 0,
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      assertPostCategoryFields(data);

      // Date fields must be strings (not null) per CCP-1
      expect(data.created_at).not.toBeNull();
      expect(data.updated_at).not.toBeNull();

      categoryId = data.id;
    });
  });

  // ─── MEDIUM-risk: PUT category ─────────────────────────────────────────

  describe('PUT /api/post-categories/:id (MEDIUM)', () => {
    it('returns PostCategory with all fields', async () => {
      if (!categoryId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/post-categories/${categoryId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Updated Category ${ctx.ts}`,
          slug: `updated-cat-${ctx.ts}`,
          description: 'Updated description',
          is_series: true,
          sort_order: 1,
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      assertPostCategoryFields(data);
    });
  });

  // ─── NONE-risk: DELETE category ────────────────────────────────────────

  describe('DELETE /api/post-categories/:id (NONE)', () => {
    it('returns success response', async () => {
      // Create a throwaway category for deletion
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/post-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Delete Target Cat ${ctx.ts}`,
          slug: `del-cat-${ctx.ts}`,
        });

      const deleteId = createRes.body.data.id;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/post-categories/${deleteId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });
});
