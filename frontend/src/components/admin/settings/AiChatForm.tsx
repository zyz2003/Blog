"use client";

import { useMemo } from "react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormCodeEditor } from "@/components/ui/form-code-editor";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_AI_PROFILES,
  KEY_AI_CHAT_PROFILE_ID,
  KEY_AI_CHAT_WELCOME_MESSAGE,
  KEY_AI_CHAT_SUGGESTED_QUESTIONS,
  KEY_AI_CHAT_SYSTEM_PROMPT,
} from "@/lib/settings/setting-keys";
import type { AiProfile } from "@/lib/settings/ai-profile";

interface AiChatFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

/** Default System Prompt (backend fallback, shown in UI) */
const DEFAULT_SYSTEM_PROMPT =
  "你是博客站的 AI 助手，可以搜索和阅读博客文章来回答用户问题。请用中文回答。";

export function AiChatForm({ values, onChange, loading }: AiChatFormProps) {
  const chatProfiles: AiProfile[] = useMemo(() => {
    try {
      const raw = values[KEY_AI_PROFILES];
      if (!raw?.trim()) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (p: Record<string, unknown>) => p.enabled && (p.purposes as Record<string, boolean>)?.chat
      ) as AiProfile[];
    } catch {
      return [];
    }
  }, [values[KEY_AI_PROFILES]]);

  const selectedProfileId = values[KEY_AI_CHAT_PROFILE_ID] || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Chat model */}
      <SettingsSection
        title="对话模型"
        description="选择用于 AI 对话的模型。需先在「AI 模型」中添加并启用模型，并勾选「对话」用途。"
      >
        {chatProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            请先在「AI 模型」中添加模型配置，并勾选「对话」用途
          </p>
        ) : (
          <FormSelect
            label="使用模型"
            value={selectedProfileId}
            placeholder="请选择对话使用的模型"
            onValueChange={v => onChange(KEY_AI_CHAT_PROFILE_ID, v)}
            description="对话功能将使用此模型，可与全局默认模型不同"
          >
            {chatProfiles.map(profile => (
              <FormSelectItem key={profile.id}>
                {profile.name || profile.model || profile.id}
              </FormSelectItem>
            ))}
          </FormSelect>
        )}
      </SettingsSection>

      {/* Welcome message */}
      <SettingsSection
        title="欢迎消息"
        description="用户打开聊天窗口时显示的欢迎语和推荐问题。"
      >
        <FormInput
          label="欢迎语"
          placeholder="你好！我是博客 AI 助手，有什么可以帮你？"
          value={values[KEY_AI_CHAT_WELCOME_MESSAGE]}
          onValueChange={v => onChange(KEY_AI_CHAT_WELCOME_MESSAGE, v)}
          description="留空则使用默认欢迎语"
        />
        <FormCodeEditor
          label="推荐问题"
          language="json"
          value={values[KEY_AI_CHAT_SUGGESTED_QUESTIONS] || ""}
          onValueChange={v => onChange(KEY_AI_CHAT_SUGGESTED_QUESTIONS, v)}
          description='JSON 字符串数组，如 ["这篇文章讲了什么？","推荐一些技术文章"]'
          minRows={4}
        />
      </SettingsSection>

      {/* System prompt */}
      <SettingsSection
        title="提示词配置"
        description="System Prompt 控制 AI 对话的风格和行为。留空则使用系统默认值。"
      >
        <FormCodeEditor
          label="System Prompt"
          language="text"
          value={values[KEY_AI_CHAT_SYSTEM_PROMPT] || ""}
          onValueChange={v => onChange(KEY_AI_CHAT_SYSTEM_PROMPT, v)}
          description={`留空时使用默认值：${DEFAULT_SYSTEM_PROMPT}`}
          minRows={6}
        />
      </SettingsSection>
    </div>
  );
}
