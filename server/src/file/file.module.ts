import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StoragePolicyModule } from '../storage-policy/storage-policy.module';
import { FileController } from './file.controller';
import { FolderController } from './folder.controller';
import { FileService } from './file.service';
import { FileRepository } from './file.repository';
import { UploadService } from './upload.service';

@Module({
  imports: [
    DatabaseModule,
    StoragePolicyModule,
    // Circular dependency: ThumbnailModule needed for post-upload thumbnail generation
    // forwardRef will be added in Plan 05-05 when ThumbnailModule is wired
  ],
  controllers: [FileController, FolderController],
  providers: [FileService, FileRepository, UploadService],
  exports: [FileService, UploadService],
})
export class FileModule {}
