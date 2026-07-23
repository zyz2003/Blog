import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ArticleController } from './article.controller';
import { PublicArticleController } from './public-article.controller';
import { ArticleService } from './article.service';
import { ArticleRepository } from './article.repository';
import { PostCategoryModule } from '../post-category/post-category.module';
import { PostTagModule } from '../post-tag/post-tag.module';
import { ArticleHistoryModule } from '../article-history/article-history.module';
import { StoragePolicyModule } from '../storage-policy/storage-policy.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { SearchModule } from '../search/search.module';
import { RssModule } from '../rss/rss.module';
import { DirectLinkModule } from '../direct-link/direct-link.module';

@Module({
  imports: [
    DatabaseModule,
    PostCategoryModule,
    PostTagModule,
    ArticleHistoryModule,
    StoragePolicyModule,
    ThumbnailModule,
    SearchModule,
    forwardRef(() => RssModule),
    forwardRef(() => DirectLinkModule),
  ],
  controllers: [ArticleController, PublicArticleController],
  providers: [ArticleService, ArticleRepository],
  exports: [ArticleService],
})
export class ArticleModule {}
