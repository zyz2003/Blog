"use client";

import { Send } from "lucide-react";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

/**
 * Chat input with text field and send button.
 * Full implementation in Task 2.
 */
export function ChatInput({ input, onInputChange, onSubmit, isLoading }: ChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder="输入消息..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          aria-label="发送"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
