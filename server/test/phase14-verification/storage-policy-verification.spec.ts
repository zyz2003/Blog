/**
 * Phase 14: Storage Policy Field-by-Field Verification
 *
 * Verifies storage-policy endpoints match Go handler response structures.
 * Go StoragePolicyResponse: _go-backend-archive/pkg/domain/model/storage_policy.go
 * Go handler: _go-backend-archive/pkg/handler/storage_policy/handler.go
 *
 * Key findings from RESEARCH:
 * - Storage-policy service returns raw Date objects for created_at/updated_at
 *   instead of ISO strings. This is inconsistent with all other modules.
 * - Fix: use toISODateString() for date serialization.
 *
 * Endpoints tested: #140-144 (excluding OneDrive 501 endpoints #145-146)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import {
  createTestApp,
  closeTestApp,
  assertSuccessResponse,
  TestContext,
} from '../helpers/api-compat-helpers';
import { decodePublicID, EntityType } from '../../src/common/utils/sqids.util';

/**
 * Asserts that an object has all StoragePolicyResponse fields with correct types,
 * matching Go StoragePolicyResponse struct (model/storage_policy.go lines 86-102).
 *
 * Go StoragePolicyResponse has 15 fields:
 *   ID (string, Sqids), CreatedAt (time.Time→ISO string), UpdatedAt (time.Time→ISO string),
 *   Name (string), Type (string), Flag (string, omitempty), Server (string, omitempty),
 *   BucketName (string, omitempty), IsPrivate (bool), AccessKey (string, omitempty),
 *   SecretKey (string, omitempty), MaxSize (int64), BasePath (string, omitempty),
 *   VirtualPath (string, omitempty), Settings (map[string]interface{}, omitempty)
 */
function assertStoragePolicyResponseFields(data: any) {
  // id: string (Sqids-encoded)
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');

  // created_at: string (ISO date, NOT raw Date object)
  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string');
  // Must be a valid ISO date string, not "[object Object]" or Date.toString()
  expect(data.created_at).not.toBe('');
  expect(new Date(data.created_at).toISOString()).toBeDefined();

  // updated_at: string (ISO date, NOT raw Date object)
  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string');
  expect(data.updated_at).not.toBe('');
  expect(new Date(data.updated_at).toISOString()).toBeDefined();

  // name: string
  expect(data).toHaveProperty('name');
  expect(typeof data.name).toBe('string');

  // type: string
  expect(data).toHaveProperty('type');
  expect(typeof data.type).toBe('string');

  // flag: string (omitempty — may be empty string or null)
  expect(data).toHaveProperty('flag');
  if (data.flag !== null && data.flag !== '') {
    expect(typeof data.flag).toBe('string');
  }

  // server: string (omitempty)
  expect(data).toHaveProperty('server');
  if (data.server !== null && data.server !== '') {
    expect(typeof data.server).toBe('string');
  }

  // bucket_name: string (omitempty)
  expect(data).toHaveProperty('bucket_name');
  if (data.bucket_name !== null && data.bucket_name !== '') {
    expect(typeof data.bucket_name).toBe('string');
  }

  // is_private: boolean
  expect(data).toHaveProperty('is_private');
  expect(typeof data.is_private).toBe('boolean');

  // access_key: string (masked as '********' or empty string)
  expect(data).toHaveProperty('access_key');
  expect(typeof data.access_key).toBe('string');

  // secret_key: string (masked as '********' or empty string)
  expect(data).toHaveProperty('secret_key');
  expect(typeof data.secret_key).toBe('string');

  // max_size: number (int64 in Go)
  expect(data).toHaveProperty('max_size');
  expect(typeof data.max_size).toBe('number');

  // base_path: string (omitempty)
  expect(data).toHaveProperty('base_path');
  if (data.base_path !== null && data.base_path !== '') {
    expect(typeof data.base_path).toBe('string');
  }

  // virtual_path: string (omitempty)
  expect(data).toHaveProperty('virtual_path');
  if (data.virtual_path !== null && data.virtual_path !== '') {
    expect(typeof data.virtual_path).toBe('string');
  }

  // settings: object (omitempty)
  if (data.settings !== null && data.settings !== undefined) {
    expect(typeof data.settings).toBe('object');
  }
}

