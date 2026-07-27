import { describe, it, expect, vi } from 'vitest';
import { resolveProfiles, AiProfile } from './ai-profile';

/**
 * Create a mock SettingsService with the given key-value pairs.
 * SettingsService.get() returns string | undefined.
 */
function mockSettings(kv: Record<string, string | undefined>) {
  return { get: vi.fn((key: string) => kv[key]) } as any;
}

describe('resolveProfiles', () => {
  it('returns parsed AiProfile[] from valid ai_profiles JSON', () => {
    const profiles: AiProfile[] = [
      {
        id: '1',
        name: 'GPT-4',
        provider: 'openai',
        api_url: 'https://api.openai.com/v1',
        model: 'gpt-4',
        enabled: true,
        api_key: 'sk-test',
        purposes: ['summary'],
      },
    ];
    const settings = mockSettings({ ai_profiles: JSON.stringify(profiles) });

    const result = resolveProfiles(settings);

    expect(result).toEqual(profiles);
  });

  it('falls back to legacy ai_summary_* keys when ai_profiles is empty', () => {
    const settings = mockSettings({
      ai_profiles: '[]',
      ai_summary_api_key: 'legacy-key',
      ai_summary_api_url: 'https://legacy.api/v1',
      ai_summary_model: 'gpt-3.5-turbo',
    });

    const result = resolveProfiles(settings);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('legacy');
    expect(result[0].provider).toBe('custom');
    expect(result[0].api_key).toBe('legacy-key');
    expect(result[0].api_url).toBe('https://legacy.api/v1');
    expect(result[0].model).toBe('gpt-3.5-turbo');
    expect(result[0].enabled).toBe(true);
    expect(result[0].purposes).toEqual(['summary']);
  });

  it('falls back to legacy ai_summary_* keys when ai_profiles is undefined', () => {
    const settings = mockSettings({
      ai_summary_api_key: 'legacy-key',
      ai_summary_api_url: 'https://legacy.api/v1',
    });

    const result = resolveProfiles(settings);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('legacy');
  });

  it('falls back to legacy when ai_profiles JSON is invalid', () => {
    const settings = mockSettings({
      ai_profiles: 'not-valid-json',
      ai_summary_api_key: 'legacy-key',
      ai_summary_api_url: 'https://legacy.api/v1',
    });

    const result = resolveProfiles(settings);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('legacy');
  });

  it('returns empty array when neither ai_profiles nor legacy keys exist', () => {
    const settings = mockSettings({});

    const result = resolveProfiles(settings);

    expect(result).toEqual([]);
  });

  it('returns empty array when legacy api_key is missing but url exists', () => {
    const settings = mockSettings({
      ai_summary_api_url: 'https://legacy.api/v1',
    });

    const result = resolveProfiles(settings);

    expect(result).toEqual([]);
  });

  it('returns empty array when legacy api_url is missing but key exists', () => {
    const settings = mockSettings({
      ai_summary_api_key: 'legacy-key',
    });

    const result = resolveProfiles(settings);

    expect(result).toEqual([]);
  });

  it('uses empty string for model when ai_summary_model is not set', () => {
    const settings = mockSettings({
      ai_summary_api_key: 'key',
      ai_summary_api_url: 'https://api/v1',
    });

    const result = resolveProfiles(settings);

    expect(result[0].model).toBe('');
  });

  it('normalizes purposes from object format { summary: true } to array ["summary"]', () => {
    const rawProfiles = [
      {
        id: '1',
        name: 'GPT-4',
        provider: 'openai',
        api_url: 'https://api.openai.com/v1',
        model: 'gpt-4',
        enabled: true,
        api_key: 'sk-test',
        purposes: { summary: true, chat: false, writing: true },
      },
    ];
    const settings = mockSettings({ ai_profiles: JSON.stringify(rawProfiles) });

    const result = resolveProfiles(settings);

    expect(result[0].purposes).toEqual(['summary', 'writing']);
  });

  it('normalizes purposes from array format and keeps it as-is', () => {
    const rawProfiles = [
      {
        id: '1',
        name: 'GPT-4',
        provider: 'openai',
        api_url: 'https://api.openai.com/v1',
        model: 'gpt-4',
        enabled: true,
        api_key: 'sk-test',
        purposes: ['summary', 'chat'],
      },
    ];
    const settings = mockSettings({ ai_profiles: JSON.stringify(rawProfiles) });

    const result = resolveProfiles(settings);

    expect(result[0].purposes).toEqual(['summary', 'chat']);
  });

  it('defaults purposes to ["summary"] when missing or invalid', () => {
    const rawProfiles = [
      { id: '1', name: 'GPT-4', provider: 'openai', api_url: 'https://api.openai.com/v1', model: 'gpt-4', enabled: true, api_key: 'sk-test' },
    ];
    const settings = mockSettings({ ai_profiles: JSON.stringify(rawProfiles) });

    const result = resolveProfiles(settings);

    expect(result[0].purposes).toEqual(['summary']);
  });
});
