import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ImageLibraryService } from './image-library.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as fs from 'fs';

/**
 * 图片库控制器。
 * - GET /api/image-library        列出图片（需 JWT）
 * - GET /api/image-library/img/:id  inline 显示原图（公开）
 * - GET /api/image-library/thumb/:id inline 显示缩略图（公开）
 *
 * 独立于直链系统（/api/f/:id），不影响现有下载功能。
 */
@Controller('image-library')
export class ImageLibraryController {
  constructor(private readonly service: ImageLibraryService) {}

  @Get()
  async listImages(
    @Query('page') page: string = '1',
    @Query('keyword') keyword: string = '',
    @CurrentUser() user: any,
  ) {
    return this.service.listImages(
      parseInt(page, 10) || 1,
      keyword,
    );
  }

  @Get('img/:publicID')
  @Public()
  async serveImage(@Param('publicID') publicID: string, @Res() res: any) {
    const { filePath, fileName, mimeType } =
      await this.service.serveImage(publicID);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ code: 404, message: '文件不存在', data: null });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  }

  @Get('thumb/:publicID')
  @Public()
  async serveThumbnail(
    @Param('publicID') publicID: string,
    @Res() res: any,
  ) {
    const { filePath, mimeType } =
      await this.service.serveThumbnail(publicID);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ code: 404, message: '缩略图不存在', data: null });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  }
}
