import {
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * SendVerificationCodeDto — matches Go SendVerificationCodeRequest.
 * Reference: pkg/handler/subscriber/handler.go
 *
 * Body: { email, turnstile_token?, geetest_challenge?, geetest_validate?,
 *         geetest_seccode?, image_captcha_id?, image_captcha_answer? }
 *
 * Per D-207: CaptchaService verifies captcha params before sending code.
 */
export class SendVerificationCodeDto {
  @IsEmail({}, { message: '邮箱格式无效' })
  email: string;

  @IsOptional()
  @IsString()
  turnstile_token?: string;

  @IsOptional()
  @IsString()
  geetest_challenge?: string;

  @IsOptional()
  @IsString()
  geetest_validate?: string;

  @IsOptional()
  @IsString()
  geetest_seccode?: string;

  @IsOptional()
  @IsString()
  image_captcha_id?: string;

  @IsOptional()
  @IsString()
  image_captcha_answer?: string;
}
