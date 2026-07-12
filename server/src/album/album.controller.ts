import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AlbumService, ImportAlbumResult } from './album.service';
import { FindAlbumsQueryDto } from './dto/find-albums-query.dto';
import { CreateAlbumDto } from './dto/create-album-request.dto';
import { UpdateAlbumDto } from './dto/update-album-request.dto';
import { BatchImportRequestDto } from './dto/batch-import-request.dto';
import { BatchDeleteRequestDto } from './dto/batch-delete-request.dto';
import { ExportAlbumsRequestDto } from './dto/export-albums-request.dto';
import { ImportAlbumsQueryDto } from './dto/import-albums-query.dto';
import { AdminGuard } from '../common/guards/admin.guard';

/**
 * AlbumController — admin endpoints for album management.
 * All routes require JWT auth (global guard) + AdminGuard.
 *
 * Route patterns match Go backend exactly:
 * - GET    /api/albums/get          — getAlbums
 * - POST   /api/albums/add          — addAlbum
 * - POST   /api/albums/batch-import — batchImport
 * - PUT    /api/albums/update/:id   — updateAlbum
 * - DELETE /api/albums/delete/:id   — deleteAlbum
 * - DELETE /api/albums/batch-delete — batchDeleteAlbums
 * - POST   /api/albums/export       — exportAlbums (file download)
 * - POST   /api/albums/import       — importAlbums (multipart upload)
 */
@Controller()
@UseGuards(AdminGuard)
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  /**
   * GET /api/albums/get
   * Get paginated album list with filters.
   * Matches Go GetAlbums (handler.go).
   */
  @Get('albums/get')
  async getAlbums(@Query() query: FindAlbumsQueryDto) {
    return this.albumService.findAlbums({
      page: query.page || 1,
      pageSize: query.pageSize || 10,
      categoryId: query.categoryId,
      tag: query.tag,
      createdAtStart: query.createdAt?.[0],
      createdAtEnd: query.createdAt?.[1],
      sort: query.sort,
    });
  }

  /**
   * POST /api/albums/add
   * Add a new album image.
   * Matches Go AddAlbum (handler.go).
   * Returns null with message "添加成功".
   */
  @Post('albums/add')
  async addAlbum(@Body() dto: CreateAlbumDto) {
    await this.albumService.createAlbum({
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl,
      bigImageUrl: dto.bigImageUrl,
      downloadUrl: dto.downloadUrl,
      thumbParam: dto.thumbParam,
      bigParam: dto.bigParam,
      tags: dto.tags,
      width: dto.width,
      height: dto.height,
      fileSize: dto.fileSize,
      format: dto.format,
      fileHash: dto.fileHash,
      displayOrder: dto.displayOrder,
      title: dto.title,
      description: dto.description,
      location: dto.location,
      createdAt: dto.created_at ? new Date(dto.created_at) : undefined,
      publishedAt: dto.published_at === null ? null : dto.published_at ? new Date(dto.published_at) : undefined,
    });
    return { data: null, message: '添加成功' };
  }

  /**
   * POST /api/albums/batch-import
   * Batch import images from URLs.
   * Matches Go BatchImportAlbums (handler.go).
   */
  @Post('albums/batch-import')
  async batchImport(@Body() dto: BatchImportRequestDto) {
    return this.albumService.batchImportAlbums({
      categoryId: dto.categoryId,
      urls: dto.urls,
      thumbParam: dto.thumbParam,
      bigParam: dto.bigParam,
      tags: dto.tags,
      displayOrder: dto.displayOrder,
    });
  }

  /**
   * PUT /api/albums/update/:id
   * Update an album image.
   * Matches Go UpdateAlbum (handler.go).
   * Returns null with message "更新成功".
   */
  @Put('albums/update/:id')
  async updateAlbum(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlbumDto,
  ) {
    await this.albumService.updateAlbum(id, {
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl,
      bigImageUrl: dto.bigImageUrl,
      downloadUrl: dto.downloadUrl,
      thumbParam: dto.thumbParam,
      bigParam: dto.bigParam,
      tags: dto.tags,
      displayOrder: dto.displayOrder,
      title: dto.title,
      description: dto.description,
      location: dto.location,
      publishedAt: dto.published_at === null ? null : dto.published_at ? new Date(dto.published_at) : undefined,
    });
    return { data: null, message: '更新成功' };
  }

  /**
   * DELETE /api/albums/delete/:id
   * Soft delete an album image.
   * Matches Go DeleteAlbum (handler.go).
   * Returns null with message "删除成功".
   */
  @Delete('albums/delete/:id')
  async deleteAlbum(@Param('id', ParseIntPipe) id: number) {
    await this.albumService.deleteAlbum(id);
    return { data: null, message: '删除成功' };
  }

  /**
   * DELETE /api/albums/batch-delete
   * Batch soft delete album images.
   * Matches Go BatchDeleteAlbums (handler.go).
   * CRITICAL: Must be defined BEFORE any parametric delete route.
   */
  @Delete('albums/batch-delete')
  async batchDeleteAlbums(@Body() dto: BatchDeleteRequestDto) {
    return this.albumService.batchDeleteAlbums(dto.ids);
  }

  /**
   * POST /api/albums/export
   * Export albums as JSON or ZIP file download.
   * Matches Go ExportAlbums (handler.go).
   * Uses @Res() to bypass ResponseInterceptor for file downloads.
   */
  @Post('albums/export')
  async exportAlbums(
    @Body() dto: ExportAlbumsRequestDto,
    @Res() res: Response,
  ) {
    const format = dto.format || 'json';

    if (format === 'zip') {
      const zipBuffer = await this.albumService.exportAlbumsToZip(dto.album_ids);
      const filename = `albums-export-${Date.now()}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(zipBuffer);
      return;
    }

    // JSON format
    const exportData = await this.albumService.exportAlbums(dto.album_ids);
    const filename = `albums-export-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(exportData, null, 2));
  }

  /**
   * POST /api/albums/import
   * Import albums from JSON or ZIP file upload.
   * Matches Go ImportAlbums (handler.go).
   * Uses FileInterceptor for multipart upload with form fields.
   */
  @Post('albums/import')
  @UseInterceptors(FileInterceptor('file'))
  async importAlbums(
    @UploadedFile() file: Express.Multer.File,
    @Body() formFields: ImportAlbumsQueryDto,
  ) {
    if (!file) {
      throw new Error('未选择文件');
    }

    const req = {
      overwriteExisting: formFields.overwrite_existing ?? false,
      skipExisting: formFields.skip_existing ?? true,
      defaultCategoryId: formFields.default_category_id,
    };

    // Determine format from file extension
    const originalName = file.originalname.toLowerCase();
    if (originalName.endsWith('.zip')) {
      return this.albumService.importAlbumsFromZip(file.buffer, req);
    }

    // Default: JSON format
    return this.albumService.importAlbumsFromJSON(file.buffer, req);
  }
}
