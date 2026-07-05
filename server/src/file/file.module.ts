import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StoragePolicyModule } from '../storage-policy/storage-policy.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { FileController } from './file.controller';
import { FolderController } from './folder.controller';
import { FileService } from './file.service';
import { FileRepository } from './file.repository';
import { UploadService } from './upload.service';

@Module({
  imports: [
    DatabaseModule,
    StoragePolicyModule,
    // Circular dependency: FileModule provides UploadService which needs ThumbnailService
    // ThumbnailModule provides ThumbnailService which needs FileService
    // Resolved via forwardRef per D-103/D-106
    forwardRef(() => ThumbnailModule),
  ],
  controllers: [FileController, FolderController],
  providers: [FileService, FileRepository, UploadService],
  exports: [FileService, UploadService],
})
export class FileModule {}
