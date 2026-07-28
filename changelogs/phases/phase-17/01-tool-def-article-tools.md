# Phase 17 - AI 工具定义层：ToolDef 类型 + article-tools

> **归属**: Phase 17 (AI Tools & Chat History Storage)
> **状态**: ✅ 已完成
> **对应需求**: AI-03
> **提交**: 049e4c0 (RED), 81ac65c (GREEN), f5e75f9 (docs)

## 目标

构建框架无关的工具定义层。ToolDef 接口使用 Zod schema + 纯 execute 函数，两个文章工具（search_articles / get_article）通过 ToolContext.getService 委托给已有 domain service。**零 AI 库导入** — LangGraph 迁移时无需修改。

## 新增文件

### `server/src/ai/tools/tool-def.ts` — 工具定义类型

```typescript
export interface ToolContext {
  db: unknown;                              // Drizzle 连接（非 Drizzle 类型，避免耦合）
  settings: SettingsService;                // 配置读取
  getService<T>(token: string): T;          // DI 容器拉取服务实例
}

export interface ToolDef<TSchema extends z.ZodType = z.ZodType, TResult = unknown> {
  name: string;
  description: string;
  inputSchema: TSchema;
  execute: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<TResult>;
}
```

- 仅导入 `zod` 和 `SettingsService` 类型，**零 AI 库导入**
- `getService<T>(token)` 在实现层通过 NestJS ModuleRef 拉取已实例化的服务

### `server/src/ai/tools/article-tools.ts` — 文章搜索/获取工具

```typescript
// search_articles — 委托 SearchService.search，返回 { articles: [{title, snippet, url}] }
export const searchArticlesTool: ToolDef<typeof searchSchema, SearchResult> = {
  name: 'search_articles',
  description: '在博客站内发布的文章中按关键词全文搜索...',
  inputSchema: z.object({
    keyword: z.string().describe('搜索关键词'),
    limit: z.number().int().min(1).max(10).optional().default(5),
  }),
  execute: async ({ keyword, limit }, ctx) => {
    const searchService = ctx.getService<SearchService>('SearchService');
    const { hits } = await searchService.search(keyword, 1, limit);
    return { articles: hits.map(h => ({ title: h.title, snippet: h.snippet, url: h.url })) };
  },
};

// get_article — 委托 ArticleService.getPublic，内容截断到 3000 字符 (D-351)
export const getArticleTool: ToolDef<typeof articleSchema, ArticleResult> = {
  name: 'get_article',
  description: '根据文章公开 ID 或 abbrlink 获取文章正文...',
  inputSchema: z.object({ id: z.string().describe('文章公开 ID 或 abbrlink') }),
  execute: async ({ id }, ctx) => {
    const articleService = ctx.getService<ArticleService>('ArticleService');
    const article = await articleService.getPublic(id);
    const plainContent = htmlToPlainText(article.content_html || '').slice(0, 3000);
    return { title: article.title, content: plainContent, url: `/posts/${article.abbrlink || article.id}` };
  },
};

export const articleTools = [searchArticlesTool, getArticleTool];
```

- `type import` 导入 SearchService/ArticleService（无运行时依赖）
- `htmlToPlainText` 复用现有 adapter，`.slice(0, 3000)` 按 D-351 截断
- `articleTools` 数组供 Phase 18 ChatService 导入并转换为 AI SDK `tool()` 格式

### `server/src/ai/tools/article-tools.spec.ts` — 19 个单元测试

覆盖：
- Zod schema 验证（keyword 类型、limit 范围 1-10、默认值 5）
- SearchService.search 委托 + 返回值映射
- ArticleService.getPublic 委托 + HTML 剥离 + 3000 字符截断 + URL 构建 + null 处理
- **框架独立性**：读源文件文本，断言非注释行不含 `from 'ai'` 或 `@ai-sdk`

## 修改文件

### `server/src/ai/ai.module.ts`

```diff
+import { SearchModule } from '../search/search.module';
+import { ArticleModule } from '../article/article.module';

 @Module({
-  imports: [DatabaseModule, SettingsModule],
+  imports: [DatabaseModule, SettingsModule, SearchModule, ArticleModule],
 })
```

使 ToolContext.getService 能通过 DI 解析 SearchService 和 ArticleService。

## 关键决策

| 决策 | 理由 |
|------|------|
| D-350: ToolContext.getService\<T\>(token) | 工具不直接操作 DB，复用已有 domain service，接口层面框架无关 |
| D-351: 内容截断 3000 字符 | 足够 LLM 理解文章主旨，不够时可追问；防止 context 膨胀 |
| class name string 作为 DI token | 最简单的方式，与 NestJS ModuleRef 自然对应 |

## 不做的事

- 不做 ToolDef → AI SDK tool() 转换（Phase 18 ChatService 内部实现）
- 不做更多工具（Phase 18/19 按需扩展）
- 不引入任何 AI 库（严格框架无关）
