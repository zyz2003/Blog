import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ArticleHistoryController } from './article-history.controller';
import { ArticleHistoryService } from './article-history.service';
import { ArticleHistoryRepository } from './article-history.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ArticleHistoryController],
  providers: [ArticleHistoryService, ArticleHistoryRepository],
  exports: [ArticleHistoryService],
})
export class ArticleHistoryModule {}
