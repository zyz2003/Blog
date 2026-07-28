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
    <form onSubmit={onSubmit} className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder="输入消息..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-400 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800 text-white transition-colors hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-200 dark:text-neutral-800 dark:hover:bg-neutral-300"
          aria-label="发送"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
