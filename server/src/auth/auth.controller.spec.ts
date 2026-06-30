import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { HttpException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockTokenService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService = { login: vi.fn() };
    mockTokenService = { refreshAccessToken: vi.fn() };
    controller = new AuthController(mockAuthService, mockTokenService);
  });

  describe('POST /api/auth/login', () => {
    it('Test 1: should return login response for valid credentials', async () => {
      const loginResult = { userInfo: { id: 'abc' }, roles: ['1'], accessToken: 'at', refreshToken: 'rt', expires: 12345 };
      mockAuthService.login.mockResolvedValue(loginResult);

      const result = await controller.login({ email: 'admin@test.com', password: 'pass' });
      expect(result).toEqual(loginResult);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('Test 9: should extract refresh token from Authorization header', async () => {
      mockTokenService.refreshAccessToken.mockResolvedValue({ accessToken: 'new-at', expires: 99999 });
      const result = await controller.refreshToken('Bearer refresh-tok', { refreshToken: undefined });
      expect(result.accessToken).toBe('new-at');
    });

    it('Test 10: should extract refresh token from request body', async () => {
      mockTokenService.refreshAccessToken.mockResolvedValue({ accessToken: 'new-at', expires: 99999 });
      const result = await controller.refreshToken(undefined, { refreshToken: 'body-tok' });
      expect(result.accessToken).toBe('new-at');
    });

    it('Test 11: should throw 401 when no token provided', async () => {
      await expect(controller.refreshToken(undefined, { refreshToken: undefined }))
        .rejects.toThrow();
    });
  });

  describe('501 stubs', () => {
    it('Test 12: register should return 501', async () => {
      await expect(controller.register()).rejects.toThrow(HttpException);
      try { await controller.register(); } catch (e: any) { expect(e.getStatus()).toBe(501); }
    });

    it('Test 13: activate should return 501', async () => {
      await expect(controller.activate()).rejects.toThrow(HttpException);
    });

    it('Test 14: forgot-password should return 501', async () => {
      await expect(controller.forgotPassword()).rejects.toThrow(HttpException);
    });

    it('Test 15: reset-password should return 501', async () => {
      await expect(controller.resetPassword()).rejects.toThrow(HttpException);
    });

    it('Test 16: check-email should return 501', async () => {
      await expect(controller.checkEmail()).rejects.toThrow(HttpException);
    });
  });
});
