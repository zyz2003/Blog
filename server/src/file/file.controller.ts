import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { FileService } from './file.service';
import { UploadService } from './upload.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateFileDto } from './dto/create-file.dto';
import { RenameItemDto } from './dto/rename-item.dto';
import { DeleteItemsDto } from './dto/delete-items.dto';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto';
import { FinalizeUploadDto } from './dto/finalize-upload.dto';
import { DeleteUploadSessionDto } from './dto/delete-upload-session.dto';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
import * as fs from 'fs';

/**
 * FileController at /api/file/*
 *
 * Route security matches Go backend (internal/infra/router/router.go):
 * - GET /api/file/content is @Public() (signed URL verification instead of JWT)
 * - All other endpoints require JWT (enforced by global JwtAuthGuard)
 *
 * Note: The Go router registers /file/content BEFORE applying JWTAuth() middleware,
 * making it publicly accessible. All other /file/* routes are inside the JWTAuth() group.
 */
@Controller('file')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly uploadService: UploadService,
  ) {}

  // ─── Upload endpoints (delegate to UploadService) ─────────

  @Put('upload')
  async createUploadSession(
    @Body() dto: CreateUploadSessionDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.uploadService.createSession(dto, ownerId);
  }

  @Get('upload/session/:sessionId')
  async getSessionStatus(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.uploadService.getSessionStatus(sessionId, ownerId);
  }

  @Post('upload/:sessionId/:index')
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @Param('index') indexStr: string,
    @Req() request: any,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    const index = parseInt(indexStr, 10);
    const body: Buffer = request.body;
    return this.uploadService.uploadChunk(sessionId, index, body, ownerId);
  }

  @Post('upload/finalize')
  async finalizeClientUpload(
    @Body() dto: FinalizeUploadDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.uploadService.finalizeClientUpload(dto, ownerId);
  }

  @Delete('upload')
  async deleteUploadSession(
    @Body() dto: DeleteUploadSessionDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.uploadService.deleteSession(dto, ownerId);
  }

  // ─── File query endpoints ─────────────────────────────────

  @Get()
  async getFilesByPath(
    @Query('uri') uri: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ) {
    // Default URI matching Go backend: c.DefaultQuery("uri", "anzhiyu://my/")
    const resolvedUri = uri || 'anzhiyu://my/';
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.getFilesByPath(resolvedUri, ownerId, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      orderBy: query.order_by,
      orderDirection: query.order_direction,
    });
  }

  @Get('download/:id')
  async downloadFile(
    @Param('id') publicID: string,
    @Res() res: any,
  ) {
    const { filePath, fileName, mimeType, size } =
      await this.fileService.downloadFile(publicID);

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Content-Length', size);

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err: any) => {
      if (!res.headersSent) {
        res.status(404).json({ code: 404, message: '文件不存在', data: null });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  }

  @Get('download-info/:id')
  async getDownloadInfo(@Param('id') publicID: string) {
    return this.fileService.getDownloadInfo(publicID);
  }

  @Get('preview-urls')
  async getPreviewURLs(
    @Query('id') publicID: string,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.getPreviewURLs(publicID, ownerId);
  }

  @Get('content')
  @Public()
  async serveSignedContent(
    @Query('sign') sign: string,
    @Res() res: any,
  ) {
    const { filePath, mimeType } =
      await this.fileService.serveSignedContent(sign);

    res.setHeader('Content-Type', mimeType);
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

  @Get(':id')
  async getFileInfo(@Param('id') publicID: string) {
    return this.fileService.getFileInfo(publicID);
  }

  // ─── File operation endpoints ─────────────────────────────

  @Post('create')
  async createEmptyFile(
    @Body() dto: CreateFileDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.createEmptyFile(dto, ownerId);
  }

  @Put('content/:publicID')
  async updateFileContent(
    @Param('publicID') publicID: string,
    @Query('uri') uri: string,
    @Req() request: any,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    const content: Buffer = request.body;
    return this.fileService.updateFileContent(publicID, uri, content, ownerId);
  }

  @Delete()
  async deleteItems(
    @Body() dto: DeleteItemsDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.deleteItems(dto.ids, ownerId);
  }

  @Put('rename')
  async renameItem(
    @Body() dto: RenameItemDto,
    @CurrentUser() user: any,
  ) {
    const ownerId = this.extractOwnerDbId(user);
    return this.fileService.renameItem(dto.id, dto.new_name, ownerId);
  }

  private extractOwnerDbId(user: any): number {
    if (!user) return 1;
    if (user.dbId) return user.dbId;
    if (user.id) {
      try {
        const { dbID, entityType } = decodePublicID(user.id);
        if (entityType === EntityType.User) return dbID;
      } catch {
        // Not a Sqids ID
      }
    }
    return 1;
  }
}
