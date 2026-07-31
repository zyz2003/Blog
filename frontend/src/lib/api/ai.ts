/**
 * AI 相关 API 服务
 */

import { apiClient } from "./client";

// ===================================
//          AI 摘要 API
// ===================================

export const aiApi = {
  /**
   * 为指定文章生成 AI 摘要
   * @param articleId 文章公开 ID（sqids 编码）
   * @returns 生成的摘要文本
   *
   * 注意：后端从数据库读取文章正文，前端只需传 ID。
   * 生成结果不写库，前端拿到后自行填入编辑器保存。
   */
  async generateSummary(articleId: string): Promise<string> {
    const response = await apiClient.post<{ summary: string }>(
      `/api/ai/generate-summary/${articleId}`
    );

    if (response.code === 200 && response.data) {
      return response.data.summary;
    }

    throw new Error(response.message || "AI 摘要生成失败");
  },
};

// ===================================
//        AI 对话 API
// ===================================

export interface ConversationItem {
  publicId: string;
  title: string | null;
  updatedAt: string;
}

export interface ConversationListResponse {
  list: ConversationItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  parts: unknown[];
  createdAt: string;
}

export const conversationApi = {
  /**
   * 获取对话列表
   */
  async fetchConversations(
    page = 1,
    pageSize = 20
  ): Promise<ConversationListResponse> {
    const response = await apiClient.get<ConversationListResponse>(
      `/api/ai/conversations?page=${page}&page_size=${pageSize}`
    );
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取对话列表失败");
  },

  /**
   * 获取对话消息历史
   */
  async fetchConversationMessages(
    conversationId: string
  ): Promise<StoredMessage[]> {
    const response = await apiClient.get<StoredMessage[]>(
      `/api/ai/conversations/${conversationId}/messages`
    );
    if (response.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response.message || "获取对话消息失败");
  },

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const response = await apiClient.delete<void>(
      `/api/ai/conversations/${conversationId}`
    );
    if (response.code !== 200) {
      throw new Error(response.message || "删除对话失败");
    }
  },
};

// ===================================
//      AI 模型连接测试 API
// ===================================

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  message: string;
  hasReasoning?: boolean;
}

export async function testConnection(params: {
  profileId: string;
  apiUrl: string;
  model: string;
}): Promise<TestConnectionResult> {
  const response = await apiClient.post<TestConnectionResult>(
    "/api/ai/test-connection",
    { profile_id: params.profileId, api_url: params.apiUrl, model: params.model }
  );
  if (response.data) {
    return response.data;
  }
  throw new Error(response.message || "测试连接失败");
}

// ===================================
//      AI 对话设置 API (public)
// ===================================

export interface ChatSettings {
  welcomeMessage: string;
  suggestedQuestions: string[];
}

/**
 * Fetch chat settings from public site config.
 * Falls back to defaults if settings are not available.
 */
export async function fetchChatSettings(): Promise<ChatSettings> {
  const defaults: ChatSettings = {
    welcomeMessage: "你好！我是博客 AI 助手，有什么可以帮你？",
    suggestedQuestions: [
      "这篇文章讲了什么？",
      "推荐一些技术文章",
      "博客最近更新了什么？",
    ],
  };

  try {
    const response = await apiClient.get<Record<string, unknown>>(
      "/api/public/site-config"
    );
    if (response.code !== 200 || !response.data) return defaults;

    const data = response.data;
    return {
      welcomeMessage:
        typeof data.ai_chat_welcome_message === "string" &&
        data.ai_chat_welcome_message.trim()
          ? data.ai_chat_welcome_message
          : defaults.welcomeMessage,
      suggestedQuestions: parseSuggestedQuestions(
        data.ai_chat_suggested_questions,
        defaults.suggestedQuestions
      ),
    };
  } catch {
    return defaults;
  }
}

function parseSuggestedQuestions(
  raw: unknown,
  fallback: string[]
): string[] {
  if (!raw) return fallback;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
        return parsed;
      }
    } catch {
      return fallback;
    }
  }
  if (Array.isArray(raw) && raw.every(item => typeof item === "string")) {
    return raw;
  }
  return fallback;
}
