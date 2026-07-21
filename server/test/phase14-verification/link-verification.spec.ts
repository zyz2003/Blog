/**
 * Phase 14: Link Field-by-Field Verification
 *
 * Per D-301: Go LinkDTO.id is `int` (raw DB ID), but NestJS currently uses
 * `generatePublicID()` returning a Sqids string. This breaks frontend batch
 * operations where `Number(id)` on a Sqids string produces NaN.
 *
 * Per D-303: Fix direction is to return raw DB int, matching Go behavior.
 *
 * Go LinkDTO baseline: _go-backend-archive/pkg/domain/model/link.go
 * Frontend LinkItem type: frontend/src/types/friends.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertPaginatedResponse,
  TestContext,
} from '../helpers/api-compat-helpers';

// ─── Field assertion helpers ─────────────────────────────────────────────

/**
 * Asserts that an object has all LinkDTO fields with correct types,
 * matching Go LinkDTO struct (model/link.go).
 * 14 fields: id(number), name(string), url(string), rss_url(string|null),
 * logo(string), description(string), status(string), siteshot(string|null),
 * email(string|null), type(string|null), original_url(string|null),
 * update_reason(string|null), sort_order(number), skip_health_check(boolean),
 * category(LinkCategoryDTO|null), tag(LinkTagDTO|null)
 */
function assertLinkResponseFields(data: any) {
  // id MUST be number (raw DB int), not Sqids string — per D-301, D-303
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('number');

  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  expect(data).toHaveProperty('url');
  expect(typeof data.url).toBe('string');

  // rss_url: string (omitempty in Go)
  expect(data).toHaveProperty('rss_url');
  if (data.rss_url !== null && data.rss_url !== undefined) {
    expect(typeof data.rss_url).toBe('string');
  }

  expect(data).toHaveProperty('logo');
  if (data.logo !== null && data.logo !== undefined) {
    expect(typeof data.logo).toBe('string');
  }

  expect(data).toHaveProperty('description');
  if (data.description !== null && data.description !== undefined) {
    expect(typeof data.description).toBe('string');
  }

  expect(data).toHaveProperty('status');
  expect(typeof data.status).toBe('string');

  // siteshot: string (omitempty in Go)
  expect(data).toHaveProperty('siteshot');
  if (data.siteshot !== null && data.siteshot !== undefined) {
    expect(typeof data.siteshot).toBe('string');
  }

  // email: string (omitempty in Go)
  expect(data).toHaveProperty('email');
  if (data.email !== null && data.email !== undefined) {
    expect(typeof data.email).toBe('string');
  }

  // type: string (omitempty in Go)
  expect(data).toHaveProperty('type');
  if (data.type !== null && data.type !== undefined) {
    expect(typeof data.type).toBe('string');
  }

  // original_url: string (omitempty in Go)
  expect(data).toHaveProperty('original_url');
  if (data.original_url !== null && data.original_url !== undefined) {
    expect(typeof data.original_url).toBe('string');
  }

  // update_reason: string (omitempty in Go)
  expect(data).toHaveProperty('update_reason');
  if (data.update_reason !== null && data.update_reason !== undefined) {
    expect(typeof data.update_reason).toBe('string');
  }

  expect(data).toHaveProperty('sort_order');
  expect(typeof data.sort_order).toBe('number');

  expect(data).toHaveProperty('skip_health_check');
  expect(typeof data.skip_health_check).toBe('boolean');

  // category: LinkCategoryDTO | null
  expect(data).toHaveProperty('category');
  if (data.category !== null) {
    assertLinkCategoryFields(data.category);
  }

  // tag: LinkTagDTO | null
  expect(data).toHaveProperty('tag');
  if (data.tag !== null) {
    assertLinkTagFields(data.tag);
  }
}

/**
 * Asserts LinkCategoryDTO fields: id(number), name(string), style(string), description(string)
 */
function assertLinkCategoryFields(data: any) {
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('number');

  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  expect(data).toHaveProperty('style');
  expect(typeof data.style).toBe('string');

  expect(data).toHaveProperty('description');
  if (data.description !== null && data.description !== undefined) {
    expect(typeof data.description).toBe('string');
  }
}

