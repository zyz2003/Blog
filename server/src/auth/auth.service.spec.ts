import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { SettingsService } from '../settings/settings.service';
import { initSqidsEncoderWithSeed } from '../common/utils/sqids.util';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

import * as bcryptjs from 'bcryptjs';

initSqidsEncoderWithSeed('test-seed');

describe('AuthService', () => {
  let service: AuthService;
  let mockTokenService: any;
  let mockSettingsService: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTokenService = {
      generateSessionTokens: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expires: Date.now() + 900000,
      }),
      refreshAccessToken: vi.fn(),
    };

    mockSettingsService = {
      get: vi.fn().mockReturnValue('https://cravatar.cn/avatar/'),
    };

    mockDb = { select: vi.fn(), update: vi.fn() };

    service = new AuthService(mockTokenService, mockDb, mockSettingsService);
  });

  const makeUser = (overrides = {}) => ({
    id: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    username: 'admin',
    nickname: 'Admin',
    avatar: 'test-avatar',
    email: 'admin@test.com',
    lastLoginAt: null,
    status: 1,
    userGroupId: 1,
    passwordHash: '$2b$10$testhash',
    ...overrides,
  });

  const makeUserGroup = (overrides = {}) => ({
    id: 1,
    name: 'Administrator',
    description: 'Admin group',
    permissions: [1, 2, 3],
    ...overrides,
  });

  const setupDbMock = (user: any, userGroup?: any) => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { from: vi.fn().mockImplementation(() => ({ where: vi.fn().mockResolvedValue([user]) })) };
      }
      return { from: vi.fn().mockImplementation(() => ({ where: vi.fn().mockResolvedValue(userGroup ? [userGroup] : []) })) };
    });
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  };

  describe('login', () => {
    it('Test 1: should login with correct email/password and return full response', async () => {
      const user = makeUser();
      const userGroup = makeUserGroup();
      setupDbMock(user, userGroup);
      (bcryptjs.compare as any).mockResolvedValue(true);

      const result = await service.login('admin@test.com', 'password');

      expect(result.userInfo).toBeDefined();
      expect(result.roles).toEqual(['1']);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(typeof result.expires).toBe('number');
    });

    it('Test 2: should return 401 for wrong password', async () => {
      setupDbMock(makeUser());
      (bcryptjs.compare as any).mockResolvedValue(false);

      await expect(service.login('admin@test.com', 'wrong-password'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('Test 3: should return 401 for non-existent email', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      }));

      await expect(service.login('nobody@test.com', 'password'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('Test 4: should return 403 for inactive user (status=2)', async () => {
      setupDbMock(makeUser({ status: 2 }));
      (bcryptjs.compare as any).mockResolvedValue(true);

      await expect(service.login('admin@test.com', 'password'))
        .rejects.toThrow(ForbiddenException);
    });

    it('Test 5: should return 403 for banned user (status=3)', async () => {
      setupDbMock(makeUser({ status: 3 }));
      (bcryptjs.compare as any).mockResolvedValue(true);

      await expect(service.login('admin@test.com', 'password'))
        .rejects.toThrow(ForbiddenException);
    });

    it('Test 6: userInfo.id should be public ID string, userInfo.userGroupID should be raw database ID number', async () => {
      setupDbMock(makeUser(), makeUserGroup());
      (bcryptjs.compare as any).mockResolvedValue(true);

      const result = await service.login('admin@test.com', 'password');

      expect(typeof result.userInfo.id).toBe('string');
      expect(typeof result.userInfo.userGroupID).toBe('number');
      expect(result.userInfo.userGroupID).toBe(1);
    });

    it('Test 7: roles should be [String(userGroupId)]', async () => {
      setupDbMock(makeUser(), makeUserGroup());
      (bcryptjs.compare as any).mockResolvedValue(true);

      const result = await service.login('admin@test.com', 'password');
      expect(result.roles).toEqual(['1']);
    });

    it('Test 8: expires should be millisecond timestamp', async () => {
      setupDbMock(makeUser(), makeUserGroup());
      (bcryptjs.compare as any).mockResolvedValue(true);

      const result = await service.login('admin@test.com', 'password');
      expect(typeof result.expires).toBe('number');
      expect(result.expires).toBeGreaterThan(0);
    });
  });
});
