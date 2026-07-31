"use client";

import { useState, useEffect } from "react";
import type { UIMessage } from "ai";
import { Brain, ChevronDown } from "lucide-react";
import { ToolResultCard } from "./ToolResultCard";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
}

/**
 * Renders chat messages with user/assistant styling.
 * Handles text parts, tool-call loading states, and tool-result cards.
 * Streaming text shows a blinking cursor on the last assistant message.
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
                <div className="space-y-2">
                  {message.parts?.map((part, i) => {
                    // Reasoning parts - 可折叠的思考过程（模型支持时才显示）
                    if (part.type === "reasoning") {
                      const reasoningPart = part as { type: "reasoning"; text: string; state?: "streaming" | "done" };
                      return (
                        <ReasoningBlock
                          key={`${message.id}-reasoning-${i}`}
                          text={reasoningPart.text}
                          state={reasoningPart.state}
                        />
                      );
                    }

                    // Text parts
                    if (part.type === "text") {
                      const showCursor = isLastAssistant && isLoading && i === message.parts.length - 1;
                      return (
                        <span key={`${message.id}-text-${i}`}>
                          {part.text}
                          {showCursor && (
                            <span className="inline-block animate-pulse text-muted-foreground">|</span>
                          )}
                        </span>
                      );
                    }

                    // Tool call parts — typed as tool-{toolName}
                    if (part.type === "tool-search_articles" || part.type === "tool-get_article") {
                      if (part.state === "output-available") {
                        return (
                          <ToolResultCard
                            key={`${message.id}-tool-${part.toolCallId}`}
                            output={part.output}
                            toolName={part.type === "tool-search_articles" ? "search_articles" : "get_article"}
                          />
                        );
                      }
                      // Loading state
                      return (
                        <div
                          key={`${message.id}-tool-loading-${part.toolCallId}`}
                          className="flex items-center gap-2 text-muted-foreground"
                        >
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary" />
                          {part.type === "tool-search_articles" ? "正在搜索文章..." : "正在获取文章..."}
                        </div>
                      );
                    }

                    // Ignore other part types
                    return null;
                  })}
                </div>
              ) : (
                // User message — just show text from parts
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

/**
 * ReasoningBlock - 可折叠的 AI 思考过程展示。
 * 模型返回 reasoning parts 时才渲染（智谱 GLM-4.7-Flash 等支持思考的模型）。
 * 不支持思考的模型没有 reasoning parts，不显示。流式时自动展开，完成后默认折叠。
 */
function ReasoningBlock({ text, state }: { text: string; state?: "streaming" | "done" }) {
  const [expanded, setExpanded] = useState(state === "streaming");

  useEffect(() => {
    if (state === "streaming") setExpanded(true);
    if (state === "done") setExpanded(false);
  }, [state]);

  return (
    <div className="rounded-lg border border-border bg-muted/50">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <Brain className="h-3.5 w-3.5" />
        <span>{state === "streaming" ? "思考中..." : "思考过程"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && text && (
        <div className="border-t border-border px-2.5 pb-2 pt-1.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {text}
          {state === "streaming" && <span className="animate-pulse">▋</span>}
        </div>
      )}
    </div>
  );
}
