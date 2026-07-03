import { IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';

/**
 * UpdatePostCategoryDto matches Go UpdatePostCategoryRequest:
 * All fields optional (pointer types in Go).
 * Manually defined instead of PartialType to avoid @nestjs/mapped-types dependency.
 */
export class UpdatePostCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_series?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
