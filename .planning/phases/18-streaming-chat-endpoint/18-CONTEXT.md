# Phase 18: Streaming Chat Endpoint - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

实现流式聊天助手端点 + 前端聊天组件。Phase 17 已交付框架无关资产（ToolDef、articleTools、chat.schema、ChatHistoryService），Phase 18 在此基础上构建 AI SDK 7 的流式对话核心和前端 UI。

**Phase 18 交付物：**
- `server/src/ai/chat.service.ts` — ChatService.chat(): streamText + articleTools(经 tool-bridge 转换) + stopWhen:stepCountIs(5) + toolChoice:auto + onFinish 持久化 + onError 日志。返回 UIMessageStream ReadableStream
- `server/src/ai/tools/tool-bridge.ts` — ToolDef → AI SDK tool() 转换器（框架特定，import ai）
- `server/src/ai/ports/ai.port.ts` — 新增 ChatService 契约（UIMessage[] in, ReadableStream<Uint8Array> out）
- `server/src/ai/ai-chat.controller.ts` — POST /api/ai/chat, @Public() + @Res() + pipeUIMessageStreamToResponse, 流前同步校验(4xx JSON)
- `server/src/main.ts` — CORS exposedHeaders 加 Cache-Control, X-Accel-Buffering
- **前台前端**: 安装 ai@7 + @ai-sdk/react@7 依赖
- **前台前端**: 聊天组件 — 右下角浮动按钮 + 对话窗口(380x580, 移动端全屏)，useChat + DefaultChatTransport 指向 /api/ai/chat
- **前台前端**: 流式 token 打字机渲染 + 工具调用结果(文章链接卡片)内嵌渲染
- Verify: frontend useChat consumes stream, tokens arrive incrementally, tool calls return article results, history saved

**不在 Phase 18 范围：**
- 对话历史列表端点（GET /api/ai/conversations）——Phase 19
- chat_conversations.userId 字段——Phase 19
- prepareStep 运行时上下文压缩 / token 用量记录——Phase 19
- 客户端断连 consumeStream 保护——Phase 19
- 后台 ai_profiles 管理表单完善 / 对话历史查看页——Phase 19
- LangGraph adapter——YAGNI
- 前端代码修改（除了新增聊天组件和安装依赖）

</domain>

<decisions>
## Implementation Decisions

### Chat 端点访问策略
- **D-360:** POST /api/ai/chat 公开访问——加 @Public() 装饰器 + 严格限流。复用全局 ThrottlerGuard，在 controller 或 module 级配更严 TTL（6s/请求 ≈ 每分钟 10 次）。匿名访客可直接聊天，无需登录。— **Reversibility:** reversible — 改 @Public() 为默认鉴权即可

### 匿名访客历史策略
- **D-361:** 匿名访客完整历史体验——前端用 localStorage 存 conversationId，刷新页面后可恢复当前对话。后端 chat_conversations 暂不加 userId 字段（Phase 19 再加），用 publicId 查找即可。— **Reversibility:** reversible — localStorage 清除即丢失，后端无 userId 关联，Phase 19 加 userId 后可迁移关联

### 历史列表端点范围
- **D-362:** 历史列表端点交给 Phase 19。Phase 18 只做单会话聊天——useChat 的 initialMessages 加载当前 conversationId 的消息，前端不显示会话列表切换。— **Reversibility:** reversible — 后续加 GET /api/ai/conversations 端点即可

### ToolDef 转换架构
- **D-363:** ToolDef → AI SDK tool() 转换逻辑放在独立 `tools/tool-bridge.ts`。这是框架特定代码（import ai），必须与框架无关的 `article-tools.ts` 分离。tool-bridge.ts 读 ToolDef[]，输出 AI SDK tool() 对象数组，供 chat.service.ts 的 streamText tools 参数使用。— **Reversibility:** reversible — 改转换逻辑不影响 article-tools.ts

### ToolContext 注入时机
- **D-364:** ToolContext 在 ChatService 构造时创建（db + settings + getService），所有 streamText 调用共用同一个 ToolContext 实例。getService 用 NestJS ModuleRef.resolve() 动态拉取服务。— **Reversibility:** reversible — 改为每次请求创建只需改构造逻辑

