import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
} from 'class-validator';

/**
 * UpdateArticleDto — all fields optional (PartialType of CreateArticleDto).
 * Per D-46: separate Create/Update DTOs.
 * Do NOT use @IsNotEmpty on any field — updates can set fields to empty/null.
 * Manual definition per Phase 03-01 pattern (avoid @nestjs/mapped-types dependency).
 */
export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED'])
  status?: string;

  @IsOptional()
  @IsString()
  content_md?: string;

  @IsOptional()
  @IsString()
  content_html?: string;

  @IsOptional()
  @IsString()
  cover_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  post_tag_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  post_category_ids?: string[];

  @IsOptional()
  @IsString()
  ip_location?: string;

  @IsOptional()
  @IsBoolean()
  show_on_home?: boolean;

  @IsOptional()
  @IsInt()
  home_sort?: number;

  @IsOptional()
  @IsInt()
  pin_sort?: number;

  @IsOptional()
  @IsString()
  top_img_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  summaries?: string[];

  @IsOptional()
  @IsString()
  primary_color?: string;

  @IsOptional()
  @IsBoolean()
  is_primary_color_manual?: boolean;

  @IsOptional()
  @IsString()
  abbrlink?: string;

  @IsOptional()
  @IsBoolean()
  copyright?: boolean;

  @IsOptional()
  @IsBoolean()
  is_reprint?: boolean;

  @IsOptional()
  @IsString()
  copyright_author?: string;

  @IsOptional()
  @IsString()
  copyright_author_href?: string;

  @IsOptional()
  @IsString()
  copyright_url?: string;

  @IsOptional()
  @IsString()
  keywords?: string;

  @IsOptional()
  @IsString()
  scheduled_at?: string;

  @IsOptional()
  @IsObject()
  extra_config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_doc?: boolean;

  @IsOptional()
  @IsString()
  doc_series_id?: string;

  @IsOptional()
  @IsInt()
  doc_sort?: number;
}
