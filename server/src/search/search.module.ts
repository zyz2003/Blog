import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';

/**
 * SearchModule provides FTS5 full-text search functionality.
 * Per D-158: Contains SearchController and SearchService.
 * SearchService is exported for ArticleService FTS5 hooks (Plan 05).
 * Per D-150: SearchService.ensureFts5Table runs on module init.
 */
@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