/**
 * Asserts LinkTagDTO fields: id(number), name(string), color(string)
 */
function assertLinkTagFields(data: any) {
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('number');

  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  expect(data).toHaveProperty('color');
  expect(typeof data.color).toBe('string');
}

// ─── Test suite ──────────────────────────────────────────────────────────

describe('Link verification (Phase 14)', () => {
  let ctx: TestContext;
  let createdLinkId: number;
  let createdCategoryId: number;
  let createdTagId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── Test 1: GET /api/links returns links where each link.id is a number ──

  describe('Admin CRUD endpoints', () => {
    it('GET /api/links returns list with numeric link.id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/links')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res);
      const list = res.body.data.list;
      if (list.length > 0) {
        for (const link of list) {
          assertLinkResponseFields(link);
          // Critical: id must be number, not Sqids string
          expect(typeof link.id).toBe('number');
        }
      }
    });

    // ─── Test 2: POST /api/links creates a link and response.id is a number ──

    it('POST /api/links creates link with numeric id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/links')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `TestLink-${ctx.ts}`,
          url: `https://test-${ctx.ts}.example.com`,
          logo: 'https://example.com/logo.png',
          description: 'Test link description',
          status: 'APPROVED',
          category_id: 1,
          sort_order: 0,
          skip_health_check: false,
        });

      assertSuccessResponse(res);
      const data = res.body.data;
      assertLinkResponseFields(data);
      // Critical: id must be number
      expect(typeof data.id).toBe('number');
      createdLinkId = data.id;
    });

    // ─── Test 3: PUT /api/links/:id with numeric ID updates the link ──

    it('PUT /api/links/:id with numeric ID updates link', async () => {
      if (!createdLinkId) return; // skip if create failed

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/links/${createdLinkId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `UpdatedLink-${ctx.ts}`,
          url: `https://updated-${ctx.ts}.example.com`,
          logo: 'https://example.com/logo2.png',
          description: 'Updated description',
          status: 'APPROVED',
          category_id: 1,
          sort_order: 1,
          skip_health_check: true,
        });

      assertSuccessResponse(res);
      const data = res.body.data;
      assertLinkResponseFields(data);
      expect(data.id).toBe(createdLinkId);
      expect(data.name).toBe(`UpdatedLink-${ctx.ts}`);
      expect(data.skip_health_check).toBe(true);
    });

    // ─── Test 4: DELETE /api/links/batch-delete with numeric IDs ──

    it('DELETE /api/links/batch-delete with numeric IDs succeeds', async () => {
      // Create a link to batch-delete
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/links')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `BatchDeleteLink-${ctx.ts}`,
          url: `https://batch-${ctx.ts}.example.com`,
          logo: 'https://example.com/logo.png',
          description: 'Batch delete test',
          status: 'APPROVED',
          category_id: 1,
          sort_order: 0,
          skip_health_check: false,
        });

      assertSuccessResponse(createRes);
      const batchDeleteId = createRes.body.data.id;
      expect(typeof batchDeleteId).toBe('number');

      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/links/batch-delete')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ ids: [batchDeleteId] });

      assertSuccessResponse(res);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.success).toBe(1);
    });

    // ─── Test 5: DELETE /api/links/:id with numeric ID ──

    it('DELETE /api/links/:id with numeric ID deletes link', async () => {
      // Create a link to delete
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/links')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `DeleteLink-${ctx.ts}`,
          url: `https://delete-${ctx.ts}.example.com`,
          logo: 'https://example.com/logo.png',
          description: 'Delete test',
          status: 'APPROVED',
          category_id: 1,
          sort_order: 0,
          skip_health_check: false,
        });

      assertSuccessResponse(createRes);
      const deleteId = createRes.body.data.id;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/links/${deleteId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });

  // ─── Category endpoints ──────────────────────────────────────────────

  describe('Category endpoints', () => {
    it('GET /api/links/categories returns array of LinkCategoryDTO', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/links/categories')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data;
      expect(Array.isArray(list)).toBe(true);
      if (list.length > 0) {
        for (const cat of list) {
          assertLinkCategoryFields(cat);
        }
      }
    });

    it('POST /api/links/categories creates category with numeric id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/links/categories')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `TestCategory-${ctx.ts}`,
          style: 'list',
          description: 'Test category description',
        });

      // Per D-244: link category create returns 201
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      const data = res.body.data;
      assertLinkCategoryFields(data);
      expect(typeof data.id).toBe('number');
      createdCategoryId = data.id;
    });

    it('PUT /api/links/categories/:id updates category with numeric id', async () => {
      if (!createdCategoryId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/links/categories/${createdCategoryId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `UpdatedCategory-${ctx.ts}`,
          style: 'card',
          description: 'Updated description',
        });

      assertSuccessResponse(res);
      const data = res.body.data;
      assertLinkCategoryFields(data);
      expect(data.id).toBe(createdCategoryId);
    });
  });

  // ─── Tag endpoints ───────────────────────────────────────────────────

  describe('Tag endpoints', () => {
    it('GET /api/links/tags returns array of LinkTagDTO', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/links/tags')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data;
      expect(Array.isArray(list)).toBe(true);
      if (list.length > 0) {
        for (const tag of list) {
          assertLinkTagFields(tag);
        }
      }
    });

    it('POST /api/links/tags creates tag with numeric id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/links/tags')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `TestTag-${ctx.ts}`,
          color: '#FF5733',
        });

      // Per D-244: link tag create returns 201
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      const data = res.body.data;
      assertLinkTagFields(data);
      expect(typeof data.id).toBe('number');
      createdTagId = data.id;
    });

    it('PUT /api/links/tags/:id updates tag with numeric id', async () => {
      if (!createdTagId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/links/tags/${createdTagId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `UpdatedTag-${ctx.ts}`,
          color: '#00FF00',
        });

      assertSuccessResponse(res);
      const data = res.body.data;
      assertLinkTagFields(data);
      expect(data.id).toBe(createdTagId);
    });
  });

  // ─── Health-check endpoints ──────────────────────────────────────────

  describe('Health-check endpoints', () => {
    it('GET /api/links/health-check/status returns HealthCheckStatusDto', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/links/health-check/status')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('is_running');
      expect(typeof data.is_running).toBe('boolean');
      // result may be null if no health check has run
      if (data.result !== null && data.result !== undefined) {
        expect(data.result).toHaveProperty('total');
        expect(typeof data.result.total).toBe('number');
        expect(data.result).toHaveProperty('healthy');
        expect(typeof data.result.healthy).toBe('number');
        expect(data.result).toHaveProperty('unhealthy');
        expect(typeof data.result.unhealthy).toBe('number');
        expect(data.result).toHaveProperty('unhealthy_ids');
        expect(Array.isArray(data.result.unhealthy_ids)).toBe(true);
        // unhealthy_ids must be number[] per Go LinkHealthCheckResponse
        for (const id of data.result.unhealthy_ids) {
          expect(typeof id).toBe('number');
        }
      }
    });
  });

  // ─── Import/Export endpoints ─────────────────────────────────────────

  describe('Import/Export endpoints', () => {
    it('GET /api/links/export returns ExportLinksResponse', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/links/export')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('links');
      expect(Array.isArray(data.links)).toBe(true);
      expect(data).toHaveProperty('total');
      expect(typeof data.total).toBe('number');
    });

    it('POST /api/links/import returns ImportLinksResponse with numeric ids', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/links/import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          links: [
            {
              name: `ImportLink-${ctx.ts}`,
              url: `https://import-${ctx.ts}.example.com`,
              logo: 'https://example.com/logo.png',
              description: 'Import test',
              status: 'PENDING',
            },
          ],
          skip_duplicates: true,
          create_categories: false,
          create_tags: false,
        });

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('total');
      expect(typeof data.total).toBe('number');
      expect(data).toHaveProperty('success');
      expect(typeof data.success).toBe('number');
      expect(data).toHaveProperty('failed');
      expect(typeof data.failed).toBe('number');
      expect(data).toHaveProperty('skipped');
      expect(typeof data.skipped).toBe('number');
      expect(data).toHaveProperty('success_list');
      expect(Array.isArray(data.success_list)).toBe(true);
      expect(data).toHaveProperty('failed_list');
      expect(Array.isArray(data.failed_list)).toBe(true);
      expect(data).toHaveProperty('skipped_list');
      expect(Array.isArray(data.skipped_list)).toBe(true);

      // success_list items must have numeric id
      for (const item of data.success_list) {
        assertLinkResponseFields(item);
        expect(typeof item.id).toBe('number');
      }
    });
  });

  // ─── Public endpoints ────────────────────────────────────────────────

  describe('Public endpoints', () => {
    it('GET /api/public/links returns categories with links having numeric id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/links');

      assertSuccessResponse(res);
      const categories = res.body.data;
      expect(Array.isArray(categories)).toBe(true);
      for (const cat of categories) {
        assertLinkCategoryFields(cat);
        if (cat.links && Array.isArray(cat.links)) {
          for (const link of cat.links) {
            assertLinkResponseFields(link);
            expect(typeof link.id).toBe('number');
          }
        }
      }
    });

    it('GET /api/public/links/check-exists returns { exists, url }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/links/check-exists?url=https://nonexistent.example.com');

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('exists');
      expect(typeof data.exists).toBe('boolean');
      expect(data).toHaveProperty('url');
      expect(typeof data.url).toBe('string');
    });

    it('GET /api/public/links/random returns array of LinkDTO with numeric id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/links/random?num=5');

      assertSuccessResponse(res);
      const links = res.body.data;
      expect(Array.isArray(links)).toBe(true);
      for (const link of links) {
        assertLinkResponseFields(link);
        expect(typeof link.id).toBe('number');
      }
    });

    it('GET /api/public/link-categories returns array of LinkCategoryDTO', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/link-categories');

      assertSuccessResponse(res);
      const categories = res.body.data;
      expect(Array.isArray(categories)).toBe(true);
      for (const cat of categories) {
        assertLinkCategoryFields(cat);
      }
    });

    it('GET /api/public/links/applications returns LinkListResponse', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/links/applications');

      assertSuccessResponse(res);
      const data = res.body.data;
      if (Array.isArray(data)) {
        // listApplications returns array of LinkResponseDto
        for (const link of data) {
          assertLinkResponseFields(link);
          expect(typeof link.id).toBe('number');
        }
      }
    });
  });

  // ─── Sort endpoint ───────────────────────────────────────────────────

  describe('Sort endpoint', () => {
    it('PUT /api/links/sort with numeric IDs succeeds', async () => {
      // Create a link for sort test
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/links')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `SortLink-${ctx.ts}`,
          url: `https://sort-${ctx.ts}.example.com`,
          logo: 'https://example.com/logo.png',
          description: 'Sort test',
          status: 'APPROVED',
          category_id: 1,
          sort_order: 0,
          skip_health_check: false,
        });

      assertSuccessResponse(createRes);
      const sortLinkId = createRes.body.data.id;
      expect(typeof sortLinkId).toBe('number');

      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/links/sort')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          items: [{ id: sortLinkId, sort_order: 99 }],
        });

      assertSuccessResponse(res);
    });
  });

  // ─── Review endpoint ─────────────────────────────────────────────────

  describe('Review endpoint', () => {
    it('PUT /api/links/:id/review with numeric ID succeeds', async () => {
      // Create a PENDING link for review test
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/links')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `ReviewLink-${ctx.ts}`,
          url: `https://review-${ctx.ts}.example.com`,
          logo: 'https://example.com/logo.png',
          description: 'Review test',
          status: 'PENDING',
          category_id: 1,
          sort_order: 0,
          skip_health_check: false,
        });

      assertSuccessResponse(createRes);
      const reviewLinkId = createRes.body.data.id;
      expect(typeof reviewLinkId).toBe('number');

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/links/${reviewLinkId}/review`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          status: 'APPROVED',
        });

      assertSuccessResponse(res);
    });
  });
});
