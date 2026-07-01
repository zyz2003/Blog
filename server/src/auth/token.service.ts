import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { DRIZZLE } from '../database/database.module';
import { users } from '../database/schemas/user.schema';
import { userGroups } from '../database/schemas/user-group.schema';
import { generatePublicID, decodePublicID, EntityType } from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';
import * as jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

/**
 * Encode permissions to base64 string for Go JWT compatibility.
 * Go's CustomClaims has `Permissions []byte` which serializes as base64 in JSON.
 */
function encodePermissions(permissions: number[]): string {
  return Buffer.from(permissions).toString('base64');
}

/**
 * Decode permissions from base64 string (Go JWT format) back to number[].
 * Handles both base64 strings (from Go-issued tokens) and number arrays.
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
export class TokenService {
  constructor(
    private readonly settingsService: SettingsService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  async generateAccessToken(user: {
    id: number;
    userGroupId: number;
    permissions: number[];
  }): Promise<string> {
    const secret = this.settingsService.get('JWT_SECRET') || 'change-me-in-production';
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      user_id: generatePublicID(user.id, EntityType.User),
      user_group_id: generatePublicID(user.userGroupId, EntityType.UserGroup),
      permissions: encodePermissions(user.permissions), // base64 string for Go []byte compat
      iss: 'anheyu-app',
      iat: now,
      exp: now + 900, // 15 minutes
      nbf: now,
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  async generateRefreshToken(userId: number): Promise<string> {
    const secret = this.settingsService.get('JWT_SECRET') || 'change-me-in-production';
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      user_id: generatePublicID(userId, EntityType.User),
      iss: 'anheyu-app',
      iat: now,
      exp: now + 2592000, // 30 days
      nbf: now,
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  async generateSessionTokens(user: {
    id: number;
    userGroupId: number;
    permissions: number[];
  }): Promise<{ accessToken: string; refreshToken: string; expires: number }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.generateRefreshToken(user.id),
    ]);

    const expires = Date.now() + 15 * 60 * 1000;

    return { accessToken, refreshToken, expires };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expires: number }> {
    const secret = this.settingsService.get('JWT_SECRET') || 'change-me-in-production';

    let claims: any;
    try {
      claims = jwt.verify(refreshToken, secret, { algorithms: ['HS256'] }) as any;
    } catch {
      throw new UnauthorizedException(ErrorCodes.TOKEN_INVALID_OR_EXPIRED);
    }

    if (!claims.user_id) {
      throw new UnauthorizedException(ErrorCodes.TOKEN_FORMAT_INVALID);
    }

    // Decode public ID to get database ID
    let dbID: number;
    try {
      const decoded = decodePublicID(claims.user_id);
      if (decoded.entityType !== EntityType.User) {
        throw new UnauthorizedException(ErrorCodes.TOKEN_FORMAT_INVALID);
      }
      dbID = decoded.dbID;
    } catch {
      throw new UnauthorizedException(ErrorCodes.TOKEN_FORMAT_INVALID);
    }

    // Look up user
    const [user] = await this.db
      .select({
        id: users.id,
        userGroupId: users.userGroupId,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, dbID));

    if (!user) {
      throw new UnauthorizedException(ErrorCodes.TOKEN_INVALID_OR_EXPIRED);
    }

    if (user.status !== 1) {
      throw new UnauthorizedException(
        user.status === 2 ? '用户未激活' : '用户已被封禁',
      );
    }

    // Get user group permissions
    const [group] = await this.db
      .select({ permissions: userGroups.permissions })
      .from(userGroups)
      .where(eq(userGroups.id, user.userGroupId));

    const permissions = Array.isArray(group?.permissions)
      ? group.permissions
      : [];

    const accessToken = await this.generateAccessToken({
      id: user.id,
      userGroupId: user.userGroupId,
      permissions,
    });

    const expires = Date.now() + 15 * 60 * 1000;

    return { accessToken, expires };
  }
}
