"use client";

import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import { Wrench, Plus } from "lucide-react";

interface ToolManagementFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

/** 内置工具列表（与后端 articleTools 对应） */
const BUILT_IN_TOOLS = [
  { name: "search_articles", description: "搜索博客文章（按关键词）" },
  { name: "get_article", description: "获取文章详情（按 ID 或 slug）" },
  { name: "get_recent_articles", description: "获取最近发布的文章" },
  { name: "get_articles_by_category", description: "按分类获取文章列表" },
  { name: "list_categories", description: "列出所有文章分类" },
  { name: "list_tags", description: "列出所有文章标签" },
];

export function ToolManagementForm({ loading }: ToolManagementFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SettingsSection
        title="内置工具"
        description="系统自带的文章搜索和阅读工具，AI 对话和写作可按需启用。"
      >
        <div className="space-y-2">
          {BUILT_IN_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/60 bg-muted/30"
            >
              <Wrench className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <code className="text-xs font-mono text-primary">{tool.name}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                内置
              </span>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="外部工具"
        description="类似 MCP 的自定义工具调用机制。注册外部工具后，AI 对话和写作可选择启用。当前为预留接口，后续支持自定义添加。"
      >
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <span>暂无外部工具</span>
        </div>
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          添加工具（开发中）
        </button>
        <p className="text-xs text-muted-foreground mt-2">
          启用方式：在「AI 对话」或「AI 写作」设置页中选择要启用的工具。
        </p>
      </SettingsSection>
    </div>
  );
}
