import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ArticleController } from './article.controller';
import { PublicArticleController } from './public-article.controller';
import { ArticleService } from './article.service';
import { ArticleRepository } from './article.repository';
import { PostCategoryModule } from '../post-category/post-category.module';
import { PostTagModule } from '../post-tag/post-tag.module';

@Module({
  imports: [DatabaseModule, PostCategoryModule, PostTagModule],
  controllers: [ArticleController, PublicArticleController],
  providers: [ArticleService, ArticleRepository],
  exports: [ArticleService],
})
export class ArticleModule {}
