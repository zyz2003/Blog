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
