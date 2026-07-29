"use client";

import { RefreshCw } from "lucide-react";

interface DisconnectBarProps {
  visible: boolean;
  onRetry: () => void;
}

/**
 * Disconnect notification bar shown when connection drops.
 * Displays error message with a manual retry button.
 */
export function DisconnectBar({ visible, onRetry }: DisconnectBarProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-t border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-950">
      <span className="text-xs text-red-600 dark:text-red-400">
        连接中断，点击重试
      </span>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900"
        aria-label="重试"
      >
        <RefreshCw className="h-3 w-3" />
        重试
      </button>
    </div>
  );
}
