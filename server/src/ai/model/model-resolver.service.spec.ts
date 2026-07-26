import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ModelResolver } from './model-resolver.service';
import { SettingsService } from '../../settings/settings.service';

/**
 * Create a mock SettingsService with the given key-value pairs.
 */
function mockSettings(kv: Record<string, string | undefined>) {
  return { get: vi.fn((key: string) => kv[key]) } as any;
}

describe('ModelResolver', () => {
  const validProfiles = JSON.stringify([
    {
      id: '1',
      name: 'GPT-4',
      provider: 'openai',
      api_url: 'https://api.openai.com/v1',
      model: 'gpt-4',
      enabled: true,
      api_key: 'sk-test-key',
      purposes: ['summary'],
    },
    {
      id: '2',
      name: 'Claude',
      provider: 'anthropic',
      api_url: 'https://api.anthropic.com/v1',
      model: 'claude-3',
      enabled: false,
      api_key: 'sk-ant-test',
      purposes: ['summary'],
    },
  ]);

  it('returns LanguageModel when profileId matches an enabled profile', async () => {
    const settings = mockSettings({
      ai_profiles: validProfiles,
      ai_default_profile_id: '1',
    });

    const module = await Test.createTestingModule({
      providers: [ModelResolver, { provide: SettingsService, useValue: settings }],
    }).compile();

    const resolver = module.get(ModelResolver);
    const model = resolver.resolve('1');

    // LanguageModel is an object with a modelId property
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4');
  });

  it('falls back to defaultId when profileId is not provided', async () => {
    const settings = mockSettings({
      ai_profiles: validProfiles,
      ai_default_profile_id: '1',
    });

    const module = await Test.createTestingModule({
      providers: [ModelResolver, { provide: SettingsService, useValue: settings }],
    }).compile();

    const resolver = module.get(ModelResolver);
    const model = resolver.resolve();

    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4');
  });

  it('falls back to first enabled profile when profileId and defaultId do not match', async () => {
    const settings = mockSettings({
      ai_profiles: validProfiles,
      ai_default_profile_id: '2', // profile 2 is disabled
    });

    const module = await Test.createTestingModule({
      providers: [ModelResolver, { provide: SettingsService, useValue: settings }],
    }).compile();

    const resolver = module.get(ModelResolver);
    const model = resolver.resolve('nonexistent');

    // Falls back to first enabled (profile 1)
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4');
  });

  it('throws "未配置可用的 AI 模型" when no enabled profile exists', async () => {
    const allDisabled = JSON.stringify([
      {
        id: '1',
        name: 'GPT-4',
        provider: 'openai',
        api_url: 'https://api.openai.com/v1',
        model: 'gpt-4',
        enabled: false,
        api_key: 'sk-test',
        purposes: ['summary'],
      },
    ]);
    const settings = mockSettings({
      ai_profiles: allDisabled,
      ai_default_profile_id: '1',
    });

    const module = await Test.createTestingModule({
      providers: [ModelResolver, { provide: SettingsService, useValue: settings }],
    }).compile();

    const resolver = module.get(ModelResolver);

    expect(() => resolver.resolve()).toThrow('未配置可用的 AI 模型');
  });

  it('throws when no profiles are configured at all', async () => {
    const settings = mockSettings({});

    const module = await Test.createTestingModule({
      providers: [ModelResolver, { provide: SettingsService, useValue: settings }],
    }).compile();

    const resolver = module.get(ModelResolver);

    expect(() => resolver.resolve()).toThrow('未配置可用的 AI 模型');
  });

  it('uses legacy fallback profile when ai_profiles is empty', async () => {
    const settings = mockSettings({
      ai_summary_api_key: 'legacy-key',
      ai_summary_api_url: 'https://legacy.api/v1',
      ai_summary_model: 'gpt-3.5-turbo',
    });

    const module = await Test.createTestingModule({
      providers: [ModelResolver, { provide: SettingsService, useValue: settings }],
    }).compile();

    const resolver = module.get(ModelResolver);
    const model = resolver.resolve();

    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-3.5-turbo');
  });
});
