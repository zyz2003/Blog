import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { StoragePolicyModule } from '../storage-policy/storage-policy.module';
import { FileModule } from '../file/file.module';
import { CommentController } from './comment.controller';
import { CommentAdminController } from './comment-admin.controller';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';
import { CommentRateLimiter } from './comment-rate-limiter';

/**
 * CommentModule — wires all comment-related controllers, services, and dependencies.
 *
 * Imports:
 * - DatabaseModule: provides DRIZZLE injection token for direct DB queries
 * - SettingsModule: provides SettingsService (also @Global, but explicit import for clarity)
 * - StoragePolicyModule: provides StoragePolicyService for upload policy lookup
 * - FileModule: provides UploadService and FileService for comment image uploads
 *   and signed URL generation. Uses forwardRef to handle potential circular dependency.
 *
 * WeatherModule (providing GeoIPService) is NOT imported — CommentService uses
 * @Optional() injection for GeoIPService with a direct HTTP fallback per D-143.
 * WeatherModule will be imported in Plan 05 when available.
 */
@Module({
  imports: [
    DatabaseModule,
    SettingsModule,
    StoragePolicyModule,
    forwardRef(() => FileModule),
  ],
  controllers: [CommentController, CommentAdminController],
  providers: [CommentService, CommentRepository, CommentRateLimiter],
  exports: [CommentService],
})
export class CommentModule {}
