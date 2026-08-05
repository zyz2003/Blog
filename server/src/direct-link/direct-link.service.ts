import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { FileService } from '../file/file.service';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { directLinks } from '../database/schemas/direct-link.schema';
import { files } from '../database/schemas/file.schema';
import { entities } from '../database/schemas/entity.schema';
import { storagePolicies } from '../database/schemas/storage-policy.schema';
import { ErrorCodes } from '../common/constants/error-codes';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { resolveEntitySource } from '../common/utils/upload-path';

@Injectable()
export class DirectLinkService {
  private readonly logger = new Logger(DirectLinkService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly fileService: FileService,
  ) {}

  /**
   * Create direct links for files per RESEARCH Section 6.
   * Uses EntityType.DirectLink=7 per D-107 and RESEARCH Pitfall 5.
   */
  async createDirectLinks(fileIds: string[], ownerId: number) {
    const results = [];

    for (const fileId of fileIds) {
      let dbID: number;
      let entityType: number;
      try {
        ({ dbID, entityType } = decodePublicID(fileId));
      } catch {
        continue; // Skip invalid IDs silently (matching Go behavior for batch create)
      }
      if (entityType !== EntityType.File) continue;

      // Check if direct link already exists (unique constraint on fileId)
      const [existingLink] = await this.db
        .select()
        .from(directLinks)
        .where(eq(directLinks.fileId, dbID));

      let linkId: number;
      let fileName: string;

      if (existingLink) {
        linkId = existingLink.id;
        fileName = existingLink.fileName;
      } else {
        // Get file record for name
        const [file] = await this.db
          .select()
          .from(files)
          .where(and(eq(files.id, dbID), isNull(files.deletedAt)));

        if (!file) continue;

        // Create direct_links record
        const [link] = await this.db
          .insert(directLinks)
          .values({
            fileId: dbID,
            fileName: file.name,
            speedLimit: 0,
            downloads: 0,
          })
          .returning();

        linkId = link.id;
        fileName = file.name;
      }

      // Encode with EntityType.DirectLink=7 per D-107 and RESEARCH Pitfall 5
      const linkPublicID = generatePublicID(linkId, EntityType.DirectLink);

      // Build full URL
      const siteUrl = process.env.SITE_URL || 'http://localhost:8091';
      const fullUrl = `${siteUrl}/api/f/${linkPublicID}/${encodeURIComponent(fileName)}`;

      results.push({
        link: linkPublicID,
        file_url: fullUrl,
      });
    }

    return results;
  }

  /**
   * Handle direct download via short-link.
   * Decodes publicID with EntityType.DirectLink per RESEARCH Pitfall 5.
   */
  async handleDirectDownload(publicID: string, fileName: string) {
    let dbID: number;
    let entityType: number;
    try {
      ({ dbID, entityType } = decodePublicID(publicID));
    } catch {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // CRITICAL: Must decode with EntityType.DirectLink, NOT EntityType.File
    // per RESEARCH Pitfall 5 and D-107
    if (entityType !== EntityType.DirectLink) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    const [link] = await this.db
      .select()
      .from(directLinks)
      .where(eq(directLinks.id, dbID));

    if (!link) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Increment downloads counter (async, non-blocking)
    this.db
      .update(directLinks)
      .set({ downloads: sql`${directLinks.downloads} + 1` })
      .where(eq(directLinks.id, dbID))
      .catch(() => {});

    // Follow link.fileId to get file
    const [file] = await this.db
      .select()
      .from(files)
      .where(eq(files.id, link.fileId));

    if (!file) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    // Follow file.primaryEntityId to get entity
    const entity = file.primaryEntityId
      ? await this.db
          .select()
          .from(entities)
          .where(eq(entities.id, file.primaryEntityId))
      : null;

    if (!entity || entity.length === 0) {
      throw new NotFoundException(ErrorCodes.FILE_NOT_FOUND);
    }

    const entityData = entity[0];

    // Get storage policy
    const [policy] = await this.db
      .select()
      .from(storagePolicies)
      .where(eq(storagePolicies.id, entityData.policyId));

    // For local storage per D-108
    return {
      filePath: resolveEntitySource(entityData.source),
      fileName: link.fileName || fileName,
      mimeType: entityData.mimeType || 'application/octet-stream',
      size: entityData.size,
    };
  }
}
