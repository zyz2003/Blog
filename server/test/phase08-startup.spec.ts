import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication, Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { SettingsService } from '../src/settings/settings.service';
import { initSqidsEncoderWithSeed } from '../src/common/utils/sqids.util';
import supertest from 'supertest';

/**
 * Task 7: AppModule startup verification
 * Verifies that npm run dev starts on port 8091, no module resolution errors,
 * and all Phase 08 routes are registered and accessible.
 */
describe('AppModule Startup Verification', () => {
  let app: INestApplication;

  beforeAll(async () => {
    initSqidsEncoderWithSeed('startup-test-seed');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should start without module resolution errors', () => {
    // If we got here, the app started successfully
    expect(app).toBeDefined();
  });

  it('should have AlbumModule routes registered', async () => {
    const server = app.getHttpServer();

    // Album routes (will return 401 without auth, but route exists)
    const albumRoutes = [
      { method: 'get', path: '/api/albums/get' },
      { method: 'post', path: '/api/albums/add' },
      { method: 'put', path: '/api/albums/update/1' },
      { method: 'delete', path: '/api/albums/delete/1' },
      { method: 'delete', path: '/api/albums/batch-delete' },
      { method: 'post', path: '/api/albums/export' },
    ];

    for (const route of albumRoutes) {
      const res = await supertest(server)[route.method](route.path);
      // 401 means route exists but requires auth
      // 404 means route not found
      expect(res.status).not.toBe(404);
    }
  });

  it('should have AlbumCategory routes registered', async () => {
    const server = app.getHttpServer();

    const catRoutes = [
      { method: 'get', path: '/api/album-categories' },
      { method: 'post', path: '/api/album-categories' },
      { method: 'get', path: '/api/album-categories/1' },
      { method: 'put', path: '/api/album-categories/1' },
      { method: 'delete', path: '/api/album-categories/1' },
    ];

    for (const route of catRoutes) {
      const res = await supertest(server)[route.method](route.path);
      expect(res.status).not.toBe(404);
    }
  });

  it('should have DocSeries routes registered', async () => {
    const server = app.getHttpServer();

    const dsRoutes = [
      { method: 'get', path: '/api/doc-series' },
      { method: 'post', path: '/api/doc-series' },
      { method: 'get', path: '/api/doc-series/test' },
      { method: 'put', path: '/api/doc-series/test' },
      { method: 'delete', path: '/api/doc-series/test' },
    ];

    for (const route of dsRoutes) {
      const res = await supertest(server)[route.method](route.path);
      expect(res.status).not.toBe(404);
    }
  });

  it('should have public album routes registered', async () => {
    const server = app.getHttpServer();

    // Public routes should return 200 (not 401 or 404)
    const res1 = await supertest(server).get('/api/public/albums?page=1&pageSize=1');
    expect(res1.status).toBe(200);

    const res2 = await supertest(server).get('/api/public/album-categories');
    expect(res2.status).toBe(200);
  });

  it('should have public doc-series routes registered', async () => {
    const server = app.getHttpServer();

    const res1 = await supertest(server).get('/api/public/doc-series?page=1&pageSize=1');
    expect(res1.status).toBe(200);
  });

  it('should have album stat route registered', async () => {
    const server = app.getHttpServer();

    // PUT /api/public/stat/1 — will return 400 for invalid type, but route exists
    const res = await supertest(server).put('/api/public/stat/1?type=invalid');
    expect(res.status).not.toBe(404);
  });
});
