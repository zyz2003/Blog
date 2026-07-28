# Changelog

All notable changes to the anheyu-app NestJS backend project.

## Phase 18: Streaming Chat Endpoint — 2026-07-28

### Added

- **POST /api/ai/chat** — SSE streaming chat endpoint with tool calling (AI-05)
  - `ChatService.chat()`: orchestrates `streamText` + article tools + persistence
  - `AiChatController`: @Public route + @Throttle (6s/1req) + pre-stream validation
  - `tool-bridge.ts`: converts framework-agnostic `ToolDef[]` to AI SDK `tool()` map (D-363)
  - `ArticleAiPort` interface for framework-agnostic AI operations
  - CORS `exposedHeaders` updated with `Cache-Control` + `X-Accel-Buffering` for streaming
- **Frontend chat widget** — floating button + streaming window (AI-05F)
  - `ChatWidget`: bottom-right floating button, mounted in root layout
  - `ChatWindow`: useChat + DefaultChatTransport wired to /api/ai/chat
  - `MessageList`: renders UIMessage[] with text parts + tool loading states + result cards
  - `ToolResultCard`: article link cards for search_articles/get_article results
  - `ChatInput`: text input + send button
  - Responsive: 380x580 desktop, fullscreen below 640px
  - Added `@ai-sdk/react@4.0.40` dependency
- **Unit tests** — 16 tests across 3 spec files
  - `tool-bridge.spec.ts`: 5 tests (conversion, execute delegation, duplicate name check)
  - `chat.service.spec.ts`: 7 tests (DomainError propagation, conversationId validation, persistence ordering, onFinish, error logging)
  - `ai-chat.controller.spec.ts`: 4 tests (empty messages 400, valid stream piping, DomainError 500)

### Fixed

- **conversationId UUID vs Sqids mismatch** — Frontend was generating UUIDs via `crypto.randomUUID()`, but backend `decodePublicID()` expects Sqids-encoded IDs. UUIDs caused 500 errors. Fix: removed frontend UUID generation; backend creates conversations with valid Sqids IDs.
- **onFinish appendMessage silent failure** — `streamText` onFinish callback's `appendMessage` call could fail silently (stream already sent). Fix: wrapped in try-catch + `logger.error` so DB write failures are observable.
- **decodePublicID unhandled exception** — Invalid or wrong-entity-type conversationId caused unhandled errors. Fix: ChatService validates conversationId via `decodePublicID` + `EntityType.ChatConversation` check, returns `DomainError('无效的会话 ID')`.
- **ModuleRef mock token mismatch** — `chat.service.spec.ts` used string token `'ModuleRef'` instead of class token `ModuleRef`. NestJS DI would resolve real ModuleRef, not the mock. Fix: changed to `{ provide: ModuleRef, ... }`.
- **tool-bridge duplicate name overwrite** — Two ToolDefs with the same name would silently overwrite. Fix: `toAiSdkTools` now throws on duplicate names.

### Decisions

- D-360: @Public() route — anonymous visitors can chat without login
- D-363: tool-bridge.ts is the ONLY file importing `tool` from `ai` — framework-agnostic converter
- D-364: ToolContext built with moduleRef.get for lazy service resolution
- D-365: Tool loop capped at 5 steps via stepCountIs(5)
- D-369: Pre-stream validation returns { code, data, message } JSON format
- D-370: CORS exposedHeaders includes Cache-Control + X-Accel-Buffering for streaming
- D-371: User message persisted BEFORE streamText; assistant message in onFinish
- D-372: Partial mock of 'ai' module using importOriginal for testing
- D-373: Frontend must NOT generate conversationId — backend creates Sqids IDs (UUID → decodePublicID crash)
- D-374: onFinish appendMessage wrapped in try-catch — DB write failure logged, not swallowed
- D-375: ChatService validates conversationId via decodePublicID + EntityType check before use
- D-376: toAiSdkTools throws on duplicate tool names instead of silent overwrite

### Known Issues (deferred to Phase 19)

- `article-tools.ts` uses `any` types extensively — SearchService/ArticleService return types should be defined
- `MessageList` hardcodes `tool-search_articles`/`tool-get_article` — new tools require component changes
- No Markdown rendering for assistant messages — raw Markdown syntax shown to user
- Auto-scroll on every `messages` change may fight user scroll-back during streaming
- @Public() + loose throttle is a cost risk for public-facing deployments
