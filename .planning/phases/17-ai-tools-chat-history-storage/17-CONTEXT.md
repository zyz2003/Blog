# Phase 17: AI Tools & Chat History Storage - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

构建框架无关资产——ToolDef 类型 + article-tools（search_articles / get_article）+ chat.schema.ts Drizzle 对话表 + ChatHistoryService CRUD + Drizzle migration。这些文件不 import `ai` 或 `@langchain/*`，是 LangGraph 迁移时零修改的保护资产。

**Phase 17 交付物：**
- `server/src/ai/tools/tool-def.ts` — ToolDef 类型（Zod schema + execute + ToolContext）
- `server/src/ai/tools/article-tools.ts` — search_articles + get_article 工具
- `server/src/ai/chat.schema.ts` — Drizzle 表：chat_conversations, chat_messages
- `server/src/ai/chat-history.service.ts` — 对话历史 CRUD + 截断
- Drizzle migration for chat tables
- `server/src/ai/ai.module.ts` 更新（注册 ChatHistoryService + 导出供 Phase 18 用）

**不在 Phase 17 范围：**
- chat.service.ts / ChatService 流式对话（Phase 18）
- ai-chat.controller.ts / POST /api/ai/chat 端点（Phase 18）
- prepareStep 运行时上下文压缩 / token 用量记录 / 断连处理（Phase 19）
- 前端聊天组件（Phase 18）
- 后台 ai_profiles 管理表单（Phase 16 已做基础，Phase 19 完善）
- LangGraph adapter（YAGNI）

</domain>

<decisions>
## Implementation Decisions

### Tool Execution Context
- **D-350:** ToolContext 接口定义为 `{ db, settings, getService<T>(token: string): T }`。接口在 `tools/tool-def.ts` 定义（框架无关），NestJS 实现通过 ModuleRef 拉取已实例化的服务。article-tools 调 `ctx.getService<SearchService>('SearchService')` 获取服务实例，而非直接操作 db 做原始查询。这允许工具复用已有的 domain service 逻辑（FTS5 搜索、文章查询等），同时保持接口层面框架无关——`getService` 方法本身不依赖 NestJS，只是实现层用 NestJS ModuleRef。— **Reversibility:** reversible — 改 ToolContext 接口只影响 tool-def.ts 和 article-tools.ts 两个文件

### Tool Return Content Depth
- **D-351:** get_article 返回 `stripHtml(contentHtml)` 截断到 3000 字符 + title + URL + abbrlink。search_articles 返回最多 5 条命中（每条含 title / snippet / url），复用现有 `extractSnippet` 逻辑。stripHtml 用现有 `SearchService.stripHtml` 或 `html-to-text.ts` 的逻辑。3000 字符足够 LLM 理解文章主旨，不够时可让 LLM 再追问。— **Reversibility:** reversible — 截断长度是硬编码常量，改一个数字即可

### Chat Message Parts Storage
- **D-352:** chat.schema.ts 旁定义 ChatMessagePart 联合类型：`TextPart { type:'text', text: string }` | `ToolCallPart { type:'tool_call', toolCallId: string, toolName: string, args: unknown }` | `ToolResultPart { type:'tool_result', toolCallId: string, result: unknown }`。chat_messages.parts 列存 ChatMessagePart[]（Drizzle `text('parts', { mode: 'json' })`）。Phase 18 可扩展（加 reasoning / source 等变体），现有 3 种覆盖 AI SDK UIMessage 的核心 parts。— **Reversibility:** reversible — 加新 part 类型是 union 扩展，不影响已有数据

### History Truncation Strategy
- **D-353:** truncateHistory(conversationId, keepLast) 硬删除超过 keepLast 条的旧消息（按 createdAt 升序删旧留新）。keepLast 参数显式传入，Phase 17 不设默认值——由 Phase 19 的 prepareStep 调用时决定。简单直接，个人博客场景不需要恢复已删历史。— **Reversibility:** one-way — 硬删除不可恢复，但个人博客场景可接受

### Claude's Discretion
- ToolContext 的 db 和 settings 字段是否保留（getService 已能取到 SettingsService）——保留更灵活，某些工具可能只需要 raw db 做简单查询
- getService 的 token 字符串格式（用 NestJS 的 class name string vs DI token）——用 class name 最简单
- chat_conversations.publicId 的 Sqids EntityType 编号——新 entity type，planner 自行分配
- ChatHistoryService 是否需要 listConversations(userId?) 方法——Phase 18/19 前端需要，但 Phase 17 只做基础 CRUD，planner 可按需加
- Drizzle migration 文件名——遵循现有 drizzle-kit 命名规范

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 架构设计文档（最重要——接口定义、目录结构、模块依赖都来自这里）
- `.planning/ai-assistant-architecture.md` — AI 助手完整架构设计。包含：ToolDef 接口定义、chat.schema.ts 表结构、ChatHistoryService 接口、目录结构、模块依赖关系图、框架无关层设计原则（该抽象/不该抽象）、LangGraph 迁移路径、11 个风险点。**planner 必须严格遵循此文档的目录结构和接口签名。**

