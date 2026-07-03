import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

/**
 * CreatePostCategoryDto matches Go CreatePostCategoryRequest:
 * name (required), slug, description, is_series, sort_order
 */
export class CreatePostCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
