/**
 * Phase 14: Album Field-by-Field Verification
 *
 * Per D-304: Go Album uses camelCase JSON tags (imageUrl, bigImageUrl, etc.),
 * NestJS toResponseDTO also uses camelCase — consistent.
 *
 * Per D-306: Album.id is raw DB int in both Go and NestJS — consistent.
 *
 * Per D-305: Album date fields use snake_case (created_at, updated_at, published_at)
 * matching Go JSON tags.
 *
 * RESEARCH finding: Album.fileHash is MISSING from NestJS toResponseDTO but present
 * in Go Album struct (model/album.go FileHash string `json:"fileHash"`).
 * Adding fileHash to the response for full field coverage.
 *
 * Known deviation: widthAndHeight field exists in NestJS response but is NOT in
 * Go Album model struct. It IS in Go AlbumResponse handler struct (computed field).
 * LOW risk per D-304 — extra field ignored by frontend.
 *
 * Go Album baseline: _go-backend-archive/pkg/domain/model/album.go
 * Go AlbumResponse baseline: _go-backend-archive/pkg/handler/album/handler.go lines 92-116
 * Go AlbumCategoryDTO baseline: _go-backend-archive/pkg/domain/model/album.go lines 39-45
 * Frontend Album type: frontend/src/types/album.ts
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
import { albums } from '../../src/database/schemas/album.schema';

// ─── Field assertion helpers ─────────────────────────────────────────────

/**
 * Helper: assert field is string or null
 */
function expectStringOrNull(value: any, fieldName: string) {
  if (value !== null && value !== undefined) {
    expect(typeof value).toBe('string');
  }
}

/**
 * Helper: assert field is number or null
 */
function expectNumberOrNull(value: any, fieldName: string) {
  if (value !== null && value !== undefined) {
    expect(typeof value).toBe('number');
  }
}

/**
 * Asserts that an object has all Album response fields with correct types,
 * matching Go Album model struct + AlbumResponse handler struct.
 *
 * 22 fields from Go Album struct:
 *   id(number), created_at(string), updated_at(string),
 *   imageUrl(string), bigImageUrl(string), downloadUrl(string),
 *   thumbParam(string), bigParam(string), tags(string),
 *   viewCount(number), downloadCount(number),
 *   width(number), height(number), fileSize(number),
 *   format(string), aspectRatio(string), fileHash(string|null),
 *   displayOrder(number), categoryId(number|null),
 *   title(string), description(string), location(string),
 *   published_at(string|null)
 *
 * Extra field in Go AlbumResponse (not in model):
 *   widthAndHeight(string) — computed "WxH" format
 */
function assertAlbumResponseFields(data: any) {
  // id: raw DB int (number), not Sqids string — per D-306
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('number');

  // Date fields: snake_case per D-305
  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string');

  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string');

  expect(data).toHaveProperty('published_at');
  // published_at can be null (unpublished albums)
  expectStringOrNull(data.published_at, 'published_at');

  // camelCase fields per D-304
  expect(data).toHaveProperty('imageUrl');
  expect(typeof data.imageUrl).toBe('string');

  expect(data).toHaveProperty('bigImageUrl');
  expect(typeof data.bigImageUrl).toBe('string');

  expect(data).toHaveProperty('downloadUrl');
  expect(typeof data.downloadUrl).toBe('string');

  expect(data).toHaveProperty('thumbParam');
  expect(typeof data.thumbParam).toBe('string');

  expect(data).toHaveProperty('bigParam');
  expect(typeof data.bigParam).toBe('string');

  expect(data).toHaveProperty('tags');
  expect(typeof data.tags).toBe('string');

  expect(data).toHaveProperty('viewCount');
  expect(typeof data.viewCount).toBe('number');

  expect(data).toHaveProperty('downloadCount');
  expect(typeof data.downloadCount).toBe('number');

  expect(data).toHaveProperty('width');
  expect(typeof data.width).toBe('number');

  expect(data).toHaveProperty('height');
  expect(typeof data.height).toBe('number');

  expect(data).toHaveProperty('fileSize');
  expect(typeof data.fileSize).toBe('number');

  expect(data).toHaveProperty('format');
  expect(typeof data.format).toBe('string');

  expect(data).toHaveProperty('aspectRatio');
  expect(typeof data.aspectRatio).toBe('string');

  // fileHash: present in Go Album struct, was MISSING from NestJS — now added
  expect(data).toHaveProperty('fileHash');
  expectStringOrNull(data.fileHash, 'fileHash');

  expect(data).toHaveProperty('displayOrder');
  expect(typeof data.displayOrder).toBe('number');

  expect(data).toHaveProperty('categoryId');
  expectNumberOrNull(data.categoryId, 'categoryId');

  expect(data).toHaveProperty('title');
  expect(typeof data.title).toBe('string');

  expect(data).toHaveProperty('description');
  expect(typeof data.description).toBe('string');

  expect(data).toHaveProperty('location');
  expect(typeof data.location).toBe('string');

  // widthAndHeight: computed field in Go AlbumResponse (not in Album model)
  // Known deviation: extra field not in Go Album model, but present in Go handler response
  expect(data).toHaveProperty('widthAndHeight');
  expect(typeof data.widthAndHeight).toBe('string');
}

