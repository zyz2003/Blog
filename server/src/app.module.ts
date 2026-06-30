import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { validationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CaptchaModule } from './captcha/captcha.module';
import { ArticleModule } from './article/article.module';
import { SettingsModule } from './settings/settings.module';
import { PageModule } from './page/page.module';
import { FileModule } from './file/file.module';
import { CommentModule } from './comment/comment.module';
import { SearchModule } from './search/search.module';
import { StatisticsModule } from './statistics/statistics.module';
import { LinkModule } from './link/link.module';
import { AlbumModule } from './album/album.module';
import { DocSeriesModule } from './doc-series/doc-series.module';
import { RssModule } from './rss/rss.module';
import { SitemapModule } from './sitemap/sitemap.module';
import { MusicModule } from './music/music.module';
import { NotificationModule } from './notification/notification.module';
import { SubscriberModule } from './subscriber/subscriber.module';
import { ThumbnailModule } from './thumbnail/thumbnail.module';
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
    DatabaseModule,
    CommonModule,
    AuthModule,
    UserModule,
    CaptchaModule,
    SettingsModule,
    ArticleModule,
    PageModule,
    FileModule,
    CommentModule,
    SearchModule,
    StatisticsModule,
    LinkModule,
    AlbumModule,
    DocSeriesModule,
    RssModule,
    SitemapModule,
    MusicModule,
    NotificationModule,
    SubscriberModule,
    ThumbnailModule,
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
