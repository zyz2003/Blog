# Phase 19: Chat Hardening & Frontend Integration - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Production-harden the chat system + wire up admin config UI + final frontend polish + close all M5 milestone gaps. This is the final phase of the AI Features milestone (M5).

**Phase 19 交付物：**

**后端硬化：**
- Context compression: prepareStep 滑动窗口 + 摘要，messages.length > 20 时触发，保留 system prompt + 最近 10 条 + 1 条摘要替代旧消息
- Token usage recording: onStepFinish 记录 input_tokens/output_tokens 到 chat_messages（已有 schema 字段）
- Disconnect handling: consumeStream 保护，客户端断连不影响后端状态，onFinish 正常持久化完整助手消息
- chat_conversations.userId: 加 nullable integer 字段，匿名访客 userId=null，登录用户 userId=DB ID。需 Drizzle migration
- System prompt 可配置: 从 settings 读 ai_chat_system_prompt，不传用默认中文提示词
- 对话历史端点: GET /api/ai/conversations（分页列表，需 JwtAuthGuard/AdminGuard）+ GET /api/ai/conversations/:id/messages
- 对话删除端点: DELETE /api/ai/conversations/:id（管理员可删除对话）

**后台前端：**
- AiModelsForm 加 purposes 'chat' 勾选选项
- "AI 对话"卡片填充（替换 AiPlaceholderForm）：chat profile 下拉选择 + 欢迎语(ai_chat_welcome_message) + 建议问题(ai_chat_suggested_questions) + system prompt(ai_chat_system_prompt)
- 对话管理页（/admin/ai-chat）：对话列表 + 消息详情查看 + 删除

**前台前端：**
- 欢迎语 + 建议问题按钮（从后台配置读取）
- 断线重连提示条（"连接中断，点击重试"）
- 新对话按钮 + 会话切换（历史对话列表）
- conversationId 恢复（localStorage 存 Sqids ID，刷新后用 GET /api/ai/conversations/:id/messages 恢复）

**遗留验收：**
- Phase 16 Wave 3 验收：前台 AI 摘要打字机展示 + admin AiModelsForm round-trip + legacy fallback + 公钥安全

**不在 Phase 19 范围：**
- LangGraph adapter（YAGNI）
- AI 写作功能（未来阶段）
- 前端代码修改（除了聊天组件和后台 AI 设置/管理页）
- 501 端点实现（config/export, config/import, proxy/download 等）
- 主题/SSR-theme 端点（20 个）
- PRO 功能

</domain>

<decisions>
## Implementation Decisions

### Token 压缩与用量
- **D-380:** 滑动窗口 + 摘要压缩策略。当 messages.length > 20 时，保留 system prompt + 最近 10 条消息，中间旧消息用一条摘要消息替代。摘要由 LLM 生成（调用 generateText，用较小模型或同一模型）。在 AI SDK 的 prepareStep 回调中实现截断逻辑。— **Reversibility:** reversible — 改阈值或截断策略只影响 chat.service.ts
- **D-381:** 压缩触发阈值 20 条消息。保留最近 10 条 + 1 条摘要。个人博客场景对话通常不会太长，20 条足够覆盖大多数对话。— **Reversibility:** reversible — 改常量即可
- **D-382:** Token 用量记录到 chat_messages 的 input_tokens / output_tokens 字段（已有 schema）。onStepFinish 回调中读取 usage.promptTokens / usage.completionTokens 写入每步消息，onFinish 汇总。不加 conversation 级别累加字段。— **Reversibility:** reversible — 去掉 onStepFinish 逻辑即可

### 断连与认证时序
- **D-383:** consumeStream 保护。客户端断连时，consumeStream 确保流被完整消费（即使客户端断开），onFinish 正常执行，助手消息完整持久化。断连只影响客户端不再收到数据，不影响后端状态。— **Reversibility:** reversible — 去掉 consumeStream 调用即可
- **D-384:** 保持 @Public() 匿名访问（D-360 不变）。Phase 19 不改认证策略，匿名访客可直接聊天。如果未来需要登录才能聊天，改 @Public() 为 JwtAuthGuard 即可。— **Reversibility:** reversible — 改装饰器即可
- **D-385:** conversationId 恢复机制：前端 localStorage 存 conversationId（后端返回的 Sqids ID），刷新页面后用 GET /api/ai/conversations/:id/messages 加载历史消息，传入 useChat 的 initialMessages。需要后端新增历史消息端点。— **Reversibility:** reversible — 去掉 localStorage 存储和 initialMessages 加载即可

