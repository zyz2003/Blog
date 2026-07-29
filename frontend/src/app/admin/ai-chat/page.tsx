"use client";

import { motion } from "framer-motion";
import { adminContainerVariants, adminItemVariants } from "@/lib/motion";
import { useAiChatPage } from "./_hooks/use-ai-chat-page";
import { AiChatSkeleton } from "./_components/AiChatSkeleton";
import { ConversationList } from "./_components/ConversationList";
import { ConversationDetail } from "./_components/ConversationDetail";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Trash2 } from "lucide-react";

export default function AiChatManagementPage() {
  const cm = useAiChatPage();

  if (cm.isLoading && cm.conversations.length === 0) {
    return <AiChatSkeleton />;
  }

  return (
    <motion.div
      className="relative h-full flex flex-col overflow-hidden -m-4 lg:-m-8"
      variants={adminContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={adminItemVariants}
        className="flex-1 min-h-0 flex flex-col mx-6 mt-5 mb-2 bg-card border border-border/60 rounded-xl overflow-hidden"
      >
        {/* Two-column layout on desktop, single column on mobile */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0">
          {/* List panel */}
          <div className={`flex-1 min-h-0 flex flex-col ${cm.selectedId ? "hidden lg:flex" : "flex"}`}>
            <ConversationList cm={cm} />
          </div>

          {/* Detail panel */}
          {cm.selectedId && (
            <div className="flex-1 min-h-0 flex flex-col lg:border-l lg:border-border/40">
              <ConversationDetail cm={cm} />
            </div>
          )}
        </div>
      </motion.div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={cm.deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) cm.handleDeleteCancel();
        }}
        title="删除对话"
        description={`确定要删除对话「${cm.deleteTarget?.title || "无标题"}」吗？此操作不可撤销。`}
        confirmText="删除"
        confirmColor="danger"
        icon={<Trash2 className="w-5 h-5 text-danger" />}
        iconBg="bg-danger/10"
        loading={cm.isDeleting}
        onConfirm={cm.handleDeleteConfirm}
      />
    </motion.div>
  );
}
