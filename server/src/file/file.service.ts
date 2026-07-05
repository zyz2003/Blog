import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { FileRepository } from './file.repository';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';
import { parseAnzhiyuURI, resolvePhysicalPath, inferMimeType } from './utils/path-resolver';
import { ensureDirectoryExists, isThumbnailableExtension } from './utils/file-system';
import { files } from '../database/schemas/file.schema';
import { entities } from '../database/schemas/entity.schema';
import { storagePolicies } from '../database/schemas/storage-policy.schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsStat from 'fs';

const HMAC_SECRET_KEY = 'FILE_SERVE_SECRET'; // Settings key for HMAC secret

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly repository: FileRepository,
  ) {}

  // ─── Query Methods ──────────────────────────────────────────

  /**
   * Get files by URI path. Returns FileListResponse per RESEARCH Section 9.
   */
  async getFilesByPath(uri: string, ownerId: number, options?: any) {
    const { path: uriPath } = parseAnzhiyuURI(uri);

    // Walk the path to find the directory
    const segments = uriPath.split('/').filter(Boolean);
    let currentParentId: number | null = null;
    let directoryFile: any = null;

    for (const segment of segments) {
      const dir = await this.repository.findByParentAndName(
        currentParentId,
        segment,
        ownerId,
      );
      if (!dir || dir.type !== 2) {
        throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
      }
      currentParentId = dir.id;
      directoryFile = dir;
    }

    // List children
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const { list, total } = await this.repository.findChildrenByParentId(
      currentParentId,
      ownerId,
      { page, pageSize, orderBy: options?.orderBy, orderDirection: options?.orderDirection },
    );

    // Get parent info
    let parent = null;
    if (directoryFile) {
      parent = this.toFileItem(directoryFile);
    }

    // Get storage policy for the first file's entity
    let storagePolicy = null;
    if (directoryFile) {
      const entity = await this.repository.findEntityById(directoryFile.primaryEntityId);
      if (entity) {
        const policy = await this.repository.findStoragePolicyById(entity.policyId);
        if (policy) {
          storagePolicy = {
            id: generatePublicID(policy.id, EntityType.StoragePolicy),
            name: policy.name,
            type: policy.type,
            max_size: policy.maxSize,
          };
        }
      }
    }

    return {
      files: list.map((f: any) => this.toFileItem(f)),
      parent,
      pagination: { page, pageSize, total },
      props: { total },
      context_hint: '',
      storage_policy: storagePolicy,
      view: directoryFile?.viewConfig || null,
    };
  }

  /**
   * Get file info by public ID.
   */
  async getFileInfo(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const file = await this.repository.findById(dbID);
    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const entity = file.primaryEntityId
      ? await this.repository.findEntityById(file.primaryEntityId)
      : null;

    let storagePolicy = null;
    if (entity) {
      const policy = await this.repository.findStoragePolicyById(entity.policyId);
      if (policy) {
        storagePolicy = {
          id: generatePublicID(policy.id, EntityType.StoragePolicy),
          name: policy.name,
          type: policy.type,
          max_size: policy.maxSize,
        };
      }
    }

    return {
      file: this.toFileItem(file, entity),
      storagePolicy,
    };
  }

  /**
   * Get file metadata for download streaming.
   */
  async downloadFile(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const file = await this.repository.findById(dbID);
    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const entity = file.primaryEntityId
      ? await this.repository.findEntityById(file.primaryEntityId)
      : null;

    if (!entity || !entity.source) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    return {
      filePath: entity.source,
      fileName: file.name,
      mimeType: entity.mimeType || inferMimeType(file.name),
      size: entity.size,
    };
  }

  /**
   * Get download info per RESEARCH Section 9.
   */
  async getDownloadInfo(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const file = await this.repository.findById(dbID);
    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const entity = file.primaryEntityId
      ? await this.repository.findEntityById(file.primaryEntityId)
      : null;

    let storageType = 'local';
    if (entity) {
      const policy = await this.repository.findStoragePolicyById(entity.policyId);
      if (policy) {
        storageType = policy.type;
      }
    }

    return {
      type: storageType === 'local' ? 'local' : 'cloud',
      url: storageType === 'local' ? null : null, // No URL for local storage
      storage_type: storageType,
      file_name: file.name,
      file_size: entity?.size || 0,
    };
  }

  /**
   * Get preview URLs for all images in the same directory.
   */
  async getPreviewURLs(publicID: string, ownerId: number) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const file = await this.repository.findById(dbID);
    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    // List siblings in same directory
    const { list: siblings } = await this.repository.findChildrenByParentId(
      file.parentId,
      ownerId,
    );

    // Filter image files and generate signed URLs
    const imageFiles = siblings.filter((f: any) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
    });

    const urls = imageFiles.map((f: any) => ({
      url: this.generateSignedContentUrl(generatePublicID(f.id, EntityType.File)),
      file_id: generatePublicID(f.id, EntityType.File),
      file_name: f.name,
      file_size: f.size,
    }));

    // Find initial index
    const initialIndex = imageFiles.findIndex((f: any) => f.id === dbID);

    return { urls, initialIndex: initialIndex >= 0 ? initialIndex : 0 };
  }

  /**
   * Serve signed content — verify HMAC-SHA256 signature and expiration.
   */
  async serveSignedContent(sign: string) {
    const parts = sign.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException(ErrorCodes.SIGNED_URL_INVALID);
    }

    const [publicID, expiresStr, signature] = parts;

    // Verify signature
    const secret = this.getHmacSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${publicID}:${expiresStr}`)
      .digest('hex');

    if (signature !== expectedSig) {
      throw new BadRequestException(ErrorCodes.SIGNED_URL_INVALID);
    }

    // Verify expiration
    if (Date.now() > parseInt(expiresStr, 10) * 1000) {
      throw new BadRequestException(ErrorCodes.SIGNED_URL_EXPIRED);
    }

    // Get file
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const file = await this.repository.findById(dbID);
    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const entity = file.primaryEntityId
      ? await this.repository.findEntityById(file.primaryEntityId)
      : null;

    if (!entity || !entity.source) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    return {
      filePath: entity.source,
      mimeType: entity.mimeType || inferMimeType(file.name),
    };
  }

  // ─── Operation Methods ──────────────────────────────────────

  /**
   * Create an empty file or directory.
   */
  async createEmptyFile(dto: any, ownerId: number) {
    const { path: uriPath, fileName } = parseAnzhiyuURI(dto.uri);
    const fileType = dto.type === 2 ? 2 : 1; // 1=file, 2=directory

    // Get default article_image policy for new files
    const [defaultPolicy] = await this.db
      .select()
      .from(storagePolicies)
      .where(
        and(
          eq(storagePolicies.flag, 'article_image'),
          isNull(storagePolicies.deletedAt),
        ),
      );

    const policyId = defaultPolicy?.id || 1;

    const fileRecord = await this.db.transaction(async (tx: any) => {
      // findOrCreateParentPath
      const parentId = await this.findOrCreateParentPath(
        uriPath,
        ownerId,
        policyId,
        tx,
      );

      // Check name conflict if err_on_conflict
      if (dto.err_on_conflict) {
        const existing = await this.repository.findByParentAndName(
          parentId,
          fileName,
          ownerId,
        );
        if (existing) {
          throw new ConflictException(ErrorCodes.FILE_NAME_EXISTS);
        }
      }

      // Create entity record
      const [entity] = await tx
        .insert(entities)
        .values({
          type: fileType === 2 ? 'directory' : 'file_content',
          source: fileType === 1 ? '' : '',
          size: 0,
          policyId,
          createdBy: ownerId,
        })
        .returning();

      // Create file record
      const [file] = await tx
        .insert(files)
        .values({
          ownerId,
          parentId,
          name: fileName,
          size: 0,
          type: fileType,
          primaryEntityId: entity.id,
        })
        .returning();

      // Update parent childrenCount
      if (parentId !== null) {
        await tx
          .update(files)
          .set({ childrenCount: sql`${files.childrenCount} + 1` })
          .where(eq(files.id, parentId));
      }

      return file;
    });

    return this.toFileItem(fileRecord);
  }

  /**
   * Update file content — write buffer to entity source path.
   */
  async updateFileContent(
    publicID: string,
    uri: string,
    content: Buffer,
    ownerId: number,
  ) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const file = await this.repository.findById(dbID);
    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const entity = file.primaryEntityId
      ? await this.repository.findEntityById(file.primaryEntityId)
      : null;

    if (!entity) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    // Write content to entity source path
    if (entity.source) {
      await ensureDirectoryExists(path.dirname(entity.source));
      await fs.writeFile(entity.source, content);
    }

    // Update entity
    await this.repository.updateEntity(entity.id, {
      size: content.length,
      mimeType: inferMimeType(file.name),
    });

    // Update file size
    await this.repository.updateFile(dbID, { size: content.length });

    return {
      id: publicID,
      size: content.length,
      updated: true,
    };
  }

  /**
   * Delete items — recursively soft-delete files and directories.
   */
  async deleteItems(ids: string[], ownerId: number) {
    for (const publicID of ids) {
      const { dbID, entityType } = decodePublicID(publicID);
      if (entityType !== EntityType.File) continue;

      const file = await this.repository.findById(dbID);
      if (!file) continue;

      if (file.type === 2) {
        // Directory — recursively delete children
        const descendants = await this.repository.findDescendantFiles(dbID);
        for (const desc of descendants) {
          await this.repository.softDeleteFile(desc.id);
          if (desc.primaryEntityId) {
            await this.repository.deleteEntity(desc.primaryEntityId);
          }
        }
      }

      // Soft-delete the file
      await this.repository.softDeleteFile(dbID);

      // Delete entity and physical file
      if (file.primaryEntityId) {
        const entity = await this.repository.findEntityById(file.primaryEntityId);
        if (entity?.source) {
          try {
            await fs.unlink(entity.source);
          } catch {
            // Physical file may already be deleted
          }
        }
        await this.repository.deleteEntity(file.primaryEntityId);
      }
    }

    return null;
  }

  /**
   * Rename a file/directory — check name conflict.
   */
  async renameItem(id: string, newName: string, ownerId: number) {
    const { dbID, entityType } = decodePublicID(id);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const file = await this.repository.findById(dbID);
    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    // Check name conflict at same parentId
    const existing = await this.repository.findByParentAndName(
      file.parentId,
      newName,
      ownerId,
    );
    if (existing) {
      throw new ConflictException(ErrorCodes.FILE_NAME_EXISTS);
    }

    await this.repository.updateFile(dbID, { name: newName });
    const updated = await this.repository.findById(dbID);
    return this.toFileItem(updated);
  }

  // ─── Folder Methods ─────────────────────────────────────────

  /**
   * Get folder tree with signed download URLs per RESEARCH Section 3.
   */
  async getFolderTree(publicID: string, ownerId: number) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const folder = await this.repository.findById(dbID);
    if (!folder || folder.type !== 2) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const descendants = await this.repository.findDescendantFiles(dbID);
    const fileDescendants = descendants.filter((f: any) => f.type === 1);

    const filesWithUrls = await Promise.all(
      fileDescendants.map(async (f: any) => {
        const signedUrl = this.generateSignedContentUrl(
          generatePublicID(f.id, EntityType.File),
        );
        // Build relative path from folder root
        return {
          url: signedUrl,
          relative_path: f.name,
          size: f.size,
        };
      }),
    );

    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    return {
      folder_name: folder.name,
      files: filesWithUrls,
      expires: expires.toISOString(),
    };
  }

  /**
   * Get folder size — recursive sum per RESEARCH Section 9.
   */
  async getFolderSize(publicID: string) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const folder = await this.repository.findById(dbID);
    if (!folder || folder.type !== 2) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const descendants = await this.repository.findDescendantFiles(dbID);
    const fileDescendants = descendants.filter((f: any) => f.type === 1);

    const logicalSize = fileDescendants.reduce((sum: number, f: any) => sum + (f.size || 0), 0);

    return {
      logicalSize,
      storageConsumption: logicalSize, // Same for local storage
      fileCount: fileDescendants.length,
    };
  }

  /**
   * Update folder view config.
   */
  async updateFolderView(publicID: string, view: any) {
    const { dbID, entityType } = decodePublicID(publicID);
    if (entityType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    await this.repository.updateFile(dbID, { viewConfig: view });
    return { view };
  }

  /**
   * Move items to a new parent directory.
   */
  async moveItems(sourceIDs: string[], destinationID: string, ownerId: number) {
    // Decode destination
    const { dbID: destDbId, entityType: destType } = decodePublicID(destinationID);
    if (destType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const destFolder = await this.repository.findById(destDbId);
    if (!destFolder || destFolder.type !== 2) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    for (const sourceID of sourceIDs) {
      const { dbID: srcDbId, entityType: srcType } = decodePublicID(sourceID);
      if (srcType !== EntityType.File) continue;

      const srcFile = await this.repository.findById(srcDbId);
      if (!srcFile) continue;

      // Check name conflict at destination
      const existing = await this.repository.findByParentAndName(
        destDbId,
        srcFile.name,
        ownerId,
      );
      if (existing) {
        throw new ConflictException(ErrorCodes.FILE_NAME_EXISTS);
      }

      // Update parent
      const oldParentId = srcFile.parentId;
      await this.repository.updateFile(srcDbId, { parentId: destDbId });

      // Update childrenCount on old parent
      if (oldParentId !== null) {
        await this.db
          .update(files)
          .set({ childrenCount: sql`${files.childrenCount} - 1` })
          .where(eq(files.id, oldParentId));
      }

      // Update childrenCount on new parent
      await this.db
        .update(files)
        .set({ childrenCount: sql`${files.childrenCount} + 1` })
        .where(eq(files.id, destDbId));
    }

    return null;
  }

  /**
   * Copy items to a new parent directory.
   */
  async copyItems(sourceIDs: string[], destinationID: string, ownerId: number) {
    const { dbID: destDbId, entityType: destType } = decodePublicID(destinationID);
    if (destType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const destFolder = await this.repository.findById(destDbId);
    if (!destFolder || destFolder.type !== 2) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    for (const sourceID of sourceIDs) {
      const { dbID: srcDbId, entityType: srcType } = decodePublicID(sourceID);
      if (srcType !== EntityType.File) continue;

      const srcFile = await this.repository.findById(srcDbId);
      if (!srcFile) continue;

      // Get source entity
      const srcEntity = srcFile.primaryEntityId
        ? await this.repository.findEntityById(srcFile.primaryEntityId)
        : null;

      // Copy physical file on disk
      if (srcEntity?.source) {
        const copyPath = srcEntity.source.replace(
          /([^/]+)$/,
          `copy-${Date.now()}-$1`,
        );
        try {
          await fs.copyFile(srcEntity.source, copyPath);
        } catch {
          // Physical copy may fail — log and continue
          this.logger.warn(`Failed to copy file: ${srcEntity.source}`);
          continue;
        }

        // Create new entity record
        const [newEntity] = await this.db
          .insert(entities)
          .values({
            type: srcEntity.type,
            source: copyPath,
            size: srcEntity.size,
            policyId: srcEntity.policyId,
            createdBy: ownerId,
            mimeType: srcEntity.mimeType,
          })
          .returning();

        // Create new file record
        await this.db.insert(files).values({
          ownerId,
          parentId: destDbId,
          name: srcFile.name,
          size: srcFile.size,
          type: srcFile.type,
          primaryEntityId: newEntity.id,
        });

        // Update destination childrenCount
        await this.db
          .update(files)
          .set({ childrenCount: sql`${files.childrenCount} + 1` })
          .where(eq(files.id, destDbId));
      }
    }

    return null;
  }

  // ─── Helper Methods ─────────────────────────────────────────

  /**
   * Walk path segments and create missing directory file records.
   */
  private async findOrCreateParentPath(
    uriPath: string,
    ownerId: number,
    policyId: number,
    tx: any,
  ): Promise<number | null> {
    const segments = uriPath.split('/').filter(Boolean);
    const dirSegments = segments.slice(0, -1);

    if (dirSegments.length === 0) {
      return null;
    }

    let currentParentId: number | null = null;

    for (const dirName of dirSegments) {
      const conditions = [
        eq(files.name, dirName),
        eq(files.ownerId, ownerId),
        eq(files.type, 2),
        isNull(files.deletedAt),
      ];
      if (currentParentId === null) {
        conditions.push(isNull(files.parentId));
      } else {
        conditions.push(eq(files.parentId, currentParentId));
      }

      const [existing] = await tx
        .select()
        .from(files)
        .where(and(...conditions));

      if (existing) {
        currentParentId = existing.id;
      } else {
        const [dirEntity] = await tx
          .insert(entities)
          .values({
            type: 'directory',
            source: '',
            size: 0,
            policyId,
            createdBy: ownerId,
          })
          .returning();

        const [dirFile] = await tx
          .insert(files)
          .values({
            ownerId,
            parentId: currentParentId,
            name: dirName,
            size: 0,
            type: 2,
            primaryEntityId: dirEntity.id,
          })
          .returning();

        if (currentParentId !== null) {
          await tx
            .update(files)
            .set({ childrenCount: sql`${files.childrenCount} + 1` })
            .where(eq(files.id, currentParentId));
        }

        currentParentId = dirFile.id;
      }
    }

    return currentParentId;
  }

  /**
   * Convert DB row to frontend FileItem format per RESEARCH Section 9.
   */
  toFileItem(file: any, entity?: any): any {
    return {
      id: generatePublicID(file.id, EntityType.File),
      name: file.name,
      type: file.type,
      size: file.size,
      created_at: file.createdAt,
      updated_at: file.updatedAt,
      path: '',
      owned: true,
      shared: false,
      permission: 0,
      capability: 0,
      primary_entity_public_id: file.primaryEntityId
        ? generatePublicID(file.primaryEntityId, EntityType.StorageEntity)
        : null,
      ext: file.name.includes('.')
        ? file.name.split('.').pop()
        : null,
      metadata: {},
      url: file.type === 1
        ? this.generateSignedContentUrl(
            generatePublicID(file.id, EntityType.File),
          )
        : null,
      relative_path: '',
    };
  }

  /**
   * Generate HMAC-SHA256 signed content URL with 15-min expiry.
   */
  generateSignedContentUrl(publicID: string): string {
    const secret = this.getHmacSecret();
    const expiresAt = Math.floor(Date.now() / 1000) + 900; // 15 min
    const payload = `${publicID}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return `/api/file/content?sign=${encodeURIComponent(`${publicID}:${expiresAt}:${signature}`)}`;
  }

  private getHmacSecret(): string {
    // For now use a fixed secret. Will be read from SettingsService in Plan 05-05.
    return process.env.HMAC_SECRET || 'anheyu-hmac-secret-key-2024';
  }
}
