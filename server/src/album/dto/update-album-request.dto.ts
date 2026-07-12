import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * UpdateAlbumDto — matches Go UpdateAlbum request body exactly.
 * Reference: pkg/handler/album/handler.go UpdateAlbum.
 * imageUrl is required; other fields optional (partial update).
 * categoryId can be set to null to remove category association.
 */
export class UpdateAlbumDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number | null;

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
  published_at?: string | null;
}