### 路线图与状态
- `.planning/ROADMAP.md` §Phase 17 — phase 定义、key deliverables、AI-03/AI-04 需求 ID
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-340c），M5 AI Features milestone 状态

### Phase 16 Context（前置 phase 的决策和代码）
- `.planning/phases/16-ai-model-router-summary-migration/16-CONTEXT.md` — Phase 16 的所有决策（D-330 到 D-340c），包括 ai_profiles 配置、resolveProfiles、AiModule DI 模式

### 现有 AI 代码（Phase 17 要在此基础上新增 tools/ 和 chat 文件）
- `server/src/ai/ai.module.ts` — 当前模块装配（需更新：加 ChatHistoryService provider + export）
- `server/src/ai/model/ai-profile.ts` — AiProfile 类型 + resolveProfiles（tool execute 中的 profileId 读取复用）
- `server/src/ai/model/model-resolver.service.ts` — ModelResolver（Phase 17 不改，Phase 18 ChatService 会用）
- `server/src/ai/ports/ai.port.ts` — ArticleAiPort 契约（Phase 18 会加 ChatService 契约）
- `server/src/ai/domain-error.ts` — DomainError 类（tool execute 抛错可复用）

### Domain 服务（tool execute 的实际调用目标）
- `server/src/search/search.service.ts` — SearchService.search(query, page, size) — search_articles 工具调用目标
- `server/src/search/search.module.ts` — SearchModule exports SearchService
- `server/src/article/article.service.ts` — ArticleService.getPublic(slugOrId) — get_article 工具调用目标
- `server/src/article/article.module.ts` — ArticleModule 结构参考

### Drizzle Schema 模式参考
- `server/src/database/schemas/index.ts` — schema 注册入口（chat.schema.ts 需加到此处）
- `server/src/database/schemas/comment.schema.ts` — 参考表结构模式（integer PK + text fields + timestamps）
- `server/drizzle.config.ts` — drizzle-kit 配置

### 项目约束
- `.claude/CLAUDE.md` — 项目核心约束：API 兼容性是核心底线，技术栈 NestJS + Drizzle + SQLite
- `~/CLAUDE.md` — CodeGraph MCP 使用指南 + Karpathy 简洁原则

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **SearchService.search(query, page, size)** — search_articles 工具直接调用，返回 { pagination, hits } 含 SearchHitDto[]（title, snippet, url, abbrlink 等）
- **ArticleService.getPublic(slugOrId)** — get_article 工具调用，返回 ArticleDetailResponseDto（含 contentHtml, title, abbrlink 等）
- **SettingsService.get(key)** — ToolContext.settings 传入，读取 ai_profiles 等配置
- **html-to-text.ts** — stripHtml 逻辑，get_article 截断时复用
- **SearchService.extractSnippet(contentHtml, 150)** — snippet 提取，search_articles 可直接用 hits 中的 snippet
- **generatePublicID / decodePublicID / EntityType** — Sqids 编解码，chat_conversations.publicId 编码用
- **Drizzle schema patterns** — integer PK + text + timestamps 模式，所有现有 schema 都遵循

### Established Patterns
- NestJS 模块：`@Module({ imports, controllers, providers, exports })` + DI 注入
- Drizzle schema：`sqliteTable('table_name', { ... })` + `integer('id').primaryKey({ autoIncrement: true })` + `text('field')` + `integer('created_at', { mode: 'timestamp' }).default(sql\`(unixepoch())\`)`
- Schema 注册：新 schema 文件加到 `server/src/database/schemas/index.ts` 的 re-export
- Service 注入：`@Inject(DRIZZLE) private readonly db: any` + 构造函数注入其他 service
- Module 导出 service 供其他模块用：`exports: [ChatHistoryService]`
- Zod schema：`z.object({ ... })` + `z.string().describe(...)` — 已在 Phase 16 引入

### Integration Points
- `AiModule` 已在 `server/src/app.module.ts` 注册，Phase 17 更新 AiModule 加 ChatHistoryService
- `tools/tool-def.ts` 是新文件，Phase 18 的 `chat.service.ts` 会 import articleTools 转换为 AI SDK tool()
- `chat.schema.ts` 是新文件，需加到 `schemas/index.ts`，drizzle-kit 生成 migration
- `ChatHistoryService` 需 AiModule import DatabaseModule（已有），Phase 18 的 ChatService 会注入 ChatHistoryService
- `SearchModule` exports SearchService — AiModule 需加 import SearchModule 才能让 tool execute 中的 getService 拿到 SearchService
- `ArticleModule` exports ArticleService — AiModule 需加 import ArticleModule 同理

</code_context>

<specifics>
## Specific Ideas

