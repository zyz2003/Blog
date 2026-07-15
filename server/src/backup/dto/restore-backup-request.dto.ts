import { IsNotEmpty, IsString } from 'class-validator';

/**
 * RestoreBackupRequest — matches Go RestoreBackupRequest (handler.go lines 36-38).
 * filename is required.
 */
export class RestoreBackupRequestDto {
  @IsNotEmpty()
  @IsString()
  filename!: string;
}
