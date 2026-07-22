/**
 * Phase 14: Regression Test Suite
 *
 * Cross-cutting regression checks that verify all Phase 14 fixes remain stable
 * and Phase 13 tests still pass (no cross-phase regressions).
 *
 * This is NOT a full re-run of all tests — that would be too expensive.
 * Instead, it runs focused regression checks on the fixed modules:
 * 1. Link.id is still numeric (D-301/D-303)
 * 2. Storage-policy dates are still ISO strings (D-313)
 * 3. UserGroup.description is still empty string not null (D-314)
 * 4. Album.fileHash is still present in response (D-307)
 * 5. Phase 13 article tests still pass (cross-phase regression)
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

describe('Phase 14 Regression', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── Link.id should be numeric (D-301/D-303) ────────────────────────

  it('Link.id should be numeric in link responses', async () => {
    // Create a link first — POST /api/links returns 201 per D-244
    const createRes = await supertest(ctx.app.getHttpServer())
      .post('/api/links')
      .set('authorization', `Bearer ${ctx.adminToken}`)
      .send({
        name: `RegressionLink-${ctx.ts}`,
        url: `https://regression-${ctx.ts}.example.com`,
        category_id: 1,
        status: 'APPROVED',
      });

    assertSuccessResponse(createRes, 201);
    const linkId = createRes.body.data.id;

    // Verify id is a number (not Sqids string)
    expect(typeof linkId).toBe('number');
    expect(Number.isInteger(linkId)).toBe(true);

    // Verify in list response too
    const listRes = await supertest(ctx.app.getHttpServer())
      .get('/api/links')
      .set('authorization', `Bearer ${ctx.adminToken}`);

    assertPaginatedResponse(listRes);
    const links = listRes.body.data.list;
    if (Array.isArray(links) && links.length > 0) {
      for (const link of links) {
        expect(typeof link.id).toBe('number');
        expect(Number.isInteger(link.id)).toBe(true);
      }
    }
  });

  // ─── Storage-policy dates should be ISO strings (D-313) ─────────────

  it('Storage-policy dates should be ISO strings', async () => {
    const res = await supertest(ctx.app.getHttpServer())
      .get('/api/policies?page=1&pageSize=10')
      .set('authorization', `Bearer ${ctx.adminToken}`);

    assertSuccessResponse(res);
    const data = res.body.data;
    // Policies may be paginated or a flat array
    const policyList = Array.isArray(data) ? data : (data?.list || []);
    if (policyList.length > 0) {
      for (const policy of policyList) {
        // created_at and updated_at must be ISO strings, not raw Date objects
        if (policy.created_at !== undefined) {
          expect(typeof policy.created_at).toBe('string');
          expect(policy.created_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
        }
        if (policy.updated_at !== undefined) {
          expect(typeof policy.updated_at).toBe('string');
          expect(policy.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
        }
      }
    }
  });

  // ─── UserGroup.description should be empty string not null (D-314) ──

  it('UserGroup.description should be empty string not null', async () => {
    const res = await supertest(ctx.app.getHttpServer())
      .get('/api/user/info')
      .set('authorization', `Bearer ${ctx.adminToken}`);

    assertSuccessResponse(res);
    const userGroup = res.body.data.userGroup;
    if (userGroup) {
      // Per D-314: description should be empty string, not null
      expect(userGroup.description).toBeDefined();
      expect(userGroup.description).not.toBeNull();
      expect(typeof userGroup.description).toBe('string');
    }
  });

  // ─── Album.fileHash should be present in response (D-307) ───────────

  it('Album.fileHash should be present in response', async () => {
    // Create an album first — POST /api/albums/add returns void { data: null }
    await supertest(ctx.app.getHttpServer())
      .post('/api/albums/add')
      .set('authorization', `Bearer ${ctx.adminToken}`)
      .send({
        imageUrl: `https://regression-${ctx.ts}.example.com/album.jpg`,
        fileHash: `regression-hash-${ctx.ts}`,
        category_id: 1,
      });

    // Then verify fileHash is in the album list response
    const listRes = await supertest(ctx.app.getHttpServer())
      .get('/api/albums/get?page=1&pageSize=10')
      .set('authorization', `Bearer ${ctx.adminToken}`);

    assertPaginatedResponse(listRes, 'list', 'pageNum');
    const albums = listRes.body.data.list;
    if (Array.isArray(albums) && albums.length > 0) {
      // Per D-307: fileHash should be present in the response
      for (const album of albums) {
        expect(album).toHaveProperty('fileHash');
      }
    }
  });

  // ─── Phase 13 article tests should still pass ───────────────────────

  it('Phase 13 article tests should still pass', async () => {
    // Cross-phase regression: verify article CRUD still works after Phase 14 changes
    // This is a minimal smoke test — full Phase 13 tests run separately

    // Create article
    const createRes = await supertest(ctx.app.getHttpServer())
      .post('/api/articles')
      .set('authorization', `Bearer ${ctx.adminToken}`)
      .send({
        title: `Phase14 Regression Article ${ctx.ts}`,
        content_md: '# Test Content',
        content_html: '<h1>Test Content</h1>',
        status: 'DRAFT',
      });

    // Article creation should succeed
    expect([200, 201]).toContain(createRes.status);
    expect(createRes.body).toHaveProperty('data');

    // List articles should work
    const listRes = await supertest(ctx.app.getHttpServer())
      .get('/api/articles?page=1&pageSize=10')
      .set('authorization', `Bearer ${ctx.adminToken}`);

    assertSuccessResponse(listRes);
  });
});
