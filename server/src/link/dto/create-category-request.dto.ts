import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

/**
 * CreateCategoryRequestDto — matches Go CreateLinkCategoryRequest JSON fields exactly.
 */
export class CreateCategoryRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['card', 'list'])
  style: string;

  @IsOptional()
  @IsString()
  description?: string;
}
