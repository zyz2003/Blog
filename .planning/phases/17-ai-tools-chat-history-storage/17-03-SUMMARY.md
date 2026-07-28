---
phase: 17-ai-tools-chat-history-storage
plan: 03
subsystem: ai
tags: [chat-history, crud, truncation, drizzle, sqids, framework-agnostic, migration-protected, nestjs]

# Dependency graph
requires:
  - phase: 17-ai-tools-chat-history-storage
    provides: chat.schema.ts (chatConversations + chatMessages tables + ChatMessagePart type)
  - phase: 17-ai-tools-chat-history-storage
    provides: ai.module.ts (module wiring with SearchModule + ArticleModule)
provides:
  - ChatHistoryService with createConversation, appendMessage, getMessages, truncateHistory, listConversations
  - StoredMessage interface
  - StoredConversation interface
  - EntityType.ChatConversation = 23 for public ID encoding
  - AiModule exports ChatHistoryService for Phase 18 injection
affects: [18-ai-chat-service, 19-ai-context-compression]

# Tech tracking
tech-stack:
  added: []
  patterns: [framework-agnostic-service, sqids-entity-type-extension, chainable-mock-thenable]

key-files:
  created:
    - server/src/ai/chat-history.service.ts
    - server/src/ai/chat-history.service.spec.ts
  modified:
    - server/src/ai/ai.module.ts
    - server/src/common/utils/sqids.util.ts

key-decisions:
  - "EntityType.ChatConversation = 23 (next value after Link=22) for Sqids public ID encoding"
  - "truncateHistory hard-deletes per D-353 (keepLast required, no default — Phase 19 decides value)"
  - "ChatHistoryService is framework-agnostic: zero AI library imports, survives framework switch"
  - "Chainable mock with thenable chain nodes for Drizzle query builder testing"

patterns-established:
  - "Framework-agnostic service: Drizzle CRUD with no AI SDK imports, migration-protected asset"
  - "Sqids EntityType extension: add new entity type value to EntityType constant for new table public IDs"
  - "Chainable mock with thenable nodes: mock Drizzle query builder chains without the thenable trap in NestJS DI"

requirements-completed: [AI-04]

coverage:
  - id: D1
    description: "ChatHistoryService CRUD operations (createConversation, appendMessage, getMessages, listConversations)"
    requirement: AI-04
    verification:
      - kind: unit
        ref: server/src/ai/chat-history.service.spec.ts#ChatHistoryService
        status: pass
    human_judgment: false
  - id: D2
    description: "truncateHistory hard-deletes old messages per D-353"
    requirement: AI-04
    verification:
      - kind: unit
        ref: server/src/ai/chat-history.service.spec.ts#truncateHistory
        status: pass
    human_judgment: false
  - id: D3
    description: "ChatHistoryService has zero AI library imports (framework-agnostic migration-protected)"
    requirement: AI-04
    verification:
      - kind: unit
        ref: server/src/ai/chat-history.service.spec.ts#zero AI library imports
        status: pass
    human_judgment: false
  - id: D4
    description: "AiModule registers and exports ChatHistoryService for Phase 18 injection"
    requirement: AI-04
    verification:
      - kind: unit
        ref: server/src/ai/chat-history.service.spec.ts#is an injectable NestJS service
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-07-28
status: complete
---

# Phase 17 Plan 03: ChatHistoryService CRUD + AiModule Wiring Summary

**Framework-agnostic ChatHistoryService with Drizzle CRUD for chat conversations/messages, Sqids public IDs with EntityType.ChatConversation=23, hard-delete truncation per D-353, and AiModule export for Phase 18 injection**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-28T01:17:32Z
- **Completed:** 2026-07-28T01:30:36Z
- **Tasks:** 1 (TDD: RED + GREEN + REFACTOR)
- **Files modified:** 4

## Accomplishments
- ChatHistoryService implements all 5 CRUD methods: createConversation, appendMessage, getMessages, truncateHistory, listConversations
- createConversation generates Sqids-encoded publicId with EntityType.ChatConversation=23
- appendMessage/getMessages/truncateHistory decode conversationPublicId via decodePublicID to resolve DB-level ids
- truncateHistory hard-deletes oldest messages keeping only last N per D-353 (keepLast required, no default)
- Zero AI library imports verified — framework-agnostic migration-protected asset
- AiModule updated: ChatHistoryService added to providers and exports for Phase 18 ChatService injection
- EntityType.ChatConversation = 23 added to sqids.util.ts
- 15 unit tests pass covering all 14+ planned behaviors

## Task Commits

Each task was committed atomically (TDD flow):

1. **Task 1 (RED): Failing tests for ChatHistoryService** - `fbd294b` (test)
2. **Task 1 (GREEN): ChatHistoryService implementation + AiModule wiring** - `c3df744` (feat)
3. **Task 1 (REFACTOR): Clean up unused import + improve test assertions** - `4c631f2` (refactor)

_Note: TDD task had 3 commits (test -> feat -> refactor)_

## Files Created/Modified
- `server/src/ai/chat-history.service.ts` - ChatHistoryService with CRUD + StoredMessage/StoredConversation interfaces
- `server/src/ai/chat-history.service.spec.ts` - 15 unit tests with chainable mock pattern
- `server/src/ai/ai.module.ts` - Added ChatHistoryService to providers and exports
- `server/src/common/utils/sqids.util.ts` - Added EntityType.ChatConversation = 23

## Decisions Made
- EntityType.ChatConversation = 23 — next available value after Link=22, following existing Go-compatible iota pattern
- Chainable mock with thenable chain nodes — avoids the "thenable trap" (NestJS DI resolves objects with .then as Promises) while supporting Drizzle's chainable+thenable query builders
- truncateHistory uses two-step select+delete strategy: select ids to keep (ORDER BY created_at DESC LIMIT keepLast), then delete messages not in the keep set
- ChatHistoryService is pure Drizzle CRUD — no AI SDK imports — survives framework switch unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Drizzle mock pattern required careful design to avoid the "thenable trap" — NestJS DI treats objects with `.then` as Promise-like and resolves them during injection. Solved by making only chain nodes (returned by methods) thenable, not the mock db itself.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ChatHistoryService is ready for Phase 18 ChatService injection via AiModule export
- createConversation will be called by Phase 18 ai-chat.controller before stream starts
- appendMessage will be called by Phase 18 ChatService.onFinish to persist assistant messages
- getMessages will be called by Phase 18 ChatService.chat() to load history for context
- truncateHistory will be called by Phase 19 prepareStep for context compression

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log. Test suite passes (15/15). Build compiles without errors.

---
*Phase: 17-ai-tools-chat-history-storage*
*Completed: 2026-07-28*
