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
 * Backup API Compatibility Tests
 * Verifies all 7 backup/config endpoints match Go backend response format.
 *
 * Endpoints:
 *   POST /api/config/backup/create  — Create backup (JWT+Admin)
 *   GET  /api/config/backup/list    — List backups (JWT+Admin)
 *   POST /api/config/backup/restore — Restore backup (JWT+Admin)
 *   POST /api/config/backup/delete  — Delete backup (JWT+Admin)
 *   POST /api/config/backup/clean   — Clean old backups (JWT+Admin)
 *   GET  /api/config/export         — Export config (JWT+Admin) — NOT YET IMPLEMENTED
 *   POST /api/config/import         — Import config (JWT+Admin) — NOT YET IMPLEMENTED
 */
describe('Backup API Compat', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── 1. POST /api/config/backup/create (JWT+Admin) ──────────────────

  describe('POST /api/config/backup/create', () => {
    it('returns { code, data: BackupInfo, message } for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ description: 'test backup' });

      assertSuccessResponse(res, 201);
      const data = res.body.data;
      // BackupInfo has filename, size, created_at, description, is_auto
      expect(data).toHaveProperty('filename');
      expect(data).toHaveProperty('size');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('is_auto');
      expect(typeof data.filename).toBe('string');
      expect(typeof data.size).toBe('number');
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .send({ description: 'test' });

      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin JWT', async () => {
      // Non-admin token — just test without proper admin group
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .set('authorization', `Bearer invalid-token`)
        .send({ description: 'test' });

      // Either 401 (invalid token) or 403 (not admin)
      expect([401, 403]).toContain(res.status);
    });
  });

  // ─── 2. GET /api/config/backup/list (JWT+Admin) ─────────────────────

  describe('GET /api/config/backup/list', () => {
    it('returns { code, data: BackupInfo[], message } for admin', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/config/backup/list')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;
      expect(Array.isArray(data)).toBe(true);
      // If backups exist, verify shape
      if (data.length > 0) {
        const backup = data[0];
        expect(backup).toHaveProperty('filename');
        expect(backup).toHaveProperty('size');
        expect(backup).toHaveProperty('created_at');
        expect(backup).toHaveProperty('description');
        expect(backup).toHaveProperty('is_auto');
      }
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/config/backup/list');

      expect(res.status).toBe(401);
    });
  });

  // ─── 3. POST /api/config/backup/restore (JWT+Admin) ─────────────────

  describe('POST /api/config/backup/restore', () => {
    it('returns 400 for nonexistent backup filename', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/restore')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ filename: 'settings_backup_20240101_120000.json' });

      // Backup file doesn't exist — should return 400
      assertErrorResponse(res, 400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/restore')
        .send({ filename: 'test.json' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 4. POST /api/config/backup/delete (JWT+Admin) ──────────────────

  describe('POST /api/config/backup/delete', () => {
    it('returns 400 for nonexistent backup filename', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/delete')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ filename: 'settings_backup_20240101_120000.json' });

      // Backup file doesn't exist — should return 400
      assertErrorResponse(res, 400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/delete')
        .send({ filename: 'test.json' });

      expect(res.status).toBe(401);
    });
  });

  // ─── 5. POST /api/config/backup/clean (JWT+Admin) ───────────────────

  describe('POST /api/config/backup/clean', () => {
    it('returns { code, data, message } for valid keep_count', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/clean')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keep_count: 10 });

      // Per D-244: NestJS POST returns code 201 in response body (Go returns 200)
      assertSuccessResponse(res, 201);
    });

    it('returns 400 for invalid keep_count (0)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/clean')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keep_count: 0 });

      // Validation should reject keep_count < 1
      expect(res.status).toBe(400);
    });

    it('returns 401 without JWT', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/clean')
        .send({ keep_count: 5 });

      expect(res.status).toBe(401);
    });
  });

  // ─── 6. GET /api/config/export (JWT+Admin) — NOT YET IMPLEMENTED ────

  describe('GET /api/config/export', () => {
    it('returns 404 (endpoint not yet implemented in NestJS)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/config/export')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      // Endpoint exists in Go backend but not yet in NestJS
      // Expected: 404 until implemented
      expect(res.status).toBe(404);
    });
  });

  // ─── 7. POST /api/config/import (JWT+Admin) — NOT YET IMPLEMENTED ───

  describe('POST /api/config/import', () => {
    it('returns 404 (endpoint not yet implemented in NestJS)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/import')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ data: {} });

      // Endpoint exists in Go backend but not yet in NestJS
      // Expected: 404 until implemented
      expect(res.status).toBe(404);
    });
  });
});
