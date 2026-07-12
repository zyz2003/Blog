import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DocSeriesService } from './doc-series.service';
import { DocSeriesRepository } from './doc-series.repository';
import { DocSeriesController } from './doc-series.controller';

/**
 * DocSeriesModule — wires doc series service, repository, and controller.
 *
 * Imports:
 * - DatabaseModule: provides DRIZZLE injection token for DB queries
 *
 * Controllers:
 * - DocSeriesController: admin + public endpoints for doc series CRUD
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
  controllers: [DocSeriesController],
  providers: [DocSeriesService, DocSeriesRepository],
  exports: [DocSeriesService],
})
export class DocSeriesModule {}
