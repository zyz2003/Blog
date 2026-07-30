# Phase 19 - 前端聊天打磨：欢迎消息 + 断连提示 + 会话切换 + conversationId 恢复 + AiChatForm

> **归属**: Phase 19 (Chat Hardening & Frontend Integration) Plan 02
> **状态**: ✅ 已完成
> **对应需求**: AI-07
> **提交**: 78911f0

## 目标

让聊天组件生产就绪：欢迎消息 + 建议按钮、断连提示 + 手动重试、新对话按钮、会话切换历史、conversationId localStorage 持久化 + 刷新恢复。用真正的 AiChatForm 替换占位表单。所有变更对应 D-385、D-386、D-388、D-389、D-390。

## 新增文件

### `frontend/src/components/chat/WelcomeMessage.tsx` - 欢迎消息 + 建议按钮

- Props: `{ welcomeMessage, suggestions, onSuggestionClick }`
- 渲染：欢迎语文本 + 建议按钮行（圆角药丸样式，中性背景）
- 点击建议调用 `onSuggestionClick(text)` -> `sendMessage({ text })`

### `frontend/src/components/chat/DisconnectBar.tsx` - 断连提示条

- Props: `{ visible, onRetry }`
- 红色调条，显示"连接中断，点击重试" + RefreshCw 图标重试按钮
- 父组件根据 `error` 或 `status === 'error'` 控制 visible

### `frontend/src/components/chat/SessionSwitcher.tsx` - 会话切换下拉

- Props: `{ currentConversationId, conversations, onSelect, onNew, isLoading }`
- 点击标题旁的 ChevronDown 触发弹出面板
- 列出最近会话（标题 + 相对时间"3 分钟前"）+ 顶部"新对话"按钮
- 外部点击关闭（useEffect + mousedown 监听）
- 加载/空状态处理

### `frontend/src/components/admin/settings/AiChatForm.tsx` - 真正的 AI 聊天设置表单

- 替换 AiPlaceholderForm（D-386）
- 对话模型下拉：过滤 `purposes.chat === true && enabled` 的 profiles
- 欢迎语输入、推荐问题 JSON 编辑器、System Prompt 文本区
- 复用 FormInput / FormSelect / FormCodeEditor / SettingsSection 组件
- 从 `values[KEY_AI_PROFILES]` 解析 profiles（同 AiModelsForm 模式）

### `frontend/src/lib/api/ai.ts` - 会话 API 客户端

- `conversationApi.fetchConversations(page, pageSize)` - GET /api/ai/conversations
- `conversationApi.fetchConversationMessages(id)` - GET /api/ai/conversations/:id/messages
- `conversationApi.deleteConversation(id)` - DELETE /api/ai/conversations/:id
- `fetchChatSettings()` - 公开设置端点获取欢迎语 + 推荐问题
- 类型：`ConversationItem`、`StoredMessage`、`ChatSettings`

## 修改文件

### `frontend/src/components/chat/ChatWindow.tsx` - 集成全部新功能

```typescript
// D-385: conversationId localStorage 持久化
const [conversationId, setConversationId] = useState<string | null>(() =>
  localStorage.getItem(CONVERSATION_ID_KEY));

// useChat 带 conversationId body + initialMessages
const { messages, sendMessage, status, error, setMessages } = useChat({
  id: chatKey,
  transport: new DefaultChatTransport({
    api: "/api/ai/chat",
    body: conversationId ? { conversationId } : {},
  }),
  messages: initialMessages,
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

- **conversationId 恢复**: 挂载时若 localStorage 有 ID，调用 `fetchConversationMessages` 加载历史 -> `storedToUIMessages` 转换 -> `initialMessages`
- **新对话按钮**: + 图标，清 conversationId + localStorage + initialMessages + setMessages([])
- **会话切换**: 标题点击展开 SessionSwitcher，选择后重载消息
- **断连重试**: DisconnectBar 显示时，重发最后一条用户消息
- **conversationId 解析**: 发送首条消息后若无 conversationId，调 `fetchConversations(1,1)` 取最新会话 ID 存入 localStorage
- **welcome 显示条件**: `messages.length === 0 && !isLoading`
- `storedToUIMessages`: 后端 StoredMessage[] -> UIMessage[]（parts 优先，否则 text part）

### `frontend/src/lib/settings/setting-keys.ts` - 4 个新 AI chat 键

- `KEY_AI_CHAT_PROFILE_ID = 'ai_chat_profile_id'`
- `KEY_AI_CHAT_WELCOME_MESSAGE = 'ai_chat_welcome_message'`
- `KEY_AI_CHAT_SUGGESTED_QUESTIONS = 'ai_chat_suggested_questions'`
- `KEY_AI_CHAT_SYSTEM_PROMPT = 'ai_chat_system_prompt'`
- 注：用 `ai_chat_` 前缀（D-386），与遗留的 `KEY_AI_ASSISTANT_WELCOME` 区分

### `frontend/src/lib/settings/setting-descriptors.ts` - 填充 ai-chat 分类

- 4 个描述符（profile_id / welcome_message / suggested_questions / system_prompt）
- 默认值：欢迎语、推荐问题 JSON 数组、系统提示
- `KEY_AI_CHAT_SYSTEM_PROMPT` 加入 `EMPTY_STRING_DEFAULT_KEYS`（空值显示默认）

### `frontend/src/app/admin/settings/_config/settings-forms.ts` - 替换表单

- `ai-chat` 入口从 `AiPlaceholderForm` 换成 `AiChatForm`
- `ai-writing` 仍用 AiPlaceholderForm（不在 Phase 19 范围）

## 关键决策

| 决策 | 理由 |
|------|------|
| D-385: conversationId localStorage 持久化 | 刷新后恢复会话历史 |
| D-386: ai_chat_ 前缀新键 | 与遗留 ai_assistant_ 键区分 |
| D-388: 欢迎消息 + 建议按钮 | 空对话时引导用户 |
| D-389: 断连提示 + 重试 | 连接中断可观测 + 手动恢复 |
| D-390: 会话切换 + 新对话 | 多会话管理 |
| conversationId 解析用 fetchConversations(1,1) | AI SDK useChat 不暴露 server-set ID，取最新会话兜底 |

## 遗留差异

- conversationId 解析存在轻微竞态：首条消息后取最新会话，若服务器慢或多用户同时聊天可能取错会话。单人博客场景风险低。更好的方案是流响应携带 conversationId（后续优化）。
- 加载历史的 useEffect 用空依赖数组 + eslint-disable（有意仅挂载时运行）。

## 测试

- 前端 TypeScript 检查通过（仅 1 个无关的 poster-generator 预存错误）
- 后端 136 个 AI 测试仍全通过
- 无新增 npm 包
