import { Module } from '@nestjs/common';
import { PageController } from './page.controller';
import { PublicPageController } from './public-page.controller';
import { PageService } from './page.service';
import { PageRepository } from './page.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PageController, PublicPageController],
  providers: [PageService, PageRepository],
  exports: [PageService],
})
export class PageModule {}
