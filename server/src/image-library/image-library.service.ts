import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { FileService } from '../file/file.service';
import { files } from '../database/schemas/file.schema';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { isNull, eq, and, desc, sql, like, or } from 'drizzle-orm';
import { ErrorCodes } from '../common/constants/error-codes';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const THUMBNAIL_DIR = 'data/uploads/thumbnails';
const THUMBNAIL_FORMAT = 'webp';

@Injectable()
export class ImageLibraryService {
  private readonly logger = new Logger(ImageLibraryService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly fileService: FileService,
  ) {}

  /**
   * 列出文件管理器中的所有图片文件（不按 owner 筛选，管理员可见全部）。
   */
  async listImages(page: number, keyword: string) {
    const pageSize = 30;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(files.type, 1), // 文件（非目录）
      isNull(files.deletedAt),
      or(...IMAGE_EXTENSIONS.map((ext) => like(files.name, `%.${ext}`))),
    ];

    if (keyword && keyword.trim()) {
      conditions.push(like(files.name, `%${keyword.trim()}%`));
    }

    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(files)
      .where(whereClause);

    const list = await this.db
      .select()
      .from(files)
      .where(whereClause)
      .orderBy(desc(files.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = list.map((file: any) => {
      const publicID = generatePublicID(file.id, EntityType.File);
      return {
        id: publicID,
        name: file.name,
        size: file.size,
        createdAt: file.createdAt,
        thumbUrl: `/api/image-library/thumb/${publicID}`,
        displayUrl: `/api/image-library/img/${publicID}`,
      };
    });

    return { list: items, total, page, pageSize };
  }

  /**
   * 获取原图文件路径（inline 显示用）。复用 FileService.downloadFile。
   */
  async serveImage(publicID: string) {
    const { filePath, fileName, mimeType } =
      await this.fileService.downloadFile(publicID);
    return { filePath, fileName, mimeType };
  }

  /**
   * 获取缩略图文件路径。缩略图不存在时回退到原图。
   */
  async serveThumbnail(publicID: string) {
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // 检查缩略图文件是否存在
    const thumbnailPath = path.join(
      THUMBNAIL_DIR,
      `${publicID}.${THUMBNAIL_FORMAT}`,
    );
    try {
      await fs.promises.access(thumbnailPath);
      return { filePath: thumbnailPath, mimeType: 'image/webp' };
    } catch {
      // 缩略图不存在，回退到原图
      const { filePath, mimeType } =
        await this.fileService.downloadFile(publicID);
      return { filePath, mimeType };
    }
  }
}
