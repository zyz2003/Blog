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
/**
 * 按用途返回落盘子目录。
 *
 * 目录结构（全部在 uploads/ 下）：
 *   articles/   -- 文章编辑器上传的图片
 *   albums/     -- 相册上传的图片
 *   logos/      -- 站点 logo、图标、头像等站点级素材
 *   comments/   -- 评论上传的图片
 *   manager/    -- 文件管理器直接上传的文件（用户手动管理）
 *   config/     -- 设置页其他图片（兜底）
 *
 * 文件管理器展示策略：
 *   - 根目录展示所有子目录 + 根目录下的散落文件
 *   - 进子目录看对应分类的文件
 *   - articles/albums/logos/comments 是系统自动分类，用户也能进去看
 *   - manager/ 是用户通过文件管理器上传的文件
 */
export function getUploadSubdir(purpose: string): string {
  switch (purpose) {
    case 'article':
      return 'articles';
    case 'album':
      return 'albums';
    case 'logo':
    case 'avatar':
      return 'logos';
    case 'comment':
      return 'comments';
    case 'manager':
      return 'manager';
    default:
      return 'config';
  }
}

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

/**
 * 把上传落盘时的绝对路径转为可移植的相对路径（data/uploads/...）。
 *
 * entity.source 存相对路径后，正式环境迁移只需整体搬 server/data/ + 改 DB_PATH，
 * 所有 source 由 resolveEntitySource() 基于新的 DB_PATH 自动解析，无需逐个改数据。
 *
 * 若传入的不是 uploads 下的绝对路径（如已是相对路径 / 其他目录），原样返回，
 * 保证幂等。
 */
export function toRelativeSource(absPath: string): string {
  if (!absPath) return absPath;
  const normalized = absPath.replace(/\\/g, '/');
  const base = getUploadBaseDir().replace(/\\/g, '/');
  const basePrefix = base.endsWith('/') ? base : `${base}/`;
  if (normalized.startsWith(basePrefix)) {
    return `data/uploads/${normalized.slice(basePrefix.length)}`;
  }
  // 已在 uploads 外或已是相对路径，保持原样（兼容迁移前记录）
  return normalized;
}
