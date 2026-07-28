---
phase: 17-ai-tools-chat-history-storage
plan: 02
subsystem: database
tags: [drizzle-schema, chat-tables, sqlite, migration-protected, chat-history]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: Drizzle ORM + SQLite database setup, schema registration pattern
provides:
  - chatConversations Drizzle table (id, publicId, title, profileId, createdAt, updatedAt)
  - chatMessages Drizzle table (id, conversationId, role, content, parts, inputTokens, outputTokens, createdAt)
  - ChatMessagePart union type (TextPart | ToolCallPart | ToolResultPart)
  - schemas/index.ts re-exports for drizzle-kit migration generation
affects: [17-03-chat-history-service, 18-ai-streaming-chat, 19-ai-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: [framework-agnostic-schema-asset, discriminated-union-type, json-column-for-parts]

key-files:
  created:
    - server/src/ai/chat.schema.ts
    - server/src/ai/chat.schema.spec.ts
  modified:
    - server/src/database/schemas/index.ts

key-decisions:
  - "ChatMessagePart as discriminated union type (not Zod schema) — runtime validation is ChatHistoryService's responsibility"
  - "chat_messages.parts uses text mode:'json' column for flexible ChatMessagePart[] storage"
  - "Schema file lives in ai/ not schemas/ — framework-agnostic asset co-located with AI module; re-exported from schemas/index.ts"

patterns-established:
  - "Migration-protected asset pattern: zero AI library imports in chat.schema.ts survives framework switches"
  - "Discriminated union type pattern: ChatMessagePart type-only export for type checking, no runtime validation"

requirements-completed: [AI-04]

# Coverage metadata
coverage:
  - id: D1
    description: "chatConversations Drizzle table with id, publicId, title, profileId, createdAt, updatedAt columns"
    requirement: "AI-04"
    verification:
      - kind: unit
        ref: "server/src/ai/chat.schema.spec.ts#chatConversations table exports and column assertions"
        status: pass
    human_judgment: false
  - id: D2
    description: "chatMessages Drizzle table with id, conversationId, role, content, parts(json), inputTokens, outputTokens, createdAt columns"
    requirement: "AI-04"
    verification:
      - kind: unit
        ref: "server/src/ai/chat.schema.spec.ts#chatMessages table exports and column assertions"
        status: pass
    human_judgment: false
  - id: D3
    description: "ChatMessagePart union type covering TextPart, ToolCallPart, ToolResultPart per D-352"
    requirement: "AI-04"
    verification:
      - kind: unit
        ref: "server/src/ai/chat.schema.spec.ts#ChatMessagePart type assertion tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "schemas/index.ts re-exports chatConversations and chatMessages for drizzle-kit migration generation"
    requirement: "AI-04"
    verification:
      - kind: unit
        ref: "server/src/ai/chat.schema.spec.ts#schemas/index.ts re-exports chatConversations and chatMessages"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-07-28
status: complete
---

# Phase 17 Plan 02: Chat History DB Schema Summary

**Drizzle schema for chat_conversations + chat_messages tables with ChatMessagePart union type — zero AI library imports, migration-protected asset**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-28T01:08:30Z
- **Completed:** 2026-07-28T01:12:24Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- chatConversations table defined with id (integer PK autoIncrement), publicId (text unique), title (text), profileId (text), createdAt/updatedAt (integer timestamp defaults)
- chatMessages table defined with id (integer PK autoIncrement), conversationId (integer notNull), role (text notNull), content (text), parts (text mode json), inputTokens/outputTokens (integer), createdAt (integer timestamp default)
- ChatMessagePart discriminated union type covering TextPart, ToolCallPart, ToolResultPart per D-352
- Zero AI library imports in chat.schema.ts — only drizzle-orm imports, making this a migration-protected asset
- schemas/index.ts updated to re-export chatConversations and chatMessages, enabling drizzle-kit migration generation

## Task Commits

Each task was committed atomically (TDD: RED → GREEN):

1. **Task 1: Drizzle chat schema + ChatMessagePart type + schema index registration**
   - `e6bec7c` (test) — RED: 22 failing tests for table exports, columns, type variants, zero-import assertion
   - `1cf4b74` (feat) — GREEN: chat.schema.ts implementation + schemas/index.ts re-exports, all 22 tests pass

## Files Created/Modified

- `server/src/ai/chat.schema.ts` — Drizzle table definitions for chatConversations and chatMessages, ChatMessagePart union type
- `server/src/ai/chat.schema.spec.ts` — 22 unit tests verifying table structure, column types, type variants, zero-import constraint, index re-exports
- `server/src/database/schemas/index.ts` — Added re-exports for chatConversations and chatMessages from ai/chat.schema.ts

## Decisions Made

- **ChatMessagePart as TypeScript discriminated union (not Zod schema)** — Per D-352, this is a type-only export for compile-time checking. Runtime validation of parts is ChatHistoryService's responsibility on read.
- **Schema file in ai/ not schemas/** — chat.schema.ts is a framework-agnostic asset co-located with the AI module per architecture doc §二. Re-exported from schemas/index.ts so drizzle-kit picks it up for migration generation.
- **parts column uses text mode:'json'** — Stores ChatMessagePart[] as JSON string. Drizzle parameterized queries prevent SQL injection (T-17-04 threat: accept).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- chat.schema.ts is ready for drizzle-kit migration generation (Plan 03)
- ChatHistoryService (Plan 03) will query these tables and validate parts using ChatMessagePart type
- Phase 18 ChatService will persist user/assistant messages and tool call/result parts via ChatHistoryService
- Schema registered in schemas/index.ts ensures drizzle-kit includes chat tables in migrations

## TDD Gate Compliance

- RED gate: `e6bec7c` (test commit) — 22 tests, all failing before implementation
- GREEN gate: `1cf4b74` (feat commit) — implementation makes all 22 tests pass
- REFACTOR: No cleanup needed — code is minimal and follows existing patterns

## Self-Check: PASSED

- server/src/ai/chat.schema.ts: FOUND
- server/src/ai/chat.schema.spec.ts: FOUND
- server/src/database/schemas/index.ts: FOUND
- .planning/phases/17-ai-tools-chat-history-storage/17-02-SUMMARY.md: FOUND
- e6bec7c (RED test commit): FOUND
- 1cf4b74 (GREEN feat commit): FOUND

---
*Phase: 17-ai-tools-chat-history-storage*
*Completed: 2026-07-28*
