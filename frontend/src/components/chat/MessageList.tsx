"use client";

import type { UIMessage } from "ai";
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
      <div className="flex h-full items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
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
                  ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-800"
                  : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="space-y-2">
                  {message.parts?.map((part, i) => {
                    // Text parts
                    if (part.type === "text") {
                      const showCursor = isLastAssistant && isLoading && i === message.parts.length - 1;
                      return (
                        <span key={`${message.id}-text-${i}`}>
                          {part.text}
                          {showCursor && (
                            <span className="inline-block animate-pulse text-neutral-400">|</span>
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
                          className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400"
                        >
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300" />
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
          <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-3 py-2 text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            AI 正在思考<span className="animate-pulse">...</span>
          </div>
        </div>
      )}
    </div>
  );
}
