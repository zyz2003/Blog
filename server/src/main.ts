import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

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
      'Authorization,Content-Range,Content-Length,Content-Disposition',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 8091);

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/api`);
}

bootstrap();
