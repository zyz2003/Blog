import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AlbumService } from './album.service';
import { AlbumCategoryService } from './album-category.service';
import { AlbumRepository } from './album.repository';
import { AlbumCategoryRepository } from './album-category.repository';
import { PostTagModule } from '../post-tag/post-tag.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';

@Module({
  imports: [
    DatabaseModule,
    PostTagModule,
    // forwardRef to handle potential circular dependency with ThumbnailModule
    forwardRef(() => ThumbnailModule),
  ],
  providers: [
    AlbumService,
    AlbumCategoryService,
    AlbumRepository,
    AlbumCategoryRepository,
  ],
  exports: [AlbumService, AlbumCategoryService, AlbumRepository, AlbumCategoryRepository],
})
export class AlbumModule {}
