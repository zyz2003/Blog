# Phase 18: Streaming Chat Endpoint - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 18-Streaming Chat Endpoint
**Areas discussed:** Chat 端点访问策略, ToolDef 转换与 ToolContext 注入, 前端聊天组件 UX, 流式错误处理与 @Res()

---

## Chat 端点访问策略

| Option | Description | Selected |
|--------|-------------|----------|
| 公开 + 严格限流 | @Public() + ThrottlerGuard 更严 TTL，匿名访客可聊天 | ✓ |
| 仅登录用户 | JwtAuthGuard 全局默认，聊天记录关联 userId | |
| 公开 + 每日配额 | @Public() + 每 IP 每日上限 50 次 | |

**User's choice:** 公开 + 严格限流

### 匿名访客历史策略

| Option | Description | Selected |
|--------|-------------|----------|
| 无历史，每次新对话 | 匿名用户每次刷新后历史消失 | |
| localStorage 保存会话 ID | 用 localStorage 存 conversationId，刷新可恢复 | |
| 完整历史（无 userId） | 浏览器指纹或 localStorage 做关联，不用 userId | ✓ |

**User's choice:** 完整历史（无 userId）

### 限流实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 ThrottlerGuard | 配更严 TTL（6s/请求），零额外代码 | ✓ |
| 自定义每 IP 每日配额 | Map 计数每 IP 每日请求数，需新代码 | |
| 两者叠加 | ThrottlerGuard 分钟级 + 自定义每日配额，双重保护 | |

**User's choice:** 复用 ThrottlerGuard

### 历史列表端点范围

| Option | Description | Selected |
|--------|-------------|----------|
| 新增历史查询端点 | GET /api/ai/conversations + GET /api/ai/conversations/:id/messages | |
| 只加载当前会话 | useChat initialMessages 加载当前 conversationId | |
| 历史列表交给 Phase 19 | Phase 18 只做单会话聊天 | ✓ |

**User's choice:** 历史列表交给 Phase 19

---

## ToolDef 转换与 ToolContext 注入

### ToolDef → AI SDK tool() 转换逻辑位置

| Option | Description | Selected |
|--------|-------------|----------|
| 内联在 chat.service.ts | 简单直接，但职责稍重 | |
| 独立 tool-bridge.ts | 职责清晰，框架特定代码与框架无关文件分离 | ✓ |
| 在 article-tools.ts 内 | 破坏框架无关设计原则 | |

**User's choice:** 独立 tool-bridge.ts

### ToolContext 注入时机

| Option | Description | Selected |
|--------|-------------|----------|
| ChatService 构造时创建 | db + settings + getService，所有 streamText 调用共用 | ✓ |
| 每个请求创建新 ToolContext | 可携带 request-scoped 信息，更灵活但更复杂 | |

**User's choice:** ChatService 构造时创建

### 工具调用循环上限

| Option | Description | Selected |
|--------|-------------|----------|
| 5 步 | stopWhen:stepCountIs(5)，架构文档推荐 | ✓ |
| 3 步 | 更保守，search + get_article 两步足够 | |
| 不限制 | 风险：无限循环消耗 API 额度 | |

**User's choice:** 5 步

---

## 前端聊天组件 UX

### 聊天窗口布局

| Option | Description | Selected |
|--------|-------------|----------|
| 固定右下角浮窗 | Intercom/Crisp 风格，桌面 380×580，移动端全屏 | ✓ |
| 模态框式 | 居中模态框，移动端全屏 | |
| 右侧滑入侧边栏 | 占 30% 屏宽，移动端需适配 | |

**User's choice:** 固定右下角浮窗

### 流式渲染与工具结果展示

| Option | Description | Selected |
|--------|-------------|----------|
| 打字机 + 内嵌工具结果 | token 打字机效果，工具调用结果为文章链接卡片 | ✓ |
| 简单文本追加 | 无打字机效果，工具调用只显示文字摘要 | |
| 打字机 + 折叠工具结果 | 工具调用为折叠面板，更紧凑但更复杂 | |

**User's choice:** 打字机 + 内嵌工具结果

### 前端 AI SDK 依赖

| Option | Description | Selected |
|--------|-------------|----------|
| ai@7 + @ai-sdk/react | useChat + DefaultChatTransport，官方方案 | ✓ |
| 原生 fetch + SSE | 零依赖但需自己解析 UIMessageStream 协议 | |

**User's choice:** ai@7 + @ai-sdk/react

---

## 流式错误处理与 @Res()

### 流前错误返回方式

| Option | Description | Selected |
|--------|-------------|----------|
| 流前同步校验 + 4xx JSON | 校验失败直接 res.status(4xx).json()，走正常 JSON 响应格式 | ✓ |
| 错误写入 SSE 流 | 依赖 onError 回调，前端需特殊处理错误帧 | |

**User's choice:** 流前同步校验 + 4xx JSON

### CORS 流式头

| Option | Description | Selected |
|--------|-------------|----------|
| 加两个流式头 | exposedHeaders 加 Cache-Control + X-Accel-Buffering | ✓ |
| 不改 CORS | next.config.ts rewrites 代理不是跨域 | |

**User's choice:** 加两个流式头

### 对话历史持久化策略

| Option | Description | Selected |
|--------|-------------|----------|
| onFinish 持久化助手消息 | 简单直接，但断连时 onFinish 可能不触发 | |
| consumeStream 后持久化 | 更安全但更复杂 | |
| Phase 18 onFinish, Phase 19 加 consumeStream | 分阶段实现 | ✓ |

**User's choice:** 你决定吧，遵循架构要求即可（Claude 选了 Phase 18 onFinish, Phase 19 加 consumeStream）

---

## Claude's Discretion

- 对话历史持久化策略：用户说"你决定吧，遵循架构要求即可"。Claude 选了 Phase 18 用 onFinish（简单版本），Phase 19 加 consumeStream 保护——符合架构文档风险点 #4 的分阶段建议。
- ChatService.chat() 的 system prompt 内容
- 打字机效果实现方式（复用 ArticleLeadSummary vs 新写）
- 浮动按钮样式
- conversationId 不存在时是否自动创建
- ThrottlerGuard 严格限流的具体 TTL 值
- tool-bridge.ts 的 Zod → AI SDK inputSchema 转换细节
- 前端聊天组件文件组织
- useChat body 参数传递方式
- 新会话创建时机

## Deferred Ideas

None — discussion stayed within phase scope