### 后台 AI 对话管理
- **D-386:** 复用 AiModelsForm 管理 chat profile。在 AiModelsForm 的 purposes 勾选框加 'chat' 选项。"AI 对话"卡片（替换 AiPlaceholderForm）配置：1) chat profile 下拉选择（从 purposes 含 chat 的 profiles 中选），2) 欢迎语（ai_chat_welcome_message），3) 建议问题（ai_chat_suggested_questions，JSON 数组），4) system prompt（ai_chat_system_prompt）。所有配置存 settings 表，key 前缀 ai_chat_。— **Reversibility:** reversible — 改表单字段和 settings key 即可
- **D-387:** 后台独立对话管理页（/admin/ai-chat）。列表显示所有对话（ID、标题、消息数、创建时间、userId），点击查看详情（消息列表），管理员可删除对话。需要后端端点：GET /api/ai/conversations（分页列表，需 JwtAuthGuard/AdminGuard）+ GET /api/ai/conversations/:id/messages + DELETE /api/ai/conversations/:id。— **Reversibility:** costly — 删页面和端点影响多处

### 前台聊天打磨
- **D-388:** 欢迎语 + 建议问题按钮。打开聊天窗口时显示欢迎语（从后台 ai_chat_welcome_message 读取，默认"你好！我是博客 AI 助手，有什么可以帮你？"）+ 3 个建议问题按钮（从 ai_chat_suggested_questions 读取）。点击建议问题直接发送。— **Reversibility:** reversible — 改组件即可
- **D-389:** 断线重连提示条 + 手动重试。前端检测到网络错误或流中断时，显示"连接中断，点击重试"提示条。点击后重新发送最后一条用户消息。简单实用，个人博客场景足够。— **Reversibility:** reversible — 去掉提示条组件即可
- **D-390:** 新对话按钮 + 会话切换。聊天窗口头部加"新对话"按钮（+ 图标），点击后清空当前消息、生成新 conversationId。同时加会话切换：头部显示当前对话标题，点击展开历史对话列表（从 GET /api/ai/conversations 加载）。— **Reversibility:** reversible — 去掉按钮和列表组件即可

### 遗留项
- **D-391:** chat_conversations 加 userId 字段（integer, nullable）。匿名访客的对话 userId=null，登录用户的对话 userId=DB ID。需要 Drizzle migration。对话管理页可按用户筛选。未来可扩展为登录才能聊天。— **Reversibility:** one-way — migration 加列容易，删列需新 migration
- **D-392:** System prompt 可配置。后台"AI 对话"卡片加 system_prompt 配置字段（ai_chat_system_prompt），默认值为当前硬编码的中文提示词。ChatService.chat() 从 settings 读取，不传则用默认。— **Reversibility:** reversible — 去掉 settings 读取改回硬编码即可
- **D-393:** Phase 16 Wave 3 验收纳入 Phase 19。作为 Phase 19 的一个验收任务：1) 前台 AI 摘要打字机展示在迁移后仍正常，2) admin AiModelsForm round-trip 保存/读取，3) legacy fallback（旧 ai_summary_* 配置自动兼容），4) 公钥安全（api_key 不在 PUBLIC_SETTING_KEYS 中暴露）。— **Reversibility:** N/A — 验收任务