### 工具调用循环限制
- **D-365:** 工具调用循环上限 5 步：stopWhen:stepCountIs(5)。足够搜索+获取文章（典型 2-3 步），防止无限循环消耗 API 额度。— **Reversibility:** reversible — 改数字即可

### 前端聊天窗口布局
- **D-366:** 聊天窗口固定右下角浮动窗（Intercom/Crisp 风格）。桌面 380×580 固定尺寸，移动端全屏展开。右下角浮动圆形按钮（AI 图标），点击展开/收起窗口。— **Reversibility:** costly — 组件布局改动影响 CSS + 响应式断点

### 流式渲染与工具结果展示
- **D-367:** 流式 token 打字机效果逐字显示（复用 ArticleLeadSummary 的打字机模式或新写）。工具调用过程显示"正在搜索文章..."加载状态，工具结果内嵌为可点击的文章链接卡片（title + snippet + url）。— **Reversibility:** reversible — 改渲染组件不影响数据层

### 前端 AI SDK 依赖
- **D-368:** 前端安装 `ai@7` + `@ai-sdk/react@7`（与后端 ai@7.0.37 匹配），用 `useChat` + `DefaultChatTransport` 指向 `/api/ai/chat`。AI SDK 7 的 useChat 自动处理 UIMessageStream 协议解析、流式追加、工具调用展示。— **Reversibility:** reversible — 删依赖即可回退，但前端组件需重写

### 流前同步校验
- **D-369:** 在 pipeUIMessageStreamToResponse 之前做同步校验：检查 ai_profiles 是否配置了可用模型（ModelResolver.resolve() 不抛错）、messages 数组是否非空。校验失败直接 res.status(400/500).json({code, data, message})，走正常 JSON 响应格式。前端 useChat 会收到网络错误（可处理的 4xx）。— **Reversibility:** reversible — 去掉校验即可

### CORS 流式头
- **D-370:** main.ts enableCors 的 exposedHeaders 加 `Cache-Control` 和 `X-Accel-Buffering`。虽然前端 next.config.ts rewrites 代理不是跨域，但为将来直连或反向代理场景预留。— **Reversibility:** reversible — 去掉头即可

### 对话历史持久化策略
- **D-371:** 用户消息先入库（ChatHistoryService.appendMessage），然后 streamText 的 onFinish 回调持久化助手消息（含 parts/tool calls）。Phase 19 加 consumeStream 保护防止断连状态损坏。— **Reversibility:** reversible — 改持久化逻辑不影响流式协议

### Claude's Discretion
- ChatService.chat() 的 system prompt 内容（默认中文博客助手提示词）——planner 决定
- 打字机效果的实现方式（复用 ArticleLeadSummary vs 新写 useTypewriter hook）——planner 根据复用度决定
- 浮动按钮的具体样式（颜色/大小/阴影）——参考现有主题变量
- ChatService 是否需要 conversationId 不存在时自动创建的逻辑——建议自动创建
- ThrottlerGuard 严格限流的具体 TTL 值——6s/请求是起点，planner 可调整
- tool-bridge.ts 的 Zod → AI SDK inputSchema 转换细节——AI SDK 7 的 tool() 接受 Zod schema，直接传即可
- 前端聊天组件的文件组织（单文件 vs 拆分子组件）——planner 根据复杂度决定
- useChat 的 body 参数传递方式（conversationId/profileId 怎么传到后端）——DefaultChatTransport 配置
- 新会话创建时机（前端点"新对话"按钮 vs 后端自动创建）——建议前端触发

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 架构设计文档（最重要——接口定义、目录结构、模块依赖都来自这里）
- `.planning/ai-assistant-architecture.md` — AI 助手完整架构设计。包含：ChatService 接口定义（UIMessage[] in, ReadableStream<Uint8Array> out）、目录结构、模块依赖关系图、streamText 用法、tool() 转换、onFinish 持久化、CORS 流式头、11 个风险点。**planner 必须严格遵循此文档的目录结构和接口签名。**

### 路线图与状态
- `.planning/ROADMAP.md` §Phase 18 — phase 定义、key deliverables、AI-05 需求 ID
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-371），M5 AI Features milestone 状态

