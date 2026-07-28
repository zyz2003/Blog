# Phase 18 - 前端聊天组件：ChatWidget + ChatWindow + useChat 流式渲染

> **归属**: Phase 18 (Streaming Chat Endpoint) Plan 02
> **状态**: ✅ 已完成
> **对应需求**: AI-05F
> **提交**: cfd4814, a92201b

## 目标

构建前端聊天组件：浮动按钮 + ChatWindow 流式渲染 + 工具加载态 + 文章卡片 + 响应式布局。消费 Plan 01 的 POST /api/ai/chat SSE 端点。

## 新增文件

### `frontend/src/components/chat/ChatWidget.tsx` — 浮动聊天按钮

- 底部右侧固定按钮 (z-50)，点击切换 ChatWindow 可见性
- Bot/X 图标切换，aria-label 无障碍支持
- 深色模式适配

### `frontend/src/components/chat/ChatWindow.tsx` — 聊天窗口

```typescript
const { messages, sendMessage, status, error } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/ai/chat",
    // 不传 conversationId — 后端创建 Sqids ID (D-373)
  }),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

- AI SDK 7 useChat API：`sendMessage({ text })` + `status`（非已废弃的 handleSubmit/isLoading）
- **D-373**: 不发送 conversationId — 前端生成的 UUID 会崩溃后端 decodePublicID
- 自动滚动到底部（messages 变化时）
- 响应式：380x580 桌面 / 全屏 <640px
- 错误显示条 + ChatInput 组件

### `frontend/src/components/chat/MessageList.tsx` — 消息列表

- UIMessage[] 渲染：用户消息右对齐，助手消息左对齐
- 工具部分按 `tool-{toolName}` 类型化渲染（AI SDK 7）
- 工具加载态：spinner + "正在搜索文章..." / "正在获取文章..."
- 流式光标：最后一条助手消息末尾闪烁 `|`
- 空状态提示："发送消息开始对话"

### `frontend/src/components/chat/ToolResultCard.tsx` — 工具结果卡片

- search_articles → 文章列表卡片（标题 + 摘要 + 链接）
- get_article → 单篇文章卡片（标题 + 内容预览 + 链接）
- 未知工具 → fallback 显示 "工具结果"

### `frontend/src/components/chat/ChatInput.tsx` — 输入框

- 文本输入 + 发送按钮
- 加载时禁用，空输入时禁用发送
- form onSubmit 阻止默认行为

### `frontend/src/components/chat/index.ts` — Re-export

## 修改文件

### `frontend/package.json`

新增 `@ai-sdk/react@4.0.40` — 与 `ai@7` 配套使用（D-368：独立版本号）。

### `frontend/src/app/layout.tsx`

在 Providers 中挂载 ChatWidget — 所有页面可见。

## 关键决策

| 决策 | 理由 |
|------|------|
| D-366: 380x580 桌面，<640px 全屏 | 兼顾桌面可用性和移动端体验 |
| D-367: 工具加载 spinner + 中文提示 | 用户知道 AI 正在搜索，而非卡死 |
| D-368: @ai-sdk/react@4 + ai@7 | 独立版本号，v4 对应 ai@7 |
| D-373: 不发送 conversationId | 前端 UUID → 后端 decodePublicID 崩溃 → 500；让后端创建 Sqids ID |

## AI SDK 7 API 变更（来自 Plan 预期差异）

| Plan 预期 | 实际 API | 变更原因 |
|-----------|----------|----------|
| handleSubmit / handleInputChange | sendMessage({ text }) + useState | AI SDK 7 移除旧 API |
| isLoading | status === 'submitted' \|\| 'streaming' | AI SDK 7 移除 isLoading |
| message.content fallback | 仅 parts 数组 | AI SDK 7 UIMessage 无 content 属性 |
| tool-call / tool-result 泛型 | tool-search_articles / tool-get_article 类型化 | AI SDK 7 类型化工具部分 |

## 不做的事

- 不做 Markdown 渲染（Phase 19 引入 react-markdown）
- 不做 conversationId 持久化/历史恢复（需后端 SSE 协议支持返回 server-generated ID）
- 不做智能滚动检测（当前每次 messages 变化自动滚底，Phase 19 优化）
