import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * BackupInfo — metadata for a settings backup file.
 * Matches Go BackupInfo (backup_service.go).
 */
export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
  description: string;
  is_auto: boolean;
}

const BACKUP_FILE_PREFIX = 'settings_backup_';
const BACKUP_FILE_SUFFIX = '.json';
const MAX_KEEP_COUNT = 100;
const DEFAULT_MAX_BACKUP_COUNT = 10;

/**
 * BackupService — CRUD for settings backup files.
 * Matches Go BackupService (backup_service.go).
 *
 * - createBackup: export settings, write JSON, save metadata
 * - listBackups: read backup dir, load metadata, sort by date desc
 * - restoreBackup: validate filename, create pre-restore backup, import settings
 * - deleteBackup: validate filename, delete file + metadata
 * - cleanOldBackups: delete oldest beyond keepCount
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private maxBackupCount: number;

  constructor(private readonly settingsService: SettingsService) {
    this.backupDir = path.join(process.cwd(), 'data', 'backups');
    this.maxBackupCount = DEFAULT_MAX_BACKUP_COUNT;

    // Ensure backup directory exists
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (err) {
      this.logger.warn(`创建备份目录失败: ${err}`);
    }
  }

  /**
   * CreateBackup — export current settings and write as backup file.
   * Matches Go backupService.CreateBackup (backup_service.go lines 87-122).
   */
  async createBackup(description: string, isAuto: boolean): Promise<BackupInfo> {
    const data = await this.settingsService.exportAll();
    const jsonStr = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(jsonStr, 'utf-8');

    const timestamp = this.formatTimestamp(new Date());
    const backupFilename = BACKUP_FILE_PREFIX + timestamp + BACKUP_FILE_SUFFIX;
    const backupPath = path.join(this.backupDir, backupFilename);

    fs.writeFileSync(backupPath, jsonStr, 'utf-8');

    const metadata: BackupInfo = {
      filename: backupFilename,
      size: buffer.length,
      created_at: new Date().toISOString(),
      description,
      is_auto: isAuto,
    };

    try {
      this.saveMetadata(backupFilename, metadata);
    } catch (err) {
      this.logger.warn(`保存备份元数据失败: ${err}`);
    }

    this.logger.log(`系统设置备份成功: ${backupFilename} (共 ${metadata.size} 字节)`);

    // Auto-cleanup if maxBackupCount is set
    if (this.maxBackupCount > 0) {
      try {
        await this.cleanOldBackups(this.maxBackupCount);
      } catch (err) {
        this.logger.warn(`自动清理旧备份失败: ${err}`);
      }
    }

    return metadata;
  }

  /**
   * ListBackups — list all backup files sorted by date descending.
   * Matches Go backupService.ListBackups (backup_service.go lines 125-170).
   */
  async listBackups(): Promise<BackupInfo[]> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.backupDir, { withFileTypes: true });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw new Error(`读取备份目录失败: ${err}`);
    }

    const backups: BackupInfo[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      const name = entry.name;

      // Only process settings backup files, exclude metadata files
      if (!name.startsWith(BACKUP_FILE_PREFIX) || !name.endsWith(BACKUP_FILE_SUFFIX)) continue;
      if (name.endsWith('.meta.json')) continue;

      let metadata = this.loadMetadata(name);
      if (!metadata) {
        // Fallback to file stats if metadata is missing
        try {
          const stat = fs.statSync(path.join(this.backupDir, name));
          metadata = {
            filename: name,
            size: stat.size,
            created_at: stat.mtime.toISOString(),
            description: '旧版本备份',
            is_auto: false,
          };
        } catch {
          continue;
        }
      }
      backups.push(metadata);
    }

    // Sort by created_at descending (newest first)
    backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return backups;
  }

  /**
   * RestoreBackup — restore settings from a backup file.
   * Matches Go backupService.RestoreBackup (backup_service.go lines 173-200).
   * Creates a pre-restore automatic backup before importing.
   */
  async restoreBackup(filename: string): Promise<void> {
    this.validateBackupFilename(filename);

    const backupPath = path.join(this.backupDir, filename);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`备份文件不存在: ${filename}`);
    }

    // Create pre-restore backup
    try {
      await this.createBackup('恢复前自动备份', true);
    } catch (err) {
      this.logger.warn(`恢复前自动备份失败: ${err}`);
    }

    const content = fs.readFileSync(backupPath, 'utf-8');
    const data = JSON.parse(content);

    await this.settingsService.importAll(data);

    this.logger.log(`系统设置已从备份恢复: ${filename}`);
  }

  /**
   * DeleteBackup — delete a backup file and its metadata.
   * Matches Go backupService.DeleteBackup (backup_service.go lines 203-223).
   */
  async deleteBackup(filename: string): Promise<void> {
    this.validateBackupFilename(filename);

    const backupPath = path.join(this.backupDir, filename);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`备份文件不存在: ${filename}`);
    }

    fs.unlinkSync(backupPath);

    // Delete metadata if it exists
    const metaPath = this.getMetadataPath(filename);
    if (fs.existsSync(metaPath)) {
      try {
        fs.unlinkSync(metaPath);
      } catch {
        // Ignore metadata deletion errors
      }
    }

    this.logger.log(`备份已删除: ${filename}`);
  }

  /**
   * CleanOldBackups — delete oldest backups beyond keepCount.
   * Matches Go backupService.CleanOldBackups (backup_service.go lines 228-246).
   */
  async cleanOldBackups(keepCount: number): Promise<void> {
    if (keepCount < 1) {
      throw new Error('保留数量必须大于0');
    }
    if (keepCount > MAX_KEEP_COUNT) {
      throw new Error(`保留数量不能超过 ${MAX_KEEP_COUNT}`);
    }

    const backups = await this.listBackups();
    if (backups.length <= keepCount) return;

    for (let i = keepCount; i < backups.length; i++) {
      try {
        await this.deleteBackup(backups[i].filename);
      } catch {
        // Continue deleting others even if one fails
      }
    }
  }

  /**
   * SetMaxBackupCount — update max backup count and auto-cleanup.
   * Matches Go backupService.SetMaxBackupCount (backup_service.go lines 301-310).
   */
  setMaxBackupCount(maxCount: number): void {
    if (maxCount < 0) {
      this.logger.warn('最大备份数量不能为负数，设置为默认值10');
      maxCount = DEFAULT_MAX_BACKUP_COUNT;
    }
    this.maxBackupCount = maxCount;
    if (maxCount > 0) {
      this.cleanOldBackups(maxCount).catch(() => {});
    }
  }

  getMaxBackupCount(): number {
    return this.maxBackupCount;
  }

  /**
   * validateBackupFilename — prevent path traversal, enforce format.
   * Matches Go backupService.validateBackupFilename (backup_service.go lines 250-272).
   * Valid format: settings_backup_YYYYMMDD_HHMMSS.json (15-char timestamp)
   */
  private validateBackupFilename(filename: string): void {
    if (!filename) {
      throw new Error('备份文件名为空');
    }
    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error(`无效的备份文件名: ${filename}`);
    }
    // Validate format: prefix + 15-char timestamp + suffix
    const expectedLen = BACKUP_FILE_PREFIX.length + 15 + BACKUP_FILE_SUFFIX.length; // 16+15+5=36
    if (
      filename.length !== expectedLen ||
      !filename.startsWith(BACKUP_FILE_PREFIX) ||
      !filename.endsWith(BACKUP_FILE_SUFFIX)
    ) {
      throw new Error(`无效的备份文件名: ${filename}`);
    }
    // Timestamp part must be digits and underscores only
    const mid = filename.slice(BACKUP_FILE_PREFIX.length, filename.length - BACKUP_FILE_SUFFIX.length);
    for (const ch of mid) {
      if (ch !== '_' && (ch < '0' || ch > '9')) {
        throw new Error(`无效的备份文件名: ${filename}`);
      }
    }
  }

  /**
   * getMetadataPath — get metadata file path for a backup.
   * x.json -> x.meta.json
   * Matches Go getMetadataPath (backup_service.go lines 275-278).
   */
  private getMetadataPath(filename: string): string {
    const base = filename.slice(0, -BACKUP_FILE_SUFFIX.length);
    return path.join(this.backupDir, base + '.meta.json');
  }

  /**
   * saveMetadata — write metadata companion file.
   * Matches Go saveMetadata (backup_service.go lines 280-286).
   */
  private saveMetadata(filename: string, metadata: BackupInfo): void {
    const metaPath = this.getMetadataPath(filename);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * loadMetadata — read metadata companion file.
   * Matches Go loadMetadata (backup_service.go lines 288-298).
   * Returns null if metadata file doesn't exist or is invalid.
   */
  private loadMetadata(filename: string): BackupInfo | null {
    const metaPath = this.getMetadataPath(filename);
    try {
      const content = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(content) as BackupInfo;
    } catch {
      return null;
    }
  }

  /**
   * formatTimestamp — format Date as YYYYMMDD_HHMMSS (local time, matches Go).
   * Go uses time.Now().Format("20060102_150405") which is local time.
   */
  private formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());
    return `${year}${month}${day}_${hour}${minute}${second}`;
  }
}
