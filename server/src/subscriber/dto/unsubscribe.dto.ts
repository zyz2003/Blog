import { IsEmail } from 'class-validator';

/**
 * UnsubscribeDto — matches Go UnsubscribeRequest.
 * Reference: pkg/handler/subscriber/handler.go
 *
 * Body: { email }
 * - email: subscriber's email address to unsubscribe
 */
export class UnsubscribeDto {
  @IsEmail({}, { message: '邮箱格式无效' })
  email: string;
}
