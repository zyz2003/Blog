import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CleanBackupsRequest — matches Go CleanBackupsRequest (handler.go lines 46-48).
 * keep_count is required, min 1, max 100.
 */
export class CleanBackupsRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  keep_count!: number;
}
