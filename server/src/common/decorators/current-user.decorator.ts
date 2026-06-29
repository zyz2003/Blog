import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the authenticated user from the request object.
 * request.user is set by JwtAuthGuard after successful JWT validation.
 *
 * Usage:
 *   @CurrentUser() user: CustomClaims
 *   @CurrentUser('user_id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
