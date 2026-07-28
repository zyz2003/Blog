---
phase: 18-streaming-chat-endpoint
plan: 03
subsystem: testing
tags: [ai, vitest, unit-test, chat, mocking, tdd]

# Dependency graph
requires:
  - phase: 18-streaming-chat-endpoint
    provides: chat.service.ts, tool-bridge.ts, ai-chat.controller.ts (production code under test)
provides:
  - Unit test coverage for ChatService persistence + error handling
  - Unit test coverage for toAiSdkTools conversion correctness
  - Unit test coverage for AiChatController pre-stream validation + stream piping
affects: [ci, ai]

# Tech tracking
tech-stack:
  added: []
  patterns: [vitest + NestJS Testing module for controller/service unit tests, vi.mock('ai') with importOriginal for partial mocking]

key-files:
  created:
    - server/src/ai/tools/tool-bridge.spec.ts
    - server/src/ai/chat.service.spec.ts
    - server/src/ai/ai-chat.controller.spec.ts
  modified: []

key-decisions:
  - "D-372: Partial mock of 'ai' module using importOriginal — preserves tool() for ChatService constructor while mocking streamText/pipeUIMessageStreamToResponse"
  - "D-373: Frontend must NOT generate conversationId — backend creates Sqids IDs (UUID → decodePublicID crash)"
  - "D-374: onFinish appendMessage wrapped in try-catch — DB write failure logged, not swallowed"
  - "D-375: ChatService validates conversationId via decodePublicID + EntityType check before use"
  - "D-376: toAiSdkTools throws on duplicate tool names instead of silent overwrite"

patterns-established:
  - "Partial vi.mock('ai') with importOriginal: needed when production code calls tool() at construction time but tests need streamText/pipeUIMessageStreamToResponse mocked"

requirements-completed: [AI-05, AI-05F]

coverage:
  - id: D1
    description: "toAiSdkTools conversion: names, descriptions, execute delegation"
    requirement: AI-05
    verification:
      - kind: unit
        ref: "server/src/ai/tools/tool-bridge.spec.ts#toAiSdkTools"
        status: pass
    human_judgment: false
  - id: D2
    description: "ChatService.chat: DomainError propagation, createConversation, persistence ordering, onFinish"
    requirement: AI-05
    verification:
      - kind: unit
        ref: "server/src/ai/chat.service.spec.ts#ChatService"
        status: pass
    human_judgment: false
  - id: D3
    description: "AiChatController: empty messages 400, valid messages piping, DomainError 500"
    requirement: AI-05F
    verification:
      - kind: unit
        ref: "server/src/ai/ai-chat.controller.spec.ts#AiChatController"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-28
status: complete
---

# Phase 18 Plan 03: Unit Tests for Streaming Chat Summary

**16 unit tests covering tool-bridge conversion, ChatService persistence + error handling + conversationId validation, and AiChatController pre-stream validation + stream piping**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-28T11:38:22Z
- **Completed:** 2026-07-28T11:53:22Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- tool-bridge.spec.ts: 5 tests verifying toAiSdkTools conversion (single tool names, article tool names, description matching, execute delegation with correct input + context, duplicate name throws)
- chat.service.spec.ts: 7 tests verifying ChatService.chat (DomainError propagation from ModelResolver, createConversation when no conversationId, user message persisted before streamText via call order tracking, onFinish persists assistant message with role + parts + tokens, invalid conversationId → DomainError, wrong entity type → DomainError, onFinish appendMessage failure logged not thrown)
- ai-chat.controller.spec.ts: 4 tests verifying AiChatController (empty messages array returns 400, undefined messages returns 400, valid messages calls ChatService.chat + pipeUIMessageStreamToResponse, DomainError returns 500 with error message)
- All 16 tests pass; all 109 AI module tests pass; no regressions in new code

## Task Commits

Each task was committed atomically:

1. **Task 1: Unit tests for tool-bridge + ChatService + AiChatController** - `c5902e7` (test)
2. **Code review fixes: conversationId validation, onFinish error logging, ModuleRef mock, duplicate tool check** - `ef2f52f` (fix)

## Files Created/Modified
- `server/src/ai/tools/tool-bridge.spec.ts` - 5 tests for toAiSdkTools conversion correctness + duplicate name check
- `server/src/ai/chat.service.spec.ts` - 7 tests for ChatService persistence + error handling + conversationId validation
- `server/src/ai/ai-chat.controller.spec.ts` - 4 tests for controller validation + stream piping

## Decisions Made
- D-372: Partial mock of 'ai' module using `importOriginal` — ChatService constructor calls `tool()` via `toAiSdkTools`, so the mock must preserve `tool()` while mocking `streamText`/`pipeUIMessageStreamToResponse`. Full replacement mock caused "No 'tool' export" error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ai module mock missing tool() export**
- **Found during:** Task 1 (ChatService test setup)
- **Issue:** Initial `vi.mock('ai')` replaced all exports, but ChatService constructor calls `toAiSdkTools` which imports `tool` from `ai`. Missing export caused "No 'tool' export is defined on the 'ai' mock" error.
- **Fix:** Changed to partial mock using `importOriginal` — preserves `tool()` and other exports while overriding `streamText`, `convertToModelMessages`, `stepCountIs`, `toUIMessageStream`.
- **Files modified:** server/src/ai/chat.service.spec.ts
- **Verification:** All 4 ChatService tests pass
- **Committed in:** c5902e7 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary for tests to run. No scope creep.

## Issues Encountered
None beyond the mock issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All streaming chat unit tests green — ChatService, tool-bridge, and AiChatController are verified
- Phase 18 complete: streaming chat endpoint with tool integration, UI components, and test coverage
- Ready for Phase 19 (chat history management, conversation list API, etc.)

---
*Phase: 18-streaming-chat-endpoint*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: server/src/ai/tools/tool-bridge.spec.ts
- FOUND: server/src/ai/chat.service.spec.ts
- FOUND: server/src/ai/ai-chat.controller.spec.ts
- FOUND: .planning/phases/18-streaming-chat-endpoint/18-03-SUMMARY.md
- FOUND: c5902e7 (task commit)
