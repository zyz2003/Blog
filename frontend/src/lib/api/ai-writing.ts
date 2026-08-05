/**
 * AI 写作 API -- SSE 流式封装。
 *
 * 不走 apiClient（axios 不支持流式），直接用 fetch + ReadableStream 解析 SSE。
 */
import { useAuthStore } from "@/store/auth-store";

interface StreamOptions {
  onChunk: (text: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

async function streamSSE(
  url: string,
  body: Record<string, string>,
  { onChunk, onDone, onError }: StreamOptions,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `请求失败: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onDone?.();
            return;
          }
          try {
            onChunk(JSON.parse(data));
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
    onDone?.();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export const aiWritingApi = {
  generate(prompt: string, options: StreamOptions): Promise<void> {
    return streamSSE("/api/ai/writing/generate", { prompt }, options);
  },
  continue(content: string, options: StreamOptions): Promise<void> {
    return streamSSE("/api/ai/writing/continue", { content }, options);
  },
  rewrite(
    text: string,
    instruction: string,
    options: StreamOptions,
  ): Promise<void> {
    return streamSSE("/api/ai/writing/rewrite", { text, instruction }, options);
  },
};

/** 预设改写指令 */
export const REWRITE_INSTRUCTIONS = [
  { label: "润色", value: "对文本进行润色，使其更加流畅、专业，保持原意不变" },
  { label: "扩写", value: "在保持原意的基础上扩写文本，增加更多细节和论述" },
  { label: "缩写", value: "精简文本，保留核心信息，删除冗余内容" },
  { label: "改语气-正式", value: "将文本改为正式、专业的语气" },
  { label: "改语气-轻松", value: "将文本改为轻松、口语化的语气" },
] as const;
