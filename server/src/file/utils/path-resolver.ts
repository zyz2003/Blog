import { ErrorCodes } from '../../common/constants/error-codes';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Parse an anzhiyu:// URI to extract path components.
 * Format: "anzhiyu://my/images/photo.jpg"
 *
 * Per RESEARCH Pitfall 1: rejects path traversal (.. segments).
 * For Phase 05 single-user blog, "my" always maps to the admin user.
 */
export function parseAnzhiyuURI(uri: string): {
  path: string;
  fileName: string;
  parentPath: string;
} {
  if (!uri || typeof uri !== 'string') {
    throw new HttpException(ErrorCodes.UPLOAD_URI_INVALID, HttpStatus.BAD_REQUEST);
  }

  // Check for the anzhiyu://my/ scheme
  const match = uri.match(/^anzhiyu:\/\/my(\/.*)?$/);
  if (!match) {
    throw new HttpException(ErrorCodes.UPLOAD_URI_INVALID, HttpStatus.BAD_REQUEST);
  }

  const path = match[1] || '/';

  // Reject path traversal
  const segments = path.split('/').filter(Boolean);
  for (const segment of segments) {
    if (segment === '..' || segment === '.') {
      throw new HttpException(ErrorCodes.UPLOAD_URI_INVALID, HttpStatus.BAD_REQUEST);
    }
  }

  const fileName = segments.length > 0 ? segments[segments.length - 1] : '';
  const parentPath = segments.length > 1 ? '/' + segments.slice(0, -1).join('/') : '/';

  return { path, fileName, parentPath };
}

/**
 * Combine policy base_path with URI path to get filesystem path.
 * Normalizes slashes to produce a clean path.
 */
export function resolvePhysicalPath(basePath: string, uriPath: string): string {
  const cleanBase = basePath.replace(/\/+$/, '');
  const cleanUri = uriPath.replace(/^\/+/, '');
  if (!cleanUri) return cleanBase;
  return `${cleanBase}/${cleanUri}`;
}

/**
 * Map common file extensions to MIME types.
 * Default: 'application/octet-stream'.
 */
export function inferMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
  };
  return mimeMap[ext] || 'application/octet-stream';
}
