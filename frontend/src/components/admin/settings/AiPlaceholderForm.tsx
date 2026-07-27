"use client";

import { Bot } from "lucide-react";
import { SettingsSection } from "./SettingsSection";

interface AiPlaceholderFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function AiPlaceholderForm({ loading }: AiPlaceholderFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SettingsSection title="功能开发中">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground/70">敬请期待</p>
        <p className="text-xs text-muted-foreground mt-1">此功能正在开发中，后续版本将支持</p>
      </div>
    </SettingsSection>
  );
}
