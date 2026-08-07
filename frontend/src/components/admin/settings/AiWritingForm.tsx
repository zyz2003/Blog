"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@heroui/react";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { SettingsSection, SettingsFieldGroup } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_AI_PROFILES,
  KEY_AI_DEFAULT_PROFILE_ID,
  KEY_AI_WRITING_PROFILE_ID,
  KEY_AI_WRITING_SYSTEM_PROMPT,
  KEY_AI_WRITING_MAX_TOKENS,
  KEY_AI_WRITING_TEMPERATURE,
  KEY_AI_WRITING_ENABLED_BLOCKS,
  KEY_AI_WRITING_ENABLED_TOOLS,
} from "@/lib/settings/setting-keys";
import { aiWritingApi, type AiBlock } from "@/lib/api/ai-writing";
import { aiToolsApi } from "@/lib/api/ai-tools";
import type { AiProfile } from "@/lib/settings/ai-profile";

interface AiWritingFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function AiWritingForm({ values, onChange, loading }: AiWritingFormProps) {
  // 所有启用的模型
  const allEnabledProfiles: AiProfile[] = useMemo(() => {
    try {
      const raw = values[KEY_AI_PROFILES];
      if (!raw?.trim()) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (p: Record<string, unknown>) => p.enabled,
      ) as AiProfile[];
    } catch {
      return [];
    }
  }, [values[KEY_AI_PROFILES]]);

  // 启用了「写作」用途的模型（给选择器用）
  const writingProfiles = useMemo(
    () => allEnabledProfiles.filter((p) => p.purposes?.writing),
    [allEnabledProfiles],
  );

  // 实际将使用的模型（镜像后端 ModelResolver.resolve 的 fallback：
  // 指定 -> 默认 -> 写作用途 -> 首个启用），用于透明化展示
  const effectiveModel = useMemo(() => {
    const desiredId =
      values[KEY_AI_WRITING_PROFILE_ID] || values[KEY_AI_DEFAULT_PROFILE_ID];
    return (
      (desiredId
        ? allEnabledProfiles.find((p) => p.id === desiredId)
        : undefined) ||
      allEnabledProfiles.find((p) => p.purposes?.writing) ||
      allEnabledProfiles[0]
    );
  }, [
    values[KEY_AI_WRITING_PROFILE_ID],
    values[KEY_AI_DEFAULT_PROFILE_ID],
    allEnabledProfiles,
  ]);

  const selectedProfileId = values[KEY_AI_WRITING_PROFILE_ID] || "";

  // AI 可用自定义块注册表
  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["ai-writing-blocks"],
    queryFn: () => aiWritingApi.getBlocks(),
    staleTime: 1000 * 60 * 10,
  });

  // 已启用的块 id 列表：空字符串=默认全部；否则解析 JSON 数组
  const enabledBlockIds: string[] = useMemo(() => {
    const raw = values[KEY_AI_WRITING_ENABLED_BLOCKS];
    if (!raw?.trim()) return blocks?.map((b) => b.id) ?? [];
    try {
      const ids = JSON.parse(raw);
      return Array.isArray(ids) ? ids.filter((i) => typeof i === "string") : [];
    } catch {
      return blocks?.map((b) => b.id) ?? [];
    }
  }, [values[KEY_AI_WRITING_ENABLED_BLOCKS], blocks]);

  const toggleBlock = (id: string) => {
    const current = new Set(enabledBlockIds);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    onChange(KEY_AI_WRITING_ENABLED_BLOCKS, JSON.stringify(Array.from(current)));
  };

  // AI 工具列表
  const { data: tools, isLoading: toolsLoading } = useQuery({
    queryKey: ["ai-tools"],
    queryFn: () => aiToolsApi.list(),
    staleTime: 1000 * 60 * 10,
  });

  // 已启用的工具：空=不用（写作默认关闭）；'[ids]'=指定
  const enabledToolIds: string[] = useMemo(() => {
    const raw = values[KEY_AI_WRITING_ENABLED_TOOLS];
    if (!raw?.trim()) return [];
    try {
      const ids = JSON.parse(raw);
      return Array.isArray(ids) ? ids.filter((i) => typeof i === "string") : [];
    } catch {
      return [];
    }
  }, [values[KEY_AI_WRITING_ENABLED_TOOLS]]);

  const toggleTool = (name: string) => {
    const current = new Set(enabledToolIds);
    if (current.has(name)) current.delete(name);
    else current.add(name);
    onChange(KEY_AI_WRITING_ENABLED_TOOLS, JSON.stringify(Array.from(current)));
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
      {/* 写作模型 */}
      <SettingsSection
        collapsible
        title="写作模型"
        description="选择用于 AI 写作的模型。需先在「AI 模型」中添加并启用模型，并勾选「写作」用途。未选择时按「指定 -> 默认 -> 写作用途 -> 首个启用」回退。"
      >
        {writingProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            暂无勾选「写作」用途的模型。
            {effectiveModel
              ? `未选择时将回退使用「${effectiveModel.name || effectiveModel.model}」。`
              : "请先在「AI 模型」中添加并启用模型。"}
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
        {!selectedProfileId && effectiveModel && writingProfiles.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            未选择专用写作模型，实际将使用：
            <span className="font-medium text-foreground">
              {effectiveModel.name || effectiveModel.model}
            </span>
            {!effectiveModel.purposes?.writing &&
              "（该模型未勾选「写作」用途，已回退）"}
          </p>
        )}
      </SettingsSection>

      {/* 写作参数 */}
      <SettingsSection
        collapsible
        title="写作参数"
        description="自定义 AI 写作的行为和风格。"
      >
        <FormTextarea
          label="系统提示词"
          placeholder="# 角色 / # 任务 / # 输出格式 / # 约束（分段编写）"
          value={values[KEY_AI_WRITING_SYSTEM_PROMPT] ?? ""}
          onValueChange={(v) => onChange(KEY_AI_WRITING_SYSTEM_PROMPT, v)}
          description="建议按「# 角色 / # 任务 / # 输出格式 / # 约束」分段编写。留空使用默认提示词。"
          minRows={6}
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

      {/* AI 可用块 */}
      <SettingsSection
        collapsible
        title="AI 可用块"
        description="选择 AI 写作时可产出的自定义块。启用后会把对应语法教给 AI；流式生成时文本块实时弹入，图表类（Mermaid）在生成完成后渲染。"
      >
        {blocksLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-1">
            {(blocks ?? []).map((block) => {
              const enabled = enabledBlockIds.includes(block.id);
              return (
                <div
                  key={block.id}
                  className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {block.label}
                      {!block.streamable && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          完成时渲染
                        </span>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground break-all">
                      {block.syntax}
                    </code>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={enabled}
                    onValueChange={() => toggleBlock(block.id)}
                    aria-label={`启用 ${block.label}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {/* 启用工具 */}
      <SettingsSection
        collapsible
        defaultCollapsed
        title="启用工具"
        description="AI 写作时可调用的工具。工具列表和管理请到「AI 功能 → AI 工具」页面。"
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
