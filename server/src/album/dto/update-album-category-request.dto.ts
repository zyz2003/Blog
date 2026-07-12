import { IsString, IsOptional, IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * UpdateAlbumCategoryRequestDto — matches Go UpdateAlbumCategoryRequest exactly.
 * Reference: pkg/domain/model/album_category.go UpdateAlbumCategoryRequest.
 * name is required; description and displayOrder are optional.
 */
export class UpdateAlbumCategoryRequestDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}
