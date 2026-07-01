import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { SettingsController, SiteConfigController } from './settings.controller';
import { SettingsService } from './settings.service';
import { DRIZZLE } from '../database/database.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

vi.mock('../common/utils/sqids.util', () => ({
  decodePublicID: vi.fn(),
  EntityType: { User: 1, File: 2, Album: 3, UserGroup: 4, StoragePolicy: 5 },
}));

import { decodePublicID } from '../common/utils/sqids.util';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: SettingsService;

  const mockSettings = [
    { configKey: 'APP_NAME', value: '安和鱼' },
    { configKey: 'JWT_SECRET', value: 'secret' },
  ];

  beforeEach(async () => {
    vi.mocked(decodePublicID).mockReturnValue({ dbID: 1, entityType: 4 });

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnValue(mockSettings),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      run: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [SettingsController, SiteConfigController],
      providers: [
        SettingsService,
        { provide: DRIZZLE, useValue: mockDb },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SettingsController>(SettingsController);
    service = module.get<SettingsService>(SettingsService);
    await service.onModuleInit();
  });

  describe('POST /api/settings/get-by-keys', () => {
    it('Test 1: should return all requested keys unflattened for admin user', () => {
      const user = { user_id: 'abc', user_group_id: 'admin-group-id' };
      vi.mocked(decodePublicID).mockReturnValue({ dbID: 1, entityType: 4 });

      const result = controller.getByKeys({ keys: ['APP_NAME', 'JWT_SECRET'] }, user);
      expect(result).toHaveProperty('APP_NAME', '安和鱼');
      expect(result).toHaveProperty('JWT_SECRET', 'secret');
    });

    it('Test 2: should filter private keys for non-admin user', () => {
      const user = { user_id: 'abc', user_group_id: 'guest-group-id' };
      vi.mocked(decodePublicID).mockReturnValue({ dbID: 2, entityType: 4 });

      const result = controller.getByKeys({ keys: ['APP_NAME', 'JWT_SECRET'] }, user);
      expect(result).toHaveProperty('APP_NAME', '安和鱼');
      expect(result).not.toHaveProperty('JWT_SECRET');
    });
  });

  describe('POST /api/settings/update', () => {
    it('Test 3: should persist and return null for admin', async () => {
      const result = await controller.update({ settings: { APP_NAME: '新名称' } });
      expect(result).toBeNull();
      expect(service.get('APP_NAME')).toBe('新名称');
    });
  });

  describe('POST /api/settings/test-email', () => {
    it('Test 7: should return 501 Not Implemented', () => {
      expect(() => controller.testEmail()).toThrow('邮件服务未配置');
    });
  });
});

describe('SiteConfigController', () => {
  let controller: SiteConfigController;

  const mockSettings = [
    { configKey: 'APP_NAME', value: '安和鱼' },
    { configKey: 'JWT_SECRET', value: 'secret' },
    { configKey: 'SUB_TITLE', value: '生活明朗' },
  ];

  beforeEach(async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnValue(mockSettings),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      run: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [SiteConfigController],
      providers: [
        SettingsService,
        { provide: DRIZZLE, useValue: mockDb },
        Reflector,
      ],
    }).compile();

    controller = module.get<SiteConfigController>(SiteConfigController);
    const service = module.get<SettingsService>(SettingsService);
    await service.onModuleInit();
  });

  describe('GET /api/public/site-config', () => {
    it('Test 5: should return public settings with _config_version', () => {
      const result = controller.getSiteConfig();
      expect(result).toHaveProperty('APP_NAME', '安和鱼');
      expect(result).not.toHaveProperty('JWT_SECRET');
      expect(result).toHaveProperty('_config_version');
    });
  });

  describe('GET /api/public/site-config/version', () => {
    it('Test 6: should return version number', () => {
      const result = controller.getConfigVersion();
      expect(result).toHaveProperty('version');
      expect(typeof result.version).toBe('number');
    });
  });

  describe('Public decorator', () => {
    it('SiteConfigController endpoints should be marked as public', () => {
      const reflector = new Reflector();
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        SiteConfigController.prototype.getSiteConfig,
      );
      expect(isPublic).toBe(true);
    });
  });
});
