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
 * CreateArticleDto — matches Go CreateArticleRequest JSON fields exactly.
 * Per D-46: separate Create/Update DTOs.
 * Per D-47: status includes SCHEDULED per Go enum values.
 * All JSON keys use snake_case matching Go JSON tags.
 */
export class CreateArticleDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED'])
  status: string = 'DRAFT';

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
  show_on_home?: boolean = true;

  @IsOptional()
  @IsInt()
  home_sort?: number = 0;

  @IsOptional()
  @IsInt()
  pin_sort?: number = 0;

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
  is_primary_color_manual?: boolean = false;

  @IsOptional()
  @IsString()
  abbrlink?: string;

  @IsOptional()
  @IsBoolean()
  copyright?: boolean = true;

  @IsOptional()
  @IsBoolean()
  is_reprint?: boolean = false;

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
  is_doc?: boolean = false;

  @IsOptional()
  @IsString()
  doc_series_id?: string;

  @IsOptional()
  @IsInt()
  doc_sort?: number = 0;
}
