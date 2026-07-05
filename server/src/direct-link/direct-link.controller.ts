import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { DirectLinkService } from './direct-link.service';
import { FileService } from '../file/file.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ErrorCodes } from '../common/constants/error-codes';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';

@Controller('direct-links')
export class DirectLinkController {
  constructor(private readonly service: DirectLinkService) {}

  @Post()
  async createDirectLinks(
    @Body() body: { file_ids: string[] },
    @CurrentUser() user: any,
  ) {
    const ownerId = user?.dbId || 1;
    return this.service.createDirectLinks(body.file_ids, ownerId);
  }
}

/**
 * Public short-link download controller.
 * Routes:
 * - GET /api/f/:publicID/*filename — direct download via short-link
 */
@Controller('f')
export class DirectLinkPublicController {
  constructor(private readonly service: DirectLinkService) {}

  @Get(':publicID')
  @Get(':publicID/*filename')
  @Public()
  async handleDirectDownload(
    @Param('publicID') publicID: string,
    @Param('0') filename: string,
    @Res() res: any,
  ) {
    const { filePath, fileName, mimeType, size } =
      await this.service.handleDirectDownload(publicID, filename);

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Content-Length', size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

/**
 * /needcache/download/:public_id compatibility route per RESEARCH Open Question 4.
 * Registered outside the /api group for CDN compatibility.
 */
@Controller('needcache/download')
export class NeedcacheDownloadController {
  constructor(
    private readonly fileService: FileService,
  ) {}

  @Get(':public_id')
  @Public()
  async handleSignedDownload(
    @Param('public_id') publicId: string,
    @Query('sign') sign: string,
    @Res() res: any,
  ) {
    if (!sign) {
      throw new BadRequestException(ErrorCodes.SIGNED_URL_INVALID);
    }

    const { filePath, mimeType } =
      await this.fileService.serveSignedContent(sign);

    res.setHeader('Content-Type', mimeType);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
