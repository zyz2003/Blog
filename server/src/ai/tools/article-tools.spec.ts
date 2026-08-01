import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { searchArticlesTool, getArticleTool, articleTools } from './article-tools';
import type { ToolDef, ToolContext } from './tool-def';

/**
 * Tests for framework-agnostic tool definitions.
 * Per AI-03: tool-def.ts and article-tools.ts must have zero imports from 'ai' or '@ai-sdk/*'.
 * These tools delegate to domain services via ToolContext.getService.
 */
describe('article-tools', () => {
  // --- ToolDef & ToolContext framework independence ---

  it('tool-def.ts exports ToolDef interface and ToolContext interface', () => {
    // Verify the module can be imported and the types exist (compile-time check)
    // Runtime: we verify the exports by checking the module source
    const source = fs.readFileSync(
      path.resolve(__dirname, 'tool-def.ts'),
      'utf-8',
    );
    expect(source).toContain('export interface ToolDef');
    expect(source).toContain('export interface ToolContext');
  });

  it('tool-def.ts has zero imports from ai or @ai-sdk', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'tool-def.ts'),
      'utf-8',
    );
    // Filter out comments (// and * JSDoc style) and blank lines
    const lines = source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('*'));
    const hasAiImport = lines.some(
      (l) => l.includes("from 'ai'") || l.includes('@ai-sdk'),
    );
    expect(hasAiImport).toBe(false);
  });

  // --- searchArticlesTool ---

  it('searchArticlesTool.name === "search_articles"', () => {
    expect(searchArticlesTool.name).toBe('search_articles');
  });

  it('searchArticlesTool.description contains search-related Chinese text', () => {
    expect(searchArticlesTool.description).toMatch(/搜索|全文搜索/);
  });

  it('searchArticlesTool.inputSchema parses { keyword: "test" } successfully', () => {
    const result = searchArticlesTool.inputSchema.safeParse({
      keyword: 'test',
    });
    expect(result.success).toBe(true);
  });

  it('searchArticlesTool.inputSchema rejects { keyword: 123 } (keyword must be string)', () => {
    const result = searchArticlesTool.inputSchema.safeParse({ keyword: 123 });
    expect(result.success).toBe(false);
  });

  it('searchArticlesTool.inputSchema applies default limit=5 when limit omitted', () => {
    const parsed = searchArticlesTool.inputSchema.parse({ keyword: 'test' });
    expect(parsed).toHaveProperty('limit', 5);
  });

  it('searchArticlesTool.inputSchema rejects limit > 10 (max constraint)', () => {
    const result = searchArticlesTool.inputSchema.safeParse({
      keyword: 'test',
      limit: 11,
    });
    expect(result.success).toBe(false);
  });

  it('searchArticlesTool.execute calls SearchService.search and returns articles with full fields', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      pagination: { total: 1, page: 1, size: 5, totalPages: 1 },
      hits: [
        {
          title: 'Test Article',
          snippet: 'A snippet',
          url: '/posts/test-1',
          id: 'abc',
          abbrlink: 'test-1',
          cover_url: '/img/test.png',
          reading_time: 5,
          publish_date: '2026-07-31',
        },
      ],
    });

    const ctx: ToolContext = {
      db: {},
      settings: {} as any,
      getService: vi.fn().mockReturnValue({ search: mockSearch }),
    };

    const result = await searchArticlesTool.execute(
      { keyword: 'test', limit: 5 },
      ctx,
    );

    // getService 必须传服务类（构造函数）作 token，不能传字符串
    expect(ctx.getService).toHaveBeenCalledWith(expect.any(Function));
    expect(mockSearch).toHaveBeenCalledWith('test', 1, 5);
    expect(result).toEqual({
      articles: [
        {
          title: 'Test Article',
          snippet: 'A snippet',
          url: '/posts/test-1',
          cover_url: '/img/test.png',
          reading_time: 5,
          created_at: '2026-07-31',
        },
      ],
    });
  });

  it('searchArticlesTool.execute maps hits to full article shape, dropping other fields', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      pagination: { total: 1, page: 1, size: 5, totalPages: 1 },
      hits: [
        {
          title: 'Article 1',
          snippet: 'Snippet 1',
          url: '/posts/a1',
          id: 'should-be-dropped',
          abbrlink: 'should-be-dropped',
          author: 'should-be-dropped',
          category: 'should-be-dropped',
        },
      ],
    });

    const ctx: ToolContext = {
      db: {},
      settings: {} as any,
      getService: vi.fn().mockReturnValue({ search: mockSearch }),
    };

    const result = await searchArticlesTool.execute(
      { keyword: 'test', limit: 5 },
      ctx,
    );

    const article = (result as any).articles[0];
    expect(Object.keys(article).sort()).toEqual([
      'cover_url',
      'created_at',
      'reading_time',
      'snippet',
      'title',
      'url',
    ]);
  });

  // --- getArticleTool ---

  it('getArticleTool.name === "get_article"', () => {
    expect(getArticleTool.name).toBe('get_article');
  });

  it('getArticleTool.inputSchema parses { id: "abc123" } successfully', () => {
    const result = getArticleTool.inputSchema.safeParse({ id: 'abc123' });
    expect(result.success).toBe(true);
  });

  it('getArticleTool.execute calls ArticleService.getPublic and returns { title, content, url }', async () => {
    const mockGetPublic = vi.fn().mockResolvedValue({
      title: 'My Article',
      content_html: '<p>Hello world</p>',
      abbrlink: 'my-article',
      id: 'encoded123',
    });

    const ctx: ToolContext = {
      db: {},
      settings: {} as any,
      getService: vi.fn().mockReturnValue({ getPublic: mockGetPublic }),
    };

    const result = await getArticleTool.execute({ id: 'my-article' }, ctx);

    expect(ctx.getService).toHaveBeenCalledWith(expect.any(Function));
    expect(mockGetPublic).toHaveBeenCalledWith('my-article');
    expect(result).toHaveProperty('title', 'My Article');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('url');
  });

  it('getArticleTool.execute truncates content to 3000 characters via htmlToPlainText then .slice(0, 3000)', async () => {
    // Create content longer than 3000 chars after stripping HTML
    const longContent = '<p>' + 'A'.repeat(4000) + '</p>';
    const mockGetPublic = vi.fn().mockResolvedValue({
      title: 'Long Article',
      content_html: longContent,
      abbrlink: 'long-article',
      id: 'encoded456',
    });

    const ctx: ToolContext = {
      db: {},
      settings: {} as any,
      getService: vi.fn().mockReturnValue({ getPublic: mockGetPublic }),
    };

    const result = (await getArticleTool.execute({ id: 'long-article' }, ctx)) as any;

    expect(result.content.length).toBeLessThanOrEqual(3000);
    // The plain text is "A" * 4000, sliced to 3000
    expect(result.content).toBe('A'.repeat(3000));
  });

  it('getArticleTool.execute builds url as /posts/{abbrlink || id}', async () => {
    const mockGetPublic = vi.fn().mockResolvedValue({
      title: 'Article With Abbrlink',
      content_html: '<p>Content</p>',
      abbrlink: 'my-abbrlink',
      id: 'encoded789',
    });

    const ctx: ToolContext = {
      db: {},
      settings: {} as any,
      getService: vi.fn().mockReturnValue({ getPublic: mockGetPublic }),
    };

    const result = (await getArticleTool.execute({ id: 'my-abbrlink' }, ctx)) as any;
    expect(result.url).toBe('/posts/my-abbrlink');
  });

  it('getArticleTool.execute builds url as /posts/{id} when abbrlink is null', async () => {
    const mockGetPublic = vi.fn().mockResolvedValue({
      title: 'Article Without Abbrlink',
      content_html: '<p>Content</p>',
      abbrlink: null,
      id: 'encoded999',
    });

    const ctx: ToolContext = {
      db: {},
      settings: {} as any,
      getService: vi.fn().mockReturnValue({ getPublic: mockGetPublic }),
    };

    const result = (await getArticleTool.execute({ id: 'encoded999' }, ctx)) as any;
    expect(result.url).toBe('/posts/encoded999');
  });

  it('getArticleTool.execute handles null content_html by returning empty string content', async () => {
    const mockGetPublic = vi.fn().mockResolvedValue({
      title: 'Empty Article',
      content_html: null,
      abbrlink: 'empty-article',
      id: 'encoded000',
    });

    const ctx: ToolContext = {
      db: {},
      settings: {} as any,
      getService: vi.fn().mockReturnValue({ getPublic: mockGetPublic }),
    };

    const result = (await getArticleTool.execute({ id: 'empty-article' }, ctx)) as any;
    expect(result.content).toBe('');
  });

  // --- articleTools array ---

  it('articleTools array contains all tools', () => {
    expect(articleTools).toHaveLength(6);
    expect(articleTools).toContain(searchArticlesTool);
    expect(articleTools).toContain(getArticleTool);
  });

  // --- Framework independence ---

  it('article-tools.ts does not import ai or @ai-sdk (framework independence)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'article-tools.ts'),
      'utf-8',
    );
    // Filter out comments (// and * JSDoc style), type-only imports, and blank lines
    const lines = source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('import type'));
    const hasAiImport = lines.some(
      (l) => l.includes("from 'ai'") || l.includes('@ai-sdk'),
    );
    expect(hasAiImport).toBe(false);
  });
});
