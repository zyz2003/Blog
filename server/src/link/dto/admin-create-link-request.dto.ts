import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsEmail,
  MaxLength,
  IsIn,
  IsInt,
  IsBoolean,
} from 'class-validator';

/**
 * AdminCreateLinkRequestDto — matches Go AdminCreateLinkRequest JSON fields exactly.
 * POST /links
 */
export class AdminCreateLinkRequestDto {
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

  @IsInt()
  @IsNotEmpty()
  category_id: number;

  @IsOptional()
  @IsInt()
  tag_id?: number | null;

  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'INVALID'])
  status: string;

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
  sort_order?: number = 0;

  @IsOptional()
  @IsBoolean()
  skip_health_check?: boolean = false;
}
