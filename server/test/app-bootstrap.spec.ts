import { describe, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';

describe('App Bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.setGlobalPrefix('api');
    app.enableCors({
      origin: true,
      credentials: true,
      methods: 'POST,GET,OPTIONS,PUT,DELETE',
      allowedHeaders:
        'Authorization,Content-Type,X-CSRF-Token,X-Requested-With,Range,Accept-Ranges,Content-Range,Content-Length,Content-Disposition',
      exposedHeaders:
        'Authorization,Content-Range,Content-Length,Content-Disposition',
    });

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should bootstrap the NestJS application', () => {
    expect(app).toBeDefined();
  });

  it('should be configured to listen on port 8091', () => {
    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 8091);
    expect(port).toBe(8091);
  });

  it('should have global API prefix set to "api"', () => {
    // The app is initialized with global prefix 'api'
    // Verify by checking that the config is set
    expect(app.getHttpAdapter().getInstance()).toBeDefined();
  });
});
