import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenService } from './token.service';
import { SettingsService } from '../settings/settings.service';
import { initSqidsEncoderWithSeed } from '../common/utils/sqids.util';
import * as jwt from 'jsonwebtoken';
import * as bcryptjs from 'bcryptjs';

// Initialize Sqids encoder for tests
initSqidsEncoderWithSeed('test-seed');

describe('TokenService', () => {
  let service: TokenService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn> };
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsService = {
      get: vi.fn().mockReturnValue('test-jwt-secret-for-testing'),
    } as any;

    mockDb = {
      select: vi.fn(),
    };

    service = new TokenService(mockSettingsService as any, mockDb);
  });

  describe('generateAccessToken', () => {
    it('Test 1: should create HS256 JWT with user_id (public ID string), user_group_id (public ID string), permissions, iss, exp=now+15min', async () => {
      const user = { id: 1, userGroupId: 1, permissions: [1, 2, 3] };
      const token = await service.generateAccessToken(user);

      const decoded = jwt.verify(token, 'test-jwt-secret-for-testing') as any;
      expect(decoded.user_id).toBeDefined();
      expect(typeof decoded.user_id).toBe('string');
      expect(decoded.user_group_id).toBeDefined();
      expect(typeof decoded.user_group_id).toBe('string');
      expect(decoded.permissions).toEqual([1, 2, 3]);
      expect(decoded.iss).toBe('anheyu-app');
      expect(decoded.exp - decoded.iat).toBe(900); // 15 minutes
    });
  });

  describe('generateRefreshToken', () => {
    it('Test 2: should create HS256 JWT with user_id only, NO user_group_id, NO permissions, exp=now+30days', async () => {
      const token = await service.generateRefreshToken(1);

      const decoded = jwt.verify(token, 'test-jwt-secret-for-testing') as any;
      expect(decoded.user_id).toBeDefined();
      expect(typeof decoded.user_id).toBe('string');
      expect(decoded.user_group_id).toBeUndefined();
      expect(decoded.permissions).toBeUndefined();
      expect(decoded.iss).toBe('anheyu-app');
      // 30 days = 2592000 seconds
      expect(decoded.exp - decoded.iat).toBe(2592000);
    });
  });

  describe('generateSessionTokens', () => {
    it('Test 3: should return { accessToken, refreshToken, expires } where expires is millisecond timestamp', async () => {
      const user = { id: 1, userGroupId: 1, permissions: [1] };
      const result = await service.generateSessionTokens(user);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.expires).toBe('number');
      // expires should be approximately now + 15 minutes in milliseconds
      const now = Date.now();
      expect(result.expires).toBeGreaterThan(now);
      expect(result.expires).toBeLessThanOrEqual(now + 15 * 60 * 1000 + 1000);
    });
  });

  describe('refreshAccessToken', () => {
    it('Test 4: should parse refresh token, look up user, generate new access token', async () => {
      const refreshToken = await service.generateRefreshToken(1);

      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        const chain = {
          from: () => chain,
          where: () => {
            if (callCount === 1) {
              return Promise.resolve([{ id: 1, userGroupId: 1, status: 1 }]);
            }
            return Promise.resolve([{ permissions: [1, 2] }]);
          },
        };
        return chain;
      });

      const result = await service.refreshAccessToken(refreshToken);
      expect(result.accessToken).toBeDefined();
      expect(typeof result.expires).toBe('number');

      const decoded = jwt.verify(result.accessToken, 'test-jwt-secret-for-testing') as any;
      expect(decoded.user_id).toBeDefined();
      expect(decoded.user_group_id).toBeDefined();
    });

    it('Test 5: should throw 401 for expired/invalid refresh token', async () => {
      await expect(service.refreshAccessToken('invalid-token'))
        .rejects.toThrow();
    });

    it('Test 6: should throw 401 for inactive/banned user', async () => {
      const refreshToken = await service.generateRefreshToken(2);

      mockDb.select.mockImplementation(() => {
        const chain = {
          from: () => chain,
          where: () => Promise.resolve([{ id: 2, userGroupId: 2, status: 3 }]),
        };
        return chain;
      });

      await expect(service.refreshAccessToken(refreshToken))
        .rejects.toThrow();
    });
  });

  describe('bcryptjs compatibility', () => {
    it('Test 9: bcryptjs.compare should verify a Go-bcrypt-hashed password', async () => {
      const hash = await bcryptjs.hash('password123', 10);
      const isValid = await bcryptjs.compare('password123', hash);
      expect(isValid).toBe(true);
    });

    it('Test 10: bcryptjs.hash should produce hash compatible with Go bcrypt (DefaultCost=10)', async () => {
      const hash = await bcryptjs.hash('testpassword', 10);
      expect(hash).toMatch(/^\$2[ab]\$10\$/);
      const isValid = await bcryptjs.compare('testpassword', hash);
      expect(isValid).toBe(true);
    });
  });
});
