import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Delete the temp directory for a session: data/uploads/tmp/{sessionId}/
 */
export async function cleanupTempDirectory(sessionId: string): Promise<void> {
  const tmpDir = path.join('data', 'uploads', 'tmp', sessionId);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

/**
 * Scan basePath for subdirectories and delete those older than maxAgeHours.
 * Returns the count of cleaned directories.
 */
export async function cleanupExpiredTempDirs(
  basePath: string,
  maxAgeHours: number,
): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(basePath, entry.name);
      try {
        const stat = await fs.stat(dirPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.rm(dirPath, { recursive: true, force: true });
          count++;
        }
      } catch {
        // Skip directories we can't stat or delete
      }
    }
  } catch {
    // basePath may not exist yet
  }
  return count;
}

/**
 * Merge chunk files sequentially into the output file.
 * Reads chunk-0, chunk-1, ... and appends each to the output.
 * Returns total bytes written.
 */
export async function mergeChunkFiles(
  tmpDir: string,
  outputPath: string,
  totalChunks: number,
): Promise<number> {
  let totalBytes = 0;

  // Ensure output directory exists
  await ensureDirectoryExists(path.dirname(outputPath));

  // Write chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(tmpDir, `chunk-${i}`);
    const data = await fs.readFile(chunkPath);
    totalBytes += data.length;

    if (i === 0) {
      await fs.writeFile(outputPath, data);
    } else {
      await fs.appendFile(outputPath, data);
    }
  }

  return totalBytes;
}

/**
 * Get file size on disk.
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.size;
}

/**
 * Check if a file extension is thumbnailable per RESEARCH Section 5.
 */
export function isThumbnailableExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const thumbnailable = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
    'mp4', 'mov', 'avi', 'mkv', 'webm', 'pdf',
  ]);
  return thumbnailable.has(ext);
}
