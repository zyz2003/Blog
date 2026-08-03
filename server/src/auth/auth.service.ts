import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { TokenService } from './token.service';
import { DRIZZLE } from '../database/database.module';
import { users } from '../database/schemas/user.schema';
import { userGroups } from '../database/schemas/user-group.schema';
import { generatePublicID, EntityType } from '../common/utils/sqids.util';
import { formatToChinaTime } from '../common/utils/time.util';
import { SettingsService } from '../settings/settings.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { LoginResponse, LoginUserInfo } from './dto/login-response.dto';
import { eq } from 'drizzle-orm';
import * as bcryptjs from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    @Inject(DRIZZLE) private readonly db: any,
    private readonly settingsService: SettingsService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    // Look up user by email
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // Verify password
    const isValid = await bcryptjs.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // Check status
    if (user.status === 2) {
      throw new ForbiddenException('用户未激活');
    }
    if (user.status === 3) {
      throw new ForbiddenException('用户已被封禁');
    }

    // Look up user group
    const [userGroup] = await this.db
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, user.userGroupId));

    const permissions = Array.isArray(userGroup?.permissions)
      ? userGroup.permissions
      : [];

    // Generate session tokens
    const tokens = await this.tokenService.generateSessionTokens({
      id: user.id,
      userGroupId: user.userGroupId,
      permissions,
    });

    // Process avatar URL
    let avatar = user.avatar;
    if (avatar && !avatar.startsWith('http')) {
      const gravatarBase = this.settingsService.get('GRAVATAR_URL') || 'https://cravatar.cn/avatar/';
      avatar = gravatarBase + avatar;
    }

    // Build userInfo
    // Note: Go LoginUserInfoResponse uses time.Time (RFC3339) for dates,
    // while GetUserInfoResponse uses formatted strings — we follow Go's inconsistency
    const userInfo: LoginUserInfo = {
      id: generatePublicID(user.id, EntityType.User),
      created_at: user.createdAt?.toISOString() || null,
      updated_at: user.updatedAt?.toISOString() || null,
      username: user.username,
      nickname: user.nickname,
      avatar,
      email: user.email,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      userGroupID: user.userGroupId, // RAW database ID (number) per Go inconsistency
      userGroup: {
        id: generatePublicID(userGroup.id, EntityType.UserGroup),
        name: userGroup.name,
        description: userGroup.description,
      },
      status: user.status,
    };

    // Update last login time
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      userInfo,
      roles: [String(user.userGroupId)],
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokens.expires,
    };
  }

  async checkEmail(email: string): Promise<{ exists: boolean; registrationEnabled: boolean }> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    const registrationEnabled = this.settingsService.get('ALLOW_REGISTRATION') === 'true';
    return { exists: !!user, registrationEnabled };
  }
}