### Phase 17 Context（前置 phase 的决策和代码）
- `.planning/phases/17-ai-tools-chat-history-storage/17-CONTEXT.md` — Phase 17 的所有决策（D-350 到 D-356），包括 ToolDef 类型、articleTools、ChatMessagePart、ChatHistoryService、AiModule wiring

### 现有 AI 代码（Phase 18 要在此基础上新增）
- `server/src/ai/ai.module.ts` — 当前模块装配（DatabaseModule + SettingsModule + SearchModule + ArticleModule imports，AiSummaryController，ModelResolver + ChatHistoryService providers，ARTICLE_AI_PORT + ChatHistoryService exports）
- `server/src/ai/ai-summary.controller.ts` — 现有 controller 模式参考（@Controller('ai')，@UseGuards，@HttpCode）
- `server/src/ai/adapters/summary.adapter.ts` — AI SDK generateText 用法参考（ModelResolver.resolve()，generateText 参数格式，DomainError 包装）
- `server/src/ai/model/model-resolver.service.ts` — ModelResolver.resolve(profileId?) → LanguageModel
- `server/src/ai/tools/article-tools.ts` — articleTools ToolDef[]（Phase 18 经 tool-bridge 转换为 AI SDK tool()）
- `server/src/ai/tools/tool-def.ts` — ToolDef 类型 + ToolContext 接口
- `server/src/ai/chat-history.service.ts` — ChatHistoryService CRUD（createConversation, appendMessage, getMessages）
- `server/src/ai/chat.schema.ts` — chat_conversations + chat_messages Drizzle 表
- `server/src/ai/ports/ai.port.ts` — ArticleAiPort 契约（Phase 18 加 ChatService 契约）
- `server/src/ai/domain-error.ts` — DomainError 类

### NestJS 流式参考
- `server/src/main.ts` — CORS 配置（需加 exposedHeaders：Cache-Control, X-Accel-Buffering）
- `server/src/rss/rss.controller.ts` — @Res() 用法参考（bypass ResponseInterceptor，手动设置 headers + send）

### 前端参考
- `frontend/src/components/post/ArticleLeadSummary.tsx` — 打字机效果组件（可复用模式）
- `frontend/src/app/admin/settings/_config/settings-nav.ts` — AI 功能导航分组（ai-models, ai-chat, ai-writing 子项已占位）
- `frontend/src/components/admin/settings/AiModelsForm.tsx` — AI 模型管理表单
- `frontend/src/components/admin/settings/AiPlaceholderForm.tsx` — AI 占位卡片
- `frontend/src/lib/settings/ai-profile.ts` — 共享 AiProfile 类型
- `frontend/src/lib/api/ai.ts` — 前端 AI API 客户端（aiApi.generateSummary，需扩展 chat 方法）
- `frontend/package.json` — 前端依赖（需加 ai@7 + @ai-sdk/react@7）

### 项目约束
- `.claude/CLAUDE.md` — 项目核心约束：API 兼容性是核心底线，技术栈 NestJS + Drizzle + SQLite
- `~/CLAUDE.md` — CodeGraph MCP 使用指南 + Karpathy 简洁原则

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ModelResolver.resolve(profileId?)** — 返回 AI SDK LanguageModel，ChatService 直接调用
- **ChatHistoryService** — createConversation / appendMessage / getMessages，Phase 18 直接注入使用
- **articleTools ToolDef[]** — search_articles + get_article，Phase 18 经 tool-bridge 转换为 AI SDK tool()
- **ToolContext 接口** — db + settings + getService，ChatService 构造时创建
- **DomainError** — 错误包装类，流前校验失败和 streamText onError 统一使用
- **pipeUIMessageStreamToResponse** — AI SDK 7 的 NestJS 流式 helper（cookbook 推荐用法）
- **ArticleLeadSummary 打字机效果** — 前端打字机模式参考
- **@Public() 装饰器** — 公开路由标记，JwtAuthGuard 全局 APP_GUARD 会跳过
- **ThrottlerGuard** — 全局限流，可配更严 TTL 给特定路由

