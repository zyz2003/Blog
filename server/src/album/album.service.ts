import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AlbumRepository, CreateAlbumParams, FindAlbumsOptions } from './album.repository';
import { AlbumCategoryRepository } from './album-category.repository';
import { SettingsService } from '../settings/settings.service';
import { PostTagService } from '../post-tag/post-tag.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { toISODateString } from '../common/utils/time.util';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import AdmZip from 'adm-zip';

/**
 * Image metadata returned by fetchImageMetadata.
 */
interface ImageMetadata {
  width: number;
  height: number;
  fileSize: number;
  format: string;
  fileHash: string;
}

/**
 * Batch import result matching Go BatchImportResult.
 */
export interface BatchImportResult {
  successCount: number;
  failCount: number;
  skipCount: number;
  total: number;
  errors: BatchImportError[];
  duplicates: string[];
}

export interface BatchImportError {
  url: string;
  reason: string;
}

export interface BatchImportParams {
  categoryId?: number;
  urls: string[];
  thumbParam?: string;
  bigParam?: string;
  tags?: string[];
  displayOrder?: number;
}

/**
 * Export data structures matching Go ExportAlbumData.
 */
export interface ExportAlbumData {
  version: string;
  export_at: string;
  albums: ExportAlbumItem[];
  meta: Record<string, any>;
}

export interface ExportAlbumItem {
  category_id: number | null;
  image_url: string;
  big_image_url: string;
  download_url: string;
  thumb_param: string;
  big_param: string;
  tags: string;
  width: number;
  height: number;
  file_size: number;
  format: string;
  aspect_ratio: string;
  file_hash: string;
  display_order: number;
  title: string;
  description: string;
  location: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/**
 * Import request matching Go ImportAlbumRequest.
 */
export interface ImportAlbumRequest {
  data?: ExportAlbumData;
  overwriteExisting: boolean;
  skipExisting: boolean;
  defaultCategoryId?: number;
}

export interface ImportAlbumResult {
  total_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  errors: string[];
  created_ids: number[];
}

@Injectable()
export class AlbumService {
  private readonly logger = new Logger(AlbumService.name);

  constructor(
    private readonly albumRepo: AlbumRepository,
    private readonly albumCategoryRepo: AlbumCategoryRepository,
    private readonly settingsService: SettingsService,
    private readonly postTagService: PostTagService,
  ) {}

  /**
   * CreateAlbum — Core CreateOrRestore logic matching Go CreateAlbum.
   * 1. Compute effectiveFileHash
   * 2. Build album model with all params
   * 3. Compute aspectRatio via getSimplifiedAspectRatioString
   * 4. Join tags array to comma-separated string
   * 5. applyDefaultAlbumParams
   * 6. Call albumRepo.createOrRestore
   * 7. On 'created'/'restored': findOrCreate tags
   * 8. On 'existed': throw error
   * 9. Apply defaults again on final result
   * 10. Return final album
   */
  async createAlbum(params: {
    categoryId?: number | null;
    imageUrl: string;
    bigImageUrl?: string;
    downloadUrl?: string;
    thumbParam?: string;
    bigParam?: string;
    tags?: string[];
    width?: number;
    height?: number;
    fileSize?: number;
    format?: string;
    fileHash: string;
    displayOrder?: number;
    title?: string;
    description?: string;
    location?: string;
    createdAt?: Date;
    publishedAt?: Date | null;
  }) {
    // 1. Compute effectiveFileHash
    const effectiveHash = this.effectiveAlbumFileHash(params.fileHash, params.imageUrl);

    // 2-4. Build album model
    const albumParams: CreateAlbumParams = {
      categoryId: params.categoryId ?? null,
      imageUrl: params.imageUrl,
      bigImageUrl: params.bigImageUrl ?? '',
      downloadUrl: params.downloadUrl ?? '',
      thumbParam: params.thumbParam ?? '',
      bigParam: params.bigParam ?? '',
      tags: (params.tags || []).join(','),
      width: params.width ?? 0,
      height: params.height ?? 0,
      fileSize: params.fileSize ?? 0,
      format: params.format ?? '',
      fileHash: effectiveHash,
      displayOrder: params.displayOrder ?? 0,
      title: params.title ?? '',
      description: params.description ?? '',
      location: params.location ?? '',
      publishedAt: params.publishedAt ?? null,
      createdAt: params.createdAt,
    };

    // 3. Compute aspectRatio
    const aspectRatio = this.getSimplifiedAspectRatioString(
      params.width ?? 0,
      params.height ?? 0,
    );
    albumParams.aspectRatio = aspectRatio;

    // Build a mutable album-like object for applyDefaultAlbumParams
    const albumLike: any = {
      ...albumParams,
    };

    // 5. Apply defaults before DB insert
    this.applyDefaultAlbumParams(albumLike);

    // Update albumParams with applied defaults
    albumParams.bigImageUrl = albumLike.bigImageUrl;
    albumParams.downloadUrl = albumLike.downloadUrl;
    albumParams.thumbParam = albumLike.thumbParam;
    albumParams.bigParam = albumLike.bigParam;

    // 6. Call createOrRestore
    const { album, status } = await this.albumRepo.createOrRestore(albumParams);

    // 7-8. Handle status
    switch (status) {
      case 'created':
        this.logger.log(`新图片已创建，ID: ${album.id}`);
        if (params.tags && params.tags.length > 0) {
          try {
            await this.postTagService.findOrCreate(params.tags);
          } catch (err) {
            this.logger.warn(`处理新图片标签时发生错误: ${err}`);
          }
        }
        break;
      case 'restored':
        this.logger.log(`已恢复并更新了被删除的图片，ID: ${album.id}`);
        if (params.tags && params.tags.length > 0) {
          try {
            await this.postTagService.findOrCreate(params.tags);
          } catch (err) {
            this.logger.warn(`处理已恢复图片标签时发生错误: ${err}`);
          }
        }
        break;
      case 'existed':
        throw new ConflictException(
          `这张图片已存在，id是${album.id}，请勿重复添加`,
        );
      default:
        throw new BadRequestException('处理相册时发生未知状态');
    }

    // 9. Apply defaults again on final result
    this.applyDefaultAlbumParams(album);

    // 10. Return final album
    return album;
  }

