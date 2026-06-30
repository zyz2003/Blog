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
  app.setGlobalPrefix('api');

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
  // Must run after SettingsService.onModuleInit() loads cache
  const settingsService = app.get(SettingsService);
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
