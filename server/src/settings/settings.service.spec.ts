import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PUBLIC_SETTING_KEYS } from './public-setting-keys';
import { formatToChinaTime } from '../common/utils/time.util';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockDb: any;

  // Sample settings data matching Go's definition.go
  const sampleSettings = [
    { configKey: 'APP_NAME', value: '安和鱼' },
    { configKey: 'JWT_SECRET', value: 'super-secret-key' },
    { configKey: 'SUB_TITLE', value: '生活明朗，万物可爱' },
    { configKey: 'SITE_URL', value: 'https://anheyu.com' },
    { configKey: 'footer.owner.name', value: '安知鱼' },
    { configKey: 'footer.owner.since', value: '2020' },
    { configKey: 'footer.runtime.enable', value: 'false' },
    { configKey: 'ENABLE_EXTERNAL_LINK_WARNING', value: 'true' },
    { configKey: 'APPEARANCE_TOKENS', value: '{"light":{"primary":"#2196f3"},"dark":{"primary":"#bb86fc"}}' },
    { configKey: 'ENABLE_REGISTRATION', value: 'true' },
    { configKey: 'SMTP_HOST', value: 'smtp.qq.com' },
    { configKey: 'SMTP_PASSWORD', value: 'smtp-pass-123' },
    { configKey: 'captcha.provider', value: 'none' },
    { configKey: 'turnstile.site_key', value: '0x4AAAAAAA' },
    { configKey: 'turnstile.secret_key', value: '0x4AAAAAAA-secret' },
    { configKey: 'geetest.captcha_id', value: 'geetest-id-123' },
    { configKey: 'geetest.captcha_key', value: 'geetest-key-456' },
    { configKey: 'image_captcha.length', value: '4' },
    { configKey: 'ai_profiles', value: '[{"id":"1","name":"GPT-4","provider":"openai","api_url":"https://api.openai.com/v1","model":"gpt-4","enabled":true,"api_key":"sk-abc1234def5678"},{"id":"2","name":"Claude","provider":"anthropic","api_url":"https://api.anthropic.com","model":"claude-3","enabled":false,"api_key":"ab"}]' },
  ];

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnValue(sampleSettings),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      run: vi.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: 'DRIZZLE',
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('onModuleInit - cache loading', () => {
    it('Test 1: should load all settings from database into memory cache', async () => {
      await service.onModuleInit();

      // Verify all settings are loaded
      expect(service.get('APP_NAME')).toBe('安和鱼');
      expect(service.get('JWT_SECRET')).toBe('super-secret-key');
      expect(service.get('SUB_TITLE')).toBe('生活明朗，万物可爱');
      expect(service.get('footer.owner.name')).toBe('安知鱼');
    });
  });

  describe('ensureSecuritySecrets', () => {
    it('should generate and persist strong random secrets when DB values are empty', async () => {
      // DB returns settings with an empty JWT_SECRET (LOCAL_FILE_SIGNING_SECRET
      // absent from sample -> also generated)
      const emptySecretSettings = sampleSettings.map(s =>
        s.configKey === 'JWT_SECRET' ? { ...s, value: '' } : s,
      );
      mockDb.from.mockReturnValue(emptySecretSettings);
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoUpdate.mockReturnThis();
      mockDb.onConflictDoNothing.mockReturnThis();
      mockDb.run.mockResolvedValue(undefined);

      await service.onModuleInit();

      const jwt = service.get('JWT_SECRET');
      const fileSecret = service.get('LOCAL_FILE_SIGNING_SECRET');
      expect(jwt).toBeTruthy();
      expect(jwt!.length).toBeGreaterThan(20);
      expect(fileSecret).toBeTruthy();
      expect(fileSecret!.length).toBeGreaterThan(20);
      // Each secret must be independently generated
      expect(jwt).not.toBe(fileSecret);
    });

    it('should not overwrite a non-empty secret', async () => {
      // sampleSettings has JWT_SECRET = 'super-secret-key' (non-empty -> preserved)
      await service.onModuleInit();
      expect(service.get('JWT_SECRET')).toBe('super-secret-key');
    });
  });

  describe('get', () => {
    it('Test 2a: should return value from cache for existing key', async () => {
      await service.onModuleInit();
      expect(service.get('JWT_SECRET')).toBe('super-secret-key');
    });

    it('Test 2b: should return undefined for nonexistent key', async () => {
      await service.onModuleInit();
      expect(service.get('NONEXISTENT')).toBeUndefined();
    });
  });

  describe('getByKeys with unflatten', () => {
    it('Test 3: should return unflattened nested objects', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['APP_NAME', 'footer.owner.name'], true);

      expect(result).toHaveProperty('APP_NAME', '安和鱼');
      expect(result).toHaveProperty('footer');
      expect((result as any).footer).toHaveProperty('owner');
      expect((result as any).footer.owner).toHaveProperty('name', '安知鱼');
    });

    it('Test 4a: should auto-parse JSON strings as objects', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['APPEARANCE_TOKENS'], true);

      expect((result as any).APPEARANCE_TOKENS).toEqual({
        light: { primary: '#2196f3' },
        dark: { primary: '#bb86fc' },
      });
    });

    it('Test 4b: should auto-parse "true" as boolean true', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['ENABLE_EXTERNAL_LINK_WARNING'], true);

      expect((result as any).ENABLE_EXTERNAL_LINK_WARNING).toBe(true);
    });

    it('Test 4c: should auto-parse "false" as boolean false', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['footer.runtime.enable'], true);

      expect((result as any).footer.runtime.enable).toBe(false);
    });

    it('Test 4d: should auto-parse numeric strings as numbers', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['footer.owner.since'], true);

      // "2020" should be parsed as integer 2020
      expect((result as any).footer.owner.since).toBe(2020);
    });

    it('Test 4e: should keep regular strings as strings', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['APP_NAME'], true);

      expect((result as any).APP_NAME).toBe('安和鱼');
    });
  });

  describe('getByKeys - public/private filtering', () => {
    it('Test 5: should filter private keys for non-admin users', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['APP_NAME', 'JWT_SECRET'], false);

      // APP_NAME is public, JWT_SECRET is private
      expect(result).toHaveProperty('APP_NAME', '安和鱼');
      expect(result).not.toHaveProperty('JWT_SECRET');
    });

    it('Test 6: should return all keys for admin users', async () => {
      await service.onModuleInit();
      const result = service.getByKeys(['APP_NAME', 'JWT_SECRET'], true);

      expect(result).toHaveProperty('APP_NAME', '安和鱼');
      expect(result).toHaveProperty('JWT_SECRET', 'super-secret-key');
    });
  });

  describe('update', () => {
    it('Test 7: should persist to database and refresh in-memory cache', async () => {
      await service.onModuleInit();

      // Mock the upsert operations
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoUpdate.mockReturnThis();
      mockDb.run.mockResolvedValue(undefined);

      await service.update({ APP_NAME: '新名称' });

      // Cache should be refreshed
      expect(service.get('APP_NAME')).toBe('新名称');
    });

    it('Test 8: should refresh config version timestamp on update', async () => {
      await service.onModuleInit();
      const versionBefore = service.getConfigVersion().version;

      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoUpdate.mockReturnThis();
      mockDb.run.mockResolvedValue(undefined);

      await service.update({ APP_NAME: '新名称' });

      const versionAfter = service.getConfigVersion().version;
      expect(versionAfter).toBeGreaterThanOrEqual(versionBefore);
    });
  });

  describe('AI profiles masking', () => {
    it('Test 9: should mask API keys - long key shows last 4 chars, short key shows ****', async () => {
      const masked = service.maskAIProfiles(
        '[{"id":"1","name":"GPT-4","provider":"openai","api_url":"https://api.openai.com/v1","model":"gpt-4","enabled":true,"api_key":"sk-abc1234def5678"},{"id":"2","name":"Claude","provider":"anthropic","api_url":"https://api.anthropic.com","model":"claude-3","enabled":false,"api_key":"ab"}]',
      );

      const profiles = JSON.parse(masked);
      // Long key: "sk-abc1234def5678" (17 chars) -> 13 asterisks + last 4 = "*************5678"
      expect(profiles[0].has_api_key).toBe(true);
      expect(profiles[0].api_key_masked).toBe('*************5678');
      expect(profiles[0].api_key).toBeUndefined();

      // Short key (length <= 4): "ab" -> "****"
      expect(profiles[1].has_api_key).toBe(true);
      expect(profiles[1].api_key_masked).toBe('****');
      expect(profiles[1].api_key).toBeUndefined();
    });

    it('Test 10: should preserve existing API key when incoming is masked', async () => {
      await service.onModuleInit();

      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoUpdate.mockReturnThis();
      mockDb.run.mockResolvedValue(undefined);

      // Incoming with masked key pattern
      const incoming = {
        ai_profiles:
          '[{"id":"1","name":"GPT-4","provider":"openai","api_url":"https://api.openai.com/v1","model":"gpt-4","enabled":true,"api_key":"************5678","api_key_masked":"************5678","has_api_key":true}]',
      };

      await service.update(incoming);

      // The service should have preserved the original key
      // After update, getting the raw value should still contain the original key
      const rawValue = service.get('ai_profiles');
      const profiles = JSON.parse(rawValue!);
      // The original key "sk-abc1234def5678" should be preserved, not the masked version
      expect(profiles[0].api_key).toBe('sk-abc1234def5678');
    });
  });

  describe('CDN cache purge detection', () => {
    it('Test 11: should log warning when CDN-affected keys change', async () => {
      await service.onModuleInit();

      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoUpdate.mockReturnThis();
      mockDb.run.mockResolvedValue(undefined);

      const loggerSpy = vi.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await service.update({ SITE_KEYWORDS: 'new keywords' });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('CDN'),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('auto-backup', () => {
    it('Test 12: should create backup before update', async () => {
      await service.onModuleInit();

      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.onConflictDoUpdate.mockReturnThis();
      mockDb.run.mockResolvedValue(undefined);

      const backupSpy = vi.spyOn(service as any, 'autoBackup').mockImplementation(() => {});

      await service.update({ APP_NAME: '备份测试' });

      expect(backupSpy).toHaveBeenCalled();

      backupSpy.mockRestore();
    });
  });

  describe('getSiteConfig', () => {
    it('Test 13: should return all public settings unflattened with _config_version', async () => {
      await service.onModuleInit();
      const result = service.getSiteConfig();

      // Should contain public keys
      expect(result).toHaveProperty('APP_NAME', '安和鱼');
      expect(result).toHaveProperty('SUB_TITLE', '生活明朗，万物可爱');

      // Should NOT contain private keys
      expect(result).not.toHaveProperty('JWT_SECRET');
      expect(result).not.toHaveProperty('SMTP_PASSWORD');

      // Should have _config_version
      expect(result).toHaveProperty('_config_version');
      expect(typeof (result as any)._config_version).toBe('number');
    });
  });

  describe('getConfigVersion', () => {
    it('Test 14: should return millisecond timestamp', async () => {
      await service.onModuleInit();
      const { version } = service.getConfigVersion();

      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThan(0);
      // Should be a reasonable millisecond timestamp (after year 2020)
      expect(version).toBeGreaterThan(1577836800000);
    });
  });

  describe('formatToChinaTime', () => {
    it('Test 15a: should format date in UTC+8 as YYYY-MM-DD HH:mm:ss', () => {
      // 2024-01-01T00:00:00Z is 2024-01-01 08:00:00 in UTC+8
      const date = new Date('2024-01-01T00:00:00Z');
      const result = formatToChinaTime(date);

      expect(result).toBe('2024-01-01 08:00:00');
    });

    it('Test 15b: should return null for null input', () => {
      expect(formatToChinaTime(null)).toBeNull();
    });

    it('Test 15c: should return null for undefined input', () => {
      expect(formatToChinaTime(undefined)).toBeNull();
    });
  });

  describe('isPublicSetting', () => {
    it('should identify APP_NAME as public', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('APP_NAME')).toBe(true);
    });

    it('should identify JWT_SECRET as private', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('JWT_SECRET')).toBe(false);
    });

    it('should identify SMTP_HOST as private', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('SMTP_HOST')).toBe(false);
    });

    it('should identify captcha.provider as public', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('captcha.provider')).toBe(true);
    });

    it('should identify turnstile.secret_key as private', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('turnstile.secret_key')).toBe(false);
    });

    it('should identify turnstile.site_key as public', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('turnstile.site_key')).toBe(true);
    });

    it('should identify geetest.captcha_id as public', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('geetest.captcha_id')).toBe(true);
    });

    it('should identify geetest.captcha_key as private', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('geetest.captcha_key')).toBe(false);
    });

    it('should identify image_captcha.length as public', async () => {
      await service.onModuleInit();
      expect(service.isPublicSetting('image_captcha.length')).toBe(true);
    });
  });
});
