"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { X, Plus } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { WelcomeMessage } from "./WelcomeMessage";
import { DisconnectBar } from "./DisconnectBar";
import { SessionSwitcher } from "./SessionSwitcher";
import {
  conversationApi,
  fetchChatSettings,
  type ConversationItem,
  type StoredMessage,
  type ChatSettings,
} from "@/lib/api/ai";

const CONVERSATION_ID_KEY = "ai_chat_conversation_id";

/** Default chat settings (used when API is unavailable) */
const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  welcomeMessage: "你好！我是博客 AI 助手，有什么可以帮你？",
  suggestedQuestions: [
    "这篇文章讲了什么？",
    "推荐一些技术文章",
    "博客最近更新了什么？",
  ],
};

/** Convert stored messages from backend to UIMessage format for useChat */
function storedToUIMessages(stored: StoredMessage[]): UIMessage[] {
  return stored.map((msg, i) => ({
    id: `restored-${i}`,
    role: msg.role as "user" | "assistant",
    parts: (Array.isArray(msg.parts) && msg.parts.length > 0
      ? msg.parts
      : [{ type: "text" as const, text: msg.content || "" }]) as UIMessage["parts"],
    createdAt: new Date(msg.createdAt),
  }));
}

interface ChatWindowProps {
  onClose: () => void;
}

/**
 * Chat window with useChat streaming, conversation persistence,
 * welcome message, disconnect handling, and session switching.
 *
 * Desktop: 380x580 fixed bottom-right. Mobile: fullscreen overlay.
 */
export function ChatWindow({ onClose }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Conversation ID persistence
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CONVERSATION_ID_KEY);
  });

  // Initial messages loaded from backend history
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(!conversationId);

  // Chat settings (welcome message + suggestions)
  const [chatSettings, setChatSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);

  // Conversation list for session switcher
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  // Track if we need to fetch the newly created conversation ID after first message
  const [pendingConversationResolve, setPendingConversationResolve] = useState(false);

  // useChat instance — key changes when conversationId is cleared to force remount
  const chatKey = conversationId ?? "new";
  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: chatKey,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: conversationId ? { conversationId } : {},
    }),
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const hasError = status === "error" || !!error;

  // Load conversation history on mount if conversationId exists
  useEffect(() => {
    if (!conversationId) {
      setHistoryLoaded(true);
      return;
    }

    let cancelled = false;
    const cid = conversationId; // capture for closure
    async function loadHistory() {
      try {
        const stored = await conversationApi.fetchConversationMessages(cid);
        if (!cancelled && stored.length > 0) {
          setInitialMessages(storedToUIMessages(stored));
        }
      } catch {
        // If history load fails, start fresh (invalid ID, etc.)
        localStorage.removeItem(CONVERSATION_ID_KEY);
        setConversationId(null);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load chat settings on mount
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const settings = await fetchChatSettings();
        if (!cancelled) setChatSettings(settings);
      } catch {
        // Use defaults
      }
    }
    loadSettings();
    return () => { cancelled = true; };
  }, []);

  // Load conversation list on mount
  useEffect(() => {
    loadConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After first message in a new conversation, fetch the created conversation ID
  useEffect(() => {
    if (pendingConversationResolve && messages.length > 0 && !conversationId) {
      // The backend created a conversation. Fetch the most recent one.
      setPendingConversationResolve(false);
      conversationApi.fetchConversations(1, 1).then(res => {
        if (res.list.length > 0) {
          const newId = res.list[0].publicId;
          setConversationId(newId);
          localStorage.setItem(CONVERSATION_ID_KEY, newId);
          loadConversations();
        }
      }).catch(() => {
        // Non-critical — conversation will be found on next refresh
      });
    }
  }, [pendingConversationResolve, messages.length, conversationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Persist conversationId to localStorage
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(CONVERSATION_ID_KEY, conversationId);
    } else {
      localStorage.removeItem(CONVERSATION_ID_KEY);
    }
  }, [conversationId]);

  async function loadConversations() {
    setConversationsLoading(true);
    try {
      const res = await conversationApi.fetchConversations(1, 20);
      setConversations(res.list);
    } catch {
      // Non-critical
    } finally {
      setConversationsLoading(false);
    }
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      sendMessage({ text: trimmed });
      setInput("");
      // If no conversationId, mark that we need to resolve it after the message is sent
      if (!conversationId) {
        setPendingConversationResolve(true);
      }
    },
    [input, isLoading, sendMessage, conversationId],
  );

  const handleSuggestionClick = useCallback(
    (text: string) => {
      if (isLoading) return;
      sendMessage({ text });
      if (!conversationId) {
        setPendingConversationResolve(true);
      }
    },
    [isLoading, sendMessage, conversationId],
  );

  const handleRetry = useCallback(() => {
    // Find the last user message and re-send it
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (lastUserMsg) {
      const text = lastUserMsg.parts
        ?.filter(p => p.type === "text")
        .map(p => (p as { type: "text"; text: string }).text)
        .join("\n") ?? "";
      if (text) {
        sendMessage({ text });
      }
    }
  }, [messages, sendMessage]);

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    localStorage.removeItem(CONVERSATION_ID_KEY);
    setInitialMessages([]);
    setMessages([]);
    setPendingConversationResolve(false);
  }, [setMessages]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (id === conversationId) return;
      try {
        const stored = await conversationApi.fetchConversationMessages(id);
        setConversationId(id);
        localStorage.setItem(CONVERSATION_ID_KEY, id);
        const uiMessages = storedToUIMessages(stored);
        setInitialMessages(uiMessages);
        setMessages(uiMessages);
      } catch {
        // If load fails, just switch ID and let useChat handle it
        setConversationId(id);
        localStorage.setItem(CONVERSATION_ID_KEY, id);
        setInitialMessages([]);
        setMessages([]);
      }
    },
    [conversationId, setMessages],
  );

  // Current conversation title
  const currentTitle = useMemo(() => {
    if (!conversationId) return "AI 助手";
    const conv = conversations.find(c => c.publicId === conversationId);
    return conv?.title || "AI 助手";
  }, [conversationId, conversations]);

  // Show welcome when no messages and not loading
  const showWelcome = messages.length === 0 && !isLoading;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-[580px] w-[380px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 max-[640px]:bottom-0 max-[640px]:right-0 max-[640px]:h-full max-[640px]:w-full max-[640px]:rounded-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
            {currentTitle}
          </h2>
          <SessionSwitcher
            currentConversationId={conversationId}
            conversations={conversations}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            isLoading={conversationsLoading}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="新对话"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {showWelcome ? (
          <WelcomeMessage
            welcomeMessage={chatSettings.welcomeMessage}
            suggestions={chatSettings.suggestedQuestions}
            onSuggestionClick={handleSuggestionClick}
          />
        ) : (
          <MessageList messages={messages} isLoading={isLoading} />
        )}
      </div>

      {/* Disconnect bar */}
      <DisconnectBar visible={hasError} onRetry={handleRetry} />

      {/* Input */}
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
