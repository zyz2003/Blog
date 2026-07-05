import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ThumbnailController, ThumbnailPublicController } from './thumbnail.controller';
import { ThumbnailService } from './thumbnail.service';

@Module({
  imports: [
    DatabaseModule,
    // forwardRef to FileModule will be added in Plan 05-05 for circular dependency
  ],
  controllers: [ThumbnailController, ThumbnailPublicController],
  providers: [ThumbnailService],
  exports: [ThumbnailService],
})
export class ThumbnailModule {}