- ToolContext 接口定义（基于 D-350）：
  ```typescript
  export interface ToolContext {
    db: unknown;                              // Drizzle 连接
    settings: SettingsService;                // 配置读取
    getService<T>(token: string): T;          // 从 DI 容器拉取服务
  }
  ```

- ToolDef 类型（来自架构文档，微调 ToolContext）：
  ```typescript
  export interface ToolDef<TSchema extends z.ZodType = z.ZodType, TResult = unknown> {
    name: string;
    description: string;
    inputSchema: TSchema;
    execute: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<TResult>;
  }
  ```

- search_articles 工具定义（来自架构文档）：
  ```typescript
  const searchSchema = z.object({
    keyword: z.string().describe('搜索关键词'),
    limit: z.number().int().min(1).max(10).optional().default(5),
  });

  export const searchArticlesTool: ToolDef<typeof searchSchema, SearchResult> = {
    name: 'search_articles',
    description: '在博客站内发布的文章中按关键词全文搜索，返回匹配最新的标题、摘要、链接。',
    inputSchema: searchSchema,
    execute: async ({ keyword, limit }, ctx) => {
      const searchService = ctx.getService<SearchService>('SearchService');
      const { hits } = await searchService.search(keyword, 1, limit);
      return { articles: hits.map(h => ({ title: h.title, snippet: h.snippet, url: h.url })) };
    },
  };
  ```

- get_article 工具定义（基于 D-351 截断 3000 字符）：
  ```typescript
  export const getArticleTool: ToolDef = {
    name: 'get_article',
    description: '根据文章公开 ID 或 abbrlink 获取文章正文，用于深入回答。',
    inputSchema: z.object({ id: z.string().describe('文章公开 ID 或 abbrlink') }),
    execute: async ({ id }, ctx) => {
      const articleService = ctx.getService<ArticleService>('ArticleService');
      const article = await articleService.getPublic(id);
      const plainContent = stripHtml(article.content_html || '').slice(0, 3000);
      return { title: article.title, content: plainContent, url: `/posts/${article.abbrlink || article.id}` };
    },
  };
  ```

- ChatMessagePart 类型（基于 D-352）：
  ```typescript
  export type ChatMessagePart =
    | { type: 'text'; text: string }
    | { type: 'tool_call'; toolCallId: string; toolName: string; args: unknown }
    | { type: 'tool_result'; toolCallId: string; result: unknown };
  ```

- chat.schema.ts 表结构（来自架构文档）：
  ```typescript
  export const chatConversations = sqliteTable('chat_conversations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicId: text('public_id').unique(),
    title: text('title'),
    profileId: text('profile_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  });

  export const chatMessages = sqliteTable('chat_messages', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    conversationId: integer('conversation_id').notNull(),
    role: text('role').notNull(),          // user | assistant | system | tool
    content: text('content'),
    parts: text('parts', { mode: 'json' }), // ChatMessagePart[]
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  });
  ```

- ChatHistoryService 接口（来自架构文档 + D-353）：
  ```typescript
  export interface StoredMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    parts?: ChatMessagePart[];
    createdAt: Date;
  }

  @Injectable()
  export class ChatHistoryService {
    async createConversation(title?: string): Promise<string> { /* 返回 publicId */ }
    async appendMessage(conversationId: string, msg: StoredMessage): Promise<void> { /* ... */ }
    async getMessages(conversationId: string): Promise<StoredMessage[]> { /* ... */ }
    async truncateHistory(conversationId: string, keepLast: number): Promise<void> { /* 硬删旧消息 */ }
  }
  ```

- AiModule 更新（Phase 17 需加 ChatHistoryService + import SearchModule/ArticleModule）：
  ```typescript
  @Module({
    imports: [DatabaseModule, SettingsModule, SearchModule, ArticleModule],
    controllers: [AiSummaryController],
    providers: [
      ModelResolver,
      ChatHistoryService,
      { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
    ],
    exports: ['ARTICLE_AI_PORT', ChatHistoryService],
  })
  export class AiModule {}
  ```

</specifics>

<deferred>
## Deferred Ideas

- chat.service.ts / ChatService 流式对话——Phase 18
- ai-chat.controller.ts / POST /api/ai/chat 端点——Phase 18
- ToolDef → AI SDK tool() 转换器——Phase 18 的 chat.service.ts 内部实现
- prepareStep 运行时上下文压缩 / token 用量记录——Phase 19
- 前端聊天组件（useChat + 浮动按钮 + 对话窗口）——Phase 18
- 后台 ai_profiles 管理表单完善——Phase 19
- LangGraph adapter——YAGNI
- chat_conversations.userId 字段（多用户对话归属）——Phase 19 需要时再加
- reasoning / source 类型 ChatMessagePart——Phase 18/19 按需扩展

</deferred>

---

*Phase: 17-AI Tools & Chat History Storage*
*Context gathered: 2026-07-27*
