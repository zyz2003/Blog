import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for restore history version request.
 * Matches Go RestoreHistoryRequest model.
 */
export class RestoreHistoryDto {
  @IsOptional()
  @IsString()
  change_note?: string;
}
