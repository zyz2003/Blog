---
status: passed
phase: 17-ai-tools-chat-history-storage
verified: 2026-07-28
verifier: inline-orchestrator
requirements: [AI-03, AI-04]
---

## Must-Haves Verification

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | ToolDef interface is framework-agnostic — zero imports from 'ai' or '@ai-sdk/*' | ✅ PASS | `tool-def.ts` imports only `zod` and `SettingsService` type; grep of import lines confirms zero AI library imports |
| 2 | search_articles tool calls SearchService.search and returns { articles: [{title, snippet, url}] } | ✅ PASS | 19 unit tests in `article-tools.spec.ts` pass; execute delegates to `ctx.getService<SearchService>('SearchService')` |
| 3 | get_article tool calls ArticleService.getPublic and returns { title, content, url } with content truncated to 3000 chars | ✅ PASS | Tested in article-tools.spec.ts; uses `htmlToPlainText().slice(0, 3000)` per D-351 |
| 4 | article-tools.ts imports zero AI library packages | ✅ PASS | Import-line grep returns nothing; only type imports from domain services |
| 5 | AiModule imports SearchModule and ArticleModule so ToolContext.getService can resolve them | ✅ PASS | `ai.module.ts` line 13: `imports: [DatabaseModule, SettingsModule, SearchModule, ArticleModule]` |
| 6 | chat_conversations table has correct columns (id, publicId, title, profileId, createdAt, updatedAt) | ✅ PASS | `chat.schema.ts` defines `sqliteTable('chat_conversations', ...)` with all specified columns |
| 7 | chat_messages table has correct columns (id, conversationId, role, content, parts json, inputTokens, outputTokens, createdAt) | ✅ PASS | `chat.schema.ts` defines `sqliteTable('chat_messages', ...)` with `mode: 'json'` on parts |
| 8 | ChatMessagePart union type covers TextPart, ToolCallPart, ToolResultPart per D-352 | ✅ PASS | Type exported from `chat.schema.ts`; discriminated union with type field |
| 9 | chat.schema.ts has zero AI library imports | ✅ PASS | Import-line grep returns nothing |
| 10 | schemas/index.ts re-exports chatConversations and chatMessages | ✅ PASS | `export { chatConversations, chatMessages } from '../../ai/chat.schema'` present |
| 11 | ChatHistoryService.createConversation() returns publicId (Sqids-encoded with EntityType.ChatConversation=23) | ✅ PASS | `EntityType.ChatConversation: 23` in sqids.util.ts; service uses `generatePublicID` |
| 12 | ChatHistoryService.appendMessage() inserts row with role, content, parts, token counts | ✅ PASS | 14+ unit tests in `chat-history.service.spec.ts` pass |
| 13 | ChatHistoryService.getMessages() returns StoredMessage[] ordered by createdAt ascending | ✅ PASS | Tested in chat-history.service.spec.ts |
| 14 | ChatHistoryService.truncateHistory() hard-deletes messages older than keepLast per D-353 | ✅ PASS | Tested with keepLast=0, keepLast=3, keepLast>=count scenarios |
| 15 | ChatHistoryService has zero AI library imports | ✅ PASS | Import-line grep returns nothing |
| 16 | AiModule registers ChatHistoryService as provider and exports it | ✅ PASS | `ai.module.ts` line 17: provider, line 20: `exports: ['ARTICLE_AI_PORT', ChatHistoryService]` |

## Requirements Traceability

| Requirement | Plan | Status |
|-------------|------|--------|
| AI-03 (framework-agnostic tool definitions) | 17-01 | ✅ Delivered — ToolDef + article-tools with zero AI imports |
| AI-04 (persistent chat history storage) | 17-02, 17-03 | ✅ Delivered — chat.schema.ts + ChatHistoryService CRUD + truncation |

## Automated Checks

| Check | Result |
|-------|--------|
| `npx vitest run src/ai/tools/article-tools.spec.ts` | ✅ 19 tests pass |
| `npx vitest run src/ai/chat.schema.spec.ts` | ✅ 22 tests pass |
| `npx vitest run src/ai/chat-history.service.spec.ts` | ✅ 15 tests pass |
| `npx nest build` | ✅ Compiles without errors |
| Framework independence (import-line grep) | ✅ Zero AI library imports in tool-def.ts, article-tools.ts, chat.schema.ts, chat-history.service.ts |
| AiModule wiring | ✅ SearchModule + ArticleModule imported, ChatHistoryService in providers + exports |
| Schema index registration | ✅ chatConversations + chatMessages re-exported from schemas/index.ts |
| EntityType.ChatConversation = 23 | ✅ Added to sqids.util.ts |

## Human Verification

None required — all must-haves are verifiable via automated checks and unit tests.

## Gaps

None found. All must-haves pass, all requirements are accounted for, and build + tests are clean.
