import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  image_captcha_id?: string;

  @IsOptional()
  @IsString()
  image_captcha_answer?: string;

  @IsOptional()
  @IsString()
  turnstile_token?: string;
}
