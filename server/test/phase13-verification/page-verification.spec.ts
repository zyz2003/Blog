/**
 * Phase 13: Page Field-by-Field Verification
 *
 * Go Page struct baseline: _go-backend-archive/pkg/domain/model/page.go
 * Fields: id (uint → NestJS: number), title (string), path (string),
 *         content (string), markdown_content (string), custom_js (string),
 *         custom_css (string), description (string), is_published (bool),
 *         show_comment (bool), sort (int), created_at (string NOT null),
 *         updated_at (string NOT null)
 *
 * Note: Go Page uses uint for ID (not Sqids), but NestJS may use raw numeric ID per D-71.
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
 * Asserts that an object has all Page response fields with correct types,
 * matching Go Page struct (model/page.go) + NestJS toApiResponse.
 */
function assertPageResponseFields(data: any) {
  expect(data).toHaveProperty('id');
  // Per D-71: Page uses raw numeric ID (no Sqids encoding)
  expect(typeof data.id).toBe('number');

  expect(data).toHaveProperty('title');
  expect(typeof data.title).toBe('string');

  expect(data).toHaveProperty('path');
  expect(typeof data.path).toBe('string');

  // content: HTML content (nullable in NestJS)
  expect(data).toHaveProperty('content');
  if (data.content !== null) {
    expect(typeof data.content).toBe('string');
  }

  expect(data).toHaveProperty('markdown_content');
  expect(typeof data.markdown_content).toBe('string');

  expect(data).toHaveProperty('custom_js');
  expect(typeof data.custom_js).toBe('string');

  expect(data).toHaveProperty('custom_css');
  expect(typeof data.custom_css).toBe('string');

  // description: nullable
  expect(data).toHaveProperty('description');
  if (data.description !== null) {
    expect(typeof data.description).toBe('string');
  }

  expect(data).toHaveProperty('is_published');
  expect(typeof data.is_published).toBe('boolean');

  expect(data).toHaveProperty('show_comment');
  expect(typeof data.show_comment).toBe('boolean');

  expect(data).toHaveProperty('sort');
  expect(typeof data.sort).toBe('number');

  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string'); // NOT null per CCP-1

  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string'); // NOT null per CCP-1
}

describe('Page Field Verification', () => {
  let ctx: TestContext;
  let pageId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── MEDIUM-risk: GET pages ────────────────────────────────────────────

  describe('GET /api/pages (MEDIUM)', () => {
    it('returns PageListResponse with pages array and pagination', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/pages?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Per D-73: Page list returns { pages, total, page, size } (NOT list/pageSize)
      expect(data).toHaveProperty('pages');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(Array.isArray(data.pages)).toBe(true);
    });

    it('pages items have all Page fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/pages?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const pages = res.body.data.pages;

      if (pages.length > 0) {
        assertPageResponseFields(pages[0]);
      }
    });
  });

  // ─── MEDIUM-risk: Create page ──────────────────────────────────────────

  describe('POST /api/pages (MEDIUM)', () => {
    it('returns Page with all fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Phase13 Verify Page ${ctx.ts}`,
          path: `phase13-page-${ctx.ts}`,
          content: '<h1>Test Page</h1>',
          markdown_content: '# Test Page',
          is_published: true,
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      assertPageResponseFields(data);

      // Date fields must be strings (not null) per CCP-1
      expect(data.created_at).not.toBeNull();
      expect(data.updated_at).not.toBeNull();

      pageId = data.id;
    });
  });

  // ─── MEDIUM-risk: Get single page ──────────────────────────────────────

  describe('GET /api/pages/:id (MEDIUM)', () => {
    it('returns Page with all fields and correct types', async () => {
      if (!pageId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/pages/${pageId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      assertPageResponseFields(data);

      // Verify date fields are strings (not null) per CCP-1
      expect(data.created_at).not.toBeNull();
      expect(data.updated_at).not.toBeNull();
    });
  });

  // ─── MEDIUM-risk: Update page ──────────────────────────────────────────

  describe('PUT /api/pages/:id (MEDIUM)', () => {
    it('returns Page with all fields', async () => {
      if (!pageId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/pages/${pageId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Updated Page ${ctx.ts}`,
          content: '<h1>Updated</h1>',
          markdown_content: '# Updated',
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      assertPageResponseFields(data);
    });
  });

  // ─── MEDIUM-risk: Public page ──────────────────────────────────────────

  describe('GET /api/public/pages/:path (MEDIUM)', () => {
    it('returns Page with all fields', async () => {
      // Create a published page for public access with /-prefixed path
      const pagePath = `/public-test-${ctx.ts}`;
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Public Page ${ctx.ts}`,
          path: pagePath,
          content: '<h1>Public</h1>',
          markdown_content: '# Public',
          is_published: true,
        });

      const publicPath = createRes.body.data.path;

      // Public route: GET /api/public/pages/*path
      // Path must be the stored path without leading /
      const routePath = publicPath.startsWith('/') ? publicPath.substring(1) : publicPath;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/public/pages/${routePath}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      assertPageResponseFields(data);
    });
  });

  // ─── NONE-risk: Delete page ────────────────────────────────────────────

  describe('DELETE /api/pages/:id (NONE)', () => {
    it('returns success response', async () => {
      // Create a throwaway page for deletion
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/pages')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          title: `Delete Target Page ${ctx.ts}`,
          path: `del-page-${ctx.ts}`,
          content: '<h1>Delete me</h1>',
          is_published: false,
        });

      const deleteId = createRes.body.data.id;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/pages/${deleteId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });

  // ─── NONE-risk: Initialize pages ───────────────────────────────────────

  describe('POST /api/pages/initialize (NONE)', () => {
    it('returns success response', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/pages/initialize')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });
});
