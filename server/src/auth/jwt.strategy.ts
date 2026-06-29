import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * JWT strategy for Passport that validates Bearer tokens.
 * Decodes JWT claims matching Go's CustomClaims structure:
 *   { user_id, user_group_id, permissions, iat, exp, nbf, iss }
 *
 * This is a minimal implementation for Phase 01 infrastructure wiring.
 * Full authentication logic (login, refresh) will be added in Phase 02.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change-me-in-production'),
    });
  }

  async validate(payload: any) {
    if (!payload.user_id || !payload.user_group_id) {
      throw new UnauthorizedException('权限信息格式不正确');
    }
    return payload;
  }
}
