import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FileModule } from '../file/file.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import {
  DirectLinkController,
  DirectLinkPublicController,
  NeedcacheDownloadController,
} from './direct-link.controller';
import { DirectLinkService } from './direct-link.service';

@Module({
  imports: [
    DatabaseModule,
    FileModule,
    ThumbnailModule,
  ],
  controllers: [
    DirectLinkController,
    DirectLinkPublicController,
    NeedcacheDownloadController,
  ],
  providers: [DirectLinkService],
  exports: [DirectLinkService],
})
export class DirectLinkModule {}
