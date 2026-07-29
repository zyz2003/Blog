"use client";

import { Button, Chip, Tooltip } from "@heroui/react";
import { X, Trash2, User, Bot, Wrench, Terminal } from "lucide-react";
import { formatDateTimeParts } from "@/utils/date";
import type { StoredMessage } from "@/lib/api/ai";
import type { AiChatPageState } from "../_hooks/use-ai-chat-page";

const ROLE_CONFIG: Record<string, { label: string; color: "primary" | "success" | "warning" | "default"; icon: React.ComponentType<{ className?: string }> }> = {
  user: { label: "用户", color: "primary", icon: User },
  assistant: { label: "助手", color: "success", icon: Bot },
  system: { label: "系统", color: "warning", icon: Terminal },
  tool: { label: "工具", color: "default", icon: Wrench },
};

interface ConversationDetailProps {
  cm: AiChatPageState;
}

export function ConversationDetail({ cm }: ConversationDetailProps) {
  if (!cm.selectedId) return null;

  const selectedConversation = cm.conversations.find(c => c.publicId === cm.selectedId);

  return (
    <div className="flex flex-col h-full bg-card border border-border/60 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">
            {selectedConversation?.title || "无标题"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {cm.selectedId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content="删除对话" placement="top" size="sm" color="danger">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              className="w-8 h-8 min-w-0 text-danger bg-danger/10 hover:bg-danger/20"
              onPress={() => {
                if (selectedConversation) {
                  cm.handleDeleteClick(selectedConversation);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="full"
            className="w-8 h-8 min-w-0"
            onPress={cm.closeDetail}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {cm.isLoadingMessages ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            加载中...
          </div>
        ) : cm.messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            暂无消息
          </div>
        ) : (
          cm.messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} />
          ))
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: StoredMessage }) {
  const roleConfig = ROLE_CONFIG[message.role] || ROLE_CONFIG.system;
  const RoleIcon = roleConfig.icon;
  const timeParts = formatDateTimeParts(message.createdAt);

  return (
    <div className="flex gap-3">
      {/* Role badge */}
      <div className="shrink-0 pt-0.5">
        <Chip
          size="sm"
          variant="flat"
          color={roleConfig.color}
          startContent={<RoleIcon className="w-3 h-3" />}
          classNames={{
            base: "h-6 px-2 gap-1",
            content: "text-[10px] font-medium",
          }}
        >
          {roleConfig.label}
        </Chip>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/60 tabular-nums">
          <span>{timeParts.date}</span>
          <span>{timeParts.time}</span>
        </div>
      </div>
    </div>
  );
}
