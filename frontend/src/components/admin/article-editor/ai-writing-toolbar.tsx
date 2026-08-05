"use client";

import { Check, Undo2, RefreshCw, Loader2 } from "lucide-react";

interface AiWritingToolbarProps {
  isGenerating: boolean;
  onAccept: () => void;
  onUndo: () => void;
  onRegenerate: () => void;
}

/**
 * AI 生成结果的浮动工具栏。
 * 生成中显示 loading，生成后显示 接受/撤销/重新生成。
 */
export function AiWritingToolbar({
  isGenerating,
  onAccept,
  onUndo,
  onRegenerate,
}: AiWritingToolbarProps) {
  if (isGenerating) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>AI 正在生成...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg">
      <button
        type="button"
        onClick={onAccept}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 rounded transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
        接受
      </button>
      <button
        type="button"
        onClick={onUndo}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted rounded transition-colors"
      >
        <Undo2 className="w-3.5 h-3.5" />
        撤销
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted rounded transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        重新生成
      </button>
    </div>
  );
}