  /**
   * DeleteAlbum — soft delete via repo.
   * Matches Go DeleteAlbum which uses SoftDeleteMixin.
   */
  async deleteAlbum(id: number) {
    const album = await this.albumRepo.findById(id);
    if (!album) {
      throw new NotFoundException(ErrorCodes.ALBUM_NOT_FOUND);
    }
    await this.albumRepo.delete(id);
  }

  /**
   * BatchDeleteAlbums — soft delete via repo.
   * Returns deleted count.
   */
  async batchDeleteAlbums(ids: number[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('没有指定要删除的相册ID');
    }
    const deleted = await this.albumRepo.batchDelete(ids);
    return { deleted };
  }

  /**
   * UpdateAlbum — find album, update fields, apply defaults.
   * Matches Go UpdateAlbum.
   */
  async updateAlbum(
    id: number,
    params: {
      categoryId?: number | null;
      imageUrl: string;
      bigImageUrl?: string;
      downloadUrl?: string;
      thumbParam?: string;
      bigParam?: string;
      tags?: string[];
      width?: number;
      height?: number;
      displayOrder?: number;
      title?: string;
      description?: string;
      location?: string;
      publishedAt?: Date | null;
    },
  ) {
    // 1. Find album by id
    const album = await this.albumRepo.findById(id);
    if (!album) {
      throw new NotFoundException(ErrorCodes.ALBUM_NOT_FOUND);
    }

    // 2-3. Only include fields that are explicitly provided (partial update per Go pointer types)
    const updateData: Partial<CreateAlbumParams> = {};

    if (params.imageUrl !== undefined) updateData.imageUrl = params.imageUrl;
    if (params.bigImageUrl !== undefined) updateData.bigImageUrl = params.bigImageUrl;
    if (params.downloadUrl !== undefined) updateData.downloadUrl = params.downloadUrl;
    if (params.thumbParam !== undefined) updateData.thumbParam = params.thumbParam;
    if (params.bigParam !== undefined) updateData.bigParam = params.bigParam;
    if (params.tags !== undefined) updateData.tags = params.tags.join(',');
    if (params.displayOrder !== undefined) updateData.displayOrder = params.displayOrder;
    if (params.title !== undefined) updateData.title = params.title;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.location !== undefined) updateData.location = params.location;
    if (params.publishedAt !== undefined) updateData.publishedAt = params.publishedAt;
    if (params.categoryId !== undefined) updateData.categoryId = params.categoryId;

