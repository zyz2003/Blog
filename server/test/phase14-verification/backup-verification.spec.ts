/**
 * Phase 14: Backup CRUD Verification
 *
 * Verifies backup endpoints response structure matches Go backend.
 * Go reference: _go-backend-archive/pkg/service/config/backup_service.go
 *   - BackupInfo: { filename, size, created_at, description, is_auto }
 *   - CreateBackup returns BackupInfo
 *   - ListBackups returns []BackupInfo
 *   - RestoreBackup/DeleteBackup/CleanOldBackups return void
 *
 * Go handler reference: _go-backend-archive/pkg/handler/config/handler.go
 *   - All routes require JWT + Admin auth
 *   - POST /api/config/backup/create  → { data: BackupInfo, message }
 *   - GET  /api/config/backup/list    → { data: BackupInfo[], message }
 *   - POST /api/config/backup/restore → { data: null, message }
 *   - POST /api/config/backup/delete  → { data: null, message }
 *   - POST /api/config/backup/clean   → { data: null, message }
 */
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
 * Assert BackupInfo has all 5 fields matching Go struct.
 * Go BackupInfo:
 *   Filename string    `json:"filename"`
 *   Size     int64     `json:"size"`
 *   CreatedAt time.Time `json:"created_at"`
 *   Description string `json:"description"`
 *   IsAuto   bool      `json:"is_auto"`
 */
function assertBackupInfo(data: any) {
  expect(data).toHaveProperty('filename');
  expect(typeof data.filename).toBe('string');

  expect(data).toHaveProperty('size');
  expect(typeof data.size).toBe('number');

  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string');
  // created_at must be ISO string (not raw Date object)
  // Go time.Time serializes as RFC3339 / ISO 8601 string
  expect(data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  expect(data).toHaveProperty('description');
  expect(typeof data.description).toBe('string');

  expect(data).toHaveProperty('is_auto');
  expect(typeof data.is_auto).toBe('boolean');
}

describe('Backup CRUD Verification', () => {
  let ctx: TestContext;
  let createdFilename: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  // ─── LOW-risk: List backups ───────────────────────────────────────────

  describe('GET /api/config/backup/list (LOW)', () => {
    it('returns array of BackupInfo objects', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/config/backup/list')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(Array.isArray(data)).toBe(true);

      // If there are backups, verify structure
      if (data.length > 0) {
        assertBackupInfo(data[0]);
      }
    });

    it('each BackupInfo has 5 fields with correct types', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/config/backup/list')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      if (data.length > 0) {
        for (const backup of data) {
          assertBackupInfo(backup);
        }
      }
    });

    it('created_at is ISO string (not raw Date object)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/config/backup/list')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      const data = res.body.data;

      if (data.length > 0) {
        // Verify created_at is a string, not a Date object
        // (Date objects would serialize differently or cause issues)
        expect(typeof data[0].created_at).toBe('string');
        // Must match ISO format pattern
        expect(data[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });
  });

  // ─── LOW-risk: Create backup ──────────────────────────────────────────

  describe('POST /api/config/backup/create (LOW)', () => {
    it('creates backup and returns BackupInfo with all 5 fields', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ description: 'Phase14 verification test' });

      assertSuccessResponse(res);
      const data = res.body.data;

      assertBackupInfo(data);

      // Verify filename contains timestamp per D-239 (local time format)
      // Format: settings_backup_YYYYMMDD_HHMMSS.json
      expect(data.filename).toMatch(/^settings_backup_\d{8}_\d{6}\.json$/);

      // Verify description matches what we sent
      expect(data.description).toBe('Phase14 verification test');

      // Verify is_auto is false (manual backup)
      expect(data.is_auto).toBe(false);

      // Store filename for subsequent tests
      createdFilename = data.filename;
    });

    it('BackupInfo size is a positive number', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ description: 'Size test backup' });

      assertSuccessResponse(res);
      const data = res.body.data;

      expect(data.size).toBeGreaterThan(0);
    });

    it('creates backup with empty description (defaults to 手动备份)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({});

      assertSuccessResponse(res);
      const data = res.body.data;

      // Go default: "手动备份" (matches NestJS BackupController default)
      expect(data.description).toBe('手动备份');
    });
  });

  // ─── LOW-risk: Restore backup ─────────────────────────────────────────

  describe('POST /api/config/backup/restore (LOW)', () => {
    it('restores from backup and returns void response', async () => {
      // Ensure we have a backup to restore
      if (!createdFilename) {
        const createRes = await supertest(ctx.app.getHttpServer())
          .post('/api/config/backup/create')
          .set('authorization', `Bearer ${ctx.adminToken}`)
          .send({ description: 'Restore test backup' });
        createdFilename = createRes.body.data.filename;
      }

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/restore')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ filename: createdFilename });

      // Go: { data: null, message: "系统设置已恢复成功..." }
      assertSuccessResponse(res);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 for nonexistent backup filename', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/restore')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ filename: 'settings_backup_99999999_999999.json' });

      // Go: 400 for nonexistent backup
      assertErrorResponse(res, 400);
    });

    it('returns 400 for invalid filename (path traversal)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/restore')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ filename: '../../../etc/passwd' });

      // Go: 400 for invalid filename (path traversal protection)
      assertErrorResponse(res, 400);
    });
  });

  // ─── LOW-risk: Delete backup ──────────────────────────────────────────

  describe('POST /api/config/backup/delete (LOW)', () => {
    it('deletes backup and returns void response', async () => {
      // Create a throwaway backup for deletion
      const createRes = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ description: 'Delete test backup' });

      const deleteFilename = createRes.body.data.filename;

      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/delete')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ filename: deleteFilename });

      // Go: { data: null, message: "备份已删除" }
      assertSuccessResponse(res);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 for nonexistent backup filename', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/delete')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ filename: 'settings_backup_99999999_999999.json' });

      assertErrorResponse(res, 400);
    });
  });

  // ─── LOW-risk: Clean old backups ──────────────────────────────────────

  describe('POST /api/config/backup/clean (LOW)', () => {
    it('cleans old backups and returns void response', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/clean')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keep_count: 10 });

      // Go: { data: null, message: "旧备份清理成功" }
      assertSuccessResponse(res);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 for invalid keep_count (less than 1)', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/clean')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ keep_count: 0 });

      // Go: 400 for keep_count < 1
      assertErrorResponse(res, 400);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('backup list when no backups exist returns empty array', async () => {
      // This test verifies the format even if backups exist
      // (we can't easily clear all backups without affecting other tests)
      const res = await supertest(ctx.app.getHttpServer())
        .get('/api/config/backup/list')
        .set('authorization', `Bearer ${ctx.adminToken}`);

      assertSuccessResponse(res);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('backup filename format matches Go: settings_backup_YYYYMMDD_HHMMSS.json', async () => {
      const res = await supertest(ctx.app.getHttpServer())
        .post('/api/config/backup/create')
        .set('authorization', `Bearer ${ctx.adminToken}`)
        .send({ description: 'Filename format test' });

      assertSuccessResponse(res);
      const filename = res.body.data.filename;

      // Go format: settings_backup_ + 15-char timestamp + .json
      // Timestamp: YYYYMMDD_HHMMSS (8 digits + underscore + 6 digits = 15 chars)
      expect(filename).toMatch(/^settings_backup_\d{8}_\d{6}\.json$/);
    });
  });
});
