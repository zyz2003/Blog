# Phase 17 - 对话历史数据库 Schema：Drizzle 表 + ChatMessagePart 类型

> **归属**: Phase 17 (AI Tools & Chat History Storage)
> **状态**: ✅ 已完成
> **对应需求**: AI-04
> **提交**: e6bec7c (RED), 1cf4b74 (GREEN), 9be030d (docs)

## 目标

定义对话历史存储的 Drizzle schema（chat_conversations + chat_messages 表）和 ChatMessagePart 联合类型。**纯 DB schema 文件，零 AI 库导入** — 框架无关的迁移保护资产。注册到 schemas/index.ts 供 drizzle-kit 生成 migration。

## 新增文件

### `server/src/ai/chat.schema.ts` — 对话历史表定义

**chatConversations 表：**

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | integer | PK autoIncrement | 自增主键 |
| public_id | text | unique | Sqids 编码的公开 ID |
| title | text | — | 对话标题 |
| profile_id | text | — | AI profile 关联 |
| created_at | integer | default unixepoch | 创建时间 |
| updated_at | integer | default unixepoch | 更新时间 |

**chatMessages 表：**

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | integer | PK autoIncrement | 自增主键 |
| conversation_id | integer | notNull | 所属对话 FK |
| role | text | notNull | user / assistant / system / tool |
| content | text | — | 消息文本内容 |
| parts | text | mode: json | ChatMessagePart[] 结构化 parts |
| input_tokens | integer | — | 输入 token 计数 |
| output_tokens | integer | — | 输出 token 计数 |
| created_at | integer | default unixepoch | 创建时间 |

**ChatMessagePart 联合类型（D-352）：**

```typescript
export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_result'; toolCallId: string; result: unknown };
```

- 纯 TypeScript 判别联合类型，不做运行时验证
- 运行时验证由 ChatHistoryService 读取时负责
- 3 种变体覆盖 AI SDK UIMessage 的核心 parts

**导入情况：** 仅 `drizzle-orm/sqlite-core` 和 `drizzle-orm` — **零 AI 库导入**

### `server/src/ai/chat.schema.spec.ts` — 22 个单元测试

覆盖：
- chatConversations/chatMessages 导出和列定义
- ChatMessagePart 类型断言（3 种变体可赋值）
- 零 AI 库导入断言
- schemas/index.ts 重导出验证

## 修改文件

### `server/src/database/schemas/index.ts`

```diff
+export { chatConversations, chatMessages } from '../../ai/chat.schema';
```

虽然 chat.schema.ts 在 `ai/` 目录下（与 AI 模块同位），但通过 re-export 让 drizzle-kit 能发现新表生成 migration。

## 关键决策

| 决策 | 理由 |
|------|------|
| D-352: ChatMessagePart 为联合类型而非 Zod schema | 仅做类型检查，运行时验证是 ChatHistoryService 的责任 |
| parts 列用 `text mode:'json'` | 灵活存储 ChatMessagePart[]，Drizzle 参数化查询防 SQL 注入 |
| schema 文件在 `ai/` 而非 `schemas/` | 框架无关资产与 AI 模块同位，re-export 到 schemas/index.ts |

## 不做的事

- 不做 drizzle-kit migration 生成（需运行 `npx drizzle-kit generate`，由 Phase 18 执行）
- 不做 ChatHistoryService（Plan 03）
- 不加 reasoning / source 等 ChatMessagePart 变体（Phase 18/19 按需扩展）
