import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SettingsService } from './settings/settings.service';
import { initSqidsEncoderWithSeed } from './common/utils/sqids.util';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix matching Go backend router -- all routes are /api/*
  // Exclude RSS/Sitemap/robots.txt routes which are served at root (no /api/ prefix)
  // matching Go backend routing: /rss.xml, /feed.xml, /atom.xml, /sitemap.xml, /robots.txt
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

  // CORS configuration matching Go backend cors.go
  app.enableCors({
    origin: true, // Development default; will be refined with settings from DB
    credentials: true,
    methods: 'POST,GET,OPTIONS,PUT,DELETE',
    allowedHeaders:
      'Authorization,Content-Type,X-CSRF-Token,X-Requested-With,Range,Accept-Ranges,Content-Range,Content-Length,Content-Disposition',
    exposedHeaders:
      'Authorization,Content-Range,Content-Length,Content-Length,Content-Disposition',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Initialize Sqids encoder with seed from settings table
  // Must run after SettingsService cache is loaded.
  // ensureLoaded() is idempotent — no-ops if onModuleInit already completed.
  const settingsService = app.get(SettingsService);
  await settingsService.ensureLoaded();
  const idSeed = settingsService.get('id_seed');
  if (idSeed) {
    initSqidsEncoderWithSeed(idSeed);
    logger.log('Sqids encoder initialized with seed from settings');
  } else {
    logger.warn('No id_seed found in settings — Sqids encoder not initialized');
  }

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 8091);

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/api`);
}

bootstrap();
