import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { SettingsModule } from '../settings/settings.module';
import { ArticleModule } from '../article/article.module';
import { RssController } from './rss.controller';
import { RssService } from './rss.service';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    SettingsModule,
    forwardRef(() => ArticleModule),
  ],
  controllers: [RssController],
  providers: [RssService],
  exports: [RssService],
})
export class RssModule {}
