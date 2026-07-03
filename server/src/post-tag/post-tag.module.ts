import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PostTagController } from './post-tag.controller';
import { PostTagService } from './post-tag.service';
import { PostTagRepository } from './post-tag.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [PostTagController],
  providers: [PostTagService, PostTagRepository],
  exports: [PostTagService, PostTagRepository],
})
export class PostTagModule {}
