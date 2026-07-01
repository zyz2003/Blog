import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SettingsService } from '../settings/settings.service';

/**
 * Decode permissions from base64 string (Go JWT format) or number[] back to number[].
 */
function decodePermissions(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map(Number);
  }
  if (typeof raw === 'string') {
    try {
      const buf = Buffer.from(raw, 'base64');
      return Array.from(buf);
    } catch {
      return [];
    }
  }
  return [];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly settingsService: SettingsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        request: any,
        rawJwtToken: string,
        done: (err: any, secret?: string) => void,
      ) => {
        const secret =
          settingsService.get('JWT_SECRET') || 'change-me-in-production';
        done(null, secret);
      },
    });
  }

  async validate(payload: any) {
    if (!payload.user_id || !payload.user_group_id) {
      throw new UnauthorizedException('权限信息格式不正确');
    }
    // Normalize permissions: decode base64 (Go format) to number[]
    payload.permissions = decodePermissions(payload.permissions);
    return payload;
  }
}
