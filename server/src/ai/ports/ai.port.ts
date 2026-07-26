/**
 * ArticleAiPort — framework-agnostic contract for article AI operations.
 * No AI SDK imports; implementers choose their own LLM integration.
 */
export interface ArticleAiPort {
  summarizeArticle(publicId: string): Promise<{ summary: string }>;
}
