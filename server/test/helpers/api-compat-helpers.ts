/**
 * Shared API compatibility test helpers.
 *
 * Provides TestContext interface, app bootstrap, data seeding,
 * JWT token generation, and response assertion utilities.
 * Consumed by all 11-02/03/04/05 API compat test files.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import * as bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../../src/app.module';
import { SettingsService } from '../../src/settings/settings.service';
import { initSqidsEncoderWithSeed, generatePublicID, EntityType } from '../../src/common/utils/sqids.util';
import { DRIZZLE } from '../../src/database/database.module';
import { users } from '../../src/database/schemas/user.schema';
import { userGroups } from '../../src/database/schemas/user-group.schema';
import { settings } from '../../src/database/schemas/setting.schema';

// ─── TestContext Interface ──────────────────────────────────────────────

export interface TestContext {
  app: INestApplication;
  db: any; // BetterSQLite3Database
  adminToken: string;
  request: (method: string) => supertest.Test; // bound to app
  ts: number; // unique timestamp for test data
}

// ─── Constants ──────────────────────────────────────────────────────────

const TEST_SEED = 'api-compat-test-seed';
const TEST_JWT_SECRET = 'api-compat-test-jwt-secret';
const ADMIN_PASSWORD = 'password123';

// ─── createTestApp ──────────────────────────────────────────────────────

export async function createTestApp(): Promise<TestContext> {
  // Initialize Sqids with test seed
  initSqidsEncoderWithSeed(TEST_SEED);

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api', {
    exclude: [
      'rss.xml',
      'feed.xml',
      'atom.xml',
      'sitemap.xml',
      'robots.txt',
      'needcache/download/:public_id',
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const db = app.get(DRIZZLE);

  // Seed base data
  await seedBaseData(db);

  // Initialize app (triggers onModuleInit hooks)
  await app.init();

  // Ensure SettingsService cache is loaded
  const settingsService = app.get(SettingsService);
  await settingsService.ensureLoaded();

  // Generate admin JWT token
  const adminToken = generateAdminToken(TEST_SEED, TEST_JWT_SECRET);

  const ts = Date.now();

  const request = (method: string): supertest.Test => {
    const server = app.getHttpServer();
    return supertest(server)[method as keyof supertest.SuperTest<any>]() as any;
  };

  return { app, db, adminToken, request, ts };
}

// ─── seedBaseData ───────────────────────────────────────────────────────

export async function seedBaseData(db: any): Promise<void> {
  // Insert user_groups (id=1, Admin)
  await db.insert(userGroups).values({
    id: 1,
    name: 'Admin',
    description: 'Admin group',
    permissions: JSON.stringify([0, 1, 2, 3]),
    maxStorage: 0,
    speedLimit: 0,
    settings: JSON.stringify({}),
  }).onConflictDoNothing().run();

  // Insert users (id=1, admin, hashed password)
  const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 10);
  await db.insert(users).values({
    id: 1,
    username: 'admin',
    passwordHash,
    email: 'admin@test.com',
    nickname: 'Admin',
    userGroupId: 1,
    status: 1,
  }).onConflictDoNothing().run();

  // Insert settings
  const settingsData = [
    { configKey: 'JWT_SECRET', value: TEST_JWT_SECRET },
    { configKey: 'id_seed', value: TEST_SEED },
    { configKey: 'APP_NAME', value: 'TestApp' },
    { configKey: 'captcha.provider', value: 'none' },
    { configKey: 'GRAVATAR_URL', value: 'https://cravatar.cn/avatar/' },
  ];

  for (const s of settingsData) {
    await db.insert(settings).values(s)
      .onConflictDoUpdate({ target: settings.configKey, set: { value: s.value } })
      .run();
  }
}

// ─── generateAdminToken ─────────────────────────────────────────────────

export function generateAdminToken(seed: string, jwtSecret: string): string {
  const userId = generatePublicID(1, EntityType.User);
  const groupId = generatePublicID(1, EntityType.UserGroup);

  return jwt.sign(
    {
      user_id: userId,
      user_group_id: groupId,
      permissions: [0, 1, 2, 3],
      iss: 'anheyu-app',
    },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
}

// ─── assertSuccessResponse ──────────────────────────────────────────────

export function assertSuccessResponse(res: supertest.Response, expectedCode = 200): void {
  expect(res.body).toHaveProperty('code', expectedCode);
  expect(res.body).toHaveProperty('message');
  expect(res.body).toHaveProperty('data');
}

// ─── assertPaginatedResponse ────────────────────────────────────────────

export function assertPaginatedResponse(
  res: supertest.Response,
  listKey = 'list',
  pageKey = 'pageNum',
): void {
  assertSuccessResponse(res);
  const data = res.body.data;
  expect(data).toHaveProperty(listKey);
  expect(data).toHaveProperty('total');
  expect(data).toHaveProperty(pageKey);
  expect(data).toHaveProperty('pageSize');
  expect(Array.isArray(data[listKey])).toBe(true);
}

// ─── assertErrorResponse ────────────────────────────────────────────────

export function assertErrorResponse(
  res: supertest.Response,
  status: number,
  code?: number,
): void {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('code');
  expect(res.body).toHaveProperty('message');
  if (code !== undefined) {
    expect(res.body.code).toBe(code);
  }
}

// ─── closeTestApp ───────────────────────────────────────────────────────

export async function closeTestApp(app: INestApplication): Promise<void> {
  if (app) {
    await app.close();
  }
}

// ─── uploadFile ─────────────────────────────────────────────────────────

export async function uploadFile(
  app: INestApplication,
  path: string,
  fieldName: string,
  buffer: Buffer,
  token?: string,
  extraFields?: Record<string, string>,
): Promise<supertest.Response> {
  let req = supertest(app.getHttpServer())
    .post(path)
    .attach(fieldName, buffer, 'test-file.png');

  if (token) {
    req = req.set('authorization', `Bearer ${token}`);
  }

  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      req = req.field(key, value);
    }
  }

  return req;
}

// ─── Exported constants for test files ──────────────────────────────────

export { TEST_SEED, TEST_JWT_SECRET, ADMIN_PASSWORD };
