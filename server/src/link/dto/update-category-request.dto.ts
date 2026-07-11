import { IsOptional, IsString, IsIn } from 'class-validator';

/**
 * UpdateCategoryRequestDto — matches Go UpdateLinkCategoryRequest JSON fields exactly.
 */
export class UpdateCategoryRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['card', 'list'])
  style?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
