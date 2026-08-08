"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@heroui/react";
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
  KEY_AI_CHAT_ENABLED_TOOLS,
} from "@/lib/settings/setting-keys";
import { aiToolsApi } from "@/lib/api/ai-tools";
import type { AiProfile } from "@/lib/settings/ai-profile";

interface AiChatFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

/** 默认系统提示词（与后端 chat.service.ts 保持一致，外显给用户查看） */
const DEFAULT_SYSTEM_PROMPT = `# 角色
你是本博客的 AI 助手，可以搜索和阅读博客文章来回答用户问题。

# 任务
回答用户关于博客内容的问题，必要时推荐相关文章。

# 输出格式
- 用中文回答
- 推荐文章时侧重推荐理由，不要在回答中重复列出文章链接（卡片已展示）

# 约束
- 推荐文章时精选最相关的 2-3 篇，避免取过多候选
- 对最终推荐的文章调用 get_article 获取详情
- 用户指定分类或语言（如 Java、Python）时，优先用 get_articles_by_category 查找；分类名可用 list_categories 确认`;

export function AiChatForm({ values, onChange, loading }: AiChatFormProps) {
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
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

  // AI 工具列表
  const { data: tools, isLoading: toolsLoading } = useQuery({
    queryKey: ["ai-tools"],
    queryFn: () => aiToolsApi.list(),
    staleTime: 1000 * 60 * 10,
  });

  // 已启用的工具：空=全部（对话默认全开）；"[]"=不用；'[ids]'=指定
  const enabledToolIds: string[] = useMemo(() => {
    const raw = values[KEY_AI_CHAT_ENABLED_TOOLS];
    if (!raw?.trim()) return tools?.map((t) => t.name) ?? [];
    try {
      const ids = JSON.parse(raw);
      return Array.isArray(ids) ? ids.filter((i) => typeof i === "string") : [];
    } catch {
      return tools?.map((t) => t.name) ?? [];
    }
  }, [values[KEY_AI_CHAT_ENABLED_TOOLS], tools]);

  const toggleTool = (name: string) => {
    const current = new Set(enabledToolIds);
    if (current.has(name)) current.delete(name);
    else current.add(name);
    onChange(KEY_AI_CHAT_ENABLED_TOOLS, JSON.stringify(Array.from(current)));
  };

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
          description="留空使用下方默认提示词。可按 # 角色 / # 任务 / # 输出格式 / # 约束 分段自定义。"
          minRows={6}
        />
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
          <button
            type="button"
            onClick={() => setShowDefaultPrompt((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-2 py-1 rounded"
          >
            {showDefaultPrompt ? "▼" : "▶"} 查看默认提示词（留空时使用）
          </button>
          {showDefaultPrompt && (
            <pre className="mt-2 text-xs text-muted-foreground bg-background/60 rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">
              {DEFAULT_SYSTEM_PROMPT}
            </pre>
          )}
        </div>
      </SettingsSection>

      {/* 启用工具 */}
      <SettingsSection
        collapsible
        title="启用工具"
        description="AI 对话可调用的工具。留空=全部启用；取消勾选的不会被调用。工具管理见「AI 工具」页面。"
      >
        {toolsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner />
          </div>
        ) : (tools ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">暂无已注册工具。</p>
        ) : (
          <div className="space-y-1">
            {(tools ?? []).map((tool) => (
              <div
                key={tool.name}
                className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0"
              >
                <div className="min-w-0">
                  <code className="text-xs font-mono text-primary">{tool.name}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                </div>
                <Switch
                  size="sm"
                  isSelected={enabledToolIds.includes(tool.name)}
                  onValueChange={() => toggleTool(tool.name)}
                  aria-label={`启用 ${tool.name}`}
                />
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
