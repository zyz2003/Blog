"use client";

import { useMemo } from "react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormCodeEditor } from "@/components/ui/form-code-editor";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_AI_PROFILES,
  KEY_AI_SUMMARY_PROFILE_ID,
  KEY_AI_SUMMARY_SYSTEM_PROMPT,
  KEY_AI_SUMMARY_GPT_NAME,
} from "@/lib/settings/setting-keys";
import type { AiProfile } from "@/lib/settings/ai-profile";

interface AiSummaryFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

/** 默认 System Prompt 见后端 summary.adapter.ts；留空时后端兜底。 */

export function AiSummaryForm({ values, onChange, loading }: AiSummaryFormProps) {
  const enabledProfiles: AiProfile[] = useMemo(() => {
    try {
      const raw = values[KEY_AI_PROFILES];
      if (!raw?.trim()) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p: Record<string, unknown>) => p.enabled) as AiProfile[];
    } catch {
      return [];
    }
  }, [values[KEY_AI_PROFILES]]);

  const selectedProfileId = values[KEY_AI_SUMMARY_PROFILE_ID] || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 摘要模型 */}
      <SettingsSection
        title="摘要模型"
        description="选择用于生成文章摘要的 AI 模型。需先在「AI 模型」中添加并启用模型。"
      >
        {enabledProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            请先在「AI 模型」中添加模型配置
          </p>
        ) : (
          <FormSelect
            label="使用模型"
            value={selectedProfileId}
            placeholder="请选择摘要使用的模型"
            onValueChange={v => onChange(KEY_AI_SUMMARY_PROFILE_ID, v)}
            description="摘要功能将使用此模型生成内容，可与全局默认模型不同"
          >
            {enabledProfiles.map(profile => (
              <FormSelectItem key={profile.id}>
                {profile.name || profile.model || profile.id}
              </FormSelectItem>
            ))}
          </FormSelect>
        )}
      </SettingsSection>

      {/* 前台展示 */}
      <SettingsSection title="前台展示" description="控制文章详情页 AI 摘要的展示效果。">
        <FormInput
          label="AI 名字"
          placeholder="AnZhiYu"
          value={values[KEY_AI_SUMMARY_GPT_NAME]}
          onValueChange={v => onChange(KEY_AI_SUMMARY_GPT_NAME, v)}
          description="前台摘要卡片中显示的 AI 助手名称，留空则默认显示「文章摘要」"
        />
      </SettingsSection>

      {/* 提示词配置 */}
      <SettingsSection
        title="提示词配置"
        description="System Prompt 控制 AI 生成摘要的风格和长度。留空则使用系统默认值。"
      >
        <FormCodeEditor
          label="System Prompt"
          language="text"
          value={values[KEY_AI_SUMMARY_SYSTEM_PROMPT] || ""}
          onValueChange={v => onChange(KEY_AI_SUMMARY_SYSTEM_PROMPT, v)}
          description="建议按「# 角色 / # 任务 / # 输出格式 / # 约束」分段编写。留空使用默认提示词。"
          minRows={6}
        />
      </SettingsSection>
    </div>
  );
}
