# Phase 17: AI Tools & Chat History Storage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 17-AI Tools & Chat History Storage
**Areas discussed:** Tool execution context, Tool return content depth, Chat message parts storage, History truncation strategy

---

## Tool Execution Context

| Option | Description | Selected |
|--------|-------------|----------|
| Service context | ToolContext 改为 { searchService, articleService } + 通用 services 字典。工具 execute 直接调 service 方法。更干净，但偏离架构文档 { db, settings } 定义。 | |
| Raw context (per arch doc) | 严格按架构文档 { db, settings }。但 search_articles 的 execute 需要自己调 FTS5 raw SQL——违反"工具只调 domain service"设计原则。 | |
| Hybrid with getService() | ToolContext 保留 { db, settings } 作为基础，加 getService<T>(token) 方法从 NestJS DI 容器拉取服务。更灵活但更复杂。 | ✓ |

**User's choice:** Hybrid with getService()
**Notes:** Follow-up clarified the getService interface form — chose `Interface with getService<T>(token: string): T` over `Plain services dict`. Interface defined in framework-agnostic `tools/tool-def.ts`, NestJS implementation uses ModuleRef.

---

## Tool Return Content Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated + metadata | get_article 返回标题 + 截断正文（3000 字符）+ URL。search_articles 返回标题 + snippet + URL。LLM 拿到足够信息，不够可再调 get_article。 | ✓ |
| Full content | get_article 返回完整 contentHtml。给 LLM 最大信息量，但长文章消耗大量 token，且 HTML 标签噪音大。 | |
| Plain text only | 两个工具都只返回纯文本（stripHtml）。更干净但丢失格式信息（代码块、链接等）。 | |

**User's choice:** Truncated + metadata
**Notes:** Follow-up clarified truncation length — chose 3000 chars over 5000 or 1500+chunking. Uses stripHtml then truncate. search_articles default limit 5 (per architecture doc).

---

## Chat Message Parts Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Opaque JSON | parts 列存任意 JSON。Phase 17 不定义 ChatMessagePart 类型，等 Phase 18 有真实数据再定义。 | |
| Typed parts now | 在 chat.schema.ts 旁定义 ChatMessagePart 联合类型（text/tool_call/tool_result），parts 列存 ChatMessagePart[]。更类型安全。 | ✓ |

**User's choice:** Typed parts now
**Notes:** Follow-up clarified part variants — chose 3-part union (text + tool_call + tool_result) over 2-part (text + tool_call only). Phase 18 can extend with reasoning/source.

---

## History Truncation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hard delete old | truncateHistory 直接删除超过 keepLast 的旧消息。简单直接。keepLast 由 Phase 19 的 prepareStep 决定。 | ✓ |
| Keep all, read-window only | 保留全部消息，getMessages(keepLast) 只返回最近 N 条。db 会增长。 | |
| Soft archive old | 旧消息加 archived 标记，可恢复。但加字段复杂度高。 | |

**User's choice:** Hard delete old
**Notes:** keepLast parameter is explicit (no default in Phase 17). Phase 19's prepareStep will determine the actual value when calling truncateHistory. Personal blog scenario — no need for recovery of deleted messages.

---

## Claude's Discretion

- ToolContext 的 db 和 settings 字段是否保留（getService 已能取到）——保留更灵活
- getService token 格式——用 class name string
- chat_conversations.publicId 的 Sqids EntityType 编号——planner 分配
- ChatHistoryService 是否需要 listConversations 方法——planner 按需加
- Drizzle migration 文件名——遵循现有命名规范

## Deferred Ideas

- chat.service.ts / ChatService 流式对话——Phase 18
- ai-chat.controller.ts / POST /api/ai/chat——Phase 18
- ToolDef → AI SDK tool() 转换器——Phase 18
- prepareStep 运行时上下文压缩——Phase 19
- 前端聊天组件——Phase 18
- 后台 ai_profiles 管理表单完善——Phase 19
- LangGraph adapter——YAGNI
- chat_conversations.userId——Phase 19 按需加
- reasoning/source ChatMessagePart——Phase 18/19 按需扩展
