import { files } from '../../database/schemas/file.schema';
import { entities } from '../../database/schemas/entity.schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

/**
 * Walk path segments and create missing directory file records.
 * Shared between UploadService and FileService to avoid duplication.
 *
 * @param uriPath - The URI path (e.g., "/images/photo.jpg")
 * @param ownerId - The owner user DB ID
 * @param policyId - The storage policy DB ID
 * @param tx - Drizzle transaction or db instance
 * @returns The parent directory file ID, or null for root level
 */
export async function findOrCreateParentPath(
  uriPath: string,
  ownerId: number,
  policyId: number,
  tx: any,
): Promise<number | null> {
  const segments = uriPath.split('/').filter(Boolean);
  // Remove the last segment (file name) — we only want directories
  const dirSegments = segments.slice(0, -1);

  if (dirSegments.length === 0) {
    return null; // Root level
  }

  let currentParentId: number | null = null;

  for (const dirName of dirSegments) {
    // Check if directory exists
    const conditions = [
      eq(files.name, dirName),
      eq(files.ownerId, ownerId),
      eq(files.type, 2), // directory type
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
      // Create directory entity record
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

      // Create directory file record
      const [dirFile] = await tx
        .insert(files)
        .values({
          ownerId,
          parentId: currentParentId,
          name: dirName,
          size: 0,
          type: 2, // directory
          primaryEntityId: dirEntity.id,
        })
        .returning();

      // Update parent's childrenCount
      if (currentParentId !== null) {
        await tx
          .update(files)
          .set({
            childrenCount: sql`${files.childrenCount} + 1`,
          })
          .where(eq(files.id, currentParentId));
      }

      currentParentId = dirFile.id;
    }
  }

  return currentParentId;
}
