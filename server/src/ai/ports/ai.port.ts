/**
 * ArticleAiPort — framework-agnostic contract for article AI operations.
 * No AI SDK imports; implementers choose their own LLM integration.
 */
export interface ArticleAiPort {
  summarizeArticle(publicId: string): Promise<{ summary: string }>;
}

/**
 * ChatService — contract for streaming chat operations.
 * UIMessage is imported from 'ai' at the implementation layer only;
 * this interface stays importable without AI SDK as a dependency.
 */
export interface ChatService {
  chat(
    messages: unknown[],
    options?: {
      conversationId?: string;
      profileId?: string;
      abortSignal?: AbortSignal;
    },
  ): Promise<ReadableStream<Uint8Array>>;
}
