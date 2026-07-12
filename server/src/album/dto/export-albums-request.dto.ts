import { IsOptional, IsArray, IsInt, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ExportAlbumsRequestDto — matches Go ExportAlbums request body exactly.
 * Reference: pkg/handler/album/handler.go ExportAlbums.
 * album_ids: optional array of IDs to export (export all if empty).
 * format: "json" or "zip", defaults to "json".
 */
export class ExportAlbumsRequestDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  album_ids?: number[];

  @IsOptional()
  @IsString()
  @IsIn(['json', 'zip'])
  format?: string = 'json';
}
