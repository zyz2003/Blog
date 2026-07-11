import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  ArrayMaxSize,
  ValidateNested,
  IsString,
  IsUrl,
  IsEmail,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ImportLinkItemDto — matches Go ImportLinkItem JSON fields exactly.
 * Single link data structure for import.
 */
export class ImportLinkItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(512)
  rss_url?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  siteshot?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  category_name?: string;

  @IsOptional()
  @IsString()
  tag_name?: string;

  @IsOptional()
  @IsString()
  tag_color?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'INVALID'])
  status?: string;
}

/**
 * ImportLinksRequestDto — matches Go ImportLinksRequest JSON fields exactly.
 * POST /links/import
 * Max 1000 links per import.
 */
export class ImportLinksRequestDto {
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportLinkItemDto)
  links: ImportLinkItemDto[];

  @IsOptional()
  @IsBoolean()
  skip_duplicates?: boolean = false;

  @IsOptional()
  @IsBoolean()
  create_categories?: boolean = false;

  @IsOptional()
  @IsBoolean()
  create_tags?: boolean = false;

  @IsOptional()
  @IsInt()
  default_category_id?: number | null;
}
