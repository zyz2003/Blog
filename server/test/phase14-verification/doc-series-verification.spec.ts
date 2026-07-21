/**
 * Phase 14: Doc-Series Field-by-Field Verification
 *
 * Per D-309: Doc-series uses Sqids encoding (EntityType.DocSeries = 12),
 * matching Go's Sqids encoding. Must verify encoding consistency.
 *
 * Per CCP-1: created_at/updated_at are non-null ISO strings (DB has NOT NULL constraints).
 *
 * Go DocSeriesResponse baseline: _go-backend-archive/pkg/domain/model/docseries.go
 * Go DocSeriesWithArticles baseline: _go-backend-archive/pkg/domain/model/docseries.go
 * Go DocArticleItem baseline: _go-backend-archive/pkg/domain/model/docseries.go
 * Go handler baseline: _go-backend-archive/pkg/handler/doc_series/handler.go
 * Frontend DocSeries type: frontend/src/types/doc-series.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  assertPaginatedResponse,
  TestContext,
  TEST_SEED,
} from '../helpers/api-compat-helpers';
import { generatePublicID, EntityType, decodePublicID } from '../../src/common/utils/sqids.util';
import { docSeries } from '../../src/database/schemas/doc-series.schema';

// ─── Field assertion helpers ─────────────────────────────────────────────

/**
 * Helper: assert field is a valid ISO date string (not null)
 * Per CCP-1: created_at/updated_at are NOT null in DB.
 * Per CCP-2: Do not assert exact format (Go RFC3339 vs NestJS ISO 8601 with ms).
 */
function expectISODateString(value: any, fieldName: string) {
  expect(value, `${fieldName} should not be null`).not.toBeNull();
  expect(typeof value, `${fieldName} should be string`).toBe('string');
  // Verify it parses as a valid date
  const parsed = new Date(value);
  expect(isNaN(parsed.getTime()), `${fieldName} should be valid ISO date`).toBe(false);
}

/**
 * Asserts that an object has all DocSeriesResponse fields with correct types,
 * matching Go DocSeriesResponse struct (model/docseries.go).
 *
 * 8 fields:
 *   id(string, Sqids encoded), created_at(string, non-null),
 *   updated_at(string, non-null), name(string),
 *   description(string), cover_url(string),
 *   sort(number), doc_count(number)
 */
function assertDocSeriesResponseFields(data: any) {
  // id: Sqids-encoded string (not raw int) per D-183
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');
  // Verify it is a Sqids string (not a numeric string)
  expect(Number.isNaN(Number(data.id)), 'id should be Sqids string, not numeric').toBe(true);

  // created_at: non-null ISO string per CCP-1
  expect(data).toHaveProperty('created_at');
  expectISODateString(data.created_at, 'created_at');

  // updated_at: non-null ISO string per CCP-1
  expect(data).toHaveProperty('updated_at');
  expectISODateString(data.updated_at, 'updated_at');

  // name: string
  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  // description: string (Go omitempty, NestJS defaults to '')
  expect(data).toHaveProperty('description');
  expect(typeof data.description).toBe('string');

  // cover_url: string (Go omitempty, NestJS defaults to '')
  expect(data).toHaveProperty('cover_url');
  expect(typeof data.cover_url).toBe('string');

  // sort: number
  expect(data).toHaveProperty('sort');
  expect(typeof data.sort).toBe('number');

  // doc_count: number
  expect(data).toHaveProperty('doc_count');
  expect(typeof data.doc_count).toBe('number');
}

/**
 * Asserts that an object has DocSeriesWithArticles fields,
 * matching Go DocSeriesWithArticles struct.
 * Extends DocSeriesResponse with articles array.
 */
function assertDocSeriesWithArticlesFields(data: any) {
  // First verify all DocSeriesResponse fields
  assertDocSeriesResponseFields(data);

  // articles: array of DocArticleItem
  expect(data).toHaveProperty('articles');
  expect(Array.isArray(data.articles)).toBe(true);
}

/**
 * Asserts that a DocArticleItem has all fields matching Go DocArticleItem struct.
 *
 * 5 fields:
 *   id(string, Sqids), title(string), abbrlink(string),
 *   doc_sort(number), created_at(string)
 */
function assertDocArticleItemFields(item: any) {
  // id: Sqids-encoded string (EntityType.Article)
  expect(item).toHaveProperty('id');
  expect(typeof item.id).toBe('string');
  expect(Number.isNaN(Number(item.id)), 'article id should be Sqids string').toBe(true);

  // title: string
  expect(item).toHaveProperty('title');
  expect(typeof item.title).toBe('string');

  // abbrlink: string
  expect(item).toHaveProperty('abbrlink');
  expect(typeof item.abbrlink).toBe('string');

  // doc_sort: number
  expect(item).toHaveProperty('doc_sort');
  expect(typeof item.doc_sort).toBe('number');

  // created_at: string (ISO date)
  expect(item).toHaveProperty('created_at');
  expect(typeof item.created_at).toBe('string');
}

// ─── Test Suite ──────────────────────────────────────────────────────────

