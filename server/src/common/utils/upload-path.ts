/**
 * 上传路径工具 -- 相对 DB_PATH 所在目录，不依赖 cwd。
 *
 * 问题根因：systemd 的 WorkingDirectory 是 .output/server/，
 * 上传用相对路径 data/uploads/ 会落在 .output/server/data/uploads/，
 * 更新部署时 .output/server/ 被替换，上传的图片全丢。
 *
 * 解决：上传根目录 = DB_PATH 所在目录 + uploads。
 * 这样上传文件跟数据库在同一目录下，更新部署产物不影响。
 *
 * 迁移时只需整体搬目录 + 改 DB_PATH，代码零硬编码。
 */
import * as path from 'path';

let cachedUploadBase: string | null = null;
let cachedThumbnailDir: string | null = null;

/**
 * 获取上传根目录（绝对路径）。
 * 相对 DB_PATH 所在目录，而不是 cwd。
 */
export function getUploadBaseDir(): string {
  if (cachedUploadBase) return cachedUploadBase;
  const dbPath = process.env.DB_PATH || 'data/blog.db';
  const dbDir = path.dirname(dbPath);
  // path.resolve 保证返回绝对路径（相对路径会基于 cwd 解析）
  cachedUploadBase = path.resolve(dbDir, 'uploads');
  return cachedUploadBase;
}

/**
 * 获取缩略图目录（绝对路径）。
 */
export function getThumbnailDir(): string {
  if (cachedThumbnailDir) return cachedThumbnailDir;
  cachedThumbnailDir = path.join(getUploadBaseDir(), 'thumbnails');
  return cachedThumbnailDir;
}

/**
 * 解析 entity.source 为可读的绝对路径。
 *
 * 兼容三种历史格式：
 * 1. 绝对路径（新上传，getUploadBaseDir 之后的记录）：直接返回
 * 2. data/uploads/...（旧记录，相对 cwd）：去掉前缀拼接 uploadBase
 * 3. data\uploads\...（Windows 旧记录）：归一化后按 2 处理
 */
export function resolveEntitySource(source: string): string {
  if (!source) return source;
  const normalized = source.replace(/\\/g, '/');
  if (path.isAbsolute(normalized)) return normalized;
  // 旧记录格式：data/uploads/articles/xxx.png -> uploadBase/articles/xxx.png
  const prefix = 'data/uploads/';
  if (normalized.startsWith(prefix)) {
    return path.join(getUploadBaseDir(), normalized.slice(prefix.length));
  }
  // 其他相对路径，拼接 uploadBase
  return path.join(getUploadBaseDir(), normalized);
}