### Established Patterns
- NestJS 模块：`@Module({ imports, controllers, providers, exports })` + DI 注入
- Controller：`@Controller('ai')` + `@UseGuards()` + `@HttpCode()`
- @Res() 用法（rss.controller.ts）：bypass ResponseInterceptor，手动设 Content-Type + headers + send
- 全局响应拦截器：`{ code, data, message }` 格式（D-04）——@Res() 时需手动包装
- AI SDK generateText 参数格式（summary.adapter.ts 参考）：model + instructions + messages + temperature + maxOutputTokens + timeout
- 前端设置三处注册：setting-descriptors.ts + settings-nav.ts + settings-forms.ts

### Integration Points
- `AiModule` 已在 app.module.ts 注册，Phase 18 更新 AiModule 加 ChatService provider + AiChatController + export ChatService
- `POST /api/ai/chat` 新端点——前端 useChat + DefaultChatTransport 指向
- `main.ts` CORS exposedHeaders 需加流式头
- 前端需安装 ai@7 + @ai-sdk/react@7
- 前端 settings-nav.ts 的 "AI 对话" 子项已有占位（AiPlaceholderForm），Phase 18 可选择填充或继续占位
- ChatHistoryService 已 export 自 AiModule，ChatService 注入即可

</code_context>

<specifics>
## Specific Ideas

- ChatService.chat() 签名（来自架构文档 §二）：
  ```typescript
  chat(
    messages: UIMessage[],
    options?: {
      conversationId?: string;
      profileId?: string;        // 选哪个 ai_profile，undefined=默认
      abortSignal?: AbortSignal; // 客户端断连时取消 LLM 调用
    },
  ): Promise<ReadableStream<Uint8Array>>
  ```

- tool-bridge.ts 核心转换逻辑：
  ```typescript
  import { tool } from 'ai';
  import type { ToolDef, ToolContext } from './tool-def';
  
  export function toAiSdkTools(defs: ToolDef[], ctx: ToolContext) {
    return defs.map(def => tool({
      description: def.description,
      parameters: def.inputSchema,  // AI SDK 7: Zod schema directly
      execute: async (input) => def.execute(input, ctx),
    }));
  }
  ```

- AiChatController 流前校验 + 流式响应：
  ```typescript
  @Controller('ai')
  export class AiChatController {
    @Public()
    @Post('chat')
    async chat(@Body() body, @Res() res: Response) {
      // 1. 流前同步校验
      if (!body.messages?.length) {
        return res.status(400).json({ code: 400, data: null, message: '消息不能为空' });
      }
      // 2. 用户消息先入库
      // 3. streamText + pipeUIMessageStreamToResponse
      const stream = await this.chatService.chat(body.messages, opts);
      return pipeUIMessageStreamToResponse(stream, res);
    }
  }
  ```

- AiModule 更新（Phase 18 需加 ChatService + AiChatController）：
  ```typescript
  @Module({
    imports: [DatabaseModule, SettingsModule, SearchModule, ArticleModule],
    controllers: [AiSummaryController, AiChatController],
    providers: [
      ModelResolver,
      ChatHistoryService,
      ChatService,
      { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
    ],
    exports: ['ARTICLE_AI_PORT', ChatHistoryService, ChatService],
  })
  export class AiModule {}
  ```

- 前端聊天组件骨架（useChat + DefaultChatTransport）：
  ```typescript
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    transport: new DefaultChatTransport({ url: '/api/ai/chat', body: { conversationId } }),
    initialMessages: loadedMessages,  // 从 ChatHistoryService.getMessages 加载
  });
  ```

- main.ts CORS 更新：
  ```typescript
  exposedHeaders: 'Authorization,Content-Range,Content-Length,Content-Disposition,Cache-Control,X-Accel-Buffering',
  ```

</specifics>

<deferred>
## Deferred Ideas

- 对话历史列表端点（GET /api/ai/conversations, GET /api/ai/conversations/:id/messages）——Phase 19
- chat_conversations.userId 字段——Phase 19
- prepareStep 运行时上下文压缩 / token 用量记录——Phase 19
- 客户端断连 consumeStream 保护——Phase 19
- 后台 ai_profiles 管理表单完善 / 对话历史查看页——Phase 19
- 前端聊天组件打磨（建议问题、欢迎语、断线重连提示、错误状态）——Phase 19
- LangGraph adapter——YAGNI
- AI 写作功能——未来阶段

</deferred>

---

*Phase: 18-Streaming Chat Endpoint*
*Context gathered: 2026-07-28*