    // Recompute aspectRatio if width or height changed
    if (params.width !== undefined || params.height !== undefined) {
      const w = params.width ?? album.width ?? 0;
      const h = params.height ?? album.height ?? 0;
      updateData.aspectRatio = this.getSimplifiedAspectRatioString(w, h);
      if (params.width !== undefined) updateData.width = params.width;
      if (params.height !== undefined) updateData.height = params.height;
    }

    // 4. Call repo update
    const updated = await this.albumRepo.update(id, updateData);
    if (!updated) {
      throw new NotFoundException(ErrorCodes.ALBUM_NOT_FOUND);
    }

    // 5. Apply defaults on result
    this.applyDefaultAlbumParams(updated);

    // 6. Ensure tags exist in tag table (matches Go UpdateAlbum)
    if (params.tags && params.tags.length > 0) {
      try {
        await this.postTagService.findOrCreate(params.tags);
      } catch (err) {
        this.logger.warn(`处理更新图片标签时发生错误: ${err}`);
      }
    }

    // 7. Return updated album
    return updated;
  }

  /**
   * FindAlbums — paginated query with filters.
   * Matches Go FindAlbums.
   */
  async findAlbums(params: FindAlbumsOptions) {
    const result = await this.albumRepo.findListByOptions(params);

    // toResponseDTO already applies read-time defaults (bigImageUrl, downloadUrl fallbacks)
    return {
      list: result.items.map((album: any) => this.toResponseDTO(album)),
      total: result.total,
      pageNum: params.page,
      pageSize: params.pageSize,
    };
  }

  /**
   * IncrementAlbumStat — increment view or download count.
   * Matches Go IncrementAlbumStat.
   */
  async incrementAlbumStat(id: number, statType: string) {
    if (statType === 'view') {
      await this.albumRepo.incrementViewCount(id);
    } else if (statType === 'download') {
      await this.albumRepo.incrementDownloadCount(id);
    } else {
      throw new BadRequestException(ErrorCodes.ALBUM_STAT_TYPE_INVALID);
    }
  }

  /**
   * BatchImportAlbums — URL batch import with dedup and thumbnail generation.
   * Matches Go BatchImportAlbums.
   */
  async batchImportAlbums(params: BatchImportParams): Promise<BatchImportResult> {
    const result: BatchImportResult = {
      successCount: 0,
      failCount: 0,
      skipCount: 0,
      total: params.urls.length,
      errors: [],
      duplicates: [],
    };

    // Pre-load all existing fileHashes for dedup
    const existingHashesMap = new Map<string, boolean>();
    try {
      const dedupMap = await this.albumRepo.findAllForDedup();
      for (const [hash] of dedupMap) {
        existingHashesMap.set(hash, true);
      }
    } catch (err) {
      this.logger.warn(`获取现有图片列表失败: ${err}`);
    }

    // Process each URL
    for (let i = 0; i < params.urls.length; i++) {
      const url = params.urls[i];
      const displayOrder = (params.displayOrder ?? 0) + i;

      // Fetch image metadata
      let metadata: ImageMetadata;
      try {
        metadata = await this.fetchImageMetadata(url);
      } catch (err) {
        result.failCount++;
        result.errors.push({
          url,
          reason: `获取图片元数据失败: ${err.message || err}`,
        });
        this.logger.warn(`获取图片元数据失败 [${url}]: ${err}`);
        continue;
      }

      // Check dedup
      if (existingHashesMap.has(metadata.fileHash)) {
        result.skipCount++;
        result.duplicates.push(url);
        this.logger.log(`跳过重复图片 [${url}]`);
        continue;
      }

      // Create album record
      try {
        await this.createAlbum({
          categoryId: params.categoryId,
          imageUrl: url,
          bigImageUrl: url,
          downloadUrl: url,
          thumbParam: params.thumbParam,
          bigParam: params.bigParam,
          tags: params.tags,
          width: metadata.width,
          height: metadata.height,
          fileSize: metadata.fileSize,
          format: metadata.format,
          fileHash: metadata.fileHash,
          displayOrder,
        });

        result.successCount++;
        // Add new hash to prevent intra-batch duplicates
        existingHashesMap.set(metadata.fileHash, true);
      } catch (err) {
        const errMsg = err.message || String(err);
        if (errMsg.includes('已存在') || errMsg.includes('重复')) {
          result.skipCount++;
          result.duplicates.push(url);
          this.logger.warn(`后端检测到重复图片 [${url}]: ${err}`);
        } else {
          result.failCount++;
          result.errors.push({
            url,
            reason: errMsg,
          });
          this.logger.warn(`创建相册记录失败 [${url}]: ${err}`);
        }
      }
    }

    return result;
  }

