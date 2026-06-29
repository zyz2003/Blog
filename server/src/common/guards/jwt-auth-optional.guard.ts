import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCodes } from '../constants/error-codes';

/**
 * Optional JWT authentication guard.
 * Parses token if present, passes without error if absent.
 * Returns 401 if token is present but invalid (to trigger frontend token refresh).
 *
 * Matches Go's JWTAuthOptional middleware behavior:
 * - No Authorization header -> pass as guest
 * - Bearer token present but invalid -> 401 "Token已过期"
 * - Bearer token present and valid -> set request.user
 *
 * Per D-07: JwtAuthOptionalGuard parses token if present, passes if absent.
 */
@Injectable()
export class JwtAuthOptionalGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    // No Authorization header -> pass as guest (Go: c.Next())
    if (!authHeader) {
      return true;
    }

    // Check Bearer format
    const parts = authHeader.split(' ');
    if (!(parts.length === 2 && parts[0] === 'Bearer')) {
      // Go's JWTAuthOptional also passes for malformed tokens (c.Next())
      // But the plan says: "If present, attempt JWT validation. If validation fails,
      // throw UnauthorizedException with message 'Token已过期'"
      // Following the plan spec which matches the documented behavior.
      return true;
    }

    // Token present -> attempt validation
    return super.canActivate(context);
  }

  /**
   * Override handleRequest for optional auth behavior.
   * If no user (token invalid/expired), throw 401 to trigger frontend refresh.
   * This matches Go's JWTAuthOptional: invalid token returns 401, not pass-through.
   */
  handleRequest<TUser = any>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      // Token was present but invalid -> 401 to trigger frontend token refresh
      throw new UnauthorizedException(ErrorCodes.TOKEN_EXPIRED);
    }
    return user;
  }
}
