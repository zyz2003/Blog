import { IsString, IsOptional, IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateDocSeriesRequestDto — matches Go CreateDocSeriesRequest exactly.
 * Reference: pkg/domain/model/docseries.go CreateDocSeriesRequest.
 * name is required; description, cover_url, sort are optional.
 * Per D-194: no article list field (articles managed via article endpoints).
 */
export class CreateDocSeriesRequestDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cover_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number = 0;
}
