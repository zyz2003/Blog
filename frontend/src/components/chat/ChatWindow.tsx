"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { UIMessage } from "ai";
import { X } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatWindowProps {
  onClose: () => void;
}

const STORAGE_KEY = "chat_conversation_id";

function getOrCreateConversationId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  // Generate a simple unique ID for new conversations
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

/**
 * Chat window with useChat streaming, tool result rendering,
 * and localStorage conversationId persistence.
 *
 * Desktop: 380x580 fixed bottom-right. Mobile: fullscreen overlay.
 */
export function ChatWindow({ onClose }: ChatWindowProps) {
  const [conversationId] = useState(() => getOrCreateConversationId());
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { conversationId },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      sendMessage({ text: trimmed });
      setInput("");
    },
    [input, isLoading, sendMessage],
  );

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-[580px] w-[380px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 max-[640px]:bottom-0 max-[640px]:right-0 max-[640px]:h-full max-[640px]:w-full max-[640px]:rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          AI 助手
        </h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error.message || "发生错误，请重试"}
        </div>
      )}

      {/* Input */}
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
