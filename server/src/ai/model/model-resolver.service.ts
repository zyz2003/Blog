import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LanguageModel } from 'ai';
import { resolveProfiles } from './ai-profile';
import { DomainError } from '../domain-error';

@Injectable()
export class ModelResolver {
  constructor(private settings: SettingsService) {}

  /**
   * Resolve a LanguageModel from the configured AI profiles.
   *
   * Resolution order:
   * 1. Exact match by profileId (if provided)
   * 2. Fallback to ai_default_profile_id setting
   * 3. Fallback to first enabled profile
   *
   * Throws if no enabled profile is found.
   */
  resolve(profileId?: string): LanguageModel {
    const profiles = resolveProfiles(this.settings);
    const defaultId = this.settings.get('ai_default_profile_id');

    const profile =
      profiles.find((p) => p.id === (profileId ?? defaultId) && p.enabled) ||
      profiles.find((p) => p.enabled);

    if (!profile) throw new DomainError('未配置可用的 AI 模型');

    const provider = createOpenAICompatible({
      name: profile.provider, // REQUIRED in AI SDK 7
      baseURL: profile.api_url,
      apiKey: profile.api_key,
      // 默认不关闭思考模式：让模型原生返回 reasoning，前端自适应展示。
      // profile.disable_thinking=true 时注入 thinking:disabled（对智谱等支持的模型生效，
      // 不支持的模型忽略该字段无害）。
      ...(profile.disable_thinking && {
        transformRequestBody: (body: Record<string, any>) => ({
          ...body,
          thinking: { type: 'disabled' },
        }),
      }),
    });

    return provider(profile.model);
  }
}
