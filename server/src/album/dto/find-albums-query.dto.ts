import {
  IsOptional,
  IsInt,
  IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * FindAlbumsQueryDto — matches Go GetAlbums query parameters exactly.
 * Reference: pkg/handler/album/handler.go GetAlbums.
 * Supports: page, pageSize, categoryId, tag, createdAt range, sort.
 * createdAt maps to query params createdAt[0] and createdAt[1].
 */
export class FindAlbumsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @Transform(({ value }) => {
    // Handle createdAt[0] and createdAt[1] from query string
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return value;
  })
  createdAt?: string[];

  @IsOptional()
  @IsString()
  sort?: string = 'display_order_asc';
}
