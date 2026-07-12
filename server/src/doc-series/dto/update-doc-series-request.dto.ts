import { IsString, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * UpdateDocSeriesRequestDto — matches Go UpdateDocSeriesRequest exactly.
 * Reference: pkg/domain/model/docseries.go UpdateDocSeriesRequest.
 * All fields optional (partial update).
 * Per D-194: no article list field (articles managed via article endpoints).
 */
export class UpdateDocSeriesRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cover_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}