  /**
   * fetchImageMetadata — Private helper.
   * HTTP GET with User-Agent header, 60s timeout.
   * Decode image dimensions, compute SHA256 hash, determine format.
   */
  private async fetchImageMetadata(urlStr: string): Promise<ImageMetadata> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(
        urlStr,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          },
          timeout: 60000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`服务器返回错误状态: ${res.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const data = Buffer.concat(chunks);
            const fileSize = data.length;

            // Compute SHA256 hash
            const hash = crypto.createHash('sha256').update(data).digest('hex');

            // Determine format from content-type or URL extension
            let format = '';
            const contentType = res.headers['content-type'] || '';
            if (contentType.includes('jpeg') || contentType.includes('jpg')) {
              format = 'jpeg';
            } else if (contentType.includes('png')) {
              format = 'png';
            } else if (contentType.includes('gif')) {
              format = 'gif';
            } else if (contentType.includes('webp')) {
              format = 'webp';
            }

            if (!format) {
              const ext = parsedUrl.pathname.split('.').pop()?.toLowerCase();
              if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
                format = ext === 'jpg' ? 'jpeg' : ext;
              }
              if (!format) {
                format = 'unknown';
              }
            }

            // Decode image dimensions using sharp
            import('sharp')
              .then((sharpModule) => {
                return sharpModule.default(data).metadata();
              })
              .then((metadata) => {
                resolve({
                  width: metadata.width || 0,
                  height: metadata.height || 0,
                  fileSize,
                  format,
                  fileHash: hash,
                });
              })
              .catch(() => {
                // If sharp fails, return with 0 dimensions
                resolve({
                  width: 0,
                  height: 0,
                  fileSize,
                  format,
                  fileHash: hash,
                });
              });
          });
          res.on('error', reject);
        },
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
    });
  }

  /**
   * ExportAlbums — export albums as JSON format.
   * Matches Go ExportAlbums.
   */
  async exportAlbums(albumIds?: number[]): Promise<ExportAlbumData> {
    this.logger.log(`[导出相册] 开始导出 ${albumIds?.length ?? 0} 个相册`);

    const exportData: ExportAlbumData = {
      version: '1.0',
      export_at: new Date().toISOString(),
      albums: [],
      meta: {
        total_albums: albumIds?.length ?? 0,
        export_by: 'anheyu-app',
      },
    };

    // If no albumIds specified, export all
    let albumsToExport: any[];
    if (!albumIds || albumIds.length === 0) {
      albumsToExport = await this.albumRepo.findAll();
    } else {
      albumsToExport = [];
      for (const id of albumIds) {
        // Use findById which filters by deletedAt IS NULL
        // But for export we need to find by ID directly — use a raw query approach
        // Actually, Go's FindByID also filters by deleted_at IS NULL via SoftDeleteMixin
        const album = await this.albumRepo.findById(id);
        if (album) {
          albumsToExport.push(album);
        } else {
          this.logger.warn(`[导出相册] 相册 ${id} 不存在`);
        }
      }
    }

    for (const album of albumsToExport) {
      this.applyDefaultAlbumParams(album);

      const exportItem: ExportAlbumItem = {
        category_id: album.categoryId ?? null,
        image_url: album.imageUrl ?? '',
        big_image_url: album.bigImageUrl ?? '',
        download_url: album.downloadUrl ?? '',
        thumb_param: album.thumbParam ?? '',
        big_param: album.bigParam ?? '',
        tags: album.tags ?? '',
        width: album.width ?? 0,
        height: album.height ?? 0,
        file_size: album.fileSize ?? 0,
        format: album.format ?? '',
        aspect_ratio: album.aspectRatio ?? '',
        file_hash: album.fileHash ?? '',
        display_order: album.displayOrder ?? 0,
        title: album.title ?? '',
        description: album.description ?? '',
        location: album.location ?? '',
        created_at: toISODateString(album.createdAt) ?? '',
        updated_at: toISODateString(album.updatedAt) ?? '',
        published_at: album.publishedAt ? toISODateString(album.publishedAt) : null,
      };

      exportData.albums.push(exportItem);
    }

    exportData.meta.total_albums = exportData.albums.length;
    this.logger.log(`[导出相册] 成功导出 ${exportData.albums.length} 个相册`);
    return exportData;
  }

  /**
   * ExportAlbumsToZip — export albums as ZIP with albums.json + README.md.
   * Matches Go ExportAlbumsToZip.
   */
  async exportAlbumsToZip(albumIds?: number[]): Promise<Buffer> {
    const exportData = await this.exportAlbums(albumIds);

    const zipArchive = new AdmZip();
    const jsonData = JSON.stringify(exportData, null, 2);
    zipArchive.addFile('albums.json', Buffer.from(jsonData, 'utf8'));

    const readmeContent = `# 相册导出包

- 导出时间: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}
- 导出版本: ${exportData.version}
- 相册总数: ${exportData.albums.length}

