import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ListDocSeriesQueryDto — matches Go ListDocSeries query parameters exactly.
 * Reference: pkg/handler/doc_series/handler.go List.
 * Pagination with page and pageSize, defaults match Go backend.
 */
export class ListDocSeriesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 20;
}
