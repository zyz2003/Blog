import { IsOptional, IsString, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateBackupRequest — matches Go CreateBackupRequest (handler.go lines 30-33).
 * description is optional (defaults to "手动备份").
 * is_auto is optional (defaults to false).
 */
export class CreateBackupRequestDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_auto?: boolean;
}
