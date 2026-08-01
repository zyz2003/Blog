"use client";

import { useState, useEffect } from "react";
import type { UIMessage } from "ai";
import { Brain, ChevronDown } from "lucide-react";
import { ToolResultCard } from "./ToolResultCard";
import { MarkdownText } from "./MarkdownText";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
}

/** 工具调用 loading 文案映射 */
const TOOL_LOADING_LABELS: Record<string, string> = {
  search_articles: "正在搜索文章...",
  get_article: "正在获取文章...",
  get_recent_articles: "正在获取最新文章...",
  get_articles_by_category: "正在按分类查找...",
  list_categories: "正在获取分类...",
  list_tags: "正在获取标签...",
};

/** 工具失败文案：从 loading label 推导（"正在搜索文章..." -> "搜索文章失败"） */
function toolErrorLabel(toolName: string): string {
  const loading = TOOL_LOADING_LABELS[toolName];
  if (!loading) return "调用失败";
  return loading.replace("正在", "").replace("...", "失败");
}

/**
 * Renders chat messages with user/assistant styling.
 * Assistant 消息分组：
 * - 思考过程折叠块：reasoning + 候选工具摘要（搜索/最新/分类列表/分类标签）
 * - 主区域：get_article 卡片（AI 精选阅读的文章，即最终推荐）+ 最终文字回答
 * 候选结果不刷屏，最终推荐以卡片呈现（可点击）。
 */
export function MessageList({ messages, isLoading }: MessageListProps) {
  const lastAssistantId = [...messages].reverse().find(m => m.role === "assistant")?.id;

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        发送消息开始对话
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map(message => {
        const isLastAssistant = message.id === lastAssistantId;

        return (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {message.role === "assistant" ? (
                <AssistantMessage
                  parts={message.parts}
                  isLastAssistant={isLastAssistant}
                  isLoading={isLoading}
                />
              ) : (
                // User message - just show text from parts
                message.parts
                  ?.filter(p => p.type === "text")
                  .map(p => (p as { type: "text"; text: string }).text)
                  .join("\n") ?? ""
              )}
            </div>
          </div>
        );
      })}
      {isLoading && !messages.some(m => m.role === "assistant") && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            AI 正在思考<span className="animate-pulse">...</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Assistant 消息：思考过程折叠块（候选摘要）+ get_article 卡片 + 最终回答 */
function AssistantMessage({
  parts,
  isLastAssistant,
  isLoading,
}: {
  parts?: UIMessage["parts"];
  isLastAssistant: boolean;
  isLoading: boolean;
}) {
  if (!parts || parts.length === 0) return null;

  const reasoningParts = parts.filter(p => p.type === "reasoning") as any[];
  const toolParts = parts.filter(
    p => typeof (p as any).type === "string" && (p as any).type.startsWith("tool-"),
  ) as any[];
  const textParts = parts.filter(p => p.type === "text") as any[];

  const pendingTools = toolParts.filter(
    t => t.state !== "output-available" && t.state !== "output-error",
  );
  const errorTools = toolParts.filter(t => t.state === "output-error");
  const successTools = toolParts.filter(t => t.state === "output-available");

  // get_article（AI 精选阅读）：主区域显示卡片，作为最终推荐
  const getArticleTools = successTools.filter(
    t => t.type.slice(5) === "get_article",
  );
  // 其他成功工具（候选文章列表 / 分类 / 标签）：折进思考块摘要
  const otherSuccessTools = successTools.filter(
    t => t.type.slice(5) !== "get_article",
  );

  const hasThinking =
    reasoningParts.length > 0 ||
    otherSuccessTools.length > 0 ||
    pendingTools.length > 0 ||
    errorTools.length > 0;
  // 流式时（有进行中的 reasoning 或工具）思考块自动展开，完成后折叠
  const isStreaming =
    reasoningParts.some(r => r.state === "streaming") || pendingTools.length > 0;

  return (
    <div className="space-y-2">
      {hasThinking && (
        <ThinkingBlock streaming={isStreaming}>
          {reasoningParts.map((r, i) => (
            <div
              key={`reasoning-${i}`}
              className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"
            >
              {r.text}
            </div>
          ))}
          {otherSuccessTools.map(t => (
            <ToolSummary key={`os-${t.toolCallId}`} tool={t} />
          ))}
          {pendingTools.map(t => (
            <div
              key={`pending-${t.toolCallId}`}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary" />
              {TOOL_LOADING_LABELS[t.type.slice(5)] || "正在处理..."}
            </div>
          ))}
          {errorTools.map(t => (
            <div
              key={`error-${t.toolCallId}`}
              className="text-xs text-muted-foreground/70"
            >
              {toolErrorLabel(t.type.slice(5))}
            </div>
          ))}
        </ThinkingBlock>
      )}

      {getArticleTools.map(t => (
        <ToolResultCard
          key={`tool-${t.toolCallId}`}
          output={t.output}
          toolName="get_article"
        />
      ))}

      {textParts.map((part, i) => {
        const showCursor =
          isLastAssistant && isLoading && i === textParts.length - 1;
        return (
          <div key={`text-${i}`}>
            <MarkdownText text={part.text} />
            {showCursor && (
              <span className="inline-block animate-pulse text-muted-foreground">|</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 候选工具摘要行（思考块内）：文章列表/分类/标签只显示一行摘要 */
function ToolSummary({ tool }: { tool: any }) {
  const name = tool.type.slice(5);
  const data = tool.output;

  // 文章列表工具（search/recent/by_category）
  if (data?.articles && Array.isArray(data.articles)) {
    const n = data.articles.length;
    const label =
      name === "search_articles"
        ? "搜索文章"
        : name === "get_recent_articles"
          ? "最新文章"
          : "分类文章";
    return (
      <div className="text-xs text-muted-foreground">
        📄 {label} · {n > 0 ? `找到 ${n} 篇` : "未找到"}
      </div>
    );
  }
  if (data?.categories && Array.isArray(data.categories)) {
    return (
      <div className="text-xs text-muted-foreground">
        🗂 查询分类 · {data.categories.length} 个
      </div>
    );
  }
  if (data?.tags && Array.isArray(data.tags)) {
    return (
      <div className="text-xs text-muted-foreground">
        🏷 查询标签 · {data.tags.length} 个
      </div>
    );
  }
  return <div className="text-xs text-muted-foreground">✓ {name}</div>;
}

/**
 * 思考过程折叠块：合并所有 reasoning + 候选工具摘要。
 * 流式时自动展开（看到实时思考），完成后默认折叠（不干扰阅读）。
 */
function ThinkingBlock({
  children,
  streaming,
}: {
  children: React.ReactNode;
  streaming: boolean;
}) {
  const [expanded, setExpanded] = useState(streaming);

  useEffect(() => {
    setExpanded(streaming);
  }, [streaming]);

  return (
    <div className="rounded-lg border border-border bg-muted/50">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <Brain className="h-3.5 w-3.5" />
        <span>{streaming ? "思考中..." : "思考过程"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="space-y-1.5 border-t border-border px-2.5 pb-2 pt-1.5">
          {children}
          {streaming && <span className="animate-pulse">▋</span>}
        </div>
      )}
    </div>
  );
}
