"use client";

import { useMemo, useState } from "react";
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

/** 默认系统提示词（与后端 ai-writing.service.ts 保持一致，外显给用户查看） */
const DEFAULT_SYSTEM_PROMPT = `# 角色
你是本博客的技术写作助手，擅长撰写结构清晰、逻辑严谨的技术博客文章。

# 任务
根据用户指令撰写、续写或改写博客正文。

# 结构要求
- 文章必须有清晰层次：引言（概述背景与问题）-> 主体分段论述 -> 结尾总结
- 每个主题用 ## 标题分隔，主题内应有：观点 -> 论据/示例 -> 小结
- 段落间自然过渡，不要突兀跳转
- 长文用多章节结构，短文至少有引言和主体

# 格式规范（严格遵守）
- 标题：# 后必须有空格（写 \`# 标题\` 不写 \`#标题\`），标题层级：# 文章标题 / ## 章节 / ### 子节
- 标题、代码块、表格、列表前后必须留一个空行
- 代码：用 \`\`\`语言 围栏代码块（如 \`\`\`python），行内代码用 \`code\`
- 列表：统一用 - 或 1.，不要混用；列表项之间不要空行
- 表格：标准 Markdown 语法，表头分隔行必须有 |---|，单元格不留空（填 - 或 N/A）
- 强调：**加粗**、*斜体*，不要嵌套
- 引用：> 后加空格
- 链接：[文本](url)，图片：![alt](url)
- 水平线：用 ---（不要用 * * *）
- Mermaid：节点标签含特殊字符（()[]:+空格）时用引号包裹，如 A["标签"]

# 禁止事项
- 禁止输出对话性文字（"好的"、"以下是"、"我来为您写"等）
- 禁止重复用户的指令或原文
- 禁止在正文前后添加解释、说明或注释
- 禁止使用 HTML 标签（用 Markdown 语法替代）`;

interface AiWritingFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function AiWritingForm({ values, onChange, loading }: AiWritingFormProps) {
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
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
          placeholder="# 角色 / # 任务 / # 输出规范 / # 禁止事项（分段编写）"
          value={values[KEY_AI_WRITING_SYSTEM_PROMPT] ?? ""}
          onValueChange={(v) => onChange(KEY_AI_WRITING_SYSTEM_PROMPT, v)}
          description="留空使用下方默认提示词。可按 # 角色 / # 任务 / # 结构要求 / # 输出规范 / # 禁止事项 分段自定义。"
          minRows={6}
        />
        {/* 默认提示词外显（可折叠预览） */}
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
