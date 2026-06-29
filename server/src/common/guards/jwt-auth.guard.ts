import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ErrorCodes } from '../constants/error-codes';

/**
 * Global JWT authentication guard.
 * Checks Authorization Bearer header, validates JWT, sets request.user.
 * Skips authentication when @Public() decorator is present on handler or controller.
 *
 * Per D-07, D-08: JwtAuthGuard registered globally (APP_GUARD), public routes
 * use @Public() decorator to skip auth. Matches Go's JWTAuth middleware.
 *
 * Note: The actual JwtModule configuration (secret, sign options) will be
 * added in Phase 02 Auth. For Phase 01, the guard structure exists but
 * will not be registered globally until app.module.ts wiring.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Override handleRequest to provide Go-compatible error messages.
   * Go's JWTAuth returns specific Chinese messages for different failure cases.
   */
  handleRequest<TUser = any>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException(ErrorCodes.TOKEN_EXPIRED);
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(ErrorCodes.TOKEN_INVALID_OR_EXPIRED);
      }
      if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException(ErrorCodes.TOKEN_INVALID_OR_EXPIRED);
      }
      throw err || new UnauthorizedException(ErrorCodes.TOKEN_MISSING);
    }
    return user;
  }
}
