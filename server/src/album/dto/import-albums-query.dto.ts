import { IsOptional, IsInt, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * ImportAlbumsQueryDto — matches Go ImportAlbums form/query fields exactly.
 * Reference: pkg/handler/album/handler.go ImportAlbums.
 * These are form fields (not JSON body) sent alongside the file upload.
 * skip_existing defaults to true, overwrite_existing defaults to false.
 */
export class ImportAlbumsQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  skip_existing: boolean = true;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overwrite_existing: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  default_category_id?: number;
}
