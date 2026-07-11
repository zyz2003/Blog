import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { settings } from '../database/schemas/setting.schema';
import { DRIZZLE } from '../database/database.module';
import { PUBLIC_SETTING_KEYS } from './public-setting-keys';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Keys that affect CDN-cached HTML rendering.
 * When any of these change, CDN cache must be purged.
 */
const CDN_AFFECTED_KEYS = [
  'SITE_KEYWORDS',
  'SITE_DESCRIPTION',
  'FRONT_DESK_SITE_OWNER_NAME',
  'ICON_URL',
  'CUSTOM_HEADER_HTML',
  'CUSTOM_FOOTER_HTML',
  'CUSTOM_CSS',
  'CUSTOM_JS',
];

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, string>();
  private configVersion = 0;
  private loaded = false;

  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
  }

  /**
   * Ensure the settings cache is loaded.
   * Safe to call multiple times — no-ops if already loaded.
   * Used by main.ts to guarantee cache is ready before Sqids init.
   */
  async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.loadCache();
      this.loaded = true;
    }
  }

  private async loadCache(): Promise<void> {
    const rows = await this.db.select().from(settings);
    this.cache.clear();
    for (const row of rows) {
      this.cache.set(row.configKey, row.value);
    }
    this.configVersion = Date.now();
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  getAll(): Map<string, string> {
    return new Map(this.cache);
  }

  getByKeys(keys: string[], isAdmin: boolean): Record<string, any> {
    const filtered: Record<string, string> = {};

    for (const key of keys) {
      if (!isAdmin && !this.isPublicSetting(key)) {
        continue;
      }
      const value = this.cache.get(key);
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    // Mask AI profiles API keys (matches Go maskSensitiveSettings)
    if (filtered.ai_profiles) {
      filtered.ai_profiles = this.maskAIProfiles(filtered.ai_profiles);
    }

    return this.unflatten(filtered);
  }

  async update(kvPairs: Record<string, string>): Promise<void> {
    // Handle AI profiles: preserve existing keys when incoming is masked
    this.preserveAIProfilesOnUpdate(kvPairs);

    // Auto-backup before update
    this.autoBackup();

    // Detect CDN cache changes
    for (const key of CDN_AFFECTED_KEYS) {
      const oldValue = this.cache.get(key);
      const newValue = kvPairs[key];
      if (newValue !== undefined && oldValue !== newValue) {
        this.logger.warn('CDN缓存需要清除，检测到配置变更');
        break;
      }
    }

    // Upsert each key to database
    for (const [key, value] of Object.entries(kvPairs)) {
      await this.db
        .insert(settings)
        .values({ configKey: key, value })
        .onConflictDoUpdate({
          target: settings.configKey,
          set: { value },
        })
        .run();
    }

    // Refresh cache
    for (const [key, value] of Object.entries(kvPairs)) {
      this.cache.set(key, value);
    }

    // Update config version
    this.configVersion = Date.now();
  }

  getSiteConfig(): Record<string, any> {
    const publicSettings: Record<string, string> = {};

    this.cache.forEach((value, key) => {
      if (this.isPublicSetting(key)) {
        publicSettings[key] = value;
      }
    });

    const result = this.unflatten(publicSettings);
    (result as any)._config_version = this.configVersion;
    return result;
  }

  getConfigVersion(): { version: number } {
    return { version: this.configVersion };
  }

  isPublicSetting(key: string): boolean {
    return PUBLIC_SETTING_KEYS.has(key);
  }

  maskAIProfiles(profilesJson: string): string {
    try {
      const profiles = JSON.parse(profilesJson);
      if (!Array.isArray(profiles)) return profilesJson;

      const masked = profiles.map((profile: any) => {
        const apiKey: string | undefined = profile.api_key;
        const hasApiKey = !!apiKey;
        let apiKeyMasked = '****';

        if (apiKey && apiKey.length > 4) {
          apiKeyMasked = '*'.repeat(apiKey.length - 4) + apiKey.slice(-4);
        }

        const { api_key, ...rest } = profile;
        return {
          ...rest,
          has_api_key: hasApiKey,
          api_key_masked: apiKeyMasked,
        };
      });

      return JSON.stringify(masked);
    } catch {
      return profilesJson;
    }
  }

  preserveAIProfilesOnUpdate(kvPairs: Record<string, string>): void {
    if (!kvPairs.ai_profiles) return;

    try {
      const incoming = JSON.parse(kvPairs.ai_profiles);
      if (!Array.isArray(incoming)) return;

      const existingRaw = this.cache.get('ai_profiles');
      if (!existingRaw) return;

      const existing = JSON.parse(existingRaw);
      if (!Array.isArray(existing)) return;

      let changed = false;
      for (const profile of incoming) {
        if (profile.api_key && profile.api_key.startsWith('*')) {
          const existingProfile = existing.find(
            (p: any) => String(p.id) === String(profile.id),
          );
          if (existingProfile?.api_key) {
            profile.api_key = existingProfile.api_key;
            delete profile.api_key_masked;
            delete profile.has_api_key;
            changed = true;
          }
        }
      }

      if (changed) {
        kvPairs.ai_profiles = JSON.stringify(incoming);
      }
    } catch {
      // If parsing fails, proceed as-is
    }
  }

  unflatten(flat: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, rawValue] of Object.entries(flat)) {
      const value = this.parseValue(rawValue.trim());
      this.setNestedValue(result, key.split('.'), value);
    }

    return result;
  }

  private parseValue(value: string): any {
    // Try JSON parse (objects and arrays starting with { or [)
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // Not valid JSON, keep as string
      }
    }

    // Try boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try number
    const num = Number(value);
    if (value !== '' && !isNaN(num) && isFinite(num)) {
      return Number.isInteger(num) ? parseInt(value, 10) : parseFloat(value);
    }

    return value;
  }

  private setNestedValue(obj: Record<string, any>, keys: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  }

  private autoBackup(): void {
    try {
      const backupDir = path.join(process.cwd(), 'data', 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `settings-${timestamp}.json`);

      const data: Record<string, string> = {};
      this.cache.forEach((value, key) => {
        data[key] = value;
      });

      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.warn(`配置自动备份失败: ${error}`);
    }
  }
}