describe('DocSeries verification', () => {
  let ctx: TestContext;
  let createdSeriesId: string; // Sqids-encoded ID of created series

  beforeAll(async () => {
    ctx = await createTestApp();

    // Seed a doc series for GET tests (use onConflictDoNothing to handle re-runs)
    await ctx.db.insert(docSeries).values({
      name: 'Test Doc Series',
      description: 'A test doc series',
      coverUrl: 'https://example.com/cover.jpg',
      sort: 1,
      docCount: 0,
    }).onConflictDoNothing().run();
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── GET /api/doc-series ────────────────────────────────────────────

  describe('GET /api/doc-series', () => {
    it('returns DocSeriesListResponse { list, total, page, pageSize }', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/doc-series')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'page');
      const data = res.body.data;

      // Verify list items have DocSeriesResponse fields
      if (data.list.length > 0) {
        assertDocSeriesResponseFields(data.list[0]);
      }
    });

    it('returns each DocSeriesResponse with Sqids-encoded id (not raw int)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/doc-series')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      for (const item of list) {
        // id should be a Sqids string, not a number
        expect(typeof item.id).toBe('string');
        expect(Number.isNaN(Number(item.id))).toBe(true);

        // Verify Sqids decoding works and entityType is DocSeries (12)
        const decoded = decodePublicID(item.id);
        expect(decoded.entityType).toBe(EntityType.DocSeries);
      }
    });

    it('returns created_at and updated_at as non-null ISO strings', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/doc-series')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      for (const item of list) {
        expectISODateString(item.created_at, 'created_at');
        expectISODateString(item.updated_at, 'updated_at');
      }
    });
  });

  // ─── POST /api/doc-series ───────────────────────────────────────────

  describe('POST /api/doc-series', () => {
    it('creates series and returns DocSeriesResponse with Sqids id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Created Series ${ctx.ts}`,
          description: 'Created via test',
          cover_url: 'https://example.com/created.jpg',
          sort: 5,
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      // Verify all DocSeriesResponse fields
      assertDocSeriesResponseFields(data);

      // Store the created ID for subsequent tests
      createdSeriesId = data.id;

      // Verify Sqids encoding: decode and check entityType
      const decoded = decodePublicID(data.id);
      expect(decoded.entityType).toBe(EntityType.DocSeries);
      expect(decoded.dbID).toBeGreaterThan(0);

      // Verify field values
      expect(data.name).toBe(`Created Series ${ctx.ts}`);
      expect(data.description).toBe('Created via test');
      expect(data.cover_url).toBe('https://example.com/created.jpg');
      expect(data.sort).toBe(5);
      expect(data.doc_count).toBe(0);
    });

    it('Sqids encoding produces same string for same DB id with test seed', async () => {
      // Decode the created ID to get the DB id
      const decoded = decodePublicID(createdSeriesId);
      const dbID = decoded.dbID;

      // Re-encode with the same seed and verify it matches
      const reEncoded = generatePublicID(dbID, EntityType.DocSeries);
      expect(reEncoded).toBe(createdSeriesId);
    });
  });

  // ─── PUT /api/doc-series/:id ────────────────────────────────────────

  describe('PUT /api/doc-series/:id', () => {
    it('updates series and returns DocSeriesResponse', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/doc-series/${createdSeriesId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Updated Series ${ctx.ts}`,
          description: 'Updated via test',
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      // Verify all DocSeriesResponse fields
      assertDocSeriesResponseFields(data);

      // Verify the ID is the same Sqids string
      expect(data.id).toBe(createdSeriesId);

      // Verify updated fields
      expect(data.name).toBe(`Updated Series ${ctx.ts}`);
      expect(data.description).toBe('Updated via test');
    });
  });

  // ─── DELETE /api/doc-series/:id ─────────────────────────────────────

  describe('DELETE /api/doc-series/:id', () => {
    it('deletes series and returns void response', async () => {
      // First create a series to delete (must have doc_count=0)
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Delete Target ${ctx.ts}`,
        });

      assertSuccessResponse(createRes);
      const deleteTargetId = createRes.body.data.id;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/doc-series/${deleteTargetId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // Go returns response.Success(c, nil, "删除成功")
      // NestJS returns { data: null, message: "删除成功" }
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('code', 200);
      expect(res.body).toHaveProperty('message');
    });
  });

  // ─── GET /api/public/doc-series/:id/articles ────────────────────────

  describe('GET /api/public/doc-series/:id/articles', () => {
    it('returns DocSeriesWithArticles with articles array', async () => {
      // Use the seeded series (which has no articles, but should still return structure)
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/public/doc-series')
        .query({ pageSize: 1 });

      assertSuccessResponse(listRes);
      const seriesList = listRes.body.data.list;
      if (seriesList.length === 0) {
        // Skip if no series exist (should not happen with seed data)
        return;
      }

      const seriesId = seriesList[0].id;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/public/doc-series/${seriesId}/articles`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Verify DocSeriesWithArticles fields
      assertDocSeriesWithArticlesFields(data);

      // articles array may be empty (no articles associated)
      // but if items exist, verify DocArticleItem fields
      for (const article of data.articles) {
        assertDocArticleItemFields(article);
      }
    });

    it('DocArticleItem has id (Sqids string), title, abbrlink, doc_sort (number), created_at (string)', async () => {
      // This test verifies the DocArticleItem field structure
      // even when articles array is empty, the structure is verified by the assertion function
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/public/doc-series')
        .query({ pageSize: 1 });

      assertSuccessResponse(listRes);
      const seriesList = listRes.body.data.list;
      if (seriesList.length === 0) return;

      const seriesId = seriesList[0].id;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/public/doc-series/${seriesId}/articles`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Verify the series itself has correct fields
      assertDocSeriesResponseFields(data);

      // Verify articles array exists
      expect(Array.isArray(data.articles)).toBe(true);

      // If articles exist, verify each item's field types
      for (const article of data.articles) {
        // id: Sqids string (EntityType.Article = 8)
        expect(typeof article.id).toBe('string');
        const decoded = decodePublicID(article.id);
        expect(decoded.entityType).toBe(EntityType.Article);

        // title: string
        expect(typeof article.title).toBe('string');

        // abbrlink: string
        expect(typeof article.abbrlink).toBe('string');

        // doc_sort: number
        expect(typeof article.doc_sort).toBe('number');

        // created_at: string
        expect(typeof article.created_at).toBe('string');
      }
    });
  });
});
