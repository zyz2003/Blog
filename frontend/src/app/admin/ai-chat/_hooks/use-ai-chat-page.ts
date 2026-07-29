import { useState, useCallback, useEffect } from "react";
import { addToast } from "@heroui/react";
import {
  conversationApi,
  type ConversationItem,
  type StoredMessage,
} from "@/lib/api/ai";

export function useAiChatPage() {
  // ---- List state ----
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ---- Detail state ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // ---- Delete state ----
  const [deleteTarget, setDeleteTarget] = useState<ConversationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // ---- Load conversations ----
  const loadConversations = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const data = await conversationApi.fetchConversations(p, pageSize);
      setConversations(data.list);
      setTotal(data.total);
      setPage(data.page);
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "获取对话列表失败",
        color: "danger",
        timeout: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  // Load on mount
  useEffect(() => {
    loadConversations(1);
  }, [loadConversations]);

  // ---- Select conversation ----
  const selectConversation = useCallback(async (id: string) => {
    setSelectedId(id);
    setIsLoadingMessages(true);
    try {
      const msgs = await conversationApi.fetchConversationMessages(id);
      setMessages(msgs);
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "获取对话消息失败",
        color: "danger",
        timeout: 3000,
      });
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // ---- Close detail ----
  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setMessages([]);
  }, []);

  // ---- Delete conversation ----
  const handleDeleteClick = useCallback((item: ConversationItem) => {
    setDeleteTarget(item);
    setDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await conversationApi.deleteConversation(deleteTarget.publicId);
      addToast({ title: "对话已删除", color: "success", timeout: 3000 });
      // If the deleted conversation was selected, close detail
      if (selectedId === deleteTarget.publicId) {
        closeDetail();
      }
      // Refresh list
      await loadConversations(page);
    } catch (error) {
      addToast({
        title: error instanceof Error ? error.message : "删除对话失败",
        color: "danger",
        timeout: 3000,
      });
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, selectedId, page, closeDetail, loadConversations]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  }, []);

  // ---- Pagination ----
  const loadPage = useCallback((p: number) => {
    loadConversations(p);
  }, [loadConversations]);

  return {
    // List
    conversations,
    isLoading,
    page,
    pageSize,
    total,
    totalPages,
    loadPage,

    // Detail
    selectedId,
    messages,
    isLoadingMessages,
    selectConversation,
    closeDetail,

    // Delete
    deleteTarget,
    isDeleting,
    deleteModalOpen,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  };
}

export type AiChatPageState = ReturnType<typeof useAiChatPage>;
