# AI 助手架构设计

> 基于 Vercel AI SDK 7 / LangGraph.js / NestJS 集成 / 可切换架构 4 维度调研的最终设计。
> 调研工作流：4 个 agent 并行联网调研 + 1 个 agent 综合设计，共 5 个 agent。

---

## 一、框架选型推荐

**推荐：Vercel AI SDK 7（`ai` + `@ai-sdk/openai-compatible`），不引入 LangGraph.js。**

理由（每条都有调研背书）：

1. **能力匹配场景**。博客 AI 助手需求是"流式对话 + 简单工具循环 + 多模型调度"。AI SDK 7 的 `streamText` + `stopWhen` + `tool()` 原生覆盖。LangGraph 的核心价值（StateGraph / durable execution / 人在回路 / 多 agent）是博客用不上的能力。
2. **NestJS 官方支持**。AI SDK 有[官方 NestJS cookbook](https://ai-sdk.dev/cookbook/api-servers/nest)（`pipeUIMessageStreamToResponse`）。LangGraph 无任何官方 NestJS 集成，流式/checkpoint/工具都要自己拼 SSE。
3. **迁移成本最低**。现有 `server/src/ai/ai.service.ts` 是单次非流式 LLM 调用（raw fetch 调 OpenAI 兼容接口），AI SDK 的 `generateText` 几乎 1:1 替换；`streamText` 自然扩展。LangGraph 要凭空构造 StateGraph/checkpoint/reducer。
4. **Provider 切换零成本**。`@ai-sdk/openai-compatible` 一个包覆盖所有 OpenAI 兼容厂商（DeepSeek / OpenAI 原生 / 本地 Ollama），换厂商只改 import + model 名。
5. **基础设施已就位**。项目已有 `ai_profiles` 配置设计（Go 后端遗留）+ `ai_summary_*` 配置 + FTS5 全文搜索（`SearchService`）。模型池和 RAG 检索的地基都有。
6. **权威建议**。Anthropic《Building Effective Agents》明确"生产期应减少抽象层，直接用基本组件"。Octomind 放弃 LangChain 的教训："领域未稳定时不要用重框架"。
7. **迁移路径真实**。调研结论：本项目无 AI SDK 可"迁移"，无论选 AI SDK 还是 LangGraph 都是重写。选 AI SDK 重写成本最低；LangGraph 只在需求演进到"多步 RAG + 人在回路 + 会话持久"时才考虑。

---

## 二、架构设计

### 目录结构

```
server/src/ai/
├── ai.module.ts                      # 模块装配，注册各类 provider
├── ports/
│   └── ai.port.ts                    # domain 契约：ArticleAiPort（摘要）+ ChatService 契约
├── tools/
│   ├── tool-def.ts                   # 框架无关的 ToolDef 类型（Zod schema + 纯 execute）
│   └── article-tools.ts              # 博客工具（search_articles / get_article），只调 domain service
├── model/
│   ├── ai-profile.ts                 # AiProfile 类型 + ai_profiles JSON 解析（框架无关）
│   └── model-resolver.service.ts     # 从 ai_profiles 配置 → AI SDK model 实例
├── adapters/
│   └── summary.adapter.ts            # ArticleAiPort 的 AI SDK 实现（generateText 替代 raw fetch）
├── chat.schema.ts                    # Drizzle schema: chat_conversations, chat_messages（框架无关存储）
├── chat-history.service.ts           # 对话历史 CRUD（SQLite，框架无关）
├── chat.service.ts                   # 流式对话核心：streamText + tools + stopWhen → UIMessageStream
├── ai-summary.controller.ts          # POST /api/ai/generate-summary/:id（重构现有 controller）
└── ai-chat.controller.ts             # POST /api/ai/chat（流式端点，@Res() + pipeUIMessageStreamToResponse）
```

### 模块依赖关系（单向：domain 不依赖 AI 框架）

```
┌─────────────────────────────────────────────────────────────────────┐
│  HTTP 层（框架特定的 HTTP 管道，调用 AI SDK 流式 helper）            │
│  ai-summary.controller.ts   ai-chat.controller.ts                    │
│         │                          │                                 │
│         ▼                          ▼                                 │
│  ArticleAiPort(token)        ChatService                              │
│         │                          │                                 │
├─────────┼──────────────────────────┼─────────────────────────────────┤
│  Adapter 层（框架特定，唯一接触 ai/@ai-sdk 的地方）                  │
│  summary.adapter.ts          chat.service.ts                         │
│  (generateText)              (streamText + tool + stopWhen)          │
│         │                          │                                 │
│         └──────────┬───────────────┘                                 │
│                    ▼                                                 │
│           model-resolver.service.ts  ← ai_profiles 配置               │
├──────────────────────────────────────────────────────────────────────┤
│  框架无关层（不 import ai / @langchain，迁移时 0 修改）               │
│  tools/article-tools.ts   (Zod + 纯 execute)                         │
│  chat-history.service.ts  (Drizzle CRUD)                             │
│  chat.schema.ts           (表结构)                                    │
│  ports/ai.port.ts         (契约接口)                                  │
├──────────────────────────────────────────────────────────────────────┤
│                     │ 共享                                            │
├──────────────────────────────────────────────────────────────────────┤
│  Domain 服务（已存在，完全复用）                                      │
│  SearchService (FTS5)   ArticleService   SettingsService             │
└──────────────────────────────────────────────────────────────────────┘
```

**关键性质**：`tools/`、`chat-history.service.ts`、`chat.schema.ts`、`ports/` 这四层**不 import 任何 AI 库**。只有 `adapters/`、`chat.service.ts`、`model-resolver.service.ts` 和两个 controller 接触 `ai`/`@ai-sdk/*`。迁移 LangGraph 时只改后者，前者不动。

### 核心接口定义

```typescript
// === ports/ai.port.ts：domain 契约，不暴露任何框架细节 ===

/** 摘要生成 port：输入 publicId，输出 {summary} */
export interface ArticleAiPort {
  summarizeArticle(publicId: string): Promise<{ summary: string }>;
}

/** 对话流式 port 契约
 *  关键：输入 UIMessage[]（前端 useChat 的协议格式），输出 ReadableStream<Uint8Array>（UIMessageStream 字节）。
 *  迁移时前端不需改动（协议不变）。
 *  不暴露 streamText/StateGraph 等封装，实现内部自由。 */
export interface ChatService {
  chat(
    messages: UIMessage[],
    options?: {
      conversationId?: string;
      profileId?: string;        // 选哪个 ai_profile，undefined=默认
      abortSignal?: AbortSignal; // 客户端断连时取消 LLM 调用
    },
  ): Promise<ReadableStream<Uint8Array>>;
}
```

```typescript
// === tools/tool-def.ts：框架无关工具定义（迁移时 0 修改的关键资产）===
import { z } from 'zod';

export interface ToolContext {
  db: unknown;                   // Drizzle 连接
  settings: SettingsService;     // 配置读取
  // 可按需扩展：conversationId、权限上下文等
}

export interface ToolDef<TSchema extends z.ZodType = z.ZodType, TResult = unknown> {
  name: string;
  description: string;
  inputSchema: TSchema;
  execute: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<TResult>;
}
```

```typescript
// === model/model-resolver.service.ts：模型路由（框架相关，迁移时改这里）===
@Injectable()
export class ModelResolver {
  constructor(private settings: SettingsService) {}
  /** 返回 AI SDK model 实例。迁移 LangGraph 时改为返回 @langchain/openai 的 ChatOpenAI */
  resolve(profileId?: string): LanguageModelV1 {
    const profiles = resolveProfiles(this.settings);
    const defaultId = this.settings.get('ai_default_profile_id');
    const profile = profiles.find(p => p.id === (profileId ?? defaultId) && p.enabled)
                 || profiles.find(p => p.enabled);
    if (!profile) throw new Error('未配置可用的 AI 模型');
    return createOpenAICompatible({
      baseURL: profile.api_url,
      apiKey: profile.api_key,
    })(profile.model);
  }
}
```

### chat.schema.ts（Drizzle 对话历史存储）

```typescript
export const chatConversations = sqliteTable('chat_conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').unique(),        // sqids 编码
  title: text('title'),
  profileId: text('profile_id'),               // 用的哪个 ai_profile
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull(),
  role: text('role').notNull(),                // user | assistant | system | tool
  content: text('content'),                    // 文本内容
  parts: text('parts', { mode: 'json' }),      // UI 消息 parts（tool calls/reasoning），JSON 字符串
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

---

## 三、抽象层设计（核心：可切换框架的关键）

### 抽象原则

调研报告 4 的核心结论：**不要预先抽象"AI 框架统一接口"**。Vercel AI SDK（薄 tool loop）与 LangGraph（厚 state graph）抽象层次根本不对称——做薄了切 LangGraph 用不到状态图能力=白切，做厚了 AI SDK 实现不了=泄漏。正确做法是端口适配器做**防腐层**而非**统一层**：domain 零框架依赖，AI 调用收敛到一个 service（adapter），domain 只依赖其接口。

### 该抽象的（框架无关，值得预先抽象）

**1. 工具定义层（最关键的切换资产）**
用 Zod schema + 纯函数 execute 表达，天然框架无关。AI SDK 的 `tool()` 和 LangGraph 的 `tool()` 都消费 JSON Schema。

```typescript
// server/src/ai/tools/article-tools.ts — 框架无关，迁移时 0 修改
import { z } from 'zod';
import type { ToolDef } from './tool-def';

const searchSchema = z.object({
  keyword: z.string().describe('搜索关键词'),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

/** 搜索博客文章工具：execute 只调 SearchService，不 import 任何 AI 库 */
export const searchArticlesTool: ToolDef<typeof searchSchema, SearchResult> = {
  name: 'search_articles',
  description: '在博客站内发布的文章中按关键词全文搜索，返回匹配最新的标题、摘要、链接。用于回答关于博客内容的问题。',
  inputSchema: searchSchema,
  execute: async ({ keyword, limit }, { db }) => {
    const searchService = resolveSearchService(db);
    const { hits } = await searchService.search(keyword, 1, limit);
    return { articles: hits.map(h => ({ title: h.title, snippet: h.snippet, url: h.url })) };
  },
};

/** 获取单篇文章内容的工具 */
export const getArticleTool: ToolDef = {
  name: 'get_article',
  description: '根据文章公开 ID 或 abbrlink 获取文章正文，用于深入回答。',
  inputSchema: z.object({ id: z.string().describe('文章公开 ID 或 abbrlink') }),
  execute: async ({ id }, { db }) => { /* 调 ArticleService.getPublic(id) */ },
};

export const articleTools: ToolDef[] = [searchArticlesTool, getArticleTool];
```

**2. 模型路由配置层（框架无关的数据） + 框架相关的工厂**
`ai_profiles` 配置数据是框架无关的，`ModelResolver` 是框架相关的工厂。两者分离：迁移时只改工厂实现，配置数据不动。

```typescript
// server/src/ai/model/ai-profile.ts — 框架无关的数据类型
export interface AiProfile {
  id: string;
  name: string;
  provider: string;          // 'openai' | 'deepseek' | 'custom' 等
  api_url: string;           // OpenAI 兼容 baseURL
  model: string;             // 模型名
  enabled: boolean;
  api_key: string;
}

/** 从 ai_profiles JSON 解析 + 兼容旧 ai_summary_* 单配置 */
export function resolveProfiles(settings: SettingsService): AiProfile[] {
  const raw = settings.get('ai_profiles');
  if (raw) try { return JSON.parse(raw); } catch {}
  // 旧配置兜底：合成单个 profile
  const key = settings.get('ai_summary_api_key');
  const url = settings.get('ai_summary_api_url');
  if (key && url) return [{ id: 'legacy', name: '默认', provider: 'custom',
    api_url: url, model: settings.get('ai_summary_model') || '', enabled: true, api_key: key }];
  return [];
}
```

**3. 对话历史存储层（框架无关）**
纯 DB CRUD，不 import 任何 AI 库。存储用简单的消息结构，和 AI SDK UIMessage 之间的转换放在 adapter 边界。

```typescript
// server/src/ai/chat-history.service.ts — 框架无关
export interface StoredMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  parts?: unknown;          // UI 消息的 parts（tool calls/reasoning），JSON 字符串存储
  createdAt: Date;
}

@Injectable()
export class ChatHistoryService {
  constructor(@Inject(DRIZZLE) private db: any) {}
  async createConversation(title?: string): Promise<string> { /* ... */ }
  async appendMessage(conversationId: string, msg: StoredMessage): Promise<void> { /* ... */ }
  async getMessages(conversationId: string): Promise<StoredMessage[]> { /* ... */ }
  async truncateHistory(conversationId: string, keepLast: number): Promise<void> { /* ... */ }
}
```

### 不该抽象的（框架特定，不要预抽象）

**1. State graph / tool loop / agent 编排**
两个框架的核心差异点。抽象它等于自己造第三个框架。Mozilla Any-Agent 已证明各框架 opinionated 设计难统一。**让 adapter 直接用各自原语**：`ChatService` 用 AI SDK 的 adapter，迁移时重写这个 adapter。

**2. 消息/chunk 格式**
AI SDK 的 `UIMessage`/`ModelMessage` 与 LangChain 的 `BaseMessage` 结构不同。**不统一到 domain**，让 adapter 在边界转换（参考 `@ai-sdk/langchain` 的 `toUIMessageStream`）。`ChatService.chat()` 接受/返回 `UIMessage[]` / `ReadableStream<Uint8Array>`（UIMessageStream 字节），这是前端 useChat 能消费的格式，同样框架无关。

**3. 业务逻辑**
文章检索、摘要生成等业务全在 `SearchService`/`ArticleService` 等 domain service，不属于 AI 抽象层。工具的 `execute` 只调用这些 service。

**4. 流式 HTTP 响应**
`pipeUIMessageStreamToResponse` 是 UIMessageStream 协议到 HTTP 写入，本质是 HTTP 工具，不属于 LLM 调用编排。只要 adapter 能产出 UIMessageStream，HTTP 层就稳定不变。

### 不预写双实现（YAGNI）

**现在只实现 AI SDK adapter，不预先写 LangGraphAdapter**。预写双实现 = 持续付两份维护成本却只用一份，且两个框架都在演进，双实现会双双腐烂。端口/契约接口存在的意义是**划定边界、让将来迁移时成本可知**，不是为现在造两个实现。记住：`ArticleAiPort`/`ChatService` 现在只有一个 AI SDK 实现，需要切 LangGraph 时再写第二个实现。

---

## 四、LangGraph 迁移路径（将来切换时执行）

### 迁移前提：真实需要

调研报告 2 明确："本项目无 AI SDK 可迁移"。无论从 AI SDK 到 LangGraph 都是从零重写。所以不存在"迁移"，只有"重写选型"。这个路径只在以下需求出现时执行：

- 需要多步 RAG 检索（搜索 → 摘要 → 再搜索 → 生成）
- 需要会话级状态 + 崩溃恢复（durable execution）
- 需要人在回路节点（如 AI 生成内容发布前人工确认）
- 需要 supervisor/swarm 多 agent 协作

博客对话助手短期内大概率不需要。一旦需要，按以下执行。

### 改哪些文件（重写 adapter 内部）

1. **`server/src/ai/chat.service.ts`**（重写核心）
   - 现：`streamText({model, messages, tools, stopWhen})` + `toUIMessageStream`
   - 改：`StateGraph` 建状态机（messages reducer）→ `addNode('llm')` / `addNode('tools', new ToolNode([...]))` → 条件路由 → `compile({checkpointer})` → `graph.streamEvents(input, {version:'v3'})` → 用 `@ai-sdk/langchain` 的 `toUIMessageStream()` 把 LangGraph 流转成 UIMessageStream（这样前端协议不变）
   - `chat()` 对外签名（UIMessage[] 输入，ReadableStream<Uint8Array> 输出）不变

2. **`server/src/ai/model/model-resolver.service.ts`**
   - 现：返回 `@ai-sdk/openai-compatible` 的 `LanguageModelV1`
   - 改：返回 `@langchain/openai` 的 `ChatOpenAI` 实例（对应 provider）。`resolveProfiles()` 配置解析逻辑不变，只换实例化

3. **`server/src/ai/adapters/summary.adapter.ts`**
   - 现：AI SDK `generateText`
   - 改：LangChain `model.invoke()`。签名 `summarizeArticle(publicId): Promise<{summary}>` 不变。摘要是一次性调用，用 LangGraph 的 StateGraph 是过度设计，直接 invoke 即可

4. **`server/src/ai/ai.module.ts`**
   - 调整 provider 绑定（如 port/adapter DI 装配用 useClass，或 chat.service.ts 内部切换）
   - 加 checkpoint store provider（MemorySaver 起步，后续可换文件/KV）

5. **`package.json`**
   - 加：`@langchain/langgraph`、`@langchain/core`、`@langchain/openai`、`@ai-sdk/langchain`（边界转换 UIMessageStream，保证前端稳定）
   - 视情况移除 `ai`、`@ai-sdk/openai-compatible`（若摘要也全转 LangChain）
   - 严格锁版本（调研提到 CVE-2026-34070 LangChain 安全漏洞）

### 不改哪些文件（迁移时资产保护）

1. **`server/src/ai/tools/article-tools.ts`** — ToolDef 数组（Zod schema + 纯 execute），100% 复用。只需加一个 `toLangGraphTool(def, ctx)` 水平包装器转 LangGraph 的 `tool()` 格式，`article-tools.ts` 本身不动
2. **`server/src/ai/chat-history.service.ts`** — 纯 DB CRUD，框架无关
3. **`server/src/ai/chat.schema.ts`** — Drizzle 表结构不变
4. **`server/src/ai/ai-chat.controller.ts`** — 只调 `chatService.chat()` 拿 UIMessageStream ReadableStream，再用 `pipeUIMessageStreamToResponse`。**前端**：LangGraph adapter 通过 `@ai-sdk/langchain` 转 UIMessageStream，前端协议不变
5. **`server/src/ai/ai-summary.controller.ts`** — 只调 `summarizeArticle(publicId): Promise<{summary}>`
6. **前端** — 不动（useChat 协议不变）
7. **配置**（ai_profiles）— 不动，schema 兼容
8. **已有 domain 服务** — SearchService、ArticleService、SettingsService 等不动

### 迁移执行方式（调研报告 4 的四阶段法）

按 digitalapplied 的 LangChain→Vercel AI SDK 迁移经验（反向适用）：
1. **Assess**（1 周）：盘点 + 基线遥测
2. **Wrap**（1 周）：feature flag 双路径并行，共享数据层保证状态互通，无真实流量
3. **Cut over**：采样流量灰度切换，比对行为差异
4. **Retire**：下线旧路径

核心原则（调研原话）："Big-bang rewrites of orchestration code are where this migration goes wrong"——编排层禁止一次性重写。

### 迁移成本估算

调研报告 4 估算：实际只重写 3-4 个文件（chat.service.ts / model-resolver / summary.adapter / ai.module.ts），成本可控。SqliteSaver 和 better-sqlite3 同步模型有写锁/记录循环风险，需单独验证（调研报告 2 的痛点）。

---

## 五、落地阶段

| 阶段 | 目标 | 涉及文件 |
|------|------|---------|
| **Phase 1：模型路由 + 摘要迁移到 AI SDK** | 建 ModelResolver，读 ai_profiles 配置，返回 AI SDK model 实例；用 `@ai-sdk/openai-compatible` 直接发请求；把现有 AiService 的 raw fetch 替换为 AI SDK generateText；签名不变（generateSummary(publicId): Promise<{summary}>）；重构 controller 为干净的 ports/adapters/tools/model 目录骨架。验证：现有摘要功能仍工作，且能通过 ai_profiles 配 profile 切换模型 | `model/ai-profile.ts`, `model/model-resolver.service.ts`, `adapters/summary.adapter.ts`, `ai-summary.controller.ts`(重构), `ai.module.ts`, `package.json`(加 ai + @ai-sdk/openai-compatible + zod) |
| **Phase 2：工具层 + 对话历史存储** | 建框架无关的 ToolDef 类型 + article-tools（search_articles 调 SearchService.search、get_article 调 ArticleService.getPublic），不 import AI 库；建 chat_conversations/chat_messages Drizzle 表 + ChatHistoryService（CRUD + 截断历史）。验证：工具 execute 能正确返回检索/文章结果，历史 CRUD 正常 | `tools/tool-def.ts`, `tools/article-tools.ts`, `chat.schema.ts`, `chat-history.service.ts`, `ai.module.ts`, drizzle migration |
| **Phase 3：流式对话端点** | 实现 ChatService.chat()（streamText + articleTools + stopWhen:stepCountIs(5) + toolChoice:auto + onFinish 持久化 + onError 日志），返回 UIMessageStream ReadableStream；建 POST /api/ai/chat 端点（@Res + pipeUIMessageStreamToResponse，含前置同步鉴权/校验，用户消息先入库）；确保 CORS 流式头。验证：前端 useChat 能正常流式渲染，token 逐字到达，工具调用能返回文章结果，对话历史正确保存 | `chat.service.ts`, `ai-chat.controller.ts`, `ai.module.ts`, `main.ts`(CORS exposedHeaders 加流式头) |
| **Phase 4：硬化和边缘工具** | 对话上下文压缩（messages.length>阈值时 prepareStep 压缩/截断旧消息）、token 用量记录（onStepFinish）、客户端断连用 consumeStream 消费完再持久化避免状态损坏、确保 JwtAuthGuard 在流开启前执行（401 而非 SSE 错误帧）、前端对接（useChat + DefaultChatTransport 指向 /api/ai/chat）+ 后台配置（ai_profiles 管理）。验证：长对话不爆 token，断连不损坏状态，未授权返回 401，端到口可用 | `chat.service.ts`(prepareStep 压缩/telemetry), `ai-chat.controller.ts`(guard 时机/abort), 前端聊天组件(useChat 对接) + 配置表单(ai_profiles 管理) |

---

## 六、风险点

1. **@Res() 绕过 NestJS 增强器**：用 @Res() 注入 Express Response 会绕过 ResponseInterceptor（统一响应 {code,message,data}）、ExceptionFilter（流前错误能否走正常 4xx）、序列化。需校验流前错误（如缺配置/消息非法）是否同正常返回 4xx。JwtAuthGuard 作为 APP_GUARD 在 handler 前执行，鉴权失败返回 401 而非 SSE 错误帧，需确保认证在 streamText 开启前完成。
2. **CORS 与流式响应**：前端（3000）调后端（8091）跨域，main.ts 的 enableCors 需 exposedHeaders 加 Cache-Control/X-Accel-Buffering。反向代理/Nginx 默认会缓冲 SSE 流，需 `proxy_buffering off` + `X-Accel-Buffering: no`。
3. **streamText 不 throw**：错误只进流，若不做 onError 日志会静默失败。需改用 onError 回调；onFinish 在多步工具调用时只提供最后一条消息，若需持久化每条要自行处理（[vercel/ai#2993](https://github.com/vercel/ai/issues/2993)）。
4. **客户端断连导致状态损坏**：客户端断连会 abort LLM 调用，onFinish 可能不触发导致 assistant 消息未持久化。对策：(1) 用户消息先入库；(2) 用 consumeStream() 在断连后消费完流再保存，或用 toUIMessageStream 的 onEnd 而非 streamText 的 onFinish。
5. **对话历史 token 爆炸**：每次请求带全部 messages，对话变长后上下文爆。用 prepareStep 在 messages.length>10 时压缩/截断，只保留 system + 最近 N 条。
6. **AI SDK 7 是新版（2026-06-25 发布）**：部分社区/博客示例是 v4/v5，可能与官方文档（ai-sdk.dev v7 Latest）有 API 名差异（stopWhen vs maxSteps、inputSchema vs parameters、pipeUIMessageStreamToResponse vs toDataStreamResponse）。前端 ai/@ai-sdk/react 版本必须与后端匹配，否则 useChat 解析失败。
7. **global provider 默认走 Vercel AI Gateway**：model ID 形如 'openai/gpt-4o' 会默认走 Vercel 网关（需付费）。本项目自己管 key，用显式 `@ai-sdk/openai-compatible` 的 createOpenAICompatible 直接对接，绕过网关。
8. **zod 版本兼容**：AI SDK 依赖 zod 的 inputSchema，server 若已有 zod 需确保与项目其他依赖兼容。tsconfig 的 isolatedModules:false 和 Express Response 类型在 Nest 注入处理上需注意。
9. **授权与端点开放**：若 /api/ai/chat 对访客开放（@Public + 全局 ThrottlerGuard），需防止未登录用户滥用消耗 API 额度。建议公开 + 严格限流 + 单 IP 每日上限，或仅登录可用。两者都影响 JwtAuthGuard 配置和端点可用性。
10. **LangGraph 迁移不要预写**：现在不写 LangGraph adapter（YAGNI）。tools/model-config/history 是切换资产，chat.service.ts 是重写目标。迁移成本实测可控（3-4 文件重写），但 SqliteSaver 和 better-sqlite3 同步模型有写锁/记录循环风险需单独验证，LangChain 生态有 CVE（如 CVE-2026-34070 路径遍历），需严格锁版本。
11. **消息格式存储**：UI 消息（含 parts/tool calls/reasoning）比简单 {role,content} 复杂。直接存 JSON 字符串到 SQLite 简单但难查询；validateUIMessages 校验旧消息兼容当前 schema 可能有坑。建议 parts 存 JSON 列，content 存 TEXT，role 存 TEXT 枚举。

---

## 七、调研来源

### Vercel AI SDK 7
- [AI SDK 官方 NestJS cookbook](https://ai-sdk.dev/cookbook/api-servers/nest)
- [streamText 文档](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [流式 troubleshooting](https://ai-sdk.dev/docs/troubleshooting/stream-text-not-working)
- [Chatbot 消息持久化](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [Tools 文档](https://ai-sdk.dev/docs/foundations/tools)
- [@ai-sdk/langchain adapter](https://ai-sdk.dev/providers/adapters/langchain)

### LangGraph.js
- [Building LangGraph: Designing an Agent Runtime](https://www.langchain.com/blog/building-langgraph)
- [LangGraph.js vs LangGraph 对比](https://www.crewship.dev/learn/langgraph-vs-langgraphjs)
- [LangGraph 状态管理/checkpoint 决策](https://activewizards.com/blog/langgraph-state-management-checkpointing-recovery-and-the-persistence-layer-decision)
- [LangGraph 生产延迟/replay/scale](https://aerospike.com/blog/langgraph-production-latency-replay-scale)
- [CSA LangChain/LangGraph 安全漏洞研究](https://labs.cloudsecurityalliance.org/research/csa-research-note-langchain-langgraph-vulnerabilities-202603)

### NestJS 集成
- [NestJS 流式 SSE 实践](https://medium.com/@chauhandarshil716/streaming-openai-responses-in-nestjs-using-server-sent-events-sse-2340ee2cf4d0)
- [WeAreDevelopers: SSE in Next.js + NestJS](https://www.wearedevelopers.com/en/videos/1630/streaming-ai-responses-in-real-time-with-sse-in-next-js-nestjs)
- [nest-native/ai-sdk（社区装饰器）](https://github.com/nest-native/ai-sdk)
- [Turso: 存储 AI SDK chat 消息](https://turso.tech/blog/storing-vercels-ai-sdk-chat-messages-in-a-turso-database)
- [Vercel AI SDK 2026 实战](https://nextfuture.io.vn/blog/ultimate-guide-vercel-ai-sdk-2026)
- [streamText 负载下的稳定模式](https://wolf-tech.io/blog/streaming-llm-responses-in-nextjs-sse-patterns-that-stay-stable-under-load)

### 可切换架构
- [Hexagonal Architecture for AI Integration（Ableneo）](https://www.ableneo.com/insight/hexagonal-architecture-for-ai-integration)
- [AI 集成模式：Adapter vs Actor](https://pasmontesinos.com/en/posts/ai-integration-patterns-adapter-actor)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anti-Corruption Layer 保护 domain](https://hosseinnejati.medium.com/the-anti-corruption-layer-protecting-your-domain-from-legacy-systems-6da58fc5f46d)
- [Thoughtworks: Agent Skill 不是 ACL](https://www.thoughtworks.com/en-us/insights/blog/generative-ai/your-agent-skill-not-anti-corruption-layer)
- [Microsoft ACL 模式](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)
- [LangChain→AI SDK 迁移 playbook](https://www.digitalapplied.com/blog/langchain-to-vercel-ai-sdk-migration-playbook-cost-quality-2026)
- [LangChain 生产事故分析](https://aws.plainenglish.io/why-langchain-apps-break-in-production-6a4c6aec5e9a)
- [LangChain 问题与规避](https://safjan.com/problems-with-Langchain-and-how-to-minimize-their-impact)
- [Mozilla Any-Agent 跨框架抽象](https://blog.mozilla.ai/introducing-any-agent-an-abstraction-layer-between-your-code-and-the-many-agentic-frameworks)
- [Vercel AI SDK 6 vs LangGraph TS](https://www.developersdigest.tech/blog/vercel-ai-sdk-6-vs-langgraph-typescript-agents)
- [Mastra vs LangGraph vs Vercel AI SDK](https://particula.tech/blog/mastra-vs-langgraph-vs-vercel-ai-sdk-typescript-agents)
