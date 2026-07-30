# Phase 19 - 后端聊天加固：上下文压缩 + Token 记录 + 断连保护 + 系统提示配置 + userId + 会话 CRUD

> **归属**: Phase 19 (Chat Hardening & Frontend Integration) Plan 01
> **状态**: ✅ 已完成
> **对应需求**: AI-06
> **提交**: aa9480b, a328a36

## 目标

生产加固聊天后端：长对话上下文压缩、按步 Token 记录、客户端断连保护、可配置系统提示、userId 字段、会话 CRUD 端点。所有变更对应 D-380 ~ D-384、D-391、D-392。

## 修改文件

### `server/src/ai/chat.schema.ts` - 新增 userId 字段

- chatConversations 表新增 `userId: integer('user_id')`（可空）
- **D-391**: 匿名=null，登录=DB ID；单向迁移（加列容易，删列需新迁移）
- Drizzle 迁移需在合并后执行 `npx drizzle-kit generate && npx drizzle-kit push`

### `server/src/ai/chat.service.ts` - 4 处加固

```typescript
// D-392: 系统提示从 settings 读取（调用时而非构造函数），运行时配置变更无需重启
const systemPrompt =
  (this.settings.get('ai_chat_system_prompt') as string | undefined) ||
  DEFAULT_SYSTEM_PROMPT;

// D-380/D-381: prepareStep 压缩 - messages.length > 20 时触发
prepareStep: async ({ messages: stepMessages }) => {
  if (stepMessages.length <= COMPRESSION_THRESHOLD) return undefined;
  // 保留 system 消息 + generateText 生成旧消息摘要 + 最近 KEEP_RECENT=10 条
  const { text: summary } = await generateText({ model, prompt: `请用中文简洁总结...${summaryText}` });
  return { messages: [systemMsg, { role: 'system', content: `之前的对话摘要：${summary}` }, ...recentMessages] };
},

// D-382: onStepFinish 累加 Token，onFinish 持久化累加值（非仅最后一步）
onStepFinish: ({ usage }) => {
  stepInputTokens += usage.inputTokens ?? 0;
  stepOutputTokens += usage.outputTokens ?? 0;
},
onFinish: async ({ text, steps }) => {
  await this.chatHistory.appendMessage(conversationId, {
    role: 'assistant', content: text ?? '',
    inputTokens: stepInputTokens || undefined,
    outputTokens: stepOutputTokens || undefined,
  });
},

// D-383: consumeStream 确保客户端断连时 onFinish 仍触发、assistant 消息仍持久化
result.consumeStream(); // fire-and-forget，不 await
```

- 常量：`COMPRESSION_THRESHOLD = 20`，`KEEP_RECENT = 10`
- 压缩失败时 `return undefined` 降级为不压缩（防御性）
- `chat()` options 新增 `userId?: number | null`，透传给 `createConversation`
- `extractModelMessageText` / `extractPartsFromSteps` 辅助函数处理 ModelMessage 内容与 step toolCalls/toolResults

### `server/src/ai/chat-history.service.ts` - 新增 3 个方法 + userId 透传

- `listConversationsPaged(page, pageSize): Promise<{ list, total }>` - 分页查询，`count()` 统计总数，`updatedAt DESC` 排序
- `getConversationMessages(publicId): Promise<StoredMessage[]>` - 复用 getMessages 逻辑的别名
- `deleteConversation(publicId): Promise<void>` - 先删 messages（FK），再删 conversation
- `createConversation` 新增可选 `userId` 参数并存储

### `server/src/ai/ai-chat.controller.ts` - 3 个新端点

```typescript
@UseGuards(JwtAuthGuard, AdminGuard)
@Get('conversations')            // 管理员：分页会话列表 { code, data: { list, total, page, page_size } }

@Public()
@Get('conversations/:id/messages') // 公开：会话消息恢复（D-385），Sqids 编码的 :id

@UseGuards(JwtAuthGuard, AdminGuard)
@Delete('conversations/:id')      // 管理员：删除会话
```

- **关键变更**: `@Public()` 从类级别移至方法级别 - 允许 admin 守卫的端点正常工作
- 分页参数 `pageSize` 夹紧至 `[1, 100]`，`page` 夹紧至 `>= 1`
- 导入 `JwtAuthGuard` + `AdminGuard`

### 测试文件（新增）

- `server/src/ai/chat.service.spec.ts` - 压缩逻辑、Token 累加、consumeStream、系统提示
- `server/src/ai/chat-history.service.spec.ts` - 分页、删除
- `server/src/ai/ai-chat.controller.spec.ts` - 新端点 + 认证守卫

## 关键决策

| 决策 | 理由 |
|------|------|
| D-380: 压缩阈值 20 条 | 长对话控制 Token 预算 |
| D-381: 保留最近 10 条 + 1 摘要 | 平衡上下文长度与连贯性 |
| D-382: onStepFinish 累加 Token | onFinish 中 `usage` 只反映最后一步，累加值才准确 |
| D-383: consumeStream fire-and-forget | 客户端断连不阻止 onFinish，assistant 消息仍持久化 |
| D-391: userId 可空整数 | 匿名=null，登录=DB ID；兼容匿名聊天 |
| D-392: 系统提示调用时读取 | 运行时配置变更无需重启 |
| D-385: GET messages 公开 | 前端刷新后会话恢复，Sqids ID 非顺序难猜测 |

## 安全考量

| 威胁 | 类别 | 缓解 |
|------|------|------|
| GET /messages 公开读取 | 信息泄露 | Sqids ID 非顺序，速率限制，个人博客可接受 |
| DELETE 会话 | 篡改 | AdminGuard + JwtAuthGuard 双重守卫 |
| 压缩 generateText | DoS | 仅 >20 条触发，同模型，个人博客规模 |

## 测试

- 全部 136 个 AI/chat 测试通过（27 新增 + 21 现有 + 其他 AI 模块）
- 无新增 npm 包 - `generateText` 和 `consumeStream` 已在 `ai` 包中
