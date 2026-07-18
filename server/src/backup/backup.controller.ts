import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BackupService, BackupInfo } from './backup.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateBackupRequestDto } from './dto/create-backup-request.dto';
import { RestoreBackupRequestDto } from './dto/restore-backup-request.dto';
import { DeleteBackupRequestDto } from './dto/delete-backup-request.dto';
import { CleanBackupsRequestDto } from './dto/clean-backups-request.dto';
import { ErrorCodes } from '../common/constants/error-codes';

/**
 * BackupController — admin API for settings backup management.
 * Matches Go ConfigBackupHandler (handler.go).
 *
 * All routes require JWT + Admin auth, matching Go's:
 *   configBackupGroup := api.Group("/config/backup").Use(r.mw.JWTAuth(), r.mw.AdminAuth())
 *
 * Routes:
 *   POST /api/config/backup/create  → CreateBackup
 *   GET  /api/config/backup/list    → ListBackups
 *   POST /api/config/backup/restore → RestoreBackup
 *   POST /api/config/backup/delete  → DeleteBackup
 *   POST /api/config/backup/clean   → CleanOldBackups
 */
@Controller('config/backup')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * CreateBackup — create a settings backup.
   * Matches Go CreateBackup (handler.go lines 61-84).
   * Response: { data: BackupInfo, message: "备份创建成功" }
   */
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createBackup(
    @Body() dto: CreateBackupRequestDto,
  ): Promise<{ data: BackupInfo; message: string }> {
    const description = dto.description || '手动备份';
    const isAuto = dto.is_auto ?? false;

    try {
      const backup = await this.backupService.createBackup(description, isAuto);
      return { data: backup, message: '备份创建成功' };
    } catch (err) {
      throw new HttpException(
        ErrorCodes.BACKUP_CREATE_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ListBackups — get all backup files.
   * Matches Go ListBackups (handler.go lines 95-104).
   * Response: { data: BackupInfo[], message: "获取备份列表成功" }
   */
  @Get('list')
  async listBackups(): Promise<{ data: BackupInfo[]; message: string }> {
    try {
      const backups = await this.backupService.listBackups();
      return { data: backups, message: '获取备份列表成功' };
    } catch (err) {
      throw new HttpException(
        ErrorCodes.BACKUP_LIST_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * RestoreBackup — restore settings from a backup file.
   * Matches Go RestoreBackup (handler.go lines 118-132).
   * Response: { data: null, message: "系统设置已恢复成功，请刷新页面以查看最新配置" }
   */
  @HttpCode(HttpStatus.OK)
  @Post('restore')
  async restoreBackup(
    @Body() dto: RestoreBackupRequestDto,
  ): Promise<{ data: null; message: string }> {
    try {
      await this.backupService.restoreBackup(dto.filename);
      return { data: null, message: '系统设置已恢复成功，请刷新页面以查看最新配置' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('不存在')) {
        throw new HttpException(
          ErrorCodes.BACKUP_FILE_NOT_FOUND,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (msg.includes('无效')) {
        throw new HttpException(
          ErrorCodes.BACKUP_FILENAME_INVALID,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        ErrorCodes.BACKUP_RESTORE_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DeleteBackup — delete a backup file.
   * Matches Go DeleteBackup (handler.go lines 146-160).
   * Response: { data: null, message: "备份已删除" }
   */
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteBackup(
    @Body() dto: DeleteBackupRequestDto,
  ): Promise<{ data: null; message: string }> {
    try {
      await this.backupService.deleteBackup(dto.filename);
      return { data: null, message: '备份已删除' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('不存在')) {
        throw new HttpException(
          ErrorCodes.BACKUP_FILE_NOT_FOUND,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (msg.includes('无效')) {
        throw new HttpException(
          ErrorCodes.BACKUP_FILENAME_INVALID,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        ErrorCodes.BACKUP_DELETE_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * CleanOldBackups — clean old backups, keep only keepCount newest.
   * Matches Go CleanOldBackups (handler.go lines 174-192).
   * Response: { data: null, message: "旧备份清理成功" }
   */
  @HttpCode(HttpStatus.OK)
  @Post('clean')
  async cleanOldBackups(
    @Body() dto: CleanBackupsRequestDto,
  ): Promise<{ data: null; message: string }> {
    try {
      await this.backupService.cleanOldBackups(dto.keep_count);
      return { data: null, message: '旧备份清理成功' };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('保留数量')) {
        throw new HttpException(
          ErrorCodes.BACKUP_KEEP_COUNT_INVALID,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        ErrorCodes.BACKUP_CLEAN_FAILED,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
