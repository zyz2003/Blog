import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SettingsService } from '../src/settings/settings.service';
import { initSqidsEncoderWithSeed, generatePublicID, decodePublicID, EntityType } from '../src/common/utils/sqids.util';
import { DRIZZLE } from '../src/database/database.module';
import { users } from '../src/database/schemas/user.schema';
import { userGroups } from '../src/database/schemas/user-group.schema';
import { settings } from '../src/database/schemas/setting.schema';
import { albumCategories } from '../src/database/schemas/album-category.schema';
import { albums } from '../src/database/schemas/album.schema';
import { docSeries } from '../src/database/schemas/doc-series.schema';
import { articles } from '../src/database/schemas/article.schema';
import { eq, isNull } from 'drizzle-orm';

const TEST_SEED = 'phase08-integration-test-seed';
const TEST_JWT_SECRET = 'phase08-test-jwt-secret';

/**
 * Phase 08 Integration Tests — Album & DocSeries endpoints.
 * Tests full lifecycle, response shapes, soft-delete/restore, dedup, and public endpoints.
 */
describe('Phase 08 Integration', () => {
  let app: INestApplication;
  let db: any;
  let adminToken: string;

  beforeAll(async () => {
    initSqidsEncoderWithSeed(TEST_SEED);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    db = app.get(DRIZZLE);

    // Seed test data
    await db.insert(userGroups).values({
      id: 1, name: 'Admin', description: 'Admin group',
      permissions: JSON.stringify([0,1,2,3]), maxStorage: 0, speedLimit: 0,
      settings: JSON.stringify({}),
    }).onConflictDoNothing().run();

    const passwordHash = await bcryptjs.hash('password123', 10);
    await db.insert(users).values({
      id: 1, username: 'admin', passwordHash, email: 'admin@test.com',
      nickname: 'Admin', userGroupId: 1, status: 1,
    }).onConflictDoNothing().run();

    await db.insert(settings).values({ configKey: 'JWT_SECRET', value: TEST_JWT_SECRET })
      .onConflictDoUpdate({ target: settings.configKey, set: { value: TEST_JWT_SECRET } }).run();
    await db.insert(settings).values({ configKey: 'id_seed', value: TEST_SEED })
      .onConflictDoUpdate({ target: settings.configKey, set: { value: TEST_SEED } }).run();
    await db.insert(settings).values({ configKey: 'APP_NAME', value: 'TestApp' })
      .onConflictDoUpdate({ target: settings.configKey, set: { value: 'TestApp' } }).run();
    await db.insert(settings).values({ configKey: 'captcha.provider', value: 'none' })
      .onConflictDoUpdate({ target: settings.configKey, set: { value: 'none' } }).run();
    await db.insert(settings).values({ configKey: 'GRAVATAR_URL', value: 'https://cravatar.cn/avatar/' })
      .onConflictDoUpdate({ target: settings.configKey, set: { value: 'https://cravatar.cn/avatar/' } }).run();
    await db.insert(settings).values({ configKey: 'DEFAULT_THUMB_PARAM', value: '?x-oss-process=image/resize,m_fill,w_300,h_300,limit_0/auto-orient,0/quality,q_90/format,webp' })
      .onConflictDoUpdate({ target: settings.configKey, set: { value: '?x-oss-process=image/resize,m_fill,w_300,h_300,limit_0/auto-orient,0/quality,q_90/format,webp' } }).run();
    await db.insert(settings).values({ configKey: 'DEFAULT_BIG_PARAM', value: '?x-oss-process=image/resize,m_fill,w_1200,h_1200,limit_0/auto-orient,0/quality,q_90/format,webp' })
      .onConflictDoUpdate({ target: settings.configKey, set: { value: '?x-oss-process=image/resize,m_fill,w_1200,h_1200,limit_0/auto-orient,0/quality,q_90/format,webp' } }).run();

    await app.init();

    // Generate admin JWT token
    const userId = generatePublicID(1, EntityType.User);
    const groupId = generatePublicID(1, EntityType.UserGroup);
    adminToken = jwt.sign(
      { user_id: userId, user_group_id: groupId, permissions: [0,1,2,3], iss: 'anheyu-app' },
      TEST_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  // ─── Task 2: Album CRUD Integration Test ─────────────────────────────

  describe('Album CRUD', () => {
    let categoryId: number;
    let albumId: number;
    const ts = Date.now();

    it('POST /api/album-categories — create album category', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/album-categories')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `风景-${ts}`, description: '风景照片', displayOrder: 1 });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name', `风景-${ts}`);
      expect(res.body.data).toHaveProperty('description', '风景照片');
      expect(res.body.data).toHaveProperty('displayOrder', 1);
      expect(typeof res.body.data.id).toBe('number');
      categoryId = res.body.data.id;
    });

    it('GET /api/album-categories — list categories', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/album-categories')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((c: any) => c.id === categoryId);
      expect(found).toBeDefined();
      expect(found.name).toBe(`风景-${ts}`);
    });

    it('POST /api/albums/add — create album', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/photo-${ts}.jpg`,
          fileHash: `abc123-${ts}`,
          categoryId,
          tags: ['风景', '自然'],
          width: 1920,
          height: 1080,
        });

      expect(res.status).toBe(201);
      // ResponseInterceptor wraps as { code, message, data }
      // addAlbum returns { data: null, message: '添加成功' }
      expect(res.body.message).toContain('成功');
      albumId = res.body.data?.id;
    });

    it('POST /api/albums/add — duplicate fileHash returns error', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/photo2-${ts}.jpg`,
          fileHash: `abc123-${ts}`,
          categoryId,
          width: 1920,
          height: 1080,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('已存在');
    });

    it('GET /api/albums/get — list albums with correct format', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('pageNum');
      expect(res.body.data).toHaveProperty('pageSize');
      expect(Array.isArray(res.body.data.list)).toBe(true);

      if (res.body.data.list.length > 0) {
        const album = res.body.data.list[0];
        // Verify AlbumResponse shape
        expect(typeof album.id).toBe('number');
        expect(album).toHaveProperty('categoryId');
        expect(album).toHaveProperty('imageUrl');
        expect(album).toHaveProperty('bigImageUrl');
        expect(album).toHaveProperty('downloadUrl');
        expect(album).toHaveProperty('thumbParam');
        expect(album).toHaveProperty('bigParam');
        expect(album).toHaveProperty('tags');
        expect(album).toHaveProperty('viewCount');
        expect(album).toHaveProperty('downloadCount');
        expect(album).toHaveProperty('fileSize');
        expect(album).toHaveProperty('format');
        expect(album).toHaveProperty('aspectRatio');
        expect(album).toHaveProperty('created_at');
        expect(album).toHaveProperty('updated_at');
        expect(album).toHaveProperty('published_at');
        expect(typeof album.width).toBe('number');
        expect(typeof album.height).toBe('number');
        expect(album).toHaveProperty('widthAndHeight');
        expect(album).toHaveProperty('displayOrder');
        expect(album).toHaveProperty('title');
        expect(album).toHaveProperty('description');
        expect(album).toHaveProperty('location');

        // Verify computed widthAndHeight format (WxH)
        if (album.width > 0 && album.height > 0) {
          expect(album.widthAndHeight).toBe(`${album.width}x${album.height}`);
        }
        // Verify aspectRatio computed (if width/height > 0)
        if (album.width > 0 && album.height > 0) {
          expect(album.aspectRatio).toBeTruthy();
        }
        // Verify applyDefaultAlbumParams: bigImageUrl and downloadUrl default to imageUrl
        expect(album.bigImageUrl).toBeTruthy();
        expect(album.downloadUrl).toBeTruthy();
      }
    });

    it('PUT /api/albums/update/:id — update album', async () => {
      // First get the album ID from the list
      const listRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      const targetId = listRes.body.data.list[0]?.id;
      if (!targetId) return; // skip if no album

      const res = await supertest(app.getHttpServer())
        .put(`/api/albums/update/${targetId}`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/photo2-${ts}.jpg`,
          title: 'Updated Title',
        });

      expect(res.status).toBe(200);
      // updateAlbum returns { data: null, message: '更新成功' }
      expect(res.body.message).toContain('成功');
    });

    it('DELETE /api/albums/batch-delete — batch delete albums', async () => {
      // Create a new album for batch delete
      await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/batch-delete-photo-${ts}.jpg`,
          fileHash: `batch-delete-hash-${ts}`,
          categoryId,
          width: 800,
          height: 600,
        });

      // Get the list to find the new album
      const listRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=100')
        .set('authorization', `Bearer ${adminToken}`);

      const batchDeleteId = listRes.body.data.list.find(
        (a: any) => a.imageUrl?.includes('batch-delete-photo'),
      )?.id;

      if (batchDeleteId) {
        const res = await supertest(app.getHttpServer())
          .delete('/api/albums/batch-delete')
          .set('authorization', `Bearer ${adminToken}`)
          .send({ ids: [batchDeleteId] });

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('deleted');
        expect(res.body.data.deleted).toBeGreaterThanOrEqual(1);
      }
    });

    it('Soft-delete + CreateOrRestore restore path', async () => {
      // Step 1: Create album A with unique fileHash
      const createRes1 = await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/restore-test-${ts}.jpg`,
          fileHash: `hash1-restore-test-${ts}`,
          categoryId,
          width: 640,
          height: 480,
        });
      expect(createRes1.status).toBe(201);

      // Get the album ID
      const listRes1 = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=100')
        .set('authorization', `Bearer ${adminToken}`);

      const albumA = listRes1.body.data.list.find(
        (a: any) => a.imageUrl?.includes(`restore-test-${ts}`),
      );
      expect(albumA).toBeDefined();
      const albumAId = albumA.id;

      // Step 2: Delete album A (soft delete)
      const deleteRes = await supertest(app.getHttpServer())
        .delete(`/api/albums/delete/${albumAId}`)
        .set('authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(200);

      // Step 3: Verify album A is NOT in the list (soft-deleted)
      const listRes2 = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=100')
        .set('authorization', `Bearer ${adminToken}`);

      const foundAfterDelete = listRes2.body.data.list.find(
        (a: any) => a.id === albumAId,
      );
      expect(foundAfterDelete).toBeUndefined();

      // Step 4: Create album B with same fileHash — should restore
      const createRes2 = await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/restore-test-new-${ts}.jpg`,
          fileHash: `hash1-restore-test-${ts}`,
          categoryId,
          width: 640,
          height: 480,
        });
      expect(createRes2.status).toBe(201);

      // Step 5: Verify the restored album is now in the list
      const listRes3 = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=100')
        .set('authorization', `Bearer ${adminToken}`);

      const restoredAlbum = listRes3.body.data.list.find(
        (a: any) => a.id === albumAId,
      );
      expect(restoredAlbum).toBeDefined();
    });

    it('DELETE /api/album-categories/:id — category in use returns error', async () => {
      // Create a new category with unique name
      const uniqueName = `测试分类-删除-${Date.now()}`;
      const catRes = await supertest(app.getHttpServer())
        .post('/api/album-categories')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: uniqueName, description: 'test', displayOrder: 5 });

      expect(catRes.status).toBe(201);
      const catId = catRes.body.data.id;

      // Create an album referencing this category
      const albumRes = await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/cat-delete-test-${ts}.jpg`,
          fileHash: `cat-delete-test-hash-${ts}`,
          categoryId: catId,
          width: 100,
          height: 100,
        });
      expect(albumRes.status).toBe(201);

      // Try to delete the category — should fail because album references it
      const delRes = await supertest(app.getHttpServer())
        .delete(`/api/album-categories/${catId}`)
        .set('authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(409);
      expect(delRes.body.message).toContain('该分类下还有相册');

      // Soft-delete the album, then category delete should succeed
      // (soft-deleted albums should NOT block category deletion)
      const listRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=100')
        .set('authorization', `Bearer ${adminToken}`);

      const catDeleteAlbum = listRes.body.data.list.find(
        (a: any) => a.imageUrl?.includes(`cat-delete-test-${ts}`),
      );
      if (catDeleteAlbum) {
        await supertest(app.getHttpServer())
          .delete(`/api/albums/delete/${catDeleteAlbum.id}`)
          .set('authorization', `Bearer ${adminToken}`);

        // Now category delete should succeed (soft-deleted albums don't block)
        const delRes2 = await supertest(app.getHttpServer())
          .delete(`/api/album-categories/${catId}`)
          .set('authorization', `Bearer ${adminToken}`);

        expect(delRes2.status).toBe(200);
      }
    });
  });

  // ─── Task 3: Album Public Endpoints Test ─────────────────────────────

  describe('Album Public Endpoints', () => {
    it('GET /api/public/albums — no auth required', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/public/albums?page=1&pageSize=12');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('pageNum');
      expect(res.body.data).toHaveProperty('pageSize');
      // Default pageSize should be 12 for public endpoint
      expect(res.body.data.pageSize).toBe(12);
    });

    it('GET /api/public/album-categories — no auth required', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/public/album-categories');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PUT /api/public/stat/:id?type=view — increment view count', async () => {
      // Get an album ID first
      const listRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      const albumId = listRes.body.data.list[0]?.id;
      if (!albumId) return;

      // Get current view count
      const beforeRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);
      const beforeAlbum = beforeRes.body.data.list.find((a: any) => a.id === albumId);
      const beforeCount = beforeAlbum?.viewCount ?? 0;

      // Increment view count
      const res = await supertest(app.getHttpServer())
        .put(`/api/public/stat/${albumId}?type=view`);

      expect(res.status).toBe(200);

      // Verify view count incremented
      const afterRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);
      const afterAlbum = afterRes.body.data.list.find((a: any) => a.id === albumId);
      expect(afterAlbum.viewCount).toBe(beforeCount + 1);
    });

    it('PUT /api/public/stat/:id?type=download — increment download count', async () => {
      const listRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      const albumId = listRes.body.data.list[0]?.id;
      if (!albumId) return;

      const beforeRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);
      const beforeAlbum = beforeRes.body.data.list.find((a: any) => a.id === albumId);
      const beforeCount = beforeAlbum?.downloadCount ?? 0;

      const res = await supertest(app.getHttpServer())
        .put(`/api/public/stat/${albumId}?type=download`);

      expect(res.status).toBe(200);

      const afterRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);
      const afterAlbum = afterRes.body.data.list.find((a: any) => a.id === albumId);
      expect(afterAlbum.downloadCount).toBe(beforeCount + 1);
    });

    it('PUT /api/public/stat/:id?type=invalid — returns error', async () => {
      const listRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      const albumId = listRes.body.data.list[0]?.id;
      if (!albumId) return;

      const res = await supertest(app.getHttpServer())
        .put(`/api/public/stat/${albumId}?type=invalid`);

      expect(res.status).toBe(400);
    });
  });

  // ─── Task 4: Album Import/Export Test ────────────────────────────────

  describe('Album Import/Export', () => {
    it('POST /api/albums/export — export albums as JSON', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/albums/export')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ format: 'json' });

      // POST endpoints return 201 by default in NestJS
      // The export endpoint uses @Res() which bypasses interceptor, so status is 201
      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain('attachment');

      // Parse the JSON body
      const exportData = res.body;
      expect(exportData).toHaveProperty('version', '1.0');
      expect(exportData).toHaveProperty('export_at');
      expect(exportData).toHaveProperty('albums');
      expect(exportData).toHaveProperty('meta');
      expect(Array.isArray(exportData.albums)).toBe(true);

      if (exportData.albums.length > 0) {
        const item = exportData.albums[0];
        // Verify ExportAlbumItem shape (snake_case keys)
        expect(item).toHaveProperty('image_url');
        expect(item).toHaveProperty('big_image_url');
        expect(item).toHaveProperty('download_url');
        expect(item).toHaveProperty('file_hash');
        expect(item).toHaveProperty('width');
        expect(item).toHaveProperty('height');
        expect(item).toHaveProperty('aspect_ratio');
      }
    });

    it('POST /api/albums/import — import albums from JSON', async () => {
      // First export to get valid data
      const exportRes = await supertest(app.getHttpServer())
        .post('/api/albums/export')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ format: 'json' });

      const exportData = exportRes.body;

      // Modify the export data to create new unique albums for import
      const uniqueHash = `import-test-hash-${Date.now()}`;
      const importData = {
        ...exportData,
        albums: [
          {
            category_id: null,
            image_url: `https://example.com/imported-photo-${Date.now()}.jpg`,
            big_image_url: '',
            download_url: '',
            thumb_param: '',
            big_param: '',
            tags: '导入,测试',
            width: 1024,
            height: 768,
            file_size: 50000,
            format: 'jpeg',
            aspect_ratio: '4:3',
            file_hash: uniqueHash,
            display_order: 0,
            title: 'Imported Album',
            description: 'Test import',
            location: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            published_at: null,
          },
        ],
      };

      // Upload as JSON file
      const jsonBuffer = Buffer.from(JSON.stringify(importData, null, 2));
      const res = await supertest(app.getHttpServer())
        .post('/api/albums/import')
        .set('authorization', `Bearer ${adminToken}`)
        .attach('file', jsonBuffer, 'albums.json')
        .field('skip_existing', 'true')
        .field('overwrite_existing', 'false');

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('total_count');
      expect(res.body.data).toHaveProperty('success_count');
      expect(res.body.data).toHaveProperty('skipped_count');
      expect(res.body.data).toHaveProperty('failed_count');
      expect(res.body.data.success_count).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Task 5: DocSeries CRUD Integration Test ─────────────────────────

  describe('DocSeries CRUD', () => {
    let seriesId: string;

    it('POST /api/doc-series — create doc series', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `Vue3-学习笔记-${Date.now()}`, description: 'Vue3 系列', sort: 1 });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(typeof res.body.data.id).toBe('string'); // Sqids string ID
      expect(res.body.data).toHaveProperty('description', 'Vue3 系列');
      expect(res.body.data).toHaveProperty('cover_url');
      expect(res.body.data).toHaveProperty('sort', 1);
      expect(res.body.data).toHaveProperty('doc_count', 0);
      expect(res.body.data).toHaveProperty('created_at');
      expect(res.body.data).toHaveProperty('updated_at');
      seriesId = res.body.data.id;
    });

    it('POST /api/doc-series — duplicate name returns error', async () => {
      // Get the name of the series we just created
      const getRes = await supertest(app.getHttpServer())
        .get(`/api/doc-series/${seriesId}`)
        .set('authorization', `Bearer ${adminToken}`);
      const seriesName = getRes.body.data.name;

      const res = await supertest(app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: seriesName, description: 'Duplicate' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('已存在');
    });

    it('GET /api/doc-series — list doc series', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/doc-series?page=1&pageSize=20')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // DocSeriesListResponse format
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('pageSize');
      expect(Array.isArray(res.body.data.list)).toBe(true);
    });

    it('GET /api/doc-series/:id — get doc series', async () => {
      const res = await supertest(app.getHttpServer())
        .get(`/api/doc-series/${seriesId}`)
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(seriesId);
    });

    it('PUT /api/doc-series/:id — update doc series', async () => {
      const res = await supertest(app.getHttpServer())
        .put(`/api/doc-series/${seriesId}`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `Vue3-进阶-${Date.now()}` });

      expect(res.status).toBe(200);
      // Verify the name was updated
      expect(res.body.data).toHaveProperty('name');
    });

    it('DELETE /api/doc-series/:id — delete with docs blocked', async () => {
      // Create a series with a doc article
      const createRes = await supertest(app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `有文档的系列-${Date.now()}`, description: 'test', sort: 2 });

      expect(createRes.status).toBe(201);
      const seriesWithDocsId = createRes.body.data.id;

      // Decode the Sqids ID to get dbID using the imported util
      const { dbID } = decodePublicID(seriesWithDocsId);

      // Insert a doc article linked to this series directly in DB
      const articleAbbrlink = `test-doc-abbrlink-${dbID}`;
      await db.insert(articles).values({
        title: 'Test Doc Article',
        contentMd: '# Test',
        status: 'PUBLISHED',
        isDoc: true,
        docSeriesId: dbID,
        docSort: 1,
        abbrlink: articleAbbrlink,
      });

      // Update doc_count on the series
      await db.update(docSeries).set({ docCount: 1 }).where(eq(docSeries.id, dbID));

      // Try to delete — should be blocked
      const delRes = await supertest(app.getHttpServer())
        .delete(`/api/doc-series/${seriesWithDocsId}`)
        .set('authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(400);
      expect(delRes.body.message).toContain('无法删除');

      // Clean up: remove the article, then delete the series
      await db.delete(articles).where(eq(articles.abbrlink, articleAbbrlink));
      await db.update(docSeries).set({ docCount: 0 }).where(eq(docSeries.id, dbID));

      const delRes2 = await supertest(app.getHttpServer())
        .delete(`/api/doc-series/${seriesWithDocsId}`)
        .set('authorization', `Bearer ${adminToken}`);

      expect(delRes2.status).toBe(200);
    });

    it('DELETE /api/doc-series/:id — delete without docs succeeds', async () => {
      // Create a series with no docs
      const createRes = await supertest(app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `空系列-${Date.now()}`, description: 'no docs', sort: 3 });

      const emptySeriesId = createRes.body.data.id;

      const delRes = await supertest(app.getHttpServer())
        .delete(`/api/doc-series/${emptySeriesId}`)
        .set('authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
    });
  });

  // ─── Task 6: DocSeries Public Endpoints Test ─────────────────────────

  describe('DocSeries Public Endpoints', () => {
    let seriesId: string;

    // Create a series for public tests
    beforeAll(async () => {
      const res = await supertest(app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `公开系列测试-${Date.now()}`, description: 'Public test', sort: 10 });

      seriesId = res.body.data?.id;
    });

    it('GET /api/public/doc-series — list public doc series', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/public/doc-series?page=1&pageSize=20');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('pageSize');
      expect(Array.isArray(res.body.data.list)).toBe(true);
    });

    it('GET /api/public/doc-series/:id — get public doc series', async () => {
      if (!seriesId) return;

      const res = await supertest(app.getHttpServer())
        .get(`/api/public/doc-series/${seriesId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(seriesId);
      // Verify DocSeriesResponse shape
      expect(res.body.data).toHaveProperty('created_at');
      expect(res.body.data).toHaveProperty('updated_at');
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('cover_url');
      expect(res.body.data).toHaveProperty('sort');
      expect(res.body.data).toHaveProperty('doc_count');
    });

    it('GET /api/public/doc-series/:id/articles — get with articles', async () => {
      if (!seriesId) return;

      const res = await supertest(app.getHttpServer())
        .get(`/api/public/doc-series/${seriesId}/articles`);

      expect(res.status).toBe(200);
      // DocSeriesWithArticles shape
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('articles');
      expect(Array.isArray(res.body.data.articles)).toBe(true);
    });
  });

  // ─── Task 8: API Compatibility Spot-Check ────────────────────────────

  describe('API Compatibility Spot-Check', () => {
    it('Album list response has correct shape: { list, total, pageNum, pageSize }', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Object.keys(data).sort()).toEqual(['list', 'pageNum', 'pageSize', 'total'].sort());
    });

    it('AlbumResponse has integer id and computed widthAndHeight', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      if (res.body.data.list.length === 0) return;
      const album = res.body.data.list[0];
      expect(Number.isInteger(album.id)).toBe(true);
      expect(typeof album.widthAndHeight).toBe('string');
      // widthAndHeight format: "WxH"
      if (album.widthAndHeight) {
        expect(album.widthAndHeight).toMatch(/^\d+x\d+$/);
      }
    });

    it('AlbumCategoryDTO has integer id, name, description, displayOrder', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/album-categories')
        .set('authorization', `Bearer ${adminToken}`);

      if (res.body.data.length === 0) return;
      const cat = res.body.data[0];
      expect(Number.isInteger(cat.id)).toBe(true);
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('description');
      expect(cat).toHaveProperty('displayOrder');
      // Should NOT have cover_url, sort, password, album_count
      expect(cat).not.toHaveProperty('cover_url');
      expect(cat).not.toHaveProperty('sort');
      expect(cat).not.toHaveProperty('password');
      expect(cat).not.toHaveProperty('album_count');
    });

    it('DocSeriesResponse has Sqids string id and snake_case fields', async () => {
      const listRes = await supertest(app.getHttpServer())
        .get('/api/doc-series?page=1&pageSize=20')
        .set('authorization', `Bearer ${adminToken}`);

      if (listRes.body.data.list.length === 0) return;
      const ds = listRes.body.data.list[0];
      expect(typeof ds.id).toBe('string');
      expect(ds).toHaveProperty('created_at');
      expect(ds).toHaveProperty('updated_at');
      expect(ds).toHaveProperty('cover_url');
      expect(ds).toHaveProperty('doc_count');
    });

    it('DocSeriesListResponse has { list, total, page, pageSize }', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/doc-series?page=1&pageSize=20')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Object.keys(data).sort()).toEqual(['list', 'page', 'pageSize', 'total'].sort());
    });

    it('Admin endpoints require JWT + Admin guard', async () => {
      // Without auth
      const res1 = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10');
      expect(res1.status).toBe(401);

      // Without auth on doc-series
      const res2 = await supertest(app.getHttpServer())
        .get('/api/doc-series?page=1&pageSize=20');
      expect(res2.status).toBe(401);

      // Without auth on album-categories
      const res3 = await supertest(app.getHttpServer())
        .get('/api/album-categories');
      expect(res3.status).toBe(401);
    });

    it('Public endpoints work without authentication', async () => {
      const res1 = await supertest(app.getHttpServer())
        .get('/api/public/albums?page=1&pageSize=12');
      expect(res1.status).toBe(200);

      const res2 = await supertest(app.getHttpServer())
        .get('/api/public/album-categories');
      expect(res2.status).toBe(200);

      const res3 = await supertest(app.getHttpServer())
        .get('/api/public/doc-series?page=1&pageSize=20');
      expect(res3.status).toBe(200);
    });
  });
});
