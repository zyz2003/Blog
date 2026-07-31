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
    <div className="flex items-center justify-between gap-2 border-t border-destructive/30 bg-destructive/10 px-4 py-2">
      <span className="text-xs text-destructive">
        连接中断，点击重试
      </span>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
        aria-label="重试"
      >
        <RefreshCw className="h-3 w-3" />
        重试
      </button>
    </div>
  );
}