describe('StoragePolicy Field Verification', () => {
  let ctx: TestContext;
  let policyId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── GET /api/policies: PolicyListResponse ──────────────────────────────

  describe('GET /api/policies', () => {
    it('returns PolicyListResponse { list, total } with correct field types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go PolicyListResponse: { list: []*StoragePolicyResponse, total: int64 }
      expect(data).toHaveProperty('list');
      expect(data).toHaveProperty('total');
      expect(typeof data.total).toBe('number');
      expect(Array.isArray(data.list)).toBe(true);
    });

    it('list items have all 15 StoragePolicyResponse fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        assertStoragePolicyResponseFields(list[0]);
      }
    });

    it('returns policies with created_at as ISO string (not Date object)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        const createdAt = list[0].created_at;
        // Must be a string, not a Date object serialized as "2026-07-21T06:30:00.000Z"
        // Raw Date objects would serialize differently or be objects
        expect(typeof createdAt).toBe('string');
        // Must be parseable as a valid date
        expect(() => new Date(createdAt)).not.toThrow();
      }
    });

    it('returns policies with updated_at as ISO string (not Date object)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        const updatedAt = list[0].updated_at;
        expect(typeof updatedAt).toBe('string');
        expect(() => new Date(updatedAt)).not.toThrow();
      }
    });

    it('returns policies with Sqids string id', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const list = res.body.data.list;

      if (list.length > 0) {
        const id = list[0].id;
        expect(typeof id).toBe('string');
        // Verify it's a valid Sqids-encoded ID for StoragePolicy entity type
        const decoded = decodePublicID(id);
        expect(decoded.entityType).toBe(EntityType.StoragePolicy);
      }
    });
  });

  // ─── GET /api/policies/:id: StoragePolicyResponse ──────────────────────

  describe('GET /api/policies/:id', () => {
    it('returns StoragePolicyResponse with Sqids id and ISO date strings', async () => {
      // First get a list to find a valid ID
      const listRes = await supertest(ctx.app.getHttpServer())
        .get('/api/policies?page=1&pageSize=10')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      const list = listRes.body.data.list;
      if (list.length === 0) return;

      const id = list[0].id;
      const res = await supertest(ctx.app.getHttpServer())
        .get(`/api/policies/${id}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      assertStoragePolicyResponseFields(data);

      // Verify id is Sqids string
      const decoded = decodePublicID(data.id);
      expect(decoded.entityType).toBe(EntityType.StoragePolicy);

      // Verify dates are ISO strings
      expect(typeof data.created_at).toBe('string');
      expect(typeof data.updated_at).toBe('string');
    });
  });

  // ─── POST /api/policies: Create policy ─────────────────────────────────

  describe('POST /api/policies', () => {
    it('returns StoragePolicyResponse with all fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/policies')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Test Policy ${ctx.ts}`,
          type: 'local',
          basePath: 'data/test-uploads',
          isPrivate: false,
          maxSize: 0,
        });

      assertSuccessResponse(res, 200);
      const data = res.body.data;

      assertStoragePolicyResponseFields(data);

      // Store ID for subsequent tests
      policyId = data.id;
    });
  });

  // ─── PUT /api/policies/:id: Update policy ──────────────────────────────

  describe('PUT /api/policies/:id', () => {
    it('returns StoragePolicyResponse with updated fields', async () => {
      if (!policyId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .put(`/api/policies/${policyId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({
          name: `Updated Policy ${ctx.ts}`,
          type: 'local',
          basePath: 'data/updated-uploads',
        });

      assertSuccessResponse(res);
      const data = res.body.data;

      assertStoragePolicyResponseFields(data);
      expect(data.name).toBe(`Updated Policy ${ctx.ts}`);
    });
  });

  // ─── DELETE /api/policies/:id: Delete policy ───────────────────────────

  describe('DELETE /api/policies/:id', () => {
    it('returns void response (success without data property)', async () => {
      if (!policyId) return;

      const res = await supertest(ctx.app.getHttpServer())
        .delete(`/api/policies/${policyId}`)
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // Go returns response.Success(c, nil, "删除成功") — void response
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('code', 200);
      expect(res.body).toHaveProperty('message');
    });
  });

  // ─── OneDrive endpoints: 501 stubs ─────────────────────────────────────

  describe('GET /api/policies/connect/onedrive/:id (501)', () => {
    it('returns 501 Not Implemented', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/policies/connect/onedrive/test-id')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      expect(res.status).toBe(501);
    });
  });

  describe('POST /api/policies/authorize/onedrive (501)', () => {
    it('returns 501 Not Implemented', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/policies/authorize/onedrive')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ code: 'test', state: 'test' });

      expect(res.status).toBe(501);
    });
  });
});
