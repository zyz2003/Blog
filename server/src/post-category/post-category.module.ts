import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PostCategoryController } from './post-category.controller';
import { PostCategoryService } from './post-category.service';
import { PostCategoryRepository } from './post-category.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [PostCategoryController],
  providers: [PostCategoryService, PostCategoryRepository],
  exports: [PostCategoryService],
})
export class PostCategoryModule {}
