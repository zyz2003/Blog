"use client";

import { Plus, MessageSquare, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ConversationSummary {
  publicId: string;
  title: string | null;
  updatedAt: string;
}

interface SessionSwitcherProps {
  currentConversationId: string | null;
  conversations: ConversationSummary[];
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading: boolean;
}

/**
 * Session switcher dropdown for switching between conversations.
 * Triggered by clicking the conversation title in the header.
 */
export function SessionSwitcher({
  currentConversationId,
  conversations,
  onSelect,
  onNew,
  isLoading,
}: SessionSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function formatRelativeTime(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "刚刚";
      if (diffMin < 60) return `${diffMin} 分钟前`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} 小时前`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 30) return `${diffDay} 天前`;
      return date.toLocaleDateString("zh-CN");
    } catch {
      return "";
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1 text-sm font-semibold text-neutral-800 transition-colors hover:text-neutral-600 dark:text-neutral-200 dark:hover:text-neutral-400"
        aria-label="切换对话"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {/* New conversation button */}
          <button
            onClick={() => {
              onNew();
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 border-b border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <Plus className="h-4 w-4" />
            新对话
          </button>

          {/* Conversation list */}
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-xs text-neutral-400">
                加载中...
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-neutral-400">
                暂无对话记录
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.publicId}
                  onClick={() => {
                    onSelect(conv.publicId);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
                    conv.publicId === currentConversationId
                      ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {conv.title || "新对话"}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {formatRelativeTime(conv.updatedAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
