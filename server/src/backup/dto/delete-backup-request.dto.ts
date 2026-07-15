import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DeleteBackupRequest — matches Go DeleteBackupRequest (handler.go lines 41-43).
 * filename is required.
 */
export class DeleteBackupRequestDto {
  @IsNotEmpty()
  @IsString()
  filename!: string;
}
