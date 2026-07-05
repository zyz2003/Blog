import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { StoragePolicyService } from '../storage-policy/storage-policy.service';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';
import {
  UploadSession,
  UPLOAD_SESSION_EXPIRE_HOURS,
} from './interfaces/upload-session.interface';
import {
  parseAnzhiyuURI,
  resolvePhysicalPath,
  inferMimeType,
} from './utils/path-resolver';
import {
  ensureDirectoryExists,
  cleanupTempDirectory,
  cleanupExpiredTempDirs,
  mergeChunkFiles,
} from './utils/file-system';
import { findOrCreateParentPath } from './utils/parent-path';
import { files } from '../database/schemas/file.schema';
import { entities } from '../database/schemas/entity.schema';
import { storagePolicies } from '../database/schemas/storage-policy.schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class UploadService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadService.name);
  private readonly sessions = new Map<string, UploadSession>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly policyService: StoragePolicyService,
    // ThumbnailService for post-upload thumbnail generation per D-103
    // Not a true circular dependency: ThumbnailService doesn't depend on UploadService
    // forwardRef is needed because FileModule and ThumbnailModule use forwardRef on each other
    @Inject(forwardRef(() => ThumbnailService))
    private readonly thumbnailService: ThumbnailService,
  ) {}

  async onModuleInit() {
    // Start 60-second cleanup interval per D-94
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredSessions(),
      60_000,
    );

    // Startup cleanup: remove expired temp directories per D-95
    try {
      const tmpBase = path.join('data', 'uploads', 'tmp');
      const count = await cleanupExpiredTempDirs(tmpBase, 24);
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired temp directories`);
      }
    } catch {
      // tmp directory may not exist yet
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create an upload session per RESEARCH Section 2.
   */
  async createSession(dto: any, ownerId: number) {
    // 1. Parse URI
    const { path: uriPath, fileName } = parseAnzhiyuURI(dto.uri);

    // 2. Decode policy_id
    let policyId: number;
    try {
      const decoded = decodePublicID(dto.policy_id);
      if (decoded.entityType !== EntityType.StoragePolicy) {
        throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
      }
      policyId = decoded.dbID;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
    }

    // 3. Look up policy
    const [policyRow] = await this.db
      .select()
      .from(storagePolicies)
      .where(eq(storagePolicies.id, policyId));

    if (!policyRow || policyRow.deletedAt) {
      throw new NotFoundException(ErrorCodes.STORAGE_NOT_FOUND);
    }

    // 4. Validate policy type is 'local'
    if (policyRow.type !== 'local') {
      throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
    }

    // 5. Validate file size per D-100 (maxSize=0 means unlimited)
    if (policyRow.maxSize > 0 && dto.size > policyRow.maxSize) {
      throw new BadRequestException('文件大小超过存储策略限制');
    }

    // 6. In a transaction
    const sessionId = uuidv4();
    const chunkSize = policyRow.settings?.chunk_size || DEFAULT_CHUNK_SIZE;

    const result = await this.db.transaction(async (tx: any) => {
      // findOrCreateParentPath — create directory file records as needed
      const parentId = await findOrCreateParentPath(
        uriPath,
        ownerId,
        policyId,
        tx,
      );

      // If overwrite=false, check for existing file at same parentId+name
      if (!dto.overwrite) {
        const conditions = [
          eq(files.name, fileName),
          eq(files.ownerId, ownerId),
          isNull(files.deletedAt),
        ];
        if (parentId === null) {
          conditions.push(isNull(files.parentId));
        } else {
          conditions.push(eq(files.parentId, parentId));
        }

        const [existing] = await tx
          .select()
          .from(files)
          .where(and(...conditions));
        if (existing) {
          throw new ConflictException(ErrorCodes.UPLOAD_FILE_EXISTS);
        }
      }

      // Create temp entity record
      const [entity] = await tx
        .insert(entities)
        .values({
          type: 'file_content',
          source: '',
          size: dto.size,
          policyId: policyId,
          createdBy: ownerId,
          uploadSessionId: sessionId,
        })
        .returning();

      // Store session
      const expireAt = new Date(
        Date.now() + UPLOAD_SESSION_EXPIRE_HOURS * 60 * 60 * 1000,
      );
      const session: UploadSession = {
        sessionId,
        ownerId,
        policyId,
        uri: dto.uri,
        chunkSize,
        fileSize: dto.size,
        tempEntityId: entity.id,
        uploadedChunks: new Set(),
        expireAt,
        overwrite: dto.overwrite ?? false,
      };
      this.sessions.set(sessionId, session);

      return { sessionId, entity, parentId, expireAt, chunkSize };
    });

    // 10. Return UploadSessionData per RESEARCH Section 2
    const policyPublicID = generatePublicID(
      policyId,
      EntityType.StoragePolicy,
    );
    return {
      expires: Math.floor(result.expireAt.getTime() / 1000),
      upload_method: 'server',
      session_id: result.sessionId,
      chunk_size: result.chunkSize,
      storage_policy: {
        id: policyPublicID,
        name: policyRow.name,
        type: policyRow.type,
        max_size: policyRow.maxSize,
      },
    };
  }

  /**
   * Upload a chunk. Auto-merge triggers on last chunk per D-96.
   */
  async uploadChunk(
    sessionId: string,
    index: number,
    body: Buffer,
    ownerId: number,
  ) {
    // 1. Look up session
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(ErrorCodes.UPLOAD_SESSION_NOT_FOUND);
    }

    // 2. Verify ownership
    if (session.ownerId !== ownerId) {
      throw new ForbiddenException(ErrorCodes.UPLOAD_SESSION_NOT_OWNER);
    }

    // 3. Calculate total chunks per RESEARCH Pitfall 2
    const totalChunks = Math.ceil(session.fileSize / session.chunkSize) || 1;

    // 4. Validate index
    if (index < 0 || index >= totalChunks) {
      throw new BadRequestException(ErrorCodes.UPLOAD_SESSION_INVALID_CHUNK);
    }

    // 5. Create temp directory and write chunk
    const tmpDir = path.join('data', 'uploads', 'tmp', sessionId);
    await ensureDirectoryExists(tmpDir);
    await fs.writeFile(path.join(tmpDir, `chunk-${index}`), body);

    // 7. Update session
    session.uploadedChunks.add(index);

    // 8. Check if ALL chunks uploaded — auto-merge per D-96
    if (session.uploadedChunks.size >= totalChunks) {
      await this.completeFileUpload(session);
    }

    return null;
  }

  /**
   * Complete file upload: merge chunks, create records, trigger thumbnail.
   * Called automatically after last chunk per D-96.
   */
  private async completeFileUpload(session: UploadSession) {
    const { path: uriPath, fileName } = parseAnzhiyuURI(session.uri);

    // Get policy for base path
    const [policyRow] = await this.db
      .select()
      .from(storagePolicies)
      .where(eq(storagePolicies.id, session.policyId));

    // 1. Create output file path
    const targetPath = resolvePhysicalPath(
      policyRow?.basePath || 'data/uploads',
      uriPath,
    );
    await ensureDirectoryExists(path.dirname(targetPath));

    // 2. Merge chunks
    const tmpDir = path.join('data', 'uploads', 'tmp', session.sessionId);
    const totalChunks =
      Math.ceil(session.fileSize / session.chunkSize) || 1;
    const actualSize = await mergeChunkFiles(tmpDir, targetPath, totalChunks);

    // 3. In a transaction: update entity + create file record
    let fileRecord: any;
    await this.db.transaction(async (tx: any) => {
      // Update temp entity
      await tx
        .update(entities)
        .set({
          source: targetPath,
          mimeType: inferMimeType(fileName),
          size: actualSize,
          uploadSessionId: null,
        })
        .where(eq(entities.id, session.tempEntityId));

      // Find parent directory
      const parentId = await findOrCreateParentPath(
        uriPath,
        session.ownerId,
        session.policyId,
        tx,
      );

      // Create file record (or update if overwrite)
      if (session.overwrite) {
        const conditions = [
          eq(files.name, fileName),
          eq(files.ownerId, session.ownerId),
          isNull(files.deletedAt),
        ];
        if (parentId === null) {
          conditions.push(isNull(files.parentId));
        } else {
          conditions.push(eq(files.parentId, parentId));
        }

        const [existing] = await tx
          .select()
          .from(files)
          .where(and(...conditions));
        if (existing) {
          await tx
            .update(files)
            .set({
              primaryEntityId: session.tempEntityId,
              size: actualSize,
            })
            .where(eq(files.id, existing.id));
          fileRecord = existing;
        }
      }

      if (!fileRecord) {
        [fileRecord] = await tx
          .insert(files)
          .values({
            ownerId: session.ownerId,
            parentId,
            name: fileName,
            size: actualSize,
            type: 1, // file
            primaryEntityId: session.tempEntityId,
          })
          .returning();
      }
    });

    // 4. Delete session from Map
    this.sessions.delete(session.sessionId);

    // 5. Clean up temp directory
    try {
      await cleanupTempDirectory(session.sessionId);
    } catch {
      this.logger.warn(
        `Failed to clean temp dir for session ${session.sessionId}`,
      );
    }

    // 6. Trigger thumbnail generation per D-103
    if (fileRecord && this.thumbnailService) {
      try {
        await this.thumbnailService.generateThumbnail(
          fileRecord.id,
          targetPath,
          fileName,
        );
      } catch (error) {
        // Per D-106: thumbnail failure does not block file upload
        this.logger.warn(
          `Thumbnail generation failed for ${fileName}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Get upload session status per RESEARCH Section 2.
   */
  async getSessionStatus(sessionId: string, ownerId: number) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { is_valid: false };
    }

    if (session.ownerId !== ownerId) {
      return { is_valid: false };
    }

    const totalChunks =
      Math.ceil(session.fileSize / session.chunkSize) || 1;

    return {
      session_id: session.sessionId,
      is_valid: true,
      chunk_size: session.chunkSize,
      total_chunks: totalChunks,
      uploaded_chunks: Array.from(session.uploadedChunks).sort(
        (a, b) => a - b,
      ),
      expires_at: session.expireAt.toISOString(),
    };
  }

  /**
   * Delete an upload session and clean up resources.
   */
  async deleteSession(dto: any, ownerId: number) {
    const session = this.sessions.get(dto.id);
    if (!session) {
      throw new NotFoundException(ErrorCodes.UPLOAD_SESSION_NOT_FOUND);
    }
    if (session.ownerId !== ownerId) {
      throw new ForbiddenException(ErrorCodes.UPLOAD_SESSION_NOT_OWNER);
    }

    // Clean up temp directory on disk
    try {
      await cleanupTempDirectory(session.sessionId);
    } catch {
      // Already cleaned up or doesn't exist
    }

    // Hard-delete temp entity from entities table
    await this.db
      .delete(entities)
      .where(eq(entities.id, session.tempEntityId));

    // Delete session from Map
    this.sessions.delete(session.sessionId);

    return null;
  }

  /**
   * Finalize client-side upload per D-97/D-98.
   * Preserved for API compatibility but rarely used for local storage.
   */
  async finalizeClientUpload(dto: any, ownerId: number) {
    const { path: uriPath, fileName } = parseAnzhiyuURI(dto.uri);

    // Decode policy
    const decoded = decodePublicID(dto.policy_id);
    if (decoded.entityType !== EntityType.StoragePolicy) {
      throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
    }
    const policyId = decoded.dbID;

    // Get policy
    const [policyRow] = await this.db
      .select()
      .from(storagePolicies)
      .where(eq(storagePolicies.id, policyId));

    if (!policyRow || policyRow.type !== 'local') {
      throw new BadRequestException(ErrorCodes.INVALID_POLICY_TYPE);
    }

    // Verify file exists on disk at expected path
    const targetPath = resolvePhysicalPath(
      policyRow.basePath || 'data/uploads',
      uriPath,
    );
    try {
      await fs.access(targetPath);
    } catch {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const stat = await fs.stat(targetPath);

    // Create entity + file records in transaction
    let fileRecord: any;
    await this.db.transaction(async (tx: any) => {
      const parentId = await findOrCreateParentPath(
        uriPath,
        ownerId,
        policyId,
        tx,
      );

      const [entity] = await tx
        .insert(entities)
        .values({
          type: 'file_content',
          source: targetPath,
          size: stat.size,
          policyId,
          createdBy: ownerId,
          mimeType: inferMimeType(fileName),
        })
        .returning();

      [fileRecord] = await tx
        .insert(files)
        .values({
          ownerId,
          parentId,
          name: fileName,
          size: stat.size,
          type: 1,
          primaryEntityId: entity.id,
        })
        .returning();
    });

    // Trigger thumbnail generation (try-catch per D-106)
    if (fileRecord && this.thumbnailService) {
      try {
        await this.thumbnailService.generateThumbnail(
          fileRecord.id,
          targetPath,
          fileName,
        );
      } catch (error) {
        this.logger.warn(
          `Thumbnail generation failed for ${fileName}: ${error.message}`,
        );
      }
    }

    return {
      file_id: generatePublicID(fileRecord.id, EntityType.File),
      name: fileRecord.name,
      size: fileRecord.size,
    };
  }

  /**
   * Remove expired sessions from the Map. Called every 60 seconds.
   */
  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expireAt.getTime() < now) {
        this.sessions.delete(id);
      }
    }
  }
}
