"use client";

import { Sparkles, MessageSquare, FileText, Clock } from "lucide-react";

interface WelcomeMessageProps {
  welcomeMessage: string;
  suggestions: string[];
  onSuggestionClick: (text: string) => void;
}

const SUGGESTION_ICONS = [MessageSquare, FileText, Clock];

/**
 * 空状态：渐变头像（脉冲环）+ 问候 + 建议卡片（图标 + 文字 + hover 上浮）。
 */
export function WelcomeMessage({
  welcomeMessage,
  suggestions,
  onSuggestionClick,
}: WelcomeMessageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-4">
      <div className="chat-avatar chat-pulse-ring flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-primary/20">
        <Sparkles className="h-7 w-7" />
      </div>
      <p className="text-center text-sm font-medium text-foreground">{welcomeMessage}</p>
      {suggestions.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          {suggestions.map((suggestion, i) => {
            const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length];
            return (
              <button
                key={i}
                onClick={() => onSuggestionClick(suggestion)}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="line-clamp-1">{suggestion}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
