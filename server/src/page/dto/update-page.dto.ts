import { IsOptional, IsString, IsBoolean, IsInt } from 'class-validator';

/**
 * UpdatePageDto matches Go UpdatePageOptions per D-78:
 * All fields optional (pointer types *string/*bool/*int in Go).
 * Manually defined instead of PartialType to avoid @nestjs/mapped-types dependency.
 * Only provided fields are updated.
 */
export class UpdatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  markdown_content?: string;

  @IsOptional()
  @IsString()
  custom_js?: string;

  @IsOptional()
  @IsString()
  custom_css?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsOptional()
  @IsBoolean()
  show_comment?: boolean;

  @IsOptional()
  @IsInt()
  sort?: number;
}
