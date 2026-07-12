import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SettingsService } from '../src/settings/settings.service';
import { initSqidsEncoderWithSeed, generatePublicID, EntityType, decodePublicID } from '../src/common/utils/sqids.util';
import { DRIZZLE } from '../src/database/database.module';
import { users } from '../src/database/schemas/user.schema';
import { userGroups } from '../src/database/schemas/user-group.schema';
import { settings } from '../src/database/schemas/setting.schema';
import { albumCategories } from '../src/database/schemas/album-category.schema';
import { docSeries } from '../src/database/schemas/doc-series.schema';

const TEST_SEED = 'phase08-integration-test-seed';
const TEST_JWT_SECRET = 'phase08-test-jwt-secret';

/**
 * Task 8: API Compatibility Spot-Check
 * Verifies that all response shapes match the Go backend format exactly.
 */
describe('API Compatibility Spot-Check', () => {
  let app: INestApplication;
  let db: any;
  let adminToken: string;
  const ts = Date.now();

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

    await app.init();

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

  describe('Album list response format', () => {
    it('returns { list, total, pageNum, pageSize }', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Object.keys(data).sort()).toEqual(['list', 'pageNum', 'pageSize', 'total'].sort());
    });
  });

  describe('AlbumResponse format', () => {
    it('has integer id, camelCase fields, computed widthAndHeight', async () => {
      // Create an album first to ensure there's data
      await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/compat-test-${ts}.jpg`,
          fileHash: `compat-test-hash-${ts}`,
          width: 1920,
          height: 1080,
        });

      const res = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      const album = res.body.data.list[0];
      expect(album).toBeDefined();

      // Integer ID (not Sqids string)
      expect(Number.isInteger(album.id)).toBe(true);

      // All camelCase fields present
      const expectedCamelCaseFields = [
        'id', 'categoryId', 'imageUrl', 'bigImageUrl', 'downloadUrl',
        'thumbParam', 'bigParam', 'tags', 'viewCount', 'downloadCount',
        'fileSize', 'format', 'aspectRatio', 'displayOrder',
        'title', 'description', 'location',
      ];
      for (const field of expectedCamelCaseFields) {
        expect(album).toHaveProperty(field);
      }

      // Snake_case date fields
      expect(album).toHaveProperty('created_at');
      expect(album).toHaveProperty('updated_at');
      expect(album).toHaveProperty('published_at');

      // width and height are numbers
      expect(typeof album.width).toBe('number');
      expect(typeof album.height).toBe('number');

      // Computed widthAndHeight string "WxH"
      expect(typeof album.widthAndHeight).toBe('string');
      if (album.widthAndHeight) {
        expect(album.widthAndHeight).toMatch(/^\d+x\d+$/);
      }

      // aspectRatio computed via GCD
      if (album.width > 0 && album.height > 0) {
        expect(album.aspectRatio).toBeTruthy();
      }
    });
  });

  describe('AlbumCategoryDTO format', () => {
    it('has integer id, name, description, displayOrder only', async () => {
      // Create a category first
      await supertest(app.getHttpServer())
        .post('/api/album-categories')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `compat-cat-${ts}`, description: 'test', displayOrder: 1 });

      const res = await supertest(app.getHttpServer())
        .get('/api/album-categories')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const cat = res.body.data[0];
      expect(cat).toBeDefined();

      // Integer ID
      expect(Number.isInteger(cat.id)).toBe(true);
      // Only allowed fields
      expect(Object.keys(cat).sort()).toEqual(['description', 'displayOrder', 'id', 'name'].sort());
      // No forbidden fields (Go backend doesn't have these)
      expect(cat).not.toHaveProperty('cover_url');
      expect(cat).not.toHaveProperty('sort');
      expect(cat).not.toHaveProperty('password');
      expect(cat).not.toHaveProperty('album_count');
    });
  });

  describe('DocSeriesResponse format', () => {
    it('has Sqids string id and snake_case date/cover_url/doc_count', async () => {
      // Create a doc series
      const createRes = await supertest(app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `compat-ds-${ts}`, description: 'test', sort: 1 });

      expect(createRes.status).toBe(201);
      const ds = createRes.body.data;

      // Sqids string ID
      expect(typeof ds.id).toBe('string');
      expect(ds.id.length).toBeGreaterThanOrEqual(4);

      // Snake_case fields matching Go JSON tags
      expect(ds).toHaveProperty('created_at');
      expect(ds).toHaveProperty('updated_at');
      expect(ds).toHaveProperty('name');
      expect(ds).toHaveProperty('description');
      expect(ds).toHaveProperty('cover_url');
      expect(ds).toHaveProperty('sort');
      expect(ds).toHaveProperty('doc_count');

      // Verify the Sqids ID can be decoded
      const decoded = decodePublicID(ds.id);
      expect(decoded.dbID).toBeGreaterThan(0);
      expect(decoded.entityType).toBe(EntityType.DocSeries);
    });
  });

  describe('DocSeriesListResponse format', () => {
    it('has { list, total, page, pageSize }', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/doc-series?page=1&pageSize=20')
        .set('authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Object.keys(data).sort()).toEqual(['list', 'page', 'pageSize', 'total'].sort());
      // Note: uses 'page' not 'pageNum' (different from album list)
    });
  });

  describe('DocSeriesWithArticles format', () => {
    it('includes articles array with DocArticleItem items', async () => {
      // Create a series
      const createRes = await supertest(app.getHttpServer())
        .post('/api/doc-series')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: `compat-ds-art-${ts}`, description: 'test', sort: 2 });

      const seriesId = createRes.body.data.id;

      const res = await supertest(app.getHttpServer())
        .get(`/api/public/doc-series/${seriesId}/articles`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // DocSeriesResponse fields present
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('cover_url');
      expect(data).toHaveProperty('sort');
      expect(data).toHaveProperty('doc_count');

      // Articles array
      expect(data).toHaveProperty('articles');
      expect(Array.isArray(data.articles)).toBe(true);
    });
  });

  describe('Response wrapper format', () => {
    it('wraps all responses as { code, message, data }', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/public/albums?page=1&pageSize=1');

      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('Error response format', () => {
    it('returns proper error for invalid stat type', async () => {
      // Get an album ID
      const listRes = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10')
        .set('authorization', `Bearer ${adminToken}`);

      const albumId = listRes.body.data.list[0]?.id;
      if (!albumId) return;

      const res = await supertest(app.getHttpServer())
        .put(`/api/public/stat/${albumId}?type=invalid`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
      expect(res.body.data).toBeNull();
    });

    it('returns 401 for admin endpoints without JWT', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/api/albums/get?page=1&pageSize=10');

      expect(res.status).toBe(401);
    });

    it('returns 409 for duplicate album fileHash', async () => {
      // Create first
      await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/dup-test-${ts}.jpg`,
          fileHash: `dup-test-hash-${ts}`,
        });

      // Try duplicate
      const res = await supertest(app.getHttpServer())
        .post('/api/albums/add')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          imageUrl: `https://example.com/dup-test2-${ts}.jpg`,
          fileHash: `dup-test-hash-${ts}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('已存在');
    });
  });
});
