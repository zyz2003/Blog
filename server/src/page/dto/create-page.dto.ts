import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';

/**
 * CreatePageDto matches Go CreatePageRequest per D-77:
 * title, path, content are required (binding:"required" in Go).
 * Optional fields: markdown_content, custom_js, custom_css,
 * description, is_published, show_comment, sort.
 */
export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  path: string;

  @IsString()
  @IsNotEmpty()
  content: string;

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
