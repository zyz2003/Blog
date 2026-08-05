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
import { toISODateString } from '../common/utils/time.util';
import { parseAnzhiyuURI, resolvePhysicalPath, inferMimeType } from './utils/path-resolver';
import { ensureDirectoryExists, isThumbnailableExtension } from './utils/file-system';
import { findOrCreateParentPath } from './utils/parent-path';
import { getUploadBaseDir } from '../common/utils/upload-path';
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
        // 目录记录不存在（旧文件未创建目录记录），返回空列表而非 404
        return {
          files: [],
          parent: null,
          pagination: { page: options?.page ?? 1, page_size: options?.pageSize ?? 50, next_token: '', is_cursor: true },
          props: { total: 0 },
          context_hint: '',
          storage_policy: null,
          view: null,
        };
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

    // 根目录或目录无关联策略时，回退到 article_image 默认策略，
    // 保证文件管理器上传有可用策略（前端依赖 storage_policy 决定上传目标）
    if (!storagePolicy) {
      const [defaultPolicy] = await this.db
        .select()
        .from(storagePolicies)
        .where(
          and(
            eq(storagePolicies.flag, 'article_image'),
            isNull(storagePolicies.deletedAt),
          ),
        );
      if (defaultPolicy) {
        storagePolicy = {
          id: generatePublicID(defaultPolicy.id, EntityType.StoragePolicy),
          name: defaultPolicy.name,
          type: defaultPolicy.type,
          max_size: defaultPolicy.maxSize,
        };
      }
    }

    return {
      files: list.map((f: any) => this.toFileItem(f)),
      parent,
      pagination: { page, page_size: pageSize, next_token: '', is_cursor: true },
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }
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
      filePath: entity.source.replace(/\\/g, '/'),
      fileName: file.name,
      mimeType: entity.mimeType || inferMimeType(file.name),
      size: entity.size,
    };
  }

  /**
   * Get download info per RESEARCH Section 9.
   */
  async getDownloadInfo(publicID: string) {
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }
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
    // Go backend returns string[] (just URLs), not objects
    const imageFiles = siblings.filter((f: any) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
    });

    const urls = imageFiles.map((f: any) =>
      this.generateSignedContentUrl(generatePublicID(f.id, EntityType.File)),
    );

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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }
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
      filePath: entity.source.replace(/\\/g, '/'),
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
      const parentId = await findOrCreateParentPath(
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }
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
      let dbID: number;
      let entityType: number;
      try {
        ({ dbID, entityType } = decodePublicID(publicID));
      } catch {
        continue; // Skip invalid IDs silently (matching Go behavior for batch delete)
      }
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(id));
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }
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
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }
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
    let destDbId: number;
    let destType: number;
    try {
      ({ dbID: destDbId, entityType: destType } = decodePublicID(destinationID));
    } catch {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }
    if (destType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const destFolder = await this.repository.findById(destDbId);
    if (!destFolder || destFolder.type !== 2) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    for (const sourceID of sourceIDs) {
      let srcDbId: number;
      let srcType: number;
      try {
        ({ dbID: srcDbId, entityType: srcType } = decodePublicID(sourceID));
      } catch {
        continue; // Skip invalid IDs silently
      }
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
    let destDbId: number;
    let destType: number;
    try {
      ({ dbID: destDbId, entityType: destType } = decodePublicID(destinationID));
    } catch {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }
    if (destType !== EntityType.File) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    const destFolder = await this.repository.findById(destDbId);
    if (!destFolder || destFolder.type !== 2) {
      throw new NotFoundException(ErrorCodes.FOLDER_NOT_FOUND);
    }

    for (const sourceID of sourceIDs) {
      let srcDbId: number;
      let srcType: number;
      try {
        ({ dbID: srcDbId, entityType: srcType } = decodePublicID(sourceID));
      } catch {
        continue; // Skip invalid IDs silently
      }
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
   * Convert DB row to frontend FileItem format per RESEARCH Section 9.
   */
  toFileItem(file: any, entity?: any): any {
    return {
      id: generatePublicID(file.id, EntityType.File),
      name: file.name,
      type: file.type,
      size: file.size,
      created_at: toISODateString(file.createdAt),
      updated_at: toISODateString(file.updatedAt),
      path: '',
      owned: true,
      shared: false,
      permission: null,
      capability: '',
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
    return process.env.HMAC_SECRET || 'anheyu-hmac-secret-key-2024';
  }

  /**
   * 迁移：扫描磁盘 uploads/ 目录，为缺少 files 记录的文件创建记录。
   * 旧上传的文件有磁盘文件但没 files 表记录（没目录记录、parentId=null），
   * 导致文件管理器看不到。此方法扫描磁盘，补录文件和目录记录。
   */
  async migrateDiskFiles(ownerId: number): Promise<{ dirs: number; files: number; skipped: number }> {
    const uploadBase = getUploadBaseDir();
    let dirCount = 0;
    let fileCount = 0;
    let skipCount = 0;

    // 获取默认策略
    const [defaultPolicy] = await this.db
      .select()
      .from(storagePolicies)
      .where(and(eq(storagePolicies.flag, 'article_image'), isNull(storagePolicies.deletedAt)));
    const policyId = defaultPolicy?.id || 1;

    // 扫描 uploads/ 下的子目录
    let entries: string[];
    try {
      entries = await fs.readdir(uploadBase);
    } catch {
      return { dirs: 0, files: 0, skipped: 0 };
    }

    for (const entry of entries) {
      if (entry === 'thumbnails' || entry === 'tmp') continue; // 跳过系统目录
      const entryPath = path.join(uploadBase, entry);
      const stat = await fs.stat(entryPath).catch(() => null);
      if (!stat) continue;

      if (stat.isDirectory()) {
        // 为子目录创建目录记录
        const parentId = await findOrCreateParentPath(
          `/${entry}/dummy`,
          ownerId,
          policyId,
          this.db,
        );

        // 扫描子目录内的文件
        const fileEntries = await fs.readdir(entryPath).catch(() => []);
        for (const fileName of fileEntries) {
          const filePath = path.join(entryPath, fileName);
          const fileStat = await fs.stat(filePath).catch(() => null);
          if (!fileStat || fileStat.isDirectory()) continue;

          // 检查是否已有文件记录（按 name + ownerId + parentId 查）
          const [existing] = await this.db
            .select()
            .from(files)
            .where(and(
              eq(files.name, fileName),
              eq(files.ownerId, ownerId),
              eq(files.parentId, parentId),
              isNull(files.deletedAt),
            ));

          if (existing) {
            skipCount++;
            continue;
          }

          // 创建 entity + file 记录
          const [entity] = await this.db
            .insert(entities)
            .values({
              type: 'file_content',
              source: filePath,
              size: fileStat.size,
              policyId,
              createdBy: ownerId,
              mimeType: inferMimeType(fileName),
            })
            .returning();

          await this.db.insert(files).values({
            ownerId,
            parentId,
            name: fileName,
            size: fileStat.size,
            type: 1,
            primaryEntityId: entity.id,
          });
          fileCount++;
        }
        dirCount++;
      } else {
        // 根目录下的散落文件（parentId=null）
        const [existing] = await this.db
          .select()
          .from(files)
          .where(and(
            eq(files.name, entry),
            eq(files.ownerId, ownerId),
            isNull(files.parentId),
            isNull(files.deletedAt),
          ));

        if (existing) {
          skipCount++;
          continue;
        }

        const [entity] = await this.db
          .insert(entities)
          .values({
            type: 'file_content',
            source: entryPath,
            size: stat.size,
            policyId,
            createdBy: ownerId,
            mimeType: inferMimeType(entry),
          })
          .returning();

        await this.db.insert(files).values({
          ownerId,
          parentId: null,
          name: entry,
          size: stat.size,
          type: 1,
          primaryEntityId: entity.id,
        });
        fileCount++;
      }
    }

    this.logger.log(`Migration complete: ${dirCount} dirs, ${fileCount} files created, ${skipCount} skipped`);
    return { dirs: dirCount, files: fileCount, skipped: skipCount };
  }
}
