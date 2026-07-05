import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';
import { isThumbnailableExtension } from '../file/utils/file-system';
import { files } from '../database/schemas/file.schema';
import { entities } from '../database/schemas/entity.schema';
import { eq, isNull, and } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as fsStat from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const THUMBNAIL_DIR = 'data/uploads/thumbnails';
const THUMBNAIL_MAX_WIDTH = 400;
const THUMBNAIL_MAX_HEIGHT = 400;
const THUMBNAIL_FORMAT = 'webp';
const SIGN_EXPIRY_SECONDS = 900; // 15 minutes

@Injectable()
export class ThumbnailService implements OnModuleInit {
  private readonly logger = new Logger(ThumbnailService.name);
  private hmacSecret: string | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async onModuleInit() {
    // Ensure thumbnail directory exists
    try {
      await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
    } catch {
      // May already exist
    }

    // Initialize HMAC secret
    this.hmacSecret = process.env.HMAC_SECRET || 'anheyu-hmac-secret-key-2024';
  }

  /**
   * Generate thumbnail for a file using sharp per D-104.
   * Returns null for non-thumbnailable extensions (silent skip).
   * Catches errors and logs but does NOT throw per D-106.
   */
  async generateThumbnail(
    fileId: number,
    entitySource: string,
    fileName: string,
  ): Promise<string | null> {
    // Check if thumbnailable
    if (!isThumbnailableExtension(fileName)) {
      return null; // Skip silently
    }

    try {
      // Ensure thumbnail directory exists
      await fs.mkdir(THUMBNAIL_DIR, { recursive: true });

      const publicID = generatePublicID(fileId, EntityType.File);
      const outputPath = path.join(THUMBNAIL_DIR, `${publicID}.${THUMBNAIL_FORMAT}`);

      // Use sharp to resize
      await sharp(entitySource)
        .resize(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp()
        .toFile(outputPath);

      this.logger.log(`Generated thumbnail for ${fileName}`);
      return outputPath;
    } catch (error) {
      // Per D-106: thumbnail failure does not block file upload
      this.logger.warn(
        `Thumbnail generation failed for ${fileName}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get thumbnail sign per RESEARCH Section 5.
   * Triggers sync generation if thumbnail missing per D-106.
   */
  async getThumbnailSign(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.THUMBNAIL_NOT_FOUND);
    }

    const thumbnailPath = path.join(
      THUMBNAIL_DIR,
      `${publicID}.${THUMBNAIL_FORMAT}`,
    );

    // Check if thumbnail exists; generate if missing per D-106
    try {
      await fs.access(thumbnailPath);
    } catch {
      // Thumbnail missing — generate synchronously
      const file = await this.db
        .select()
        .from(files)
        .where(and(eq(files.id, dbID), isNull(files.deletedAt)));

      if (!file || file.length === 0) {
        throw new NotFoundException(ErrorCodes.THUMBNAIL_NOT_FOUND);
      }

      const entity = file[0].primaryEntityId
        ? await this.db
            .select()
            .from(entities)
            .where(eq(entities.id, file[0].primaryEntityId))
        : null;

      if (!entity || entity.length === 0 || !entity[0].source) {
        throw new NotFoundException(ErrorCodes.THUMBNAIL_NOT_FOUND);
      }

      await this.generateThumbnail(dbID, entity[0].source, file[0].name);
    }

    // Generate signed token per D-105
    const expiresAt = Math.floor(Date.now() / 1000) + SIGN_EXPIRY_SECONDS;
    const payload = `${publicID}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', this.getHmacSecret())
      .update(payload)
      .digest('hex');

    const signedToken = `${publicID}:${expiresAt}:${signature}`;

    return {
      sign: signedToken,
      expires: expiresAt,
      obfuscated: true,
    };
  }

  /**
   * Serve thumbnail content by verifying HMAC-SHA256 signature.
   */
  async serveThumbnailContent(signedToken: string) {
    const parts = signedToken.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException(ErrorCodes.THUMBNAIL_SIGN_INVALID);
    }

    const [publicID, expiresStr, signature] = parts;

    // Recompute expected signature
    const expectedSig = crypto
      .createHmac('sha256', this.getHmacSecret())
      .update(`${publicID}:${expiresStr}`)
      .digest('hex');

    if (signature !== expectedSig) {
      throw new BadRequestException(ErrorCodes.THUMBNAIL_SIGN_INVALID);
    }

    // Verify expiration
    if (Date.now() > parseInt(expiresStr, 10) * 1000) {
      throw new BadRequestException(ErrorCodes.THUMBNAIL_SIGN_EXPIRED);
    }

    // Decode publicID to verify EntityType
    const { entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new BadRequestException(ErrorCodes.THUMBNAIL_SIGN_INVALID);
    }

    const filePath = path.join(
      THUMBNAIL_DIR,
      `${publicID}.${THUMBNAIL_FORMAT}`,
    );

    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException(ErrorCodes.THUMBNAIL_NOT_FOUND);
    }

    return {
      filePath,
      mimeType: 'image/webp',
    };
  }

  /**
   * Regenerate a single thumbnail.
   */
  async regenerateThumbnail(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.THUMBNAIL_NOT_FOUND);
    }

    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, dbID), isNull(files.deletedAt)));

    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const entity = file.primaryEntityId
      ? await this.db
          .select()
          .from(entities)
          .where(eq(entities.id, file.primaryEntityId))
      : null;

    if (!entity || entity.length === 0) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    // Delete existing thumbnail
    const thumbnailPath = path.join(
      THUMBNAIL_DIR,
      `${publicID}.${THUMBNAIL_FORMAT}`,
    );
    try {
      await fs.unlink(thumbnailPath);
    } catch {
      // May not exist
    }

    // Regenerate
    await this.generateThumbnail(dbID, entity[0].source, file.name);

    return { status: 'ready' };
  }

  /**
   * Regenerate all thumbnails for files under a directory.
   */
  async regenerateDirectoryThumbnails(directoryPublicID: string) {
    const { dbID, entityType } = decodePublicID(directoryPublicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    // Find all descendant files
    // Use BFS to find all files under directory
    const allFiles: any[] = [];
    const queue: number[] = [dbID];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.db
        .select()
        .from(files)
        .where(
          and(eq(files.parentId, currentId), isNull(files.deletedAt)),
        );

      for (const child of children) {
        if (child.type === 2) {
          queue.push(child.id);
        }
        allFiles.push(child);
      }
    }

    let filesProcessed = 0;
    for (const f of allFiles) {
      if (f.type !== 1) continue; // Only process files

      const publicID = generatePublicID(f.id, EntityType.File);
      const thumbnailPath = path.join(
        THUMBNAIL_DIR,
        `${publicID}.${THUMBNAIL_FORMAT}`,
      );

      // Delete old thumbnail
      try {
        await fs.unlink(thumbnailPath);
      } catch {
        // May not exist
      }

      // Regenerate
      const entity = f.primaryEntityId
        ? await this.db
            .select()
            .from(entities)
            .where(eq(entities.id, f.primaryEntityId))
        : null;

      if (entity && entity.length > 0 && entity[0].source) {
        await this.generateThumbnail(f.id, entity[0].source, f.name);
        filesProcessed++;
      }
    }

    return {
      message: '缩略图重新生成完成',
      filesToProcess: filesProcessed,
    };
  }

  private getHmacSecret(): string {
    if (!this.hmacSecret) {
      this.hmacSecret = process.env.HMAC_SECRET || 'anheyu-hmac-secret-key-2024';
    }
    return this.hmacSecret;
  }
}
