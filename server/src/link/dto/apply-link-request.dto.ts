import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsEmail,
  MaxLength,
  IsIn,
} from 'class-validator';

/**
 * ApplyLinkRequestDto — matches Go ApplyLinkRequest JSON fields exactly.
 * POST /public/links
 * Per D-179: tag is single object, not array.
 */
export class ApplyLinkRequestDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['NEW', 'UPDATE'])
  type: string;

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

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsUrl()
  original_url?: string;

  @IsOptional()
  @IsString()
  update_reason?: string;

  // CAPTCHA fields — only required for repeat applicants
  @IsOptional()
  @IsString()
  turnstile_token?: string;

  @IsOptional()
  @IsString()
  geetest_lot_number?: string;

  @IsOptional()
  @IsString()
  geetest_captcha_output?: string;

  @IsOptional()
  @IsString()
  geetest_pass_token?: string;

  @IsOptional()
  @IsString()
  geetest_gen_time?: string;

  @IsOptional()
  @IsString()
  image_captcha_id?: string;

  @IsOptional()
  @IsString()
  image_captcha_answer?: string;
}
