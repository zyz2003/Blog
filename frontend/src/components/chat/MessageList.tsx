"use client";

import { useState, useEffect } from "react";
import type { UIMessage } from "ai";
import {
  Brain,
  ChevronDown,
  Sparkles,
  FileText,
  FolderClosed,
  Tag,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { ToolResultCard } from "./ToolResultCard";
import { MarkdownText } from "./MarkdownText";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
}

/** 工具调用 loading 文案映射（流式态显示） */
const TOOL_LOADING_LABELS: Record<string, string> = {
  search_articles: "搜索文章中…",
  get_article: "阅读文章中…",
  get_recent_articles: "获取最新文章中…",
  get_articles_by_category: "按分类查找中…",
  list_categories: "获取分类中…",
  list_tags: "获取标签中…",
};

/** 工具完成态文案（摘要 / 失败推导用） */
const TOOL_DONE_LABELS: Record<string, string> = {
  search_articles: "搜索文章",
  get_article: "阅读文章",
  get_recent_articles: "最新文章",
  get_articles_by_category: "分类文章",
  list_categories: "查询分类",
  list_tags: "查询标签",
};

/** 工具失败文案：从完成态 label 推导（"搜索文章" -> "搜索文章失败"） */
function toolErrorLabel(toolName: string): string {
  const done = TOOL_DONE_LABELS[toolName];
  return done ? `${done}失败` : "调用失败";
}

/** 助手消息是否有可见内容（reasoning / 工具 / 非空文本）- 用于区分等待态与正常气泡 */
function assistantHasVisibleContent(parts?: UIMessage["parts"]): boolean {
  if (!parts || parts.length === 0) return false;
  return parts.some(p => {
    const t = (p as any).type;
    if (t === "text") return !!(p as any).text?.trim();
    if (t === "reasoning") return true;
    if (typeof t === "string" && t.startsWith("tool-")) return true;
    return false;
  });
}

/** 三点弹跳指示器：Queued / 等待首个 token 时显示 */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1.5 py-2">
      <span className="chat-typing-dot" style={{ animationDelay: "0ms" }} />
      <span className="chat-typing-dot" style={{ animationDelay: "160ms" }} />
      <span className="chat-typing-dot" style={{ animationDelay: "320ms" }} />
    </div>
  );
}

/** 助手渐变头像：Sparkles 图标 + primary 渐变圆 */
function AssistantAvatar({
  size = "md",
  pulsing = false,
}: {
  size?: "sm" | "md";
  pulsing?: boolean;
}) {
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div
      className={`chat-avatar ${dim} flex shrink-0 items-center justify-center rounded-full ring-1 ring-primary/20 ${
        pulsing ? "chat-pulse-ring" : ""
      }`}
    >
      <Sparkles className={icon} />
    </div>
  );
}

