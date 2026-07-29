---
phase: 19-chat-hardening-frontend-integration
plan: 02
subsystem: frontend-chat
tags: [chat, settings, conversation, welcome, disconnect, session-switcher]
dependency_graph:
  requires: [19-01]
  provides: [AI-07]
  affects: [ChatWindow, AiChatForm, setting-descriptors, setting-keys, ai-api]
tech_stack:
  added: ["@ai-sdk/react useChat with ChatInit.messages", "localStorage conversationId persistence"]
  patterns: ["conversation recovery via fetchConversationMessages -> storedToUIMessages -> useChat messages prop"]
key_files:
  created:
    - frontend/src/components/chat/WelcomeMessage.tsx
    - frontend/src/components/chat/DisconnectBar.tsx
    - frontend/src/components/chat/SessionSwitcher.tsx
    - frontend/src/components/admin/settings/AiChatForm.tsx
  modified:
    - frontend/src/components/chat/ChatWindow.tsx
    - frontend/src/components/chat/index.ts
    - frontend/src/lib/api/ai.ts
    - frontend/src/lib/settings/setting-descriptors.ts
    - frontend/src/lib/settings/setting-keys.ts
    - frontend/src/app/admin/settings/_config/settings-forms.ts
decisions:
  - D-388: Welcome message + suggestion buttons from settings shown when chat is empty
  - D-389: DisconnectBar with retry button replaces inline error div
  - D-390: SessionSwitcher dropdown + new conversation button in header
  - D-385: conversationId persisted in localStorage, recovered via fetchConversationMessages on mount
  - D-386: AiChatForm replaces AiPlaceholderForm with profile dropdown + welcome + suggestions + system prompt
metrics:
  duration: 44
  completed: "2026-07-29"
  tasks: 2
  files: 10
status: complete
---

# Phase 19 Plan 02: Frontend Chat Polish & Admin AI Chat Settings Summary

Chat window production-ready with welcome/suggestions, disconnect handling, session management, conversation recovery, and AiChatForm replacing placeholder.

## What Was Built

### Chat Window Features
- **Welcome message + suggestion buttons**: When chat is empty, shows configurable welcome message and 3 suggestion buttons from settings (per D-388)
- **Disconnect notification bar**: Red-tinted bar with "连接中断，点击重试" and retry button appears on connection error (per D-389)
- **New conversation button**: "+" icon in header clears current chat and starts fresh (per D-390)
- **Session switching**: Dropdown triggered by chevron next to title, shows conversation list with relative timestamps, allows switching between conversations (per D-390)
- **conversationId persistence**: Stored in localStorage as `ai_chat_conversation_id`, recovered on page refresh via `fetchConversationMessages`, converted to UIMessage format for useChat (per D-385)
- **Conversation ID resolution**: After first message in new conversation, fetches most recent conversation from API to get server-generated Sqids ID

### Admin Settings
- **AiChatForm**: Replaces AiPlaceholderForm with full configuration form:
  - Chat Profile dropdown (filters profiles with `purposes.chat === true`)
  - Welcome Message text input
  - Suggested Questions JSON editor
  - System Prompt textarea
- **4 new setting keys**: `ai_chat_profile_id`, `ai_chat_welcome_message`, `ai_chat_suggested_questions`, `ai_chat_system_prompt`
- **ai-chat category descriptors**: Populated with 4 descriptors including Chinese defaults
- **EMPTY_STRING_DEFAULT_KEYS**: Added `KEY_AI_CHAT_SYSTEM_PROMPT` so empty backend value shows default in form

### API Client
- **conversationApi.fetchConversations**: GET /api/ai/conversations with pagination
- **conversationApi.fetchConversationMessages**: GET /api/ai/conversations/:id/messages
- **conversationApi.deleteConversation**: DELETE /api/ai/conversations/:id
- **fetchChatSettings**: Fetches welcome message and suggested questions from public site-config API with fallback defaults

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | End-to-end frontend chat polish | 78911f0 | 10 files (4 created, 6 modified) |
| 2 | Frontend chat API client + settings integration verification | (no new changes) | verified existing |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useChat API: `initialMessages` -> `messages`**
- **Found during:** Task 1 tracer build check
- **Issue:** AI SDK 7 `useChat` uses `ChatInit.messages` not `initialMessages` — TypeScript error TS2353
- **Fix:** Changed `initialMessages` prop to `messages` in useChat options
- **Files modified:** ChatWindow.tsx
- **Commit:** 78911f0

**2. [Rule 1 - Bug] Fixed UIMessage parts type incompatibility**
- **Found during:** Task 1 tracer build check
- **Issue:** `storedToUIMessages` returned `unknown[]` for parts, incompatible with `UIMessage["parts"]`
- **Fix:** Cast parts array to `UIMessage["parts"]` type
- **Files modified:** ChatWindow.tsx
- **Commit:** 78911f0

**3. [Rule 1 - Bug] Fixed conversationId null passed to string parameter**
- **Found during:** Task 1 tracer build check
- **Issue:** `conversationId` (string | null) passed to `fetchConversationMessages(conversationId: string)`
- **Fix:** Captured conversationId in local const `cid` after null check, before async closure
- **Files modified:** ChatWindow.tsx
- **Commit:** 78911f0

None of these were architectural — all were TypeScript type-safety fixes for the AI SDK 7 API surface.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| conversationId resolved via fetchConversations(1,1) after first message | AI SDK useChat doesn't expose server-set conversationId from SSE stream; fetching most recent conversation is simplest reliable approach |
| fetchChatSettings uses public site-config endpoint | Chat settings (welcome message, suggestions) are public-facing and should be available without auth |
| SessionSwitcher as dropdown triggered by chevron | Minimal UI footprint; clicking title area opens conversation list |
| storedToUIMessages generates `restored-{i}` IDs | Backend messages lack client-side IDs; sequential IDs are sufficient for React keys |

## Verification Results

- Frontend builds without errors (Next.js build: Compiled successfully)
- TypeScript type-check passes (0 new errors)
- All 4 ai-chat setting keys appear in setting descriptors
- AiChatForm replaces AiPlaceholderForm in settings-forms.ts
- ChatWindow integrates all new components

## Known Stubs

None — all features are fully wired with real data sources and API calls.

## Threat Flags

No new threat surface beyond what the plan's threat model already covers. The conversation endpoints are public (T-19-04 accepted), localStorage conversationId is low-risk (T-19-05 accepted), and system prompt in public settings is low-risk (T-19-06 accepted).

## Self-Check: PASSED

- All 10 created/modified files exist on disk
- Commit 78911f0 exists in git log
- SUMMARY.md exists at expected path
