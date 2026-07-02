import { Inject, Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { users } from '../database/schemas/user.schema';
import { userGroups } from '../database/schemas/user-group.schema';
import { generatePublicID, decodePublicID, EntityType } from '../common/utils/sqids.util';
import { formatToChinaTime } from '../common/utils/time.util';
import { SettingsService } from '../settings/settings.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { UserInfoResponse } from './dto/user-info-response.dto';
import { AdminUserDTO } from './dto/admin-user.dto';
import { AdminListUsersResponse } from './dto/admin-list-users-response.dto';
import { UserGroupDTO } from './dto/user-group.dto';
import { eq, like, and, sql, isNull } from 'drizzle-orm';
import * as bcryptjs from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly settingsService: SettingsService,
  ) {}

  async getUserInfo(userId: number): Promise<UserInfoResponse> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    const [userGroup] = await this.db
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, user.userGroupId));

    // Avatar processing: GetUserInfo trims slashes (different from AdminListUsers)
    let avatar = user.avatar;
    if (avatar && !avatar.startsWith('http')) {
      const gravatarBase = this.settingsService.get('GRAVATAR_URL') || 'https://cravatar.cn/avatar/';
      avatar = gravatarBase.replace(/\/+$/, '') + '/' + avatar.replace(/^\/+/, '');
    }

    return {
      id: generatePublicID(user.id, EntityType.User),
      created_at: formatToChinaTime(user.createdAt),
      updated_at: formatToChinaTime(user.updatedAt),
      username: user.username,
      nickname: user.nickname,
      avatar,
      email: user.email,
      website: user.website || null,
      lastLoginAt: formatToChinaTime(user.lastLoginAt),
      userGroupID: user.userGroupId, // RAW database ID (number) per Go inconsistency
      userGroup: {
        id: generatePublicID(userGroup.id, EntityType.UserGroup),
        name: userGroup.name,
        description: userGroup.description,
      },
      status: user.status,
    };
  }

  async updatePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    const isValid = await bcryptjs.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('旧密码不正确');
    }

    const hash = await bcryptjs.hash(newPassword, 10);
    await this.db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateProfile(userId: number, nickname?: string, website?: string): Promise<void> {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (nickname !== undefined) updateData.nickname = nickname;
    if (website !== undefined) updateData.website = website;

    await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));
  }

  async adminListUsers(
    page: number,
    pageSize: number,
    keyword?: string,
    groupID?: number,
    status?: number,
  ): Promise<AdminListUsersResponse> {
    const conditions = [isNull(users.deletedAt)];

    if (keyword) {
      const pattern = `%${keyword}%`;
      conditions.push(
        sql`(${users.username} LIKE ${pattern} OR ${users.nickname} LIKE ${pattern} OR ${users.email} LIKE ${pattern})`,
      );
    }

    if (groupID !== undefined) {
      conditions.push(eq(users.userGroupId, groupID));
    }

    if (status !== undefined) {
      conditions.push(eq(users.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const rows = await this.db
      .select()
      .from(users)
      .where(whereClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const userGroupIds = [...new Set(rows.map((u: any) => u.userGroupId))];
    let groupRows: any[] = [];
    if (userGroupIds.length > 0) {
      groupRows = await this.db
        .select()
        .from(userGroups)
        .where(sql`${userGroups.id} IN ${userGroupIds}`);
    }

    const groupMap = new Map<number, any>(groupRows.map((g: any) => [g.id, g]));

    const userList: AdminUserDTO[] = rows.map((user: any) => {
      const group = groupMap.get(user.userGroupId);

      // Avatar processing: AdminListUsers does NOT trim slashes (different from GetUserInfo)
      let avatar = user.avatar;
      if (avatar && !avatar.startsWith('http')) {
        const gravatarBase = this.settingsService.get('GRAVATAR_URL') || 'https://cravatar.cn/avatar/';
        avatar = gravatarBase + avatar;
      }

      return {
        id: generatePublicID(user.id, EntityType.User),
        created_at: formatToChinaTime(user.createdAt),
        updated_at: formatToChinaTime(user.updatedAt),
        username: user.username,
        nickname: user.nickname,
        avatar,
        email: user.email,
        website: user.website || null,
        lastLoginAt: formatToChinaTime(user.lastLoginAt),
        userGroupID: generatePublicID(user.userGroupId, EntityType.UserGroup), // PUBLIC ID (string!)
        userGroup: {
          id: generatePublicID(group.id, EntityType.UserGroup),
          name: group.name,
          description: group.description,
        },
        status: user.status,
      };
    });

    return { users: userList, total, page, size: pageSize };
  }

  async adminCreateUser(dto: any): Promise<AdminUserDTO> {
    const { username, password, email, nickname, userGroupID } = dto;

    // Decode public ID for userGroupID
    const decoded = decodePublicID(userGroupID);
    if (decoded.entityType !== EntityType.UserGroup) {
      throw new NotFoundException(ErrorCodes.INVALID_PUBLIC_ID);
    }

    const hash = await bcryptjs.hash(password, 10);

    const [user] = await this.db
      .insert(users)
      .values({
        username,
        passwordHash: hash,
        email,
        nickname: nickname || null,
        userGroupId: decoded.dbID,
        status: 1, // Default active, matches Go UserStatusActive
      })
      .returning();

    const [group] = await this.db
      .select()
      .from(userGroups)
      .where(eq(userGroups.id, user.userGroupId));

    let avatar = user.avatar;
    if (avatar && !avatar.startsWith('http')) {
      const gravatarBase = this.settingsService.get('GRAVATAR_URL') || 'https://cravatar.cn/avatar/';
      avatar = gravatarBase + avatar;
    }

    return {
      id: generatePublicID(user.id, EntityType.User),
      created_at: formatToChinaTime(user.createdAt),
      updated_at: formatToChinaTime(user.updatedAt),
      username: user.username,
      nickname: user.nickname,
      avatar,
      email: user.email,
      website: user.website || null,
      lastLoginAt: formatToChinaTime(user.lastLoginAt),
      userGroupID: generatePublicID(user.userGroupId, EntityType.UserGroup),
      userGroup: {
        id: generatePublicID(group.id, EntityType.UserGroup),
        name: group.name,
        description: group.description,
      },
      status: user.status,
    };
  }

  async adminUpdateUser(publicId: string, dto: any): Promise<void> {
    const decoded = decodePublicID(publicId);
    if (decoded.entityType !== EntityType.User) {
      throw new NotFoundException(ErrorCodes.INVALID_PUBLIC_ID);
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (dto.userGroupID !== undefined) {
      const groupDecoded = decodePublicID(dto.userGroupID);
      if (groupDecoded.entityType !== EntityType.UserGroup) {
        throw new NotFoundException(ErrorCodes.INVALID_PUBLIC_ID);
      }
      updateData.userGroupId = groupDecoded.dbID;
    }

    await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, decoded.dbID));
  }

  async adminDeleteUser(publicId: string): Promise<void> {
    const decoded = decodePublicID(publicId);
    if (decoded.entityType !== EntityType.User) {
      throw new NotFoundException(ErrorCodes.INVALID_PUBLIC_ID);
    }

    // Soft delete
    await this.db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, decoded.dbID));
  }

  async adminResetPassword(publicId: string, newPassword: string): Promise<void> {
    const decoded = decodePublicID(publicId);
    if (decoded.entityType !== EntityType.User) {
      throw new NotFoundException(ErrorCodes.INVALID_PUBLIC_ID);
    }

    const hash = await bcryptjs.hash(newPassword, 10);
    await this.db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.id, decoded.dbID));
  }

  async adminUpdateStatus(publicId: string, status: number): Promise<void> {
    const decoded = decodePublicID(publicId);
    if (decoded.entityType !== EntityType.User) {
      throw new NotFoundException(ErrorCodes.INVALID_PUBLIC_ID);
    }

    await this.db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, decoded.dbID));
  }

  async getUserGroups(): Promise<UserGroupDTO[]> {
    const rows = await this.db.select().from(userGroups);

    return rows.map((group: any) => ({
      id: generatePublicID(group.id, EntityType.UserGroup),
      name: group.name,
      description: group.description,
    }));
  }
}