### Claude's Discretion
- 摘要生成的具体实现（generateText 参数、prompt 模板）——planner 决定
- prepareStep 回调的具体实现方式——AI SDK 7 的 onStepFinish / prepareStep API，planner 查 context7 确认
- consumeStream 的具体调用位置——在 chat.service.ts 的 chat() 方法中，planner 决定
- 对话管理页的具体 UI 布局（表格 vs 卡片列表）——参考现有 admin 页面模式
- 建议问题的默认值（3 条中文博客相关问题）——planner 决定
- 会话切换的 UI 形式（下拉 vs 侧边栏 vs 弹出面板）——planner 根据空间约束决定
- 断线重试的具体实现（重新发送最后消息 vs 重新加载整个对话）——planner 决定
- /admin/ai-chat 页面的路由注册方式——参考现有 admin 路由模式
- ChatHistoryService 新增 listConversations / getConversationMessages / deleteConversation 方法的签名——planner 决定
- userId 字段在 ChatService.chat() 中的传递方式（从 request 对象提取 vs 前端传参）——planner 决定

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 架构设计文档（最重要——接口定义、目录结构、模块依赖都来自这里）
- `.planning/ai-assistant-architecture.md` — AI 助手完整架构设计。包含：ChatService 接口定义、目录结构、模块依赖关系图、streamText 用法、tool() 转换、onFinish 持久化、CORS 流式头、11 个风险点。**planner 必须严格遵循此文档的目录结构和接口签名。**

### 路线图与状态
- `.planning/ROADMAP.md` §Phase 19 — phase 定义、key deliverables、AI-06/AI-07 需求 ID
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-393），M5 AI Features milestone 状态

### Phase 18 Context（前置 phase 的决策和代码）
- `.planning/phases/18-streaming-chat-endpoint/18-CONTEXT.md` — Phase 18 的所有决策（D-360 到 D-376），包括 ChatService、AiChatController、前端聊天组件、流式协议

### Phase 16 Context（AI 基础设施 + 验收遗留）
- `.planning/phases/16-ai-model-router-summary-migration/16-CONTEXT.md` — Phase 16 的所有决策（D-330 到 D-340），包括 ai_profiles、ModelResolver、AiModelsForm、legacy fallback

### 现有 AI 代码（Phase 19 要在此基础上修改/扩展）
- `server/src/ai/chat.service.ts` — ChatService.chat()：streamText + tools + onFinish 持久化。Phase 19 加 prepareStep 压缩 + onStepFinish token 记录 + consumeStream 保护 + system prompt 从 settings 读取
- `server/src/ai/ai-chat.controller.ts` — POST /api/ai/chat，@Public() + @Res() + pipeUIMessageStreamToResponse。Phase 19 加对话历史端点
- `server/src/ai/chat-history.service.ts` — ChatHistoryService CRUD。Phase 19 加 listConversations / getConversationMessages / deleteConversation
- `server/src/ai/chat.schema.ts` — chat_conversations + chat_messages Drizzle 表。Phase 19 加 userId 字段
- `server/src/ai/ai.module.ts` — AiModule 装配。Phase 19 可能需更新
- `server/src/ai/tools/tool-bridge.ts` — ToolDef → AI SDK tool() 转换器
- `server/src/ai/tools/article-tools.ts` — articleTools ToolDef[]
- `server/src/ai/model/model-resolver.service.ts` — ModelResolver.resolve(profileId?)
- `server/src/ai/domain-error.ts` — DomainError 类

### 前端聊天组件（Phase 19 要打磨）
- `frontend/src/components/chat/ChatWidget.tsx` — 浮动按钮
- `frontend/src/components/chat/ChatWindow.tsx` — 对话窗口（useChat + DefaultChatTransport）。Phase 19 加欢迎语/建议问题/断线重连/新对话/会话切换/conversationId 恢复
- `frontend/src/components/chat/MessageList.tsx` — 消息列表
- `frontend/src/components/chat/ChatInput.tsx` — 输入框
- `frontend/src/components/chat/ToolResultCard.tsx` — 工具结果卡片

### 前端后台 AI 设置（Phase 19 要扩展）
- `frontend/src/components/admin/settings/AiModelsForm.tsx` — AI 模型管理表单。Phase 19 加 purposes 'chat' 勾选
- `frontend/src/components/admin/settings/AiPlaceholderForm.tsx` — 占位卡片。Phase 19 替换为 AiChatForm
- `frontend/src/app/admin/settings/_config/settings-nav.ts` — AI 功能导航分组
- `frontend/src/app/admin/settings/_config/settings-forms.ts` — 表单注册
- `frontend/src/app/admin/settings/_config/setting-descriptors.ts` — category/key 映射
- `frontend/src/lib/settings/ai-profile.ts` — 共享 AiProfile 类型
- `frontend/src/lib/api/ai.ts` — 前端 AI API 客户端

