import {
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * SendVerificationCodeDto — matches Go SendVerificationCodeRequest.
 * Reference: pkg/handler/subscriber/handler.go
 *
 * Body: { email, turnstile_token?, geetest_lot_number?, geetest_captcha_output?,
 *         geetest_pass_token?, geetest_gen_time?, image_captcha_id?, image_captcha_answer? }
 *
 * Per D-207: CaptchaService verifies captcha params before sending code.
 * CR-01 fix: Geetest field names updated to match Go backend and frontend.
 */
export class SendVerificationCodeDto {
  @IsEmail({}, { message: '邮箱格式无效' })
  email: string;

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
