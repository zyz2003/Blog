import {
  IsString,
  IsOptional,
  IsUrl,
  IsEmail,
  MaxLength,
  IsIn,
  IsInt,
  IsBoolean,
} from 'class-validator';

/**
 * UpdateLinkRequestDto — matches Go AdminUpdateLinkRequest JSON fields exactly.
 * PUT /links/:id
 * Same fields as AdminCreateLinkRequestDto but all optional except those explicitly required.
 */
export class UpdateLinkRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

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
  @IsInt()
  category_id?: number;

  @IsOptional()
  @IsInt()
  tag_id?: number | null;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'INVALID'])
  status?: string;

  @IsOptional()
  @IsString()
  siteshot?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['NEW', 'UPDATE'])
  type?: string;

  @IsOptional()
  @IsUrl()
  original_url?: string;

  @IsOptional()
  @IsString()
  update_reason?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  skip_health_check?: boolean;
}
