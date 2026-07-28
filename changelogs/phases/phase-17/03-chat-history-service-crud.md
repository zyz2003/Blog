# Phase 17 - 对话历史 CRUD 服务：ChatHistoryService + AiModule 接线

> **归属**: Phase 17 (AI Tools & Chat History Storage)
> **状态**: ✅ 已完成
> **对应需求**: AI-04
> **提交**: fbd294b (RED), c3df744 (GREEN), 4c631f2 (REFACTOR), ee1d865 (docs)

## 目标

构建框架无关的 ChatHistoryService — 对话持久化的纯 DB CRUD 层。管理对话（create、list）和消息（append、get、truncate），使用 Drizzle 查询 Plan 02 的 chat_conversations/chat_messages 表。注册到 AiModule 供 Phase 18 ChatService 注入。**零 AI 库导入** — 迁移保护资产。

## 新增文件

### `server/src/ai/chat-history.service.ts` — 对话历史 CRUD 服务

**导出接口：**

```typescript
export interface StoredMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  parts?: ChatMessagePart[];
  inputTokens?: number;
  outputTokens?: number;
  createdAt: Date;
}

export interface StoredConversation {
  publicId: string;
  title: string | null;
  profileId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**5 个方法：**

| 方法 | 签名 | 说明 |
|------|------|------|
| createConversation | `(title?: string, profileId?: string) => Promise<string>` | 插入 chat_conversations，生成 Sqids publicId（EntityType.ChatConversation=23），返回 publicId |
| appendMessage | `(conversationPublicId: string, msg: Omit<StoredMessage, 'createdAt'>) => Promise<void>` | 解码 publicId 获取 DB id，插入 chat_messages |
| getMessages | `(conversationPublicId: string) => Promise<StoredMessage[]>` | 按 createdAt 升序返回消息，parts 已由 Drizzle mode:'json' 自动解析 |
| truncateHistory | `(conversationPublicId: string, keepLast: number) => Promise<void>` | 按 D-353 硬删除旧消息，保留最后 keepLast 条 |
| listConversations | `() => Promise<StoredConversation[]>` | 按 updatedAt 降序返回所有对话 |

**truncateHistory 实现（D-353 硬删除策略）：**
1. 解码 publicId 获取 conversation DB id
2. 查询保留的消息 id（ORDER BY created_at DESC LIMIT keepLast）
3. 删除该对话中 id 不在保留集合中的消息
4. keepLast=0 删除全部；keepLast >= 消息总数则不删除

**导入情况：** 仅 Drizzle ORM + sqids 工具 + chat schema — **零 AI 库导入**

### `server/src/ai/chat-history.service.spec.ts` — 15 个单元测试

覆盖：
- @Injectable() 装饰器验证
- createConversation 插入 + generatePublicID 调用（EntityType.ChatConversation=23）
- appendMessage 解码 publicId + 插入消息
- getMessages 按 createdAt 升序 + parts JSON 映射 + 空对话返回 []
- truncateHistory 三种场景（keepLast=0 全删、keepLast=3 保留最新、keepLast>=总数不删）
- listConversations 按 updatedAt 降序
- 零 AI 库导入断言
- 使用 chainable mock + thenable chain nodes 模式避免 NestJS DI 的 thenable 陷阱

## 修改文件

### `server/src/ai/ai.module.ts`

```diff
+import { ChatHistoryService } from './chat-history.service';

 @Module({
   imports: [DatabaseModule, SettingsModule, SearchModule, ArticleModule],
   controllers: [AiSummaryController],
   providers: [
     ModelResolver,
+    ChatHistoryService,
     { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
   ],
-  exports: ['ARTICLE_AI_PORT'],
+  exports: ['ARTICLE_AI_PORT', ChatHistoryService],
 })
```

Phase 18 ChatService 可通过 `@Inject(ChatHistoryService)` 注入。

### `server/src/common/utils/sqids.util.ts`

```diff
 export const EntityType = {
   ...,
   Link: 22,
+  ChatConversation: 23,
 } as const;
```

新增 EntityType.ChatConversation = 23，用于 chat_conversations.publicId 的 Sqids 编码。

## 关键决策

| 决策 | 理由 |
|------|------|
| D-353: truncateHistory 硬删除 | 简单直接，个人博客场景不需要恢复已删历史 |
| EntityType.ChatConversation = 23 | 紧接 Link=22 之后的下一个可用值，遵循 Go 兼容的 iota 模式 |
| keepLast 显式传入，无默认值 | Phase 19 的 prepareStep 决定截断值，Phase 17 不预设 |
| chainable mock + thenable nodes | 避免 NestJS DI 将带 .then 的对象当作 Promise 解析的 thenable 陷阱 |

## 验证

- `npx vitest run src/ai/chat-history.service.spec.ts` — 15/15 pass
- `npx nest build` — 编译通过
- 框架独立性：`grep -E "^import.*from 'ai'|@ai-sdk" src/ai/chat-history.service.ts` 返回空

## 不做的事

- 不做对话删除（deleteConversation）— Phase 18/19 按需加
- 不做消息搜索/过滤 — YAGNI
- 不做 token 用量统计聚合 — Phase 19
