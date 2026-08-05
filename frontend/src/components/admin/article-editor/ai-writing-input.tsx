"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface AiWritingInputProps {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  isGenerating: boolean;
}

/**
 * AI 写作提示词输入框。
 * 斜杠命令 /ai 触发后显示，用户输入提示词回车后开始生成。
 */
export function AiWritingInput({ onSubmit, onCancel, isGenerating }: AiWritingInputProps) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!prompt.trim() || isGenerating) return;
    onSubmit(prompt.trim());
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
      <Sparkles className="w-4 h-4 text-primary shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        placeholder="描述你想写的内容，如：写一篇关于 Docker 部署的教程"
        disabled={isGenerating}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
    </div>
  );
}