### 前端 AI 摘要（Phase 16 Wave 3 验收目标）
- `frontend/src/components/post/ArticleLeadSummary.tsx` — 前台打字机摘要组件
- `frontend/src/components/admin/article-editor/EditorSidebar.tsx` — 编辑器 AI 生成按钮

### 项目约束
- `.claude/CLAUDE.md` — 项目核心约束：API 兼容性是核心底线，技术栈 NestJS + Drizzle + SQLite
- `~/CLAUDE.md` — CodeGraph MCP 使用指南 + Karpathy 简洁原则

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ChatService.chat()** — 已实现 streamText + tools + onFinish 持久化，Phase 19 在此基础上加 prepareStep / onStepFinish / consumeStream
- **ChatHistoryService** — createConversation / appendMessage / getMessages / truncateHistory，Phase 19 扩展 listConversations / getConversationMessages / deleteConversation
- **ModelResolver.resolve(profileId?)** — 返回 AI SDK LanguageModel
- **articleTools ToolDef[]** — search_articles + get_article
- **AiModelsForm** — 多 profile 管理表单，Phase 19 加 'chat' purposes 勾选
- **AiPlaceholderForm** — 占位卡片，Phase 19 替换为 AiChatForm
- **settings 三处注册** — setting-descriptors.ts + settings-nav.ts + settings-forms.ts
- **DomainError** — 错误包装类
- **decodePublicID + EntityType** — Sqids 编解码
- **@Public() 装饰器** — 公开路由标记
- **ThrottlerGuard** — 全局限流

### Established Patterns
- NestJS 模块：`@Module({ imports, controllers, providers, exports })` + DI 注入
- Controller：`@Controller('ai')` + `@UseGuards()` + `@HttpCode()`
- @Res() 用法：bypass ResponseInterceptor，手动设 headers + send
- 全局响应拦截器：`{ code, data, message }` 格式（D-04）
- AI SDK streamText 参数格式：model + instructions + messages + tools + stopWhen + toolChoice + abortSignal + onError + onFinish
- 前端 settings 三处注册：setting-descriptors.ts + settings-nav.ts + settings-forms.ts
- 前端 admin 页面路由：`frontend/src/app/admin/*/page.tsx`
- Drizzle schema：integer PK + text + timestamps 模式
- Schema 注册：新 schema 变更加到 `server/src/database/schemas/index.ts` re-export

### Integration Points
- `AiModule` 已在 app.module.ts 注册，Phase 19 更新 AiModule 加新 controller 端点
- `POST /api/ai/chat` 已实现，Phase 19 不改路径，只加 consumeStream / prepareStep / onStepFinish
- 新增端点：GET /api/ai/conversations + GET /api/ai/conversations/:id/messages + DELETE /api/ai/conversations/:id
- chat_conversations 表需加 userId 字段（Drizzle migration）
- 前端 ChatWindow 需改 useChat 配置（加 conversationId 恢复 + initialMessages）
- 前端 settings-nav.ts 的 "AI 对话" 子项已有占位（AiPlaceholderForm），Phase 19 替换为 AiChatForm
- 前端需新增 /admin/ai-chat 对话管理页
- AiModelsForm 的 purposes 勾选需加 'chat' 选项
- ChatService.chat() 需从 settings 读 ai_chat_system_prompt 替代硬编码 SYSTEM_PROMPT

</code_context>

<specifics>
## Specific Ideas

- prepareStep 压缩逻辑（基于 D-380/D-381）：
  ```typescript
  // 在 streamText 调用前，检查消息数是否超过阈值
  const MAX_MESSAGES = 20;
  const KEEP_RECENT = 10;
  let compressedMessages = messages;
  if (messages.length > MAX_MESSAGES) {
    // 保留 system prompt + 最近 KEEP_RECENT 条 + 1 条摘要替代旧消息
    const oldMessages = messages.slice(0, messages.length - KEEP_RECENT);
    const recentMessages = messages.slice(messages.length - KEEP_RECENT);
    const summary = await generateSummary(oldMessages); // LLM 生成摘要
    compressedMessages = [
      { role: 'system', content: `之前的对话摘要：${summary}` },
      ...recentMessages,
    ];
  }
  ```

