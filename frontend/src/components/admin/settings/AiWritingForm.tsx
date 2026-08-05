"use client";

import { useMemo } from "react";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_AI_PROFILES,
  KEY_AI_WRITING_PROFILE_ID,
  KEY_AI_WRITING_SYSTEM_PROMPT,
  KEY_AI_WRITING_MAX_TOKENS,
  KEY_AI_WRITING_TEMPERATURE,
} from "@/lib/settings/setting-keys";
import type { AiProfile } from "@/lib/settings/ai-profile";

interface AiWritingFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function AiWritingForm({ values, onChange, loading }: AiWritingFormProps) {
  // 筛选启用了"写作"用途的模型
  const writingProfiles: AiProfile[] = useMemo(() => {
    try {
      const raw = values[KEY_AI_PROFILES];
      if (!raw?.trim()) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (p: Record<string, unknown>) =>
          p.enabled && (p.purposes as Record<string, boolean>)?.writing,
      ) as AiProfile[];
    } catch {
      return [];
    }
  }, [values[KEY_AI_PROFILES]]);

  const selectedProfileId = values[KEY_AI_WRITING_PROFILE_ID] || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 写作模型 */}
      <SettingsSection
        title="写作模型"
        description="选择用于 AI 写作的模型。需先在「AI 模型」中添加并启用模型，并勾选「写作」用途。"
      >
        {writingProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            请先在「AI 模型」中添加模型配置，并勾选「写作」用途
          </p>
        ) : (
          <FormSelect
            label="使用模型"
            value={selectedProfileId}
            placeholder="请选择写作使用的模型"
            onValueChange={(v) => onChange(KEY_AI_WRITING_PROFILE_ID, v)}
            description="写作功能将使用此模型，可与对话/摘要使用不同模型"
          >
            {writingProfiles.map((profile) => (
              <FormSelectItem key={profile.id} textValue={profile.name || profile.model || profile.id}>
                {profile.name || profile.model || profile.id}
              </FormSelectItem>
            ))}
          </FormSelect>
        )}
      </SettingsSection>

      {/* 写作参数 */}
      <SettingsSection
        title="写作参数"
        description="自定义 AI 写作的行为和风格。"
      >
        <FormTextarea
          label="系统提示词"
          placeholder="你是一个专业的博客写作助手。请用中文写作，风格清晰简洁，适合技术博客..."
          value={values[KEY_AI_WRITING_SYSTEM_PROMPT] ?? ""}
          onValueChange={(v) => onChange(KEY_AI_WRITING_SYSTEM_PROMPT, v)}
          description="留空则使用默认提示词。可自定义 AI 的写作风格、语言、输出格式等。"
          minRows={4}
        />
        <SettingsFieldGroup cols={2}>
          <FormInput
            label="最大 Token"
            type="number"
            placeholder="2000"
            value={values[KEY_AI_WRITING_MAX_TOKENS] ?? ""}
            onValueChange={(v) => onChange(KEY_AI_WRITING_MAX_TOKENS, v)}
            description="单次生成的最大 token 数"
          />
          <FormInput
            label="温度"
            type="number"
            placeholder="0.7"
            value={values[KEY_AI_WRITING_TEMPERATURE] ?? ""}
            onValueChange={(v) => onChange(KEY_AI_WRITING_TEMPERATURE, v)}
            description="0=严谨, 1=创意, 建议 0.7"
          />
        </SettingsFieldGroup>
      </SettingsSection>

      {/* 启用工具 */}
      <SettingsSection
        title="启用工具"
        description="AI 写作时可调用的工具。工具列表和管理请到「AI 功能 → AI 工具」页面。"
      >
        <p className="text-sm text-muted-foreground py-2">
          工具选择功能开发中。当前写作不启用工具。后续可在「AI 工具」页面管理工具，并在此选择启用。
        </p>
      </SettingsSection>
    </div>
  );
}
