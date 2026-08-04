import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FileModule } from '../file/file.module';
import { ImageLibraryController } from './image-library.controller';
import { ImageLibraryService } from './image-library.service';

/**
 * 图片库模块 - 独立于直链系统，提供图片列表 + inline 显示端点。
 * 出问题注释 app.module.ts 里此模块一行即可禁用，不影响现有功能。
 */
@Module({
  imports: [DatabaseModule, FileModule],
  controllers: [ImageLibraryController],
  providers: [ImageLibraryService],
})
export class ImageLibraryModule {}