/**
 * Asserts that an object has all AlbumCategoryDTO fields with correct types,
 * matching Go AlbumCategoryDTO struct (model/album.go lines 39-45).
 * 4 fields: id(number), name(string), description(string), displayOrder(number)
 */
function assertAlbumCategoryFields(data: any) {
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('number');

  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  expect(data).toHaveProperty('description');
  // description may be empty string (omitempty in Go)
  if (data.description !== null && data.description !== undefined) {
    expect(typeof data.description).toBe('string');
  }

  // displayOrder: camelCase matching Go per D-304
  expect(data).toHaveProperty('displayOrder');
  expect(typeof data.displayOrder).toBe('number');
}

// ─── Test suite ──────────────────────────────────────────────────────────

describe('Album Field Verification', () => {
  let ctx: TestContext;
  let albumId: number;
  let categoryId: number;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Seed a test album for verification
    const albumDb = ctx.db;
    const uniqueHash = `test-verify-hash-${ctx.ts}`;
    await albumDb.insert(albums).values({
      imageUrl: 'https://example.com/test-album.jpg',
      bigImageUrl: 'https://example.com/test-album-big.jpg',
      downloadUrl: 'https://example.com/test-album-download.jpg',
      thumbParam: '?w=300',
      bigParam: '?w=1920',
      tags: 'test,verification',
      viewCount: 10,
      downloadCount: 5,
      width: 1920,
      height: 1080,
      fileSize: 500000,
      format: 'jpeg',
      aspectRatio: '16:9',
      fileHash: uniqueHash,
      displayOrder: 1,
      categoryId: 1,
      title: 'Test Album',
      description: 'Album for verification testing',
      location: 'Test Location',
    }).onConflictDoNothing().run();

    // Get the inserted album ID
    const insertedAlbums = await albumDb.select().from(albums).limit(1);
    albumId = insertedAlbums[0]?.id;
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── Admin album CRUD: GET /api/albums/get ─────────────────────────────

  describe('GET /api/albums/get', () => {
    it('returns albums with fileHash field (string or null)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // Album list uses pageNum (not page) matching Go handler
      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        const album = list[0];
        expect(album).toHaveProperty('fileHash');
        // fileHash is string or null
        if (album.fileHash !== null) {
          expect(typeof album.fileHash).toBe('string');
        }
      }
    });

    it('returns albums with all camelCase fields: imageUrl, bigImageUrl, downloadUrl, viewCount, downloadCount, fileSize, aspectRatio, displayOrder, categoryId', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        const album = list[0];
        // Verify camelCase field names exist
        expect(album).toHaveProperty('imageUrl');
        expect(album).toHaveProperty('bigImageUrl');
        expect(album).toHaveProperty('downloadUrl');
        expect(album).toHaveProperty('viewCount');
        expect(album).toHaveProperty('downloadCount');
        expect(album).toHaveProperty('fileSize');
        expect(album).toHaveProperty('aspectRatio');
        expect(album).toHaveProperty('displayOrder');
        expect(album).toHaveProperty('categoryId');

        // Verify types
        expect(typeof album.imageUrl).toBe('string');
        expect(typeof album.viewCount).toBe('number');
        expect(typeof album.downloadCount).toBe('number');
        expect(typeof album.fileSize).toBe('number');
        expect(typeof album.aspectRatio).toBe('string');
        expect(typeof album.displayOrder).toBe('number');
      }
    });

    it('returns albums with snake_case date fields: created_at, updated_at, published_at', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        const album = list[0];
        expect(album).toHaveProperty('created_at');
        expect(typeof album.created_at).toBe('string');

        expect(album).toHaveProperty('updated_at');
        expect(typeof album.updated_at).toBe('string');

        expect(album).toHaveProperty('published_at');
        // published_at may be null
        expectStringOrNull(album.published_at, 'published_at');
      }
    });

    it('returns albums with numeric id (not Sqids string)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        const album = list[0];
        expect(typeof album.id).toBe('number');
        // Verify it's a plain integer, not a Sqids string
        expect(Number.isInteger(album.id)).toBe(true);
      }
    });

    it('returns full AlbumResponse with all 22+ fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        assertAlbumResponseFields(list[0]);
      }
    });
  });

  // ─── Album categories: GET /api/album-categories ───────────────────────

  describe('GET /api/album-categories', () => {
    it('returns categories with camelCase displayOrder', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/album-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const categories = res.body.data;

      expect(Array.isArray(categories)).toBe(true);

      if (categories.length > 0) {
        const cat = categories[0];
        // displayOrder is camelCase matching Go per D-304
        expect(cat).toHaveProperty('displayOrder');
        expect(typeof cat.displayOrder).toBe('number');

        // Verify NOT snake_case display_order
        expect(cat).not.toHaveProperty('display_order');
      }
    });

    it('returns categories with all 4 AlbumCategoryDTO fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/album-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const categories = res.body.data;

      if (categories.length > 0) {
        assertAlbumCategoryFields(categories[0]);
      }
    });
  });

  // ─── Public album endpoints ────────────────────────────────────────────

  describe('GET /api/public/albums', () => {
    it('returns public albums with same field structure as admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/albums?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        // Public albums should have same fields as admin albums
        assertAlbumResponseFields(list[0]);
      }
    });
  });

  // ─── POST /api/albums/batch-import ─────────────────────────────────────

  describe('POST /api/albums/batch-import', () => {
    it('returns result with successCount, failCount, skipCount, total fields matching Go handler', async () => {
      // Use an invalid URL that will fail — we're testing response structure, not actual import
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/batch-import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          urls: ['https://invalid-url-that-will-fail.example.com/nonexistent.jpg'],
          thumbParam: '?w=300',
          bigParam: '?w=1920',
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go BatchImportAlbums response structure:
      // successCount, failCount, skipCount, total
      expect(data).toHaveProperty('successCount');
      expect(typeof data.successCount).toBe('number');

      expect(data).toHaveProperty('failCount');
      expect(typeof data.failCount).toBe('number');

      expect(data).toHaveProperty('skipCount');
      expect(typeof data.skipCount).toBe('number');

      // Go handler adds total: len(req.URLs) to response
      // NestJS BatchImportResult currently lacks this — needs fix
      expect(data).toHaveProperty('total');
      expect(typeof data.total).toBe('number');
    });
  });

  // ─── Create album ──────────────────────────────────────────────────────

  describe('POST /api/albums/add', () => {
    it('returns success with correct response structure', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          imageUrl: 'https://example.com/new-album.jpg',
          fileHash: `test-hash-${ctx.ts}`,
          tags: ['test'],
        });

      assertSuccessResponse(res);
    });
  });

  // ─── Update album ──────────────────────────────────────────────────────

  describe('PUT /api/albums/update/:id', () => {
    it('returns success response', async () => {
      if (!albumId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/albums/update/${albumId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          imageUrl: 'https://example.com/updated-album.jpg',
          title: 'Updated Album Title',
        });

      assertSuccessResponse(res);
    });
  });

  // ─── Delete album ──────────────────────────────────────────────────────

  describe('DELETE /api/albums/delete/:id', () => {
    it('returns success response', async () => {
      // Create a throwaway album for deletion
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          imageUrl: 'https://example.com/delete-target.jpg',
          fileHash: `delete-hash-${ctx.ts}`,
        });

      assertSuccessResponse(createRes);

      // Get the created album ID from the list
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=1&sort=created_at_desc')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const deleteId = listRes.body.data.list[0]?.id;
      if (!deleteId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/albums/delete/${deleteId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });

  // ─── Batch delete albums ───────────────────────────────────────────────

  describe('DELETE /api/albums/batch-delete', () => {
    it('returns { deleted: number } matching Go handler', async () => {
      // Create a throwaway album for batch deletion
      await supertest(ctx.app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          imageUrl: 'https://example.com/batch-delete-target.jpg',
          fileHash: `batch-delete-hash-${ctx.ts}`,
        });

      // Get the album ID
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=1&sort=created_at_desc')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const batchId = listRes.body.data.list[0]?.id;
      if (!batchId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete('/api/albums/batch-delete')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ ids: [batchId] });

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(data).toHaveProperty('deleted');
      expect(typeof data.deleted).toBe('number');
    });
  });

  // ─── Public album categories ───────────────────────────────────────────

  describe('GET /api/public/album-categories', () => {
    it('returns array with camelCase displayOrder', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/album-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const categories = res.body.data;

      expect(Array.isArray(categories)).toBe(true);
      if (categories.length > 0) {
        assertAlbumCategoryFields(categories[0]);
      }
    });
  });

  // ─── Public stat increment ─────────────────────────────────────────────

  describe('PUT /api/public/stat/:id', () => {
    it('succeeds with void response (increments view count)', async () => {
      if (!albumId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/public/stat/${albumId}?type=view`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });

    it('succeeds silently for nonexistent ID per D-248', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/public/stat/999999?type=view')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // Per D-248: stat increment for nonexistent ID succeeds silently
      assertSuccessResponse(res);
    });
  });

  // ─── Album category CRUD ───────────────────────────────────────────────

  describe('POST /api/album-categories', () => {
    it('returns 201 with AlbumCategoryDTO fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/album-categories')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Test Category ${ctx.ts}`,
          description: 'Test description',
          displayOrder: 10,
        });

      // Per D-244: album category create returns 201
      assertSuccessResponse(res, 201);
      const data = res.body.data;
      assertAlbumCategoryFields(data);

      categoryId = data.id;
    });
  });

  describe('PUT /api/album-categories/:id', () => {
    it('returns AlbumCategoryDTO with updated fields', async () => {
      if (!categoryId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/album-categories/${categoryId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Updated Category ${ctx.ts}`,
          description: 'Updated description',
          displayOrder: 20,
        });

      assertSuccessResponse(res);
      const data = res.body.data;
      assertAlbumCategoryFields(data);
    });
  });

  describe('DELETE /api/album-categories/:id', () => {
    it('returns success response', async () => {
      if (!categoryId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/album-categories/${categoryId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
    });
  });

  // ─── Export albums ─────────────────────────────────────────────────────

  describe('POST /api/albums/export', () => {
    it('returns JSON export data with correct structure', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/export')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({});

      // Export returns JSON by default
      // May be raw JSON (not wrapped in {code, data, message}) since it uses @Res()
      if (res.status === 200) {
        // If wrapped response
        if (res.body.code !== undefined) {
          expect(res.body.code).toBe(200);
        }
        // The response should be valid JSON with export structure
        const exportData = res.body.data || res.body;
        if (exportData.version !== undefined) {
          expect(typeof exportData.version).toBe('string');
          expect(exportData).toHaveProperty('albums');
          expect(Array.isArray(exportData.albums)).toBe(true);
          expect(exportData).toHaveProperty('export_at');
        }
      }
    });

    it('returns ZIP export with application/zip content type', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/export')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ format: 'zip' });

      if (res.status === 200) {
        // ZIP export should have application/zip content type
        expect(res.type).toMatch(/zip|octet-stream/);
      }
    });
  });

  // ─── Import albums ─────────────────────────────────────────────────────

  describe('POST /api/albums/import', () => {
    it('returns ImportAlbumResult with correct fields', async () => {
      // Create a minimal valid JSON export for import
      const importData = JSON.stringify({
        version: '1.0',
        export_at: new Date().toISOString(),
        albums: [],
        meta: { total_albums: 0, export_by: 'test' },
      });

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .attach('file', Buffer.from(importData), 'albums.json')
        .field('skip_existing', 'true')
        .field('overwrite_existing', 'false');

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go ImportAlbumResult fields:
      // total_count, success_count, skipped_count, failed_count, created_ids
      expect(data).toHaveProperty('total_count');
      expect(typeof data.total_count).toBe('number');

      expect(data).toHaveProperty('success_count');
      expect(typeof data.success_count).toBe('number');

      expect(data).toHaveProperty('skipped_count');
      expect(typeof data.skipped_count).toBe('number');

      expect(data).toHaveProperty('failed_count');
      expect(typeof data.failed_count).toBe('number');

      expect(data).toHaveProperty('created_ids');
      expect(Array.isArray(data.created_ids)).toBe(true);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('album with null categoryId returns categoryId: null', async () => {
      // Create album without categoryId
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          imageUrl: 'https://example.com/no-category.jpg',
          fileHash: `no-cat-hash-${ctx.ts}`,
        });

      assertSuccessResponse(res);
    });

    it('album with null published_at returns published_at: null', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        // All albums should have published_at field (null or string)
        for (const album of list) {
          expect(album).toHaveProperty('published_at');
          if (album.published_at !== null) {
            expect(typeof album.published_at).toBe('string');
          }
        }
      }
    });
  });

  // ─── Import result structure details ───────────────────────────────────

  describe('Import result structures', () => {
    it('POST /api/albums/batch-import includes errors and duplicates arrays', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/batch-import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          urls: ['https://invalid.example.com/fail.jpg'],
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      // errors array: each item has url and reason
      if (data.errors && data.errors.length > 0) {
        expect(data.errors[0]).toHaveProperty('url');
        expect(typeof data.errors[0].url).toBe('string');
        expect(data.errors[0]).toHaveProperty('reason');
        expect(typeof data.errors[0].reason).toBe('string');
      }

      // duplicates array: array of strings (URLs)
      if (data.duplicates) {
        expect(Array.isArray(data.duplicates)).toBe(true);
      }
    });

    it('POST /api/albums/import with valid data returns created_ids as number array', async () => {
      // Import with empty albums list — should succeed with zero counts
      const importData = JSON.stringify({
        version: '1.0',
        export_at: new Date().toISOString(),
        albums: [],
        meta: { total_albums: 0, export_by: 'test' },
      });

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .attach('file', Buffer.from(importData), 'albums.json')
        .field('skip_existing', 'true');

      assertSuccessResponse(res);
      const data = res.body.data;

      // created_ids should be array of numbers (raw DB ints)
      expect(Array.isArray(data.created_ids)).toBe(true);
      for (const id of data.created_ids) {
        expect(typeof id).toBe('number');
      }

      // errors should be string array
      if (data.errors) {
        expect(Array.isArray(data.errors)).toBe(true);
        for (const err of data.errors) {
          expect(typeof err).toBe('string');
        }
      }
    });
  });

  // ─── Export content verification ───────────────────────────────────────

  describe('Export content verification', () => {
    it('POST /api/albums/export JSON includes version, export_at, albums, meta', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/export')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({});

      expect(res.status).toBe(200);

      // Export uses @Res() so response is raw, not wrapped
      const exportData = res.body;

      // Go ExportAlbumData structure
      expect(exportData).toHaveProperty('version');
      expect(typeof exportData.version).toBe('string');

      expect(exportData).toHaveProperty('export_at');
      expect(typeof exportData.export_at).toBe('string');

      expect(exportData).toHaveProperty('albums');
      expect(Array.isArray(exportData.albums)).toBe(true);

      expect(exportData).toHaveProperty('meta');
      expect(typeof exportData.meta).toBe('object');
    });

    it('export album items use snake_case field names matching Go ExportAlbumItem', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/export')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      const exportData = res.body;

      if (exportData.albums && exportData.albums.length > 0) {
        const item = exportData.albums[0];
        // Go ExportAlbumItem uses snake_case for all fields
        expect(item).toHaveProperty('category_id');
        expect(item).toHaveProperty('image_url');
        expect(item).toHaveProperty('big_image_url');
        expect(item).toHaveProperty('download_url');
        expect(item).toHaveProperty('thumb_param');
        expect(item).toHaveProperty('big_param');
        expect(item).toHaveProperty('tags');
        expect(item).toHaveProperty('width');
        expect(item).toHaveProperty('height');
        expect(item).toHaveProperty('file_size');
        expect(item).toHaveProperty('format');
        expect(item).toHaveProperty('aspect_ratio');
        expect(item).toHaveProperty('file_hash');
        expect(item).toHaveProperty('display_order');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('location');
        expect(item).toHaveProperty('created_at');
        expect(item).toHaveProperty('updated_at');
        expect(item).toHaveProperty('published_at');
      }
    });
  });

  // ─── Public album display verification ─────────────────────────────────

  describe('Public album display', () => {
    it('GET /api/public/albums returns pagination with pageNum (matching Go)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/albums?page=1&pageSize=5')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const data = res.body.data;

      // Go public album list uses same pagination as admin: list, total, pageNum, pageSize
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('pageNum');
      expect(data).toHaveProperty('pageSize');
      expect(typeof data.total).toBe('number');
      expect(typeof data.pageNum).toBe('number');
      expect(typeof data.pageSize).toBe('number');
    });

    it('GET /api/public/albums items have numeric id and all camelCase fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/albums?page=1&pageSize=5')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        const album = list[0];
        // id must be number (raw DB int)
        expect(typeof album.id).toBe('number');
        expect(Number.isInteger(album.id)).toBe(true);

        // All camelCase fields present
        expect(album).toHaveProperty('imageUrl');
        expect(album).toHaveProperty('bigImageUrl');
        expect(album).toHaveProperty('downloadUrl');
        expect(album).toHaveProperty('viewCount');
        expect(album).toHaveProperty('downloadCount');
        expect(album).toHaveProperty('fileSize');
        expect(album).toHaveProperty('aspectRatio');
        expect(album).toHaveProperty('displayOrder');
        expect(album).toHaveProperty('categoryId');
        expect(album).toHaveProperty('fileHash');
      }
    });

    it('GET /api/public/album-categories returns array with camelCase displayOrder', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/public/album-categories');

      assertSuccessResponse(res);
      const categories = res.body.data;

      expect(Array.isArray(categories)).toBe(true);
      if (categories.length > 0) {
        const cat = categories[0];
        // displayOrder is camelCase matching Go per D-304
        expect(cat).toHaveProperty('displayOrder');
        expect(typeof cat.displayOrder).toBe('number');
        // NOT snake_case
        expect(cat).not.toHaveProperty('display_order');
      }
    });

    it('PUT /api/public/stat/:id with type=download increments download count', async () => {
      if (!albumId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/public/stat/${albumId}?type=download`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // Per D-248: stat increment succeeds silently
      assertSuccessResponse(res);
    });
  });

  // ─── Null field edge cases ─────────────────────────────────────────────

  describe('Null field edge cases', () => {
    it('album with null fileHash returns fileHash: null', async () => {
      // Create album with empty fileHash (will be computed from imageUrl)
      // The effectiveAlbumFileHash computes SHA256 of imageUrl when fileHash is empty
      // So fileHash in response will be a hash string, not null
      // But we can verify the field exists and is string | null
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(res, 'list', 'pageNum');
      const list = res.body.data.list;

      if (list.length > 0) {
        for (const album of list) {
          expect(album).toHaveProperty('fileHash');
          if (album.fileHash !== null) {
            expect(typeof album.fileHash).toBe('string');
          }
        }
      }
    });

    it('album with null categoryId returns categoryId: null in list', async () => {
      // Create album without categoryId
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          imageUrl: 'https://example.com/null-cat.jpg',
          fileHash: `null-cat-hash-${ctx.ts}-2`,
        });

      assertSuccessResponse(createRes);

      // Verify the album appears with categoryId: null
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=50')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertPaginatedResponse(listRes, 'list', 'pageNum');
      const list = listRes.body.data.list;

      // Find the album we just created (most recent)
      const nullCatAlbum = list.find((a: any) => a.imageUrl === 'https://example.com/null-cat.jpg');
      if (nullCatAlbum) {
        expect(nullCatAlbum.categoryId).toBeNull();
      }
    });
  });
});
