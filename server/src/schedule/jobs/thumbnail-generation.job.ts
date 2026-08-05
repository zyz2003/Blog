import { Injectable, Logger } from '@nestjs/common';
import { ThumbnailService } from '../../thumbnail/thumbnail.service';
import { files } from '../../database/schemas/file.schema';
import { entities } from '../../database/schemas/entity.schema';
import { DRIZZLE } from '../../database/database.module';
import { Inject } from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { resolveEntitySource } from '../../common/utils/upload-path';

/**
 * ThumbnailGenerationJob — generates thumbnail for a single file.
 * On-demand job dispatched via ScheduleService.dispatchThumbnailGeneration().
 * Matches Go ThumbnailGenerationJob (job_thumbnail.go).
 *
 * Per Go: 5-minute timeout, calls thumbnailService.Generate(ctx, fileID).
 */
@Injectable()
export class ThumbnailGenerationJob {
  private readonly logger = new Logger(ThumbnailGenerationJob.name);

  constructor(
    private readonly thumbnailService: ThumbnailService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  /**
   * Run thumbnail generation for a file.
   * Matches Go ThumbnailGenerationJob.Run() which calls thumbnailService.Generate(ctx, fileID).
   *
   * The Go version passes fileID to the service which looks up the file internally.
   * Our ThumbnailService.generateThumbnail() needs entitySource and fileName,
   * so we look them up here before calling it.
   */
  async run(fileId: number): Promise<void> {
    // 5-minute timeout matching Go context.WithTimeout(5*time.Minute)
    const timeoutMs = 5 * 60 * 1000;
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(
        () => reject(new Error(`ThumbnailGenerationJob timed out after 5 minutes for fileId=${fileId}`)),
        timeoutMs,
      );
    });

    try {
      await Promise.race([this.doGenerate(fileId), timeoutPromise]);
    } catch (error) {
      this.logger.error(`ThumbnailGenerationJob failed for fileId=${fileId}: ${String(error)}`);
    }
  }

  private async doGenerate(fileId: number): Promise<void> {
    // Look up file record
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), isNull(files.deletedAt)));

    if (!file) {
      this.logger.warn(`ThumbnailGenerationJob: file not found (id=${fileId})`);
      return;
    }

    // Look up entity for source path
    if (!file.primaryEntityId) {
      this.logger.warn(`ThumbnailGenerationJob: file has no primary entity (id=${fileId})`);
      return;
    }

    const [entity] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, file.primaryEntityId));

    if (!entity?.source) {
      this.logger.warn(`ThumbnailGenerationJob: entity source not found (id=${fileId})`);
      return;
    }

    // Generate thumbnail — errors are caught internally by ThumbnailService per D-106
    await this.thumbnailService.generateThumbnail(fileId, resolveEntitySource(entity.source), file.name);
  }
}
