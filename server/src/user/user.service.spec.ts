import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user.service';
import { SettingsService } from '../settings/settings.service';
import { generatePublicID, decodePublicID, EntityType, initSqidsEncoderWithSeed } from '../common/utils/sqids.util';
import * as bcryptjs from 'bcryptjs';

// Initialize Sqids for tests
initSqidsEncoderWithSeed('test-seed');

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

const mockSettingsService = {
  get: vi.fn().mockReturnValue('https://cravatar.cn/avatar/'),
};

const mockUser = {
  id: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  deletedAt: null,
  username: 'admin',
  passwordHash: '$2a$10$testhash',
  nickname: 'Admin',
  avatar: 'avatar.png',
  email: 'admin@test.com',
  lastLoginAt: null,
  status: 1,
  userGroupId: 1,
};

const mockUserGroup = {
  id: 1,
  name: 'Admin',
  description: 'Administrator group',
  permissions: [0, 1, 2, 3],
};

function createChainableSelect(returnValue: any) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(returnValue),
    }),
  };
}

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService(mockDb as any, mockSettingsService as any);
  });

  describe('getUserInfo', () => {
    it('returns user with public ID for id, raw DB ID for userGroupID', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUser]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUserGroup]),
          }),
        });

      const result = await service.getUserInfo(1);

      expect(result.id).toBe(generatePublicID(1, EntityType.User));
      expect(typeof result.id).toBe('string');
      expect(result.userGroupID).toBe(1);
      expect(typeof result.userGroupID).toBe('number');
    });

    it('formats dates in UTC+8 as YYYY-MM-DD HH:mm:ss, null for lastLoginAt', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUser]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUserGroup]),
          }),
        });

      const result = await service.getUserInfo(1);

      expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result.lastLoginAt).toBeNull();
    });

    it('prepends Gravatar URL with slash trimming for non-http avatar', async () => {
      const userWithAvatar = { ...mockUser, avatar: '/avatar.png' };
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([userWithAvatar]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUserGroup]),
          }),
        });

      const result = await service.getUserInfo(1);

      // GetUserInfo: trims trailing slash from base and leading slash from path
      expect(result.avatar).toBe('https://cravatar.cn/avatar/avatar.png');
    });

    it('leaves http avatar unchanged', async () => {
      const userWithHttpAvatar = { ...mockUser, avatar: 'https://example.com/pic.jpg' };
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([userWithHttpAvatar]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUserGroup]),
          }),
        });

      const result = await service.getUserInfo(1);
      expect(result.avatar).toBe('https://example.com/pic.jpg');
    });
  });

  describe('updatePassword', () => {
    it('verifies old password with bcryptjs.compare before updating', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...mockUser, passwordHash: await bcryptjs.hash('oldpass', 10) }]),
        }),
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await service.updatePassword(1, 'oldpass', 'newpass123');
      // Should not throw — old password matches
    });

    it('throws 401 if old password is wrong', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ ...mockUser, passwordHash: await bcryptjs.hash('correctpass', 10) }]),
        }),
      });

      await expect(service.updatePassword(1, 'wrongpass', 'newpass123')).rejects.toThrow('旧密码不正确');
    });
  });

  describe('updateProfile', () => {
    it('updates nickname and/or website', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await service.updateProfile(1, 'NewNick', 'https://example.com');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('adminListUsers', () => {
    it('returns paginated results with AdminUserDTO (userGroupID as public ID string)', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUserGroup]),
          }),
        });

      const result = await service.adminListUsers(1, 10);

      expect(result.users).toHaveLength(1);
      expect(typeof result.users[0].userGroupID).toBe('string');
      expect(result.users[0].userGroupID).toBe(generatePublicID(1, EntityType.UserGroup));
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('admin avatar processing: non-http avatar prepends Gravatar URL WITHOUT slash trimming', async () => {
      const userWithLeadingSlash = { ...mockUser, avatar: '/avatar.png' };
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([userWithLeadingSlash]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockUserGroup]),
          }),
        });

      const result = await service.adminListUsers(1, 10);

      // AdminListUsers: NO trimming — just gravatarBase + avatar
      expect(result.users[0].avatar).toBe('https://cravatar.cn/avatar//avatar.png');
    });

    it('supports keyword filter', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const result = await service.adminListUsers(1, 10, 'admin');
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('adminCreateUser', () => {
    it('hashes password with bcryptjs and creates user', async () => {
      const insertReturn = { ...mockUser, id: 2 };
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertReturn]),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockUserGroup]),
        }),
      });

      const dto = {
        username: 'newuser',
        password: 'password123',
        email: 'new@test.com',
        userGroupID: generatePublicID(1, EntityType.UserGroup),
      };

      const result = await service.adminCreateUser(dto);

      expect(result.id).toBe(generatePublicID(2, EntityType.User));
      expect(typeof result.userGroupID).toBe('string');
    });
  });

  describe('adminUpdateUser', () => {
    it('updates user fields; decodes public ID for userGroupID', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const publicId = generatePublicID(1, EntityType.User);
      const groupPublicId = generatePublicID(2, EntityType.UserGroup);

      await service.adminUpdateUser(publicId, { userGroupID: groupPublicId });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('adminDeleteUser', () => {
    it('soft-deletes user (sets deletedAt)', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const publicId = generatePublicID(1, EntityType.User);
      await service.adminDeleteUser(publicId);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('adminResetPassword', () => {
    it('sets new password hash with bcryptjs', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const publicId = generatePublicID(1, EntityType.User);
      await service.adminResetPassword(publicId, 'newpass123');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('adminUpdateStatus', () => {
    it('changes user status', async () => {
      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const publicId = generatePublicID(1, EntityType.User);
      await service.adminUpdateStatus(publicId, 3);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('getUserGroups', () => {
    it('returns all user groups with public IDs', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([mockUserGroup]),
      });

      const result = await service.getUserGroups();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(generatePublicID(1, EntityType.UserGroup));
      expect(result[0].name).toBe('Admin');
    });
  });
});
