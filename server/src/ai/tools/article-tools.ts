/**
 * Article tools — framework-agnostic tool definitions for blog article search and retrieval.
 * Per AI-03: Zero runtime imports from 'ai' or '@ai-sdk/*'.
 * These tools delegate to domain services (SearchService, ArticleService) via ToolContext.getService.
 */
import { z } from 'zod';
import type { ToolDef, ToolContext } from './tool-def';
import type { SearchService } from '../../search/search.service';
import type { ArticleService } from '../../article/article.service';
import { htmlToPlainText } from '../adapters/html-to-text';

const searchSchema = z.object({
  keyword: z.string().describe('搜索关键词'),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export const searchArticlesTool: ToolDef<
  typeof searchSchema,
  { articles: { title: string; snippet: string; url: string }[] }
> = {
  name: 'search_articles',
  description:
    '在博客站内发布的文章中按关键词全文搜索，返回匹配最新的标题、摘要、链接。',
  inputSchema: searchSchema,
  execute: async ({ keyword, limit }, ctx: ToolContext) => {
    const searchService = ctx.getService<SearchService>('SearchService');
    const { hits } = await searchService.search(keyword, 1, limit);
    return {
      articles: hits.map((h: any) => ({
        title: h.title,
        snippet: h.snippet,
        url: h.url,
      })),
    };
  },
};

const getArticleSchema = z.object({
  id: z.string().describe('文章公开 ID 或 abbrlink'),
});

export const getArticleTool: ToolDef<
  typeof getArticleSchema,
  { title: string; content: string; url: string }
> = {
  name: 'get_article',
  description: '根据文章公开 ID 或 abbrlink 获取文章正文，用于深入回答。',
  inputSchema: getArticleSchema,
  execute: async ({ id }, ctx: ToolContext) => {
    const articleService = ctx.getService<ArticleService>('ArticleService');
    const article = await articleService.getPublic(id);
    const plainContent = htmlToPlainText(
      (article as any).content_html || '',
    ).slice(0, 3000);
    return {
      title: (article as any).title,
      content: plainContent,
      url: '/posts/' + ((article as any).abbrlink || (article as any).id),
    };
  },
};

export const articleTools: ToolDef[] = [searchArticlesTool, getArticleTool];
