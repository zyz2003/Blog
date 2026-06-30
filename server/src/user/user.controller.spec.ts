import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { generatePublicID, EntityType, initSqidsEncoderWithSeed } from '../common/utils/sqids.util';

initSqidsEncoderWithSeed('test-seed');

const mockUserService = {
  getUserInfo: vi.fn(),
  updatePassword: vi.fn(),
  updateProfile: vi.fn(),
  adminListUsers: vi.fn(),
  adminCreateUser: vi.fn(),
  adminUpdateUser: vi.fn(),
  adminDeleteUser: vi.fn(),
  adminResetPassword: vi.fn(),
  adminUpdateStatus: vi.fn(),
  getUserGroups: vi.fn(),
};

const mockUser = {
  user_id: generatePublicID(1, EntityType.User),
  user_group_id: generatePublicID(1, EntityType.UserGroup),
  permissions: [0, 1, 2, 3],
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UserController(mockUserService as any);
  });

  describe('GET /api/user/info', () => {
    it('decodes user_id from JWT and calls getUserInfo', async () => {
      const userInfo = { id: 'pub_id', userGroupID: 1 };
      mockUserService.getUserInfo.mockResolvedValue(userInfo);

      const result = await controller.getUserInfo(mockUser);

      expect(mockUserService.getUserInfo).toHaveBeenCalledWith(1);
      expect(result).toEqual(userInfo);
    });
  });

  describe('POST /api/user/update-password', () => {
    it('decodes user_id and calls updatePassword', async () => {
      mockUserService.updatePassword.mockResolvedValue(undefined);

      const result = await controller.updatePassword(mockUser, {
        oldPassword: 'old',
        newPassword: 'new123456',
      });

      expect(mockUserService.updatePassword).toHaveBeenCalledWith(1, 'old', 'new123456');
      expect(result).toBeNull();
    });
  });

  describe('PUT /api/user/profile', () => {
    it('decodes user_id and calls updateProfile', async () => {
      mockUserService.updateProfile.mockResolvedValue(undefined);

      const result = await controller.updateProfile(mockUser, {
        nickname: 'NewNick',
      });

      expect(mockUserService.updateProfile).toHaveBeenCalledWith(1, 'NewNick', undefined);
      expect(result).toBeNull();
    });
  });

  describe('POST /api/user/avatar', () => {
    it('returns 501 per D-44', async () => {
      await expect(controller.uploadAvatar()).rejects.toThrow('头像上传功能暂未开放');
    });
  });

  describe('GET /api/admin/users', () => {
    it('calls adminListUsers with decoded groupID', async () => {
      const listResult = { users: [], total: 0, page: 1, size: 10 };
      mockUserService.adminListUsers.mockResolvedValue(listResult);

      const groupPublicId = generatePublicID(1, EntityType.UserGroup);
      const result = await controller.adminListUsers('1', '10', undefined, groupPublicId, undefined);

      expect(mockUserService.adminListUsers).toHaveBeenCalledWith(1, 10, undefined, 1, undefined);
      expect(result).toEqual(listResult);
    });
  });

  describe('POST /api/admin/users', () => {
    it('calls adminCreateUser', async () => {
      const created = { id: 'pub_id' };
      mockUserService.adminCreateUser.mockResolvedValue(created);

      const result = await controller.adminCreateUser({
        username: 'test',
        password: 'pass123456',
        email: 'test@test.com',
        userGroupID: generatePublicID(1, EntityType.UserGroup),
      });

      expect(mockUserService.adminCreateUser).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    it('passes public ID and dto to adminUpdateUser', async () => {
      mockUserService.adminUpdateUser.mockResolvedValue(undefined);

      const publicId = generatePublicID(1, EntityType.User);
      const result = await controller.adminUpdateUser(publicId, { nickname: 'Updated' });

      expect(mockUserService.adminUpdateUser).toHaveBeenCalledWith(publicId, { nickname: 'Updated' });
      expect(result).toBeNull();
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('passes public ID to adminDeleteUser', async () => {
      mockUserService.adminDeleteUser.mockResolvedValue(undefined);

      const publicId = generatePublicID(1, EntityType.User);
      const result = await controller.adminDeleteUser(publicId);

      expect(mockUserService.adminDeleteUser).toHaveBeenCalledWith(publicId);
      expect(result).toBeNull();
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    it('passes public ID and new password', async () => {
      mockUserService.adminResetPassword.mockResolvedValue(undefined);

      const publicId = generatePublicID(1, EntityType.User);
      const result = await controller.adminResetPassword(publicId, { newPassword: 'newpass123' });

      expect(mockUserService.adminResetPassword).toHaveBeenCalledWith(publicId, 'newpass123');
      expect(result).toBeNull();
    });
  });

  describe('PUT /api/admin/users/:id/status', () => {
    it('passes public ID and status', async () => {
      mockUserService.adminUpdateStatus.mockResolvedValue(undefined);

      const publicId = generatePublicID(1, EntityType.User);
      const result = await controller.adminUpdateStatus(publicId, { status: 3 });

      expect(mockUserService.adminUpdateStatus).toHaveBeenCalledWith(publicId, 3);
      expect(result).toBeNull();
    });
  });

  describe('GET /api/admin/user-groups', () => {
    it('calls getUserGroups', async () => {
      const groups = [{ id: 'pub_id', name: 'Admin', description: null }];
      mockUserService.getUserGroups.mockResolvedValue(groups);

      const result = await controller.getUserGroups();

      expect(mockUserService.getUserGroups).toHaveBeenCalled();
      expect(result).toEqual(groups);
    });
  });
});