- onStepFinish token 记录（基于 D-382）：
  ```typescript
  // streamText 的 onStepFinish 回调
  onStepFinish: async ({ usage }) => {
    // 记录每步的 token 用量（累加到当前步骤的消息记录）
    stepInputTokens += usage.promptTokens ?? 0;
    stepOutputTokens += usage.completionTokens ?? 0;
  },
  // onFinish 中写入 chat_messages 的 input_tokens / output_tokens
  ```

- consumeStream 保护（基于 D-383）：
  ```typescript
  // 在 chat() 方法中，流返回前 consumeStream
  const result = streamText({ ... });
  const stream = toUIMessageStream({ stream: result.stream });
  // consumeStream 确保即使客户端断连，流也被完整消费
  result.text.then(() => {
    this.logger.debug(`Stream fully consumed for conversation ${conversationId}`);
  });
  return stream as unknown as ReadableStream<Uint8Array>;
  ```

- chat_conversations.userId 字段（基于 D-391）：
  ```typescript
  // Drizzle schema 变更
  userId: integer('user_id'),  // nullable, anonymous=null, logged-in=DB ID
  ```

- System prompt 从 settings 读取（基于 D-392）：
  ```typescript
  const systemPrompt = this.settings.get('ai_chat_system_prompt')
    || '你是博客站的 AI 助手，可以搜索和阅读博客文章来回答用户问题。请用中文回答。';
  ```

- "AI 对话"卡片配置字段（基于 D-386）：
  - ai_chat_profile_id: 选哪个 profile 用于对话（下拉，从 purposes 含 chat 的 profiles 中选）
  - ai_chat_welcome_message: 欢迎语（默认"你好！我是博客 AI 助手，有什么可以帮你？"）
  - ai_chat_suggested_questions: 建议问题（JSON 数组，默认 3 条）
  - ai_chat_system_prompt: system prompt（默认中文提示词）

- 对话历史端点（基于 D-385/D-387）：
  ```typescript
  // GET /api/ai/conversations?page=1&pageSize=20
  // 需 JwtAuthGuard + AdminGuard
  // 返回 { list: ConversationDto[], total, page, page_size }

  // GET /api/ai/conversations/:id/messages
  // 需 JwtAuthGuard + AdminGuard（管理员查看）或 @Public()（前端恢复自己的对话）
  // 返回 StoredMessage[]

  // DELETE /api/ai/conversations/:id
  // 需 JwtAuthGuard + AdminGuard
  ```

- 前端 conversationId 恢复（基于 D-385）：
  ```typescript
  // ChatWindow 中
  const [conversationId, setConversationId] = useState<string | null>(
    () => localStorage.getItem('ai_chat_conversation_id')
  );
  const [initialMessages, setInitialMessages] = useState([]);

  useEffect(() => {
    if (conversationId) {
      fetch(`/api/ai/conversations/${conversationId}/messages`)
        .then(res => res.json())
        .then(data => setInitialMessages(data.data))
        .catch(() => localStorage.removeItem('ai_chat_conversation_id'));
    }
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { conversationId },
    }),
    initialMessages,
  });
  ```

</specifics>

<deferred>
## Deferred Ideas
- LangGraph adapter——YAGNI
- AI 写作功能——未来阶段
- 登录才能聊天的认证策略——未来按需改 @Public() 为 JwtAuthGuard
- 匿名 + 登录分级限流——未来按需实现
- conversation 级别 token 用量累加——未来按需加字段
- 自动重连（指数退避）——未来按需实现
- 501 端点功能实现（11 个）——未来按需
- 主题/SSR-theme 端点（20 个）——未来阶段
- PRO 功能——未来阶段

</deferred>

---

*Phase: 19-Chat Hardening & Frontend Integration*
*Context gathered: 2026-07-28*
