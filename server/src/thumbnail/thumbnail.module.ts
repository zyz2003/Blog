import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FileModule } from '../file/file.module';
import { ThumbnailController, ThumbnailPublicController } from './thumbnail.controller';
import { ThumbnailService } from './thumbnail.service';

@Module({
  imports: [
    DatabaseModule,
    // Circular dependency: ThumbnailModule provides ThumbnailService which needs FileService
    // FileModule provides UploadService which needs ThumbnailService
    // Resolved via forwardRef
    forwardRef(() => FileModule),
  ],
  controllers: [ThumbnailController, ThumbnailPublicController],
  providers: [ThumbnailService],
  exports: [ThumbnailService],
})
export class ThumbnailModule {}
