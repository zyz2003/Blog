"use client";

import { useCallback, useMemo } from "react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormSwitch } from "@/components/ui/form-switch";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_AI_PROFILES,
  KEY_AI_DEFAULT_PROFILE_ID,
} from "@/lib/settings/setting-keys";
import type { AiProfile } from "@/lib/settings/ai-profile";

/** 服务商预设映射 */
const PROVIDER_PRESETS: Record<string, { api_url: string; model: string }> = {
  openai: { api_url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  deepseek: { api_url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
};

interface AiModelsFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

/** 用途标签配置 */
const PURPOSE_OPTIONS = [
  { key: "summary" as const, label: "摘要" },
  { key: "chat" as const, label: "对话" },
  { key: "writing" as const, label: "写作" },
];

export function AiModelsForm({ values, onChange, loading }: AiModelsFormProps) {
  const profiles: AiProfile[] = useMemo(() => {
    try {
      const raw = values[KEY_AI_PROFILES];
      if (!raw?.trim()) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [values[KEY_AI_PROFILES]]);

  const defaultProfileId = values[KEY_AI_DEFAULT_PROFILE_ID] || "";

  const updateProfiles = useCallback(
    (updated: AiProfile[]) => {
      onChange(KEY_AI_PROFILES, JSON.stringify(updated));
    },
    [onChange]
  );

  const updateProfile = useCallback(
    (id: string, patch: Partial<AiProfile>) => {
      const updated = profiles.map(p => (p.id === id ? { ...p, ...patch } : p));
      updateProfiles(updated);
    },
    [profiles, updateProfiles]
  );

  const addProfile = useCallback(() => {
    const newProfile: AiProfile = {
      id: `p_${Date.now()}`,
      name: `模型 ${profiles.length + 1}`,
      provider: "openai",
      api_url: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      api_key: "",
      enabled: true,
      purposes: { summary: true },
    };
    const updated = [...profiles, newProfile];
    updateProfiles(updated);
    // Auto-set as default if no default exists
    if (!defaultProfileId) {
      onChange(KEY_AI_DEFAULT_PROFILE_ID, newProfile.id);
    }
  }, [profiles, updateProfiles, defaultProfileId, onChange]);

  const removeProfile = useCallback(
    (id: string) => {
      const updated = profiles.filter(p => p.id !== id);
      updateProfiles(updated);
      // If removed profile was default, clear or reassign
      if (defaultProfileId === id) {
        const firstEnabled = updated.find(p => p.enabled);
        onChange(KEY_AI_DEFAULT_PROFILE_ID, firstEnabled?.id || "");
      }
    },
    [profiles, updateProfiles, defaultProfileId, onChange]
  );

  const setDefault = useCallback(
    (id: string) => {
      onChange(KEY_AI_DEFAULT_PROFILE_ID, id);
    },
    [onChange]
  );

  const handleProviderChange = useCallback(
    (id: string, provider: string) => {
      const profile = profiles.find(p => p.id === id);
      if (!profile) return;
      const patch: Partial<AiProfile> = {
        provider: provider as AiProfile["provider"],
      };
      const preset = PROVIDER_PRESETS[provider];
      if (preset) {
        // Auto-fill only if current values match a different preset or are empty
        if (!profile.api_url.trim() || Object.values(PROVIDER_PRESETS).some(p => p.api_url === profile.api_url)) {
          patch.api_url = preset.api_url;
        }
        if (!profile.model.trim() || Object.values(PROVIDER_PRESETS).some(p => p.model === profile.model)) {
          patch.model = preset.model;
        }
      }
      updateProfile(id, patch);
    },
    [profiles, updateProfile]
  );

  const togglePurpose = useCallback(
    (id: string, purposeKey: keyof AiProfile["purposes"], checked: boolean) => {
      const profile = profiles.find(p => p.id === id);
      if (!profile) return;
      updateProfile(id, {
        purposes: { ...profile.purposes, [purposeKey]: checked },
      });
    },
    [profiles, updateProfile]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 模型列表 */}
      {profiles.length === 0 && (
        <SettingsSection title="模型配置" description="尚未添加任何 AI 模型，点击下方按钮添加。">
          <p className="text-sm text-muted-foreground py-2">
            添加模型后，可在「AI 摘要」等功能中选择使用。
          </p>
        </SettingsSection>
      )}

      {profiles.map(profile => {
        const isDefault = profile.id === defaultProfileId;
        const hasApiKey = !!(profile.api_key ?? "").trim();

        return (
          <SettingsSection
            key={profile.id}
            title={profile.name || "未命名模型"}
            description={isDefault ? "当前默认模型" : undefined}
            className={isDefault ? "ring-1 ring-primary/30" : undefined}
          >
            {/* 基本信息 */}
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="模型名称"
                placeholder="如：GPT-4o Mini"
                value={profile.name}
                onValueChange={v => updateProfile(profile.id, { name: v })}
                description="便于识别的名称"
              />
              <FormSelect
                label="服务商"
                value={profile.provider}
                placeholder="请选择服务商"
                onValueChange={v => handleProviderChange(profile.id, v)}
                description="选择预设可自动填充 API 地址和模型"
              >
                <FormSelectItem key="openai">OpenAI</FormSelectItem>
                <FormSelectItem key="deepseek">DeepSeek</FormSelectItem>
                <FormSelectItem key="custom">自定义</FormSelectItem>
              </FormSelect>
            </SettingsFieldGroup>

            {/* 接口配置 */}
            <SettingsFieldGroup cols={2}>
              <FormInput
                label="API 地址"
                placeholder="https://api.openai.com/v1"
                value={profile.api_url}
                onValueChange={v => updateProfile(profile.id, { api_url: v })}
                description="OpenAI 兼容接口地址，以 /v1 结尾"
              />
              <FormInput
                label="模型名称"
                placeholder="gpt-4o-mini"
                value={profile.model}
                onValueChange={v => updateProfile(profile.id, { model: v })}
                description="如 gpt-4o-mini / deepseek-chat / gpt-4o 等"
              />
            </SettingsFieldGroup>

            <FormInput
              label="API Key"
              type="password"
              placeholder={hasApiKey ? "已配置（如需修改请重新输入）" : "请输入 API Key"}
              value={profile.api_key}
              onValueChange={v => updateProfile(profile.id, { api_key: v })}
              description="用于鉴权的密钥，保存后不会明文回显"
            />

            {/* 启用与用途 */}
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground/80">启用此模型</span>
                <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">
                  禁用后不会出现在功能的选择列表中
                </p>
              </div>
              <FormSwitch
                checked={profile.enabled}
                onCheckedChange={v => updateProfile(profile.id, { enabled: v })}
              />
            </div>

            {profile.enabled && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-foreground/80">用途标记</span>
                <p className="text-xs text-muted-foreground">
                  标记此模型可用于哪些功能，方便后续功能自动选择
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {PURPOSE_OPTIONS.map(opt => (
                    <label
                      key={opt.key}
                      className="inline-flex items-center gap-1.5 text-sm text-foreground/70 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!profile.purposes[opt.key]}
                        onChange={e => togglePurpose(profile.id, opt.key, e.target.checked)}
                        className="rounded border-border/60 accent-primary"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-3 pt-2 border-t border-border/30">
              {!isDefault && profile.enabled && (
                <button
                  type="button"
                  onClick={() => setDefault(profile.id)}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  设为默认
                </button>
              )}
              {isDefault && (
                <span className="text-xs text-primary font-medium">默认模型</span>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => removeProfile(profile.id)}
                className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors"
              >
                删除
              </button>
            </div>
          </SettingsSection>
        );
      })}

      {/* 添加按钮 */}
      <button
        type="button"
        onClick={addProfile}
        className="w-full rounded-xl border-2 border-dashed border-border/60 bg-card/50 py-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        + 添加模型
      </button>
    </div>
  );
}