/** 复制按钮：hover 消息时出现，复制助手回答纯文本 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="mt-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
      aria-label="复制回答"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

/**
 * 渲染对话消息。混合布局：
 * - 助手：左侧渐变头像 + 轻背景弱气泡（bg-muted/60，rounded-2xl 左上直角），全宽感 + 气泡轮廓
 * - 用户：右侧紧凑强调气泡（bg-primary，右下直角）
 * Assistant 消息分组：思考过程折叠块（reasoning + 候选工具摘要）+ get_article 卡片（最终推荐）+ markdown 回答
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
    <div className="space-y-4">
      {messages.map(message => {
        const isLastAssistant = message.id === lastAssistantId;

        if (message.role === "assistant") {
          const hasContent = assistantHasVisibleContent(message.parts);
          const isWaiting = !hasContent && isLoading;
          const plainText = hasContent
            ? (message.parts
                ?.filter(p => p.type === "text")
                .map(p => (p as { type: "text"; text: string }).text)
                .join("\n") ?? "")
            : "";
          return (
            <div key={message.id} className="chat-msg-enter group flex gap-2.5">
              <AssistantAvatar pulsing={isWaiting} />
              {hasContent ? (
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2.5 text-sm">
                    <AssistantMessage
                      parts={message.parts}
                      isLastAssistant={isLastAssistant}
                      isLoading={isLoading}
                    />
                  </div>
                  <CopyButton text={plainText} />
                </div>
              ) : isWaiting ? (
                <div className="flex items-center">
                  <TypingDots />
                </div>
              ) : null}
            </div>
          );
        }

        // 用户消息
        const text =
          message.parts
            ?.filter(p => p.type === "text")
            .map(p => (p as { type: "text"; text: string }).text)
            .join("\n") ?? "";
        return (
          <div key={message.id} className="chat-msg-enter flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">
              {text}
            </div>
          </div>
        );
      })}
      {isLoading && !messages.some(m => m.role === "assistant") && (
        <div className="chat-msg-enter flex gap-2.5">
          <AssistantAvatar pulsing />
          <div className="flex items-center">
            <TypingDots />
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
  const getArticleTools = successTools.filter(t => t.type.slice(5) === "get_article");
  // 其他成功工具（候选文章列表 / 分类 / 标签）：折进思考块摘要
  const otherSuccessTools = successTools.filter(t => t.type.slice(5) !== "get_article");

  const hasThinking =
    reasoningParts.length > 0 ||
    otherSuccessTools.length > 0 ||
    pendingTools.length > 0 ||
    errorTools.length > 0;
  // 流式时（有进行中的 reasoning 或工具）思考块自动展开，完成后折叠
  const isStreaming =
    reasoningParts.some(r => r.state === "streaming") || pendingTools.length > 0;

  // 动态头部标签：流式时显示最新进行中工具的动作，完成显示"思考过程"
  const streamingLabel =
    pendingTools.length > 0
      ? TOOL_LOADING_LABELS[pendingTools[pendingTools.length - 1].type.slice(5)] || "思考中…"
      : "思考中…";
  const headerLabel = isStreaming ? streamingLabel : "思考过程";
  const stepCount = toolParts.length;

  return (
    <div className="space-y-2">
      {hasThinking && (
        <ThinkingBlock streaming={isStreaming} label={headerLabel} stepCount={stepCount}>
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
              {TOOL_LOADING_LABELS[t.type.slice(5)] || "正在处理…"}
            </div>
          ))}
          {errorTools.map(t => (
            <div
              key={`error-${t.toolCallId}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/70"
            >
              <AlertCircle className="h-3 w-3 shrink-0" />
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
          <div key={`text-${i}`} className="text-foreground">
            <MarkdownText text={part.text} />
            {showCursor && (
              <span className="chat-cursor ml-0.5 inline-block text-primary">▋</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 候选工具摘要行（思考块内）：lucide 图标 + 一行摘要 */
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3 w-3 shrink-0" />
        <span>
          {label} · {n > 0 ? `找到 ${n} 篇` : "未找到"}
        </span>
      </div>
    );
  }
  if (data?.categories && Array.isArray(data.categories)) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FolderClosed className="h-3 w-3 shrink-0" />
        <span>查询分类 · {data.categories.length} 个</span>
      </div>
    );
  }
  if (data?.tags && Array.isArray(data.tags)) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Tag className="h-3 w-3 shrink-0" />
        <span>查询标签 · {data.tags.length} 个</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="h-3 w-3 shrink-0" />
      <span>{name}</span>
    </div>
  );
}

/**
 * 思考过程折叠块：合并所有 reasoning + 候选工具摘要。
 * 流式时自动展开 + 顶部 shimmer 条 + 动态动作标签；完成后默认折叠。
 */
function ThinkingBlock({
  children,
  streaming,
  label,
  stepCount,
}: {
  children: React.ReactNode;
  streaming: boolean;
  label: string;
  stepCount: number;
}) {
  const [expanded, setExpanded] = useState(streaming);

  useEffect(() => {
    setExpanded(streaming);
  }, [streaming]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/40">
      {streaming && (
        <div className="chat-thinking-shimmer absolute inset-x-0 top-0 h-0.5" />
      )}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span>{label}</span>
        {stepCount > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
            {stepCount} 步
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="space-y-1.5 border-t border-border/60 px-2.5 pb-2 pt-1.5">
          {children}
        </div>
      )}
    </div>
  );
}
