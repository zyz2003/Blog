import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

/**
 * SubscribeDto — matches Go SubscribeRequest.
 * Reference: pkg/handler/subscriber/handler.go
 *
 * Body: { email, code }
 * - email: subscriber's email address
 * - code: verification code received via email
 */
export class SubscribeDto {
  @IsEmail({}, { message: '邮箱格式无效' })
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
