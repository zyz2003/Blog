import { Controller, Get, Post, Body, Param, Res } from '@nestjs/common';
import { ThumbnailService } from './thumbnail.service';
import { Public } from '../common/decorators/public.decorator';
import * as fs from 'fs';

@Controller('thumbnail')
export class ThumbnailController {
  constructor(private readonly service: ThumbnailService) {}

  @Post('regenerate')
  async regenerateThumbnail(@Body() body: { id: string }) {
    return this.service.regenerateThumbnail(body.id);
  }

  @Post('regenerate/directory')
  async regenerateDirectoryThumbnails(
    @Body() body: { directoryId: string },
  ) {
    return this.service.regenerateDirectoryThumbnails(body.directoryId);
  }

  @Get(':publicID')
  async getThumbnailSign(@Param('publicID') publicID: string) {
    return this.service.getThumbnailSign(publicID);
  }
}

/**
 * Separate controller for the public thumbnail serving endpoint.
 * Registered at @Controller('t') per RESEARCH Section 5.
 */
@Controller('t')
export class ThumbnailPublicController {
  constructor(private readonly service: ThumbnailService) {}

  @Get(':signedToken')
  @Public()
  async handleThumbnailContent(
    @Param('signedToken') signedToken: string,
    @Res() res: any,
  ) {
    const { filePath, mimeType } =
      await this.service.serveThumbnailContent(signedToken);

    res.setHeader('Content-Type', mimeType);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
