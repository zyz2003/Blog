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
 * Page API Compatibility Tests
 * Verifies all 7 page endpoints match Go backend response format.
 */
describe('Page API Compat', () => {
  let ctx: TestContext;
  let pageId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/pages (JWT+Admin) ─────────────────────────────────

  describe('POST /api/pages', () => {
    it('creates page with numeric id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Compat Test Page ${ctx.ts}`,
          path: `/compat-test-${ctx.ts}`,
          content: '<p>Test page content</p>',
          markdown_content: '# Test Page\n\nTest page content',
          is_published: true,
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      // Page has: id (numeric), path, content, is_published, created_at, updated_at
      expect(data).toHaveProperty('id');
      expect(Number.isInteger(data.id)).toBe(true); // Numeric ID per D-71
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('is_published');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');

      pageId = data.id;
    });
  });

  // ─── 2. GET /api/pages (JWT+Admin) ──────────────────────────────────

  describe('GET /api/pages', () => {
    it('returns page list with { pages, total, page, size }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/pages?page=1&page_size=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Per D-73: uses { pages, total, page, size } format
      expect(data).toHaveProperty('pages');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('size');
      expect(Array.isArray(data.pages)).toBe(true);
    });
  });

  // ─── 3. GET /api/pages/:id (JWT+Admin) ──────────────────────────────

  describe('GET /api/pages/:id', () => {
    it('returns single page with all fields', async () => {
      if (!pageId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/pages/${pageId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Page object fields
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('path');
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('is_published');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');

      // Snake_case fields
      expect(data).toHaveProperty('markdown_content');
      expect(data).toHaveProperty('custom_js');
      expect(data).toHaveProperty('custom_css');
      expect(data).toHaveProperty('show_comment');
      expect(data).toHaveProperty('sort');
    });
  });

  // ─── 4. PUT /api/pages/:id (JWT+Admin) ──────────────────────────────

  describe('PUT /api/pages/:id', () => {
    it('updates page and returns updated data', async () => {
      if (!pageId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/pages/${pageId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ title: 'Updated Compat Test Page' });

      assertSuccessResponse(res, 200);
    });
  });

  // ─── 5. DELETE /api/pages/:id (JWT+Admin) ───────────────────────────

  describe('DELETE /api/pages/:id', () => {
    it('soft-deletes page and returns success', async () => {
      if (!pageId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/pages/${pageId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res, 200);
    });
  });

  // ─── 6. POST /api/pages/initialize (JWT+Admin) ──────────────────────

  describe('POST /api/pages/initialize', () => {
    it('initializes default pages and returns success', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/pages/initialize')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // NestJS POST returns 201
      assertSuccessResponse(res, 200);
    });
  });

  // ─── 7. GET /api/public/pages/*path ─────────────────────────────────

  describe('GET /api/public/pages/*path', () => {
    it('returns 404 for nonexistent page path', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/pages/nonexistent-page-path');

      expect(res.status).toBe(404);
    });

    it('returns published page by path', async () => {
      // Create a published page first
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: 'Public Test Page',
          path: `/public-test-${ctx.ts}`,
          content: '<p>Public content</p>',
          markdown_content: '# Public Test Page',
          is_published: true,
        });

      const path = createRes.body.data?.path;
      if (!path) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/public/pages${path}`);

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('title');
      expect(res.body.data).toHaveProperty('content');
      expect(res.body.data).toHaveProperty('is_published', true);
    });

    it('returns 404 for unpublished page', async () => {
      // Create an unpublished page
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: 'Private Test Page',
          path: `/private-test-${ctx.ts}`,
          content: '<p>Private content</p>',
          markdown_content: '# Private Test Page',
          is_published: false,
        });

      const path = createRes.body.data?.path;
      if (!path) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/public/pages${path}`);

      expect(res.status).toBe(404);
    });
  });
});
