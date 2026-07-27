import { SettingsService } from '../../settings/settings.service';

/**
 * AiProfile — a single AI model configuration stored in the settings table.
 * No AI SDK imports; framework-agnostic data layer.
 */
export interface AiProfile {
  id: string;
  name: string;
  provider: string;
  api_url: string;
  model: string;
  enabled: boolean;
  api_key: string;
  purposes: string[];
}

/**
 * Normalize purposes from either format:
 * - Frontend saves as object: { summary: true, chat: false }
 * - Backend expects array: ['summary']
 */
function normalizePurposes(purposes: unknown): string[] {
  if (Array.isArray(purposes)) return purposes.filter((p): p is string => typeof p === 'string');
  if (typeof purposes === 'object' && purposes !== null) {
    return Object.entries(purposes)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }
  return ['summary']; // default
}

/**
 * Normalize a raw parsed profile to ensure all fields conform to AiProfile.
 */
function normalizeProfile(raw: Record<string, unknown>): AiProfile {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    provider: String(raw.provider ?? 'custom'),
    api_url: String(raw.api_url ?? ''),
    model: String(raw.model ?? ''),
    enabled: raw.enabled !== false,
    api_key: String(raw.api_key ?? ''),
    purposes: normalizePurposes(raw.purposes),
  };
}

/**
 * resolveProfiles — reads AI profiles from settings, with legacy fallback.
 *
 * 1. Tries to parse `ai_profiles` JSON from settings.
 * 2. If empty/undefined/invalid, falls back to legacy `ai_summary_*` keys
 *    synthesizing a single profile with id='legacy', provider='custom'.
 * 3. Returns empty array when neither source provides configuration.
 */
export function resolveProfiles(settings: SettingsService): AiProfile[] {
  const raw = settings.get('ai_profiles'); // returns string | undefined
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: Record<string, unknown>) => normalizeProfile(p));
      }
    } catch {
      /* fall through to legacy */
    }
  }
  // Legacy fallback (D-330)
  const key = settings.get('ai_summary_api_key');
  const url = settings.get('ai_summary_api_url');
  if (key && url) {
    return [
      {
        id: 'legacy',
        name: '默认',
        provider: 'custom',
        api_url: url,
        model: settings.get('ai_summary_model') || '',
        enabled: true,
        api_key: key,
        purposes: ['summary'],
      },
    ];
  }
  return [];
}