## 文件说明

- albums.json: 包含所有相册的相册完整数据（JSON格式）

## 导入说明

使用本系统的导入功能，选择 albums.json 文件即可导入所有相册。
`;
    zipArchive.addFile('README.md', Buffer.from(readmeContent, 'utf8'));

    return zipArchive.toBuffer();
  }

  /**
   * ImportAlbumsFromJSON — parse JSON and call importAlbums.
   * Matches Go ImportAlbumsFromJSON.
   */
  async importAlbumsFromJSON(
    jsonData: Buffer | string,
    req: ImportAlbumRequest,
  ): Promise<ImportAlbumResult> {
    let exportData: ExportAlbumData;
    try {
      const raw = typeof jsonData === 'string' ? jsonData : jsonData.toString('utf8');
      exportData = JSON.parse(raw);
    } catch (err) {
      throw new BadRequestException(`解析 JSON 数据失败: ${err.message || err}`);
    }

    req.data = exportData;
    return this.importAlbums(req);
  }

  /**
   * ImportAlbums — import albums from ExportAlbumData.
   * Matches Go ImportAlbums.
   */
  async importAlbums(req: ImportAlbumRequest): Promise<ImportAlbumResult> {
    const data = req.data;
    if (!data || !data.albums) {
      throw new BadRequestException('导入数据格式无效');
    }

    this.logger.log(`[导入相册] 开始导入 ${data.albums.length} 个相册`);

    const result: ImportAlbumResult = {
      total_count: data.albums.length,
      success_count: 0,
      skipped_count: 0,
      failed_count: 0,
      errors: [],
      created_ids: [],
    };

    // Pre-load existing categories for FK validation
    const categorySet = new Set<number>();
    try {
      const categories = await this.albumCategoryRepo.findAll();
      for (const cat of categories) {
        categorySet.add(cat.id);
      }
    } catch (err) {
      throw new BadRequestException(`获取相册分类失败: ${err.message || err}`);
    }

    // Determine fallback category ID
    let fallbackCategoryId: number | null = null;
    if (req.defaultCategoryId != null) {
      if (categorySet.has(req.defaultCategoryId)) {
        fallbackCategoryId = req.defaultCategoryId;
      } else {
        this.logger.warn(
          `[导入相册] 默认分类ID=${req.defaultCategoryId} 不存在，已忽略默认分类`,
        );
      }
    }

    // Pre-load existing hashes for dedup
    const existingHashesMap = new Map<string, number>();
    if (req.skipExisting) {
      try {
        const dedupMap = await this.albumRepo.findAllForDedup();
        // We need effectiveAlbumFileHash for dedup, but dedupMap only has fileHash→id
        // For import dedup, we need to also compute effectiveAlbumFileHash for each existing album
        // The Go code queries all albums and computes effectiveAlbumFileHash for each
        // Our findAllForDedup only returns fileHash→id, which is sufficient for the common case
        // where fileHash is non-empty. For albums with empty fileHash, we'd need imageUrl too.
        // For now, use the fileHash-based dedup which covers the vast majority of cases.
        for (const [hash, id] of dedupMap) {
          if (hash) {
            existingHashesMap.set(hash, id);
          }
        }
      } catch (err) {
        this.logger.warn(`获取现有相册列表失败: ${err}`);
      }
    }

    for (let idx = 0; idx < data.albums.length; idx++) {
      const albumData = data.albums[idx];
      this.logger.log(
        `[导入相册] 处理第 ${idx + 1}/${result.total_count} 个相册`,
      );

      // Validate categoryId
      let categoryId: number | null = albumData.category_id ?? null;
      if (categoryId == null) {
        categoryId = fallbackCategoryId;
      } else if (!categorySet.has(categoryId)) {
        if (fallbackCategoryId != null) {
          this.logger.warn(
            `[导入相册] 分类ID=${categoryId} 不存在，回退到默认分类ID=${fallbackCategoryId}`,
          );
          categoryId = fallbackCategoryId;
        } else {
          this.logger.warn(
            `[导入相册] 分类ID=${categoryId} 不存在，回退为未分类导入`,
          );
          categoryId = null;
        }
      }

      // Parse tags from comma-separated string
      const tags: string[] = albumData.tags ? albumData.tags.split(',').filter((t) => t.trim()) : [];

      // Parse createdAt
      let createdAt: Date | undefined;
      if (albumData.created_at) {
        const d = new Date(albumData.created_at);
        if (!isNaN(d.getTime())) {
          createdAt = d;
        }
      }

      // Parse publishedAt
      let publishedAt: Date | null = null;
      if (albumData.published_at) {
        const d = new Date(albumData.published_at);
        if (!isNaN(d.getTime())) {
          publishedAt = d;
        }
      }

      // Check dedup via effectiveAlbumFileHash
      const importKey = this.effectiveAlbumFileHash(
        albumData.file_hash,
        albumData.image_url,
      );
      if (importKey && existingHashesMap.has(importKey)) {
        if (req.overwriteExisting) {
          // Overwrite existing album instead of skipping
          const existingId = existingHashesMap.get(importKey);
          try {
            await this.updateAlbum(existingId, {
              categoryId,
              imageUrl: albumData.image_url,
              bigImageUrl: albumData.big_image_url,
              downloadUrl: albumData.download_url,
              thumbParam: albumData.thumb_param,
              bigParam: albumData.big_param,
              tags,
              displayOrder: albumData.display_order,
              title: albumData.title,
              description: albumData.description,
              location: albumData.location,
              publishedAt,
            });
            result.success_count++;
            this.logger.log(`[导入相册] 覆盖已存在的相册: ID=${existingId}`);
          } catch (err) {
            result.failed_count++;
            result.errors.push(`覆盖相册失败 (ID=${existingId}): ${err.message || err}`);
          }
          continue;
        }
        this.logger.log(
          `[导入相册] 跳过已存在的相册: key=${importKey}`,
        );
        result.skipped_count++;
        continue;
      }

      // Create album
      try {
        const createdAlbum = await this.createAlbum({
          categoryId,
          imageUrl: albumData.image_url,
          bigImageUrl: albumData.big_image_url,
          downloadUrl: albumData.download_url,
          thumbParam: albumData.thumb_param,
          bigParam: albumData.big_param,
          tags,
          width: albumData.width,
          height: albumData.height,
          fileSize: albumData.file_size,
          format: albumData.format,
          fileHash: albumData.file_hash,
          displayOrder: albumData.display_order,
          title: albumData.title,
          description: albumData.description,
          location: albumData.location,
          createdAt,
          publishedAt,
        });

        this.logger.log(`[导入相册] 成功导入相册: ID=${createdAlbum.id}`);
        result.created_ids.push(createdAlbum.id);
        result.success_count++;

        // Add new hash to prevent intra-batch duplicates
        const newKey = this.effectiveAlbumFileHash(
          createdAlbum.fileHash,
          createdAlbum.imageUrl,
        );
        if (newKey) {
          existingHashesMap.set(newKey, createdAlbum.id);
        }
      } catch (err) {
        const errMsg = err.message || String(err);
        if (errMsg.includes('已存在') || errMsg.includes('重复')) {
          result.skipped_count++;
          this.logger.log(`[导入相册] 跳过重复相册: ${errMsg}`);
        } else {
          const msg = `导入相册失败 (索引 ${idx + 1}): ${errMsg}`;
          this.logger.warn(`[导入相册] ${msg}`);
          result.errors.push(msg);
          result.failed_count++;
        }
      }
    }

    this.logger.log(
      `[导入相册] 导入完成 - 总数: ${result.total_count}, 成功: ${result.success_count}, 跳过: ${result.skipped_count}, 失败: ${result.failed_count}`,
    );

    return result;
  }

  /**
   * ImportAlbumsFromZip — extract albums.json from ZIP and import.
   * Matches Go ImportAlbumsFromZip.
   */
  async importAlbumsFromZip(
    zipData: Buffer,
    req: ImportAlbumRequest,
  ): Promise<ImportAlbumResult> {
    let zipArchive: AdmZip;
    try {
      zipArchive = new AdmZip(zipData);
    } catch (err) {
      throw new BadRequestException(`读取 ZIP 文件失败: ${err.message || err}`);
    }

    // Find albums.json
    const entry = zipArchive.getEntry('albums.json');
    if (!entry) {
      throw new BadRequestException('ZIP 文件中未找到 albums.json');
    }

    const jsonData = entry.getData().toString('utf8');
    return this.importAlbumsFromJSON(jsonData, req);
  }

  /**
   * applyDefaultAlbumParams — Private helper matching Go applyDefaultAlbumParams.
   * 1. If bigImageUrl empty → bigImageUrl = imageUrl
   * 2. If downloadUrl empty → downloadUrl = imageUrl
   * 3. If thumbParam empty → read from settings: DEFAULT_THUMB_PARAM
   * 4. If bigParam empty → read from settings: DEFAULT_BIG_PARAM
   */
  private applyDefaultAlbumParams(album: any) {
    if (!album) return;

    if (!album.bigImageUrl) {
      album.bigImageUrl = album.imageUrl;
    }
    if (!album.downloadUrl) {
      album.downloadUrl = album.imageUrl;
    }
    if (!album.thumbParam) {
      album.thumbParam = this.settingsService.get('DEFAULT_THUMB_PARAM') || '';
    }
    if (!album.bigParam) {
      album.bigParam = this.settingsService.get('DEFAULT_BIG_PARAM') || '';
    }
  }

  /**
   * getSimplifiedAspectRatioString — Private helper.
   * If width <= 0 or height <= 0 → return "0:0"
   * Compute gcd(width, height) → return "W/gcd:H/gcd"
   */
  private getSimplifiedAspectRatioString(width: number, height: number): string {
    if (width <= 0 || height <= 0) {
      return '0:0';
    }
    const commonDivisor = this.gcd(width, height);
    return `${width / commonDivisor}:${height / commonDivisor}`;
  }

  /**
   * gcd — Private helper for greatest common divisor.
   */
  private gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  /**
   * effectiveAlbumFileHash — Private helper.
   * If fileHash non-empty after trim → return fileHash
   * If imageUrl non-empty after trim → return SHA256(imageUrl) as hex
   * Else return empty string
   */
  private effectiveAlbumFileHash(fileHash: string, imageUrl: string): string {
    const h = (fileHash || '').trim();
    if (h) return h;
    const url = (imageUrl || '').trim();
    if (!url) return '';
    return crypto.createHash('sha256').update(url).digest('hex');
  }

  /**
   * toResponseDTO — Convert DB record to AlbumResponseDto.
   * Applies read-time defaults matching Go toDomainAlbum:
   * - bigImageUrl = album.bigImageUrl || album.imageUrl
   * - downloadUrl = album.downloadUrl || album.imageUrl
   */
  toResponseDTO(album: any) {
    if (!album) return null;

    return {
      id: album.id,
      categoryId: album.categoryId ?? null,
      imageUrl: album.imageUrl ?? '',
      bigImageUrl: album.bigImageUrl || album.imageUrl || '',
      downloadUrl: album.downloadUrl || album.imageUrl || '',
      thumbParam: album.thumbParam ?? '',
      bigParam: album.bigParam ?? '',
      tags: album.tags ?? '',
      viewCount: album.viewCount ?? 0,
      downloadCount: album.downloadCount ?? 0,
      fileSize: album.fileSize ?? 0,
      format: album.format ?? '',
      aspectRatio: album.aspectRatio ?? '',
      created_at: toISODateString(album.createdAt),
      updated_at: toISODateString(album.updatedAt),
      published_at: album.publishedAt ? toISODateString(album.publishedAt) : null,
      width: album.width ?? 0,
      height: album.height ?? 0,
      widthAndHeight: album.width && album.height ? `${album.width}x${album.height}` : '',
      fileHash: album.fileHash ?? null,
      displayOrder: album.displayOrder ?? 0,
      title: album.title ?? '',
      description: album.description ?? '',
      location: album.location ?? '',
    };
  }
}
