import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { validationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CaptchaModule } from './captcha/captcha.module';
import { ArticleModule } from './article/article.module';
import { ArticleHistoryModule } from './article-history/article-history.module';
import { PostCategoryModule } from './post-category/post-category.module';
import { PostTagModule } from './post-tag/post-tag.module';
import { SettingsModule } from './settings/settings.module';
import { PageModule } from './page/page.module';
import { VersionModule } from './version/version.module';
import { FileModule } from './file/file.module';
import { StoragePolicyModule } from './storage-policy/storage-policy.module';
import { ThumbnailModule } from './thumbnail/thumbnail.module';
import { DirectLinkModule } from './direct-link/direct-link.module';
import { CommentModule } from './comment/comment.module';
import { SearchModule } from './search/search.module';
import { WeatherModule } from './weather/weather.module';
import { StatisticsModule } from './statistics/statistics.module';
import { LinkModule } from './link/link.module';
import { AlbumModule } from './album/album.module';
import { DocSeriesModule } from './doc-series/doc-series.module';
import { RssModule } from './rss/rss.module';
import { SitemapModule } from './sitemap/sitemap.module';
import { MusicModule } from './music/music.module';
import { NotificationModule } from './notification/notification.module';
import { SubscriberModule } from './subscriber/subscriber.module';
import { EmailModule } from './email/email.module';
import { ConfigFeatureModule } from './config-module/config.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    // Phase 10 — Scheduled Tasks: register NestJS schedule module before feature modules
    NestScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    AuthModule,
    UserModule,
    CaptchaModule,
    SettingsModule,
    ArticleModule,
    ArticleHistoryModule,
    PostCategoryModule,
    PostTagModule,
    PageModule,
    VersionModule,
    // Phase 05 — File Upload & Media
    StoragePolicyModule,
    FileModule,
    ThumbnailModule,
    DirectLinkModule,
    // Static file serving for uploaded files per D-114
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'data', 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        maxAge: 86400000, // 24h cache
      },
    }),
    CommentModule,
    SearchModule,
    WeatherModule,
    StatisticsModule,
    LinkModule,
    AlbumModule,
    DocSeriesModule,
    RssModule,
    SitemapModule,
    MusicModule,
    NotificationModule,
    SubscriberModule,
    EmailModule,
    ConfigFeatureModule,
  ],
  providers: [
    // ThrottlerGuard runs before auth — rate limiting before JWT validation
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global auth guard -- all routes require JWT by default
    // Public routes use @Public() decorator to skip auth (per D-08)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global response interceptor -- wraps all returns as { code, message, data } (per D-10)
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Global exception filter -- formats errors as { code, message, data: null } (per D-04)
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
