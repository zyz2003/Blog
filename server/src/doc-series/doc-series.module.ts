import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DocSeriesService } from './doc-series.service';
import { DocSeriesRepository } from './doc-series.repository';

/**
 * DocSeriesModule — wires doc series service and repository.
 *
 * Imports:
 * - DatabaseModule: provides DRIZZLE injection token for DB queries
 *
 * Providers:
 * - DocSeriesRepository: Drizzle query methods for doc series CRUD
 * - DocSeriesService: business logic for doc series operations
 *
 * Exports:
 * - DocSeriesService: for ArticleService to update doc_count on link/unlink
 */
@Module({
  imports: [DatabaseModule],
  providers: [DocSeriesService, DocSeriesRepository],
  exports: [DocSeriesService],
})
export class DocSeriesModule {}
