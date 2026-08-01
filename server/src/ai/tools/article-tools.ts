/**
 * Article tools - framework-agnostic tool definitions for blog article search and retrieval.
 * Per AI-03: Zero runtime imports from 'ai' or '@ai-sdk/*'.
 * These tools delegate to domain services (SearchService, ArticleService,
 * PostCategoryService, PostTagService) via ToolContext.getService.
 *
 * 注意：getService 必须传服务类（构造函数）作 token，不能传字符串——
 * NestJS 的 provider 用类注册，moduleRef.get('ArticleService') 字符串 token 匹配不到。
 */
import { z } from 'zod';
import type { ToolDef, ToolContext } from './tool-def';
import { SearchService } from '../../search/search.service';
import { ArticleService } from '../../article/article.service';
import { PostCategoryService } from '../../post-category/post-category.service';
import { PostTagService } from '../../post-tag/post-tag.service';
import { htmlToPlainText } from '../adapters/html-to-text';

const emptySchema = z.object({});

const searchSchema = z.object({
  keyword: z.string().describe('搜索关键词'),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export const searchArticlesTool: ToolDef<
  typeof searchSchema,
  {
    articles: {
      title: string;
      snippet: string;
      url: string;
      cover_url: string;
      reading_time: number;
      created_at: string;
    }[];
  }
> = {
  name: 'search_articles',
  description:
    '在博客站内发布的文章中按关键词全文搜索，返回匹配文章的标题、摘要、链接、封面、阅读时间、发布日期。',
  inputSchema: searchSchema,
  execute: async ({ keyword, limit }, ctx: ToolContext) => {
    const searchService = ctx.getService<SearchService>(SearchService);
    const { hits } = await searchService.search(keyword, 1, limit);
    return {
      articles: hits.map((h: any) => ({
        title: h.title,
        snippet: h.snippet,
        url: h.url,
        cover_url: h.cover_url || '',
        reading_time: h.reading_time ?? 0,
        created_at: h.publish_date || '',
      })),
    };
  },
};

const getArticleSchema = z.object({
  id: z.string().describe('文章公开 ID 或 abbrlink'),
});

export const getArticleTool: ToolDef<
  typeof getArticleSchema,
  { title: string; content: string; url: string; cover_url: string; reading_time: number; created_at: string }
> = {
  name: 'get_article',
  description: '根据文章公开 ID 或 abbrlink 获取文章正文，用于深入回答。',
  inputSchema: getArticleSchema,
  execute: async ({ id }, ctx: ToolContext) => {
    const articleService = ctx.getService<ArticleService>(ArticleService);
    const article = await articleService.getPublic(id);
    const plainContent = htmlToPlainText(
      (article as any).content_html || '',
    ).slice(0, 3000);
    return {
      title: (article as any).title,
      content: plainContent,
      url: '/posts/' + ((article as any).abbrlink || (article as any).id),
      cover_url: (article as any).cover_url || '',
      reading_time: (article as any).reading_time ?? 0,
      created_at: (article as any).created_at || '',
    };
  },
};

const recentSchema = z.object({
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export const getRecentArticlesTool: ToolDef<
  typeof recentSchema,
  {
    articles: {
      title: string;
      url: string;
      cover_url: string;
      reading_time: number;
      created_at: string;
    }[];
  }
> = {
  name: 'get_recent_articles',
  description:
    '获取最近发布的文章列表，用于回答"最近更新了什么""有哪些新文章"。返回标题、链接、封面、阅读时间、发布日期。',
  inputSchema: recentSchema,
  execute: async ({ limit }, ctx: ToolContext) => {
    const articleService = ctx.getService<ArticleService>(ArticleService);
    const { list } = await articleService.listPublic({ page: 1, pageSize: limit });
    return { articles: list.map((a: any) => articleSummary(a)) };
  },
};

const byCategorySchema = z.object({
  category: z.string().describe('分类名称，如"技术"'),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

export const getArticlesByCategoryTool: ToolDef<
  typeof byCategorySchema,
  {
    articles: {
      title: string;
      url: string;
      cover_url: string;
      reading_time: number;
      created_at: string;
    }[];
  }
> = {
  name: 'get_articles_by_category',
  description:
    '按分类名称获取该分类下的文章列表，用于"推荐某分类的文章"。分类名可用 list_categories 查询。',
  inputSchema: byCategorySchema,
  execute: async ({ category, limit }, ctx: ToolContext) => {
    const articleService = ctx.getService<ArticleService>(ArticleService);
    const { list } = await articleService.listPublic({
      page: 1,
      pageSize: limit,
      category,
    });
    return { articles: list.map((a: any) => articleSummary(a)) };
  },
};

export const listCategoriesTool: ToolDef<
  typeof emptySchema,
  { categories: { name: string; slug: string; count: number }[] }
> = {
  name: 'list_categories',
  description: '列出博客所有文章分类及其文章数量，用于回答"有哪些分类"。',
  inputSchema: emptySchema,
  execute: async (_input, ctx: ToolContext) => {
    const categoryService =
      ctx.getService<PostCategoryService>(PostCategoryService);
    const list = await categoryService.list();
    return {
      categories: list.map((c: any) => ({
        name: c.name,
        slug: c.slug,
        count: c.count ?? 0,
      })),
    };
  },
};

export const listTagsTool: ToolDef<
  typeof emptySchema,
  { tags: { name: string; slug: string; count: number }[] }
> = {
  name: 'list_tags',
  description: '列出博客所有文章标签及其文章数量，用于回答"有哪些标签"。',
  inputSchema: emptySchema,
  execute: async (_input, ctx: ToolContext) => {
    const tagService = ctx.getService<PostTagService>(PostTagService);
    const list = await tagService.list();
    return {
      tags: list.map((t: any) => ({
        name: t.name,
        slug: t.slug,
        count: t.count ?? 0,
      })),
    };
  },
};

/** 文章摘要：从 ArticleService 响应提取工具返回字段 */
function articleSummary(a: any) {
  return {
    title: a.title,
    url: '/posts/' + (a.abbrlink || a.id),
    cover_url: a.cover_url || '',
    reading_time: a.reading_time ?? 0,
    created_at: a.created_at || '',
  };
}

export const articleTools: ToolDef[] = [
  searchArticlesTool,
  getArticleTool,
  getRecentArticlesTool,
  getArticlesByCategoryTool,
  listCategoriesTool,
  listTagsTool,
];
