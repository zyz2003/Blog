import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Search query DTO for GET /api/search endpoint.
 * Per D-149: q is required, page defaults to 1, size defaults to 10.
 * Matches Go SearchRequest structure.
 */
export class SearchQueryDto {
  @IsString()
  @IsNotEmpty()
  q!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  size: number = 10;
}
