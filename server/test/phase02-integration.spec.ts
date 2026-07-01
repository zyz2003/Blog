import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SettingsService } from '../src/settings/settings.service';
import { initSqidsEncoderWithSeed, generatePublicID, EntityType } from '../src/common/utils/sqids.util';
import { DRIZZLE } from '../src/database/database.module';
import { users } from '../src/database/schemas/user.schema';
import { userGroups } from '../src/database/schemas/user-group.schema';
import { settings } from '../src/database/schemas/setting.schema';
import { INestApplication } from '@nestjs/common';

const TEST_SEED = 'integration-test-seed';
const TEST_JWT_SECRET = 'test-jwt-secret-key';

describe('Phase 02 Integration', () => {
  let app: INestApplication;
  let db: any;

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
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('POST /api/auth/login returns correct structure', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    expect(res.status).toBe(201);
    const body = res.body;
    expect(body.data).toHaveProperty('userInfo');
    expect(body.data).toHaveProperty('accessToken');
    expect(body.data).toHaveProperty('refreshToken');
    expect(body.data).toHaveProperty('expires');
  });

  it('userInfo.id is public ID string, userInfo.userGroupID is raw DB ID number', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    const userInfo = res.body.data.userInfo;
    expect(typeof userInfo.id).toBe('string');
    expect(typeof userInfo.userGroupID).toBe('number');
    expect(userInfo.userGroupID).toBe(1);
  });

  it('GET /api/user/info with valid JWT returns user profile', async () => {
    const loginRes = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    const token = loginRes.body.data.accessToken;
    const res = await supertest(app.getHttpServer())
      .get('/api/user/info')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('username', 'admin');
  });

  it('POST /api/auth/refresh-token returns new accessToken', async () => {
    const loginRes = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    const refreshToken = loginRes.body.data.refreshToken;
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/refresh-token')
      .send({ refreshToken });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('Go-issued JWT token is accepted by NestJS JwtStrategy', async () => {
    const userId = generatePublicID(1, EntityType.User);
    const groupId = generatePublicID(1, EntityType.UserGroup);
    const goToken = jwt.sign(
      { user_id: userId, user_group_id: groupId, permissions: [0,1,2,3], iss: 'anheyu-app' },
      TEST_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    const res = await supertest(app.getHttpServer())
      .get('/api/user/info')
      .set('authorization', `Bearer ${goToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/public/site-config returns unflattened public settings', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/public/site-config');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('_config_version');
  });

  it('GET /api/public/captcha/config returns provider config', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/public/captcha/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('provider');
  });

  it('GET /api/public/site-config/version returns version number', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/public/site-config/version');
    expect(res.status).toBe(200);
    expect(typeof res.body.data.version).toBe('number');
  });

  it('Login with wrong password returns 401', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('Access protected endpoint without JWT returns 401', async () => {
    const res = await supertest(app.getHttpServer())
      .get('/api/user/info');
    expect(res.status).toBe(401);
  });

  it('bcryptjs compatibility: hash and verify match', async () => {
    const hash = await bcryptjs.hash('test123', 10);
    expect(await bcryptjs.compare('test123', hash)).toBe(true);
  });
});
