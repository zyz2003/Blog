---
phase: 18-streaming-chat-endpoint
plan: 01
subsystem: ai
tags: [ai, streaming, chat, backend, tool-bridge, streamText, nestjs]

requires:
  - phase: 17
    provides: ToolDef, ToolContext, articleTools, ChatHistoryService, ModelResolver, DomainError
provides:
  - POST /api/ai/chat streaming endpoint with tool calling
  - tool-bridge.ts: ToolDef[] → AI SDK tool() converter
  - ChatService: streamText + tools + persistence orchestration
  - AiChatController: @Public + @Throttle + pre-stream validation
affects: [18-02, 18-03]

tech-stack:
  added: []
  patterns:
    - "tool-bridge: framework-agnostic ToolDef → AI SDK tool() adapter (per D-363)"
    - "ChatService: streamText with stepCountIs(5) tool loop cap (per D-365)"
    - "Pre-stream validation in controller: empty messages → 400, DomainError → 500 (per D-369)"
    - "@Res() bypass of ResponseInterceptor for streaming responses"

key-files:
  created:
    - server/src/ai/tools/tool-bridge.ts
    - server/src/ai/chat.service.ts
    - server/src/ai/ai-chat.controller.ts
  modified:
    - server/src/ai/ports/ai.port.ts
    - server/src/ai/ai.module.ts
    - server/src/main.ts

key-decisions:
  - "D-363: tool-bridge.ts is the ONLY file importing `tool` from `ai` — framework-agnostic converter"
  - "D-364: ToolContext built with moduleRef.get for lazy service resolution"
  - "D-365: Tool loop capped at 5 steps via stepCountIs(5)"
  - "D-369: Pre-stream validation returns { code, data, message } JSON format"
  - "D-370: CORS exposedHeaders includes Cache-Control + X-Accel-Buffering for streaming"
  - "D-371: User message persisted BEFORE streamText; assistant message in onFinish"
  - "D-374: onFinish appendMessage wrapped in try-catch — DB write failure logged, not swallowed"
  - "D-375: ChatService validates conversationId via decodePublicID + EntityType check before use"
  - "D-376: toAiSdkTools throws on duplicate tool names instead of silent overwrite"

patterns-established:
  - "tool-bridge pattern: ToolDef[] → AI SDK ToolSet via toAiSdkTools(defs, ctx)"
  - "streaming controller pattern: @Res() + pipeUIMessageStreamToResponse for SSE streaming"
  - "pre-stream validation: check input → return JSON error before starting stream"

requirements-completed: [AI-05]

coverage:
  - id: D1
    description: "POST /api/ai/chat streaming endpoint with tool calling and persistence"
    requirement: "AI-05"
    verification:
      - kind: unit
        ref: "server/src/ai/chat.service.spec.ts#ChatService persistence + error handling"
        status: unknown
    human_judgment: true
    rationale: "Streaming endpoint requires runtime verification with actual LLM provider"

duration: 80min
completed: 2026-07-28
status: complete
---

# Phase 18: Streaming Chat Endpoint — Plan 01 Summary

**Backend streaming chat: tool-bridge converts ToolDef[] → AI SDK tools, ChatService orchestrates streamText with article tools + persistence, AiChatController exposes POST /api/ai/chat as public throttled SSE endpoint**

## Performance

- **Duration:** 80 min
- **Started:** 2026-07-28T07:40:00Z
- **Completed:** 2026-07-28T09:00:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- tool-bridge.ts converts framework-agnostic ToolDef[] to AI SDK tool() map — zero NestJS imports
- ChatService.chat() wires streamText + articleTools + stepCountIs(5) + persistence (user msg before stream, assistant msg in onFinish)
- AiChatController with @Public() + @Throttle(6s/1req) + pre-stream validation (400/500 JSON errors)
- CORS exposedHeaders updated with Cache-Control + X-Accel-Buffering for streaming proxy support
- AiModule registers ChatService + AiChatController

## Task Commits

Each task was committed atomically:

1. **Task 1: tool-bridge.ts + ChatService + ai.port.ts — core streaming slice** - `1c5572c` (feat)
2. **Task 2: AiChatController + CORS headers + AiModule wiring** - `759ce01` (feat)

## Files Created/Modified
- `server/src/ai/tools/tool-bridge.ts` - Converts ToolDef[] to AI SDK ToolSet (framework-agnostic adapter)
- `server/src/ai/chat.service.ts` - Core streaming chat: streamText + tools + persistence
- `server/src/ai/ai-chat.controller.ts` - POST /api/ai/chat with @Public + @Throttle + @Res streaming
- `server/src/ai/ports/ai.port.ts` - Added ChatService interface alongside ArticleAiPort
- `server/src/ai/ai.module.ts` - Registers ChatService + AiChatController
- `server/src/main.ts` - CORS exposedHeaders adds Cache-Control + X-Accel-Buffering

## Decisions Made
- Used `inputSchema` (not `parameters`) in tool() calls — matches AI SDK 7 actual API
- Used `stepCountIs` (aliased from `isStepCount`) for tool loop cap — both work in ai@7
- Used `moduleRef.get()` (not `moduleRef.resolve()`) for ToolContext.getService — get is synchronous and sufficient for lazy resolution
- Cast `toUIMessageStream` result through `unknown` to `ReadableStream<Uint8Array>` for port interface — actual runtime type is `ReadableStream<UIMessageChunk>`
- `extractPartsFromSteps` uses `(tc as { input: unknown }).input` to access `input` property on `TypedToolCall` union type

## Deviations from Plan

### Auto-fixed Issues

**1. AI SDK 7 type mismatches in extractPartsFromSteps**
- **Found during:** Task 1 (ChatService implementation)
- **Issue:** StepResult.toolCalls uses `TypedToolCall<ToolSet>` which has `input` (not `args`), and StepResult.toolResults uses `TypedToolResult<ToolSet>` which has `output` (not `result`)
- **Fix:** Changed extractPartsFromSteps to use `StepResult<ToolSet>[]` type and access `input`/`output` via type assertion
- **Files modified:** server/src/ai/chat.service.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** 1c5572c (Task 1 commit)

**2. toUIMessageStream return type mismatch with port interface**
- **Found during:** Task 1 (ChatService implementation)
- **Issue:** toUIMessageStream returns ReadableStream<UIMessageChunk> but port interface declares ReadableStream<Uint8Array> to avoid AI SDK imports
- **Fix:** Double cast through `unknown` in ChatService.chat() return; controller also casts when passing to pipeUIMessageStreamToResponse
- **Files modified:** server/src/ai/chat.service.ts, server/src/ai/ai-chat.controller.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** 1c5572c, 759ce01

---

**Total deviations:** 2 auto-fixed (2 type compatibility)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Executor agent partially completed Task 1 but stopped at type errors — orchestrator completed Task 1 fixes and all of Task 2 inline

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- POST /api/ai/chat endpoint ready for frontend consumption (Plan 18-02)
- Tool-bridge pattern established for future tool additions
- ChatService persistence pattern ready for unit testing (Plan 18-03)

---
*Phase: 18-streaming-chat-endpoint*
*Completed: 2026-07-28*
