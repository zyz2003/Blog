import {
  IsOptional,
  IsInt,
  IsArray,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * BatchImportRequestDto — matches Go BatchImportAlbums request body exactly.
 * Reference: pkg/handler/album/handler.go BatchImportAlbums.
 * urls is required array of 1-100 URLs for batch image import.
 */
export class BatchImportRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  urls: string[];

  @IsOptional()
  @IsString()
  thumbParam?: string;

  @IsOptional()
  @IsString()
  bigParam?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}
