import { IsString, IsOptional, IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateAlbumCategoryRequestDto — matches Go CreateAlbumCategoryRequest exactly.
 * Reference: pkg/domain/model/album_category.go CreateAlbumCategoryRequest.
 * name is required; description and displayOrder are optional.
 */
export class CreateAlbumCategoryRequestDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number = 0;
}
