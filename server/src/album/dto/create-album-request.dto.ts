import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateAlbumDto — matches Go AddAlbum request body exactly.
 * Reference: pkg/handler/album/handler.go AddAlbum.
 * fileHash is required for dedup (CreateOrRestore pattern per D-190).
 * imageUrl is required; other fields optional.
 */
export class CreateAlbumDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsNotEmpty()
  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsString()
  bigImageUrl?: string;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

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
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fileSize?: number;

  @IsOptional()
  @IsString()
  format?: string;

  @IsNotEmpty()
  @IsString()
  fileHash: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  created_at?: string;

  @IsOptional()
  @IsString()
  published_at?: string | null;
}
