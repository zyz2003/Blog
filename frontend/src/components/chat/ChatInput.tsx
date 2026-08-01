"use client";

import { useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop?: () => void;
}

/**
 * 输入区：自适应高度 textarea + 发送/Stop 按钮。
 * - Enter 发送，Shift+Enter 换行
 * - 流式中发送键变 Stop 方块按钮（调 onStop 取消请求）
 * - 超过 max-h-32 后内部滚动
 */
export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
}: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 自适应高度：重算 scrollHeight，超过上限后滚动
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form && input.trim() && !isLoading) {
        form.requestSubmit();
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="border-t border-border px-3 py-2.5">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 transition-colors focus-within:border-primary">
        <textarea
          ref={taRef}
          rows={1}
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息…"
          className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            disabled={!onStop}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
            aria-label="停止生成"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}
