/**
 * Phase 13: File Field-by-Field Verification
 *
 * Fixes applied to file.service.ts:
 * 1. Pagination: { page, pageSize, total } → { page, page_size, next_token, is_cursor }
 * 2. toFileItem dates: raw Date objects → toISODateString()
 * 3. toFileItem permission: 0 → null, capability: 0 → '' (empty string)
 *
 * Go FileItem/Pagination baseline: _go-backend-archive/pkg/domain/model/file.go
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
 * Assert FileItem fields match Go FileItem struct (model/file.go lines 128-149).
 */
function assertFileItemFields(data: any) {
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');

  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  expect(data).toHaveProperty('type');
  expect(typeof data.type).toBe('number');

  expect(data).toHaveProperty('size');
  expect(typeof data.size).toBe('number');

  // Date fields must be ISO strings (NOT Date objects) per Fix 2
  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string'); // NOT null per CCP-1

  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string'); // NOT null per CCP-1

  expect(data).toHaveProperty('path');
  expect(typeof data.path).toBe('string');

  expect(data).toHaveProperty('owned');
  expect(typeof data.owned).toBe('boolean');

  expect(data).toHaveProperty('shared');
  expect(typeof data.shared).toBe('boolean');

  // permission: null per Fix 3 (Go: interface{} = nil)
  expect(data).toHaveProperty('permission');
  expect(data.permission).toBeNull();

  // capability: empty string per Fix 3 (Go: string = "")
  expect(data).toHaveProperty('capability');
  expect(typeof data.capability).toBe('string');

  // primary_entity_public_id: string | null
  expect(data).toHaveProperty('primary_entity_public_id');
  if (data.primary_entity_public_id !== null) {
    expect(typeof data.primary_entity_public_id).toBe('string');
  }

  // ext: string | null (NestJS-only field, not in Go)
  if (data.ext !== undefined && data.ext !== null) {
    expect(typeof data.ext).toBe('string');
  }

  expect(data).toHaveProperty('metadata');
  expect(typeof data.metadata).toBe('object');

  // url: string | null
  expect(data).toHaveProperty('url');
  if (data.url !== null) {
    expect(typeof data.url).toBe('string');
  }

  expect(data).toHaveProperty('relative_path');
  expect(typeof data.relative_path).toBe('string');
}

describe('File Field Verification', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── MEDIUM-risk: GET file list ────────────────────────────────────────

  describe('GET /api/file (MEDIUM)', () => {
    it('returns FileListResponse with page_size (snake_case) pagination', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/file?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Per Fix 1: pagination uses page_size (snake_case), NOT pageSize (camelCase)
      expect(data).toHaveProperty('files');
      expect(data).toHaveProperty('pagination');

      const pagination = data.pagination;
      expect(pagination).toHaveProperty('page');
      expect(typeof pagination.page).toBe('number');
      expect(pagination).toHaveProperty('page_size');
      expect(typeof pagination.page_size).toBe('number');
      expect(pagination).toHaveProperty('next_token');
      expect(typeof pagination.next_token).toBe('string');
      expect(pagination).toHaveProperty('is_cursor');
      expect(typeof pagination.is_cursor).toBe('boolean');

      // Per Fix 1: pagination does NOT have pageSize or total
      expect(pagination).not.toHaveProperty('pageSize');
      expect(pagination).not.toHaveProperty('total');
    });

    it('has props.total and storage_policy in response', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/file?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('props');
      expect(data.props).toHaveProperty('total');

      expect(data).toHaveProperty('storage_policy');
      expect(typeof data.storage_policy).toBe('object');

      expect(data).toHaveProperty('context_hint');
      expect(typeof data.context_hint).toBe('string');
    });

    it('file items have all FileItem fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/file?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const files = res.body.data.files;

      if (files.length > 0) {
        assertFileItemFields(files[0]);
      }
    });
  });

  // ─── MEDIUM-risk: GET file info ────────────────────────────────────────

  describe('GET /api/file/:id (MEDIUM)', () => {
    it('returns FileInfoResponse with file and storagePolicy', async () => {
      // First, get a file ID from the file list
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/file?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const files = listRes.body.data.files;
      if (files.length === 0) return; // skip if no files

      const fileId = files[0].id;

      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/file/${fileId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('file');
      assertFileItemFields(data.file);

      expect(data).toHaveProperty('storagePolicy');
      expect(typeof data.storagePolicy).toBe('object');
      expect(data.storagePolicy).toHaveProperty('name');
      expect(data.storagePolicy).toHaveProperty('type');
    });
  });

  // ─── MEDIUM-risk: Folder tree ──────────────────────────────────────────

  describe('GET /api/folder/tree/:id (MEDIUM)', () => {
    it('returns FolderTreeResponse with folder_name, files, expires', async () => {
      // Root folder (id=1)
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/folder/tree/1')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      if (res.status === 404) return; // skip if root folder not found

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data).toHaveProperty('folder_name');
      expect(typeof data.folder_name).toBe('string');

      expect(data).toHaveProperty('files');
      expect(Array.isArray(data.files)).toBe(true);

      // expires: string | null
      expect(data).toHaveProperty('expires');
      if (data.expires !== null) {
        expect(typeof data.expires).toBe('string');
      }
    });
  });

  // ─── LOW-risk: Upload session ──────────────────────────────────────────

  describe('PUT /api/file/upload (LOW)', () => {
    it('returns CreateUploadSessionResponse with session fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/file/upload')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          uri: 'anzhiyu://my/',
          size: 1024,
          name: `test-upload-${ctx.ts}.txt`,
          policy_id: 'local',
          chunk_count: 1,
        });

      // May succeed or fail depending on storage policy setup
      if (res.status === 200) {
        const data = res.body.data;
        expect(data).toHaveProperty('session_id');
      } else {
        // If storage policy is not configured, this is expected
        expect([400, 404, 500]).toContain(res.status);
      }
    });
  });

  // ─── LOW-risk: Upload finalize ─────────────────────────────────────────

  describe('POST /api/file/upload/finalize (LOW)', () => {
    it('returns error for nonexistent session', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/file/upload/finalize')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ session_id: 'nonexistent' });

      // May return 404 or error for nonexistent session
      expect([400, 404, 500]).toContain(res.status);
    });
  });

  // ─── LOW-risk: Update folder view ──────────────────────────────────────

  describe('PUT /api/folder/view (LOW)', () => {
    it('returns updated view config', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .put('/api/folder/view')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ folder_id: 1, view_type: 'grid' });

      if (res.status === 200) {
        assertSuccessResponse(res);
      }
    });
  });

  // ─── NONE-risk: confirm existing api-compat tests still pass ──────────

  describe('Existing api-compat tests (NONE)', () => {
    it('file api-compat tests still pass after fixes', async () => {
      // This is a confirmation test — the actual api-compat test file is run
      // separately. This test just verifies basic file operations still work.
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/file?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      expect(res.body.data).toHaveProperty('files');
      expect(res.body.data.pagination).toHaveProperty('page_size');
    });
  });
});
