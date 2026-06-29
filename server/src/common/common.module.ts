import { Module } from '@nestjs/common';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthOptionalGuard } from './guards/jwt-auth-optional.guard';
import { AdminGuard } from './guards/admin.guard';
import { MemoryCache } from './cache/memory-cache.util';

/**
 * CommonModule exports all shared providers for use across feature modules.
 *
 * Note: Global registration (APP_GUARD, APP_INTERCEPTOR) will happen in
 * app.module.ts wiring in Plan 06, not here. CommonModule just provides
 * the classes for injection.
 */
@Module({
  providers: [
    ResponseInterceptor,
    JwtAuthGuard,
    JwtAuthOptionalGuard,
    AdminGuard,
    {
      provide: MemoryCache,
      useFactory: () => new MemoryCache(),
    },
  ],
  exports: [
    ResponseInterceptor,
    JwtAuthGuard,
    JwtAuthOptionalGuard,
    AdminGuard,
    MemoryCache,
  ],
})
export class CommonModule {}
