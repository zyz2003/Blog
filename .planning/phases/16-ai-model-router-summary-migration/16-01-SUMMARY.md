---
phase: 16
plan: 01
subsystem: ai
tags: [ports-adapters, ai-sdk-7, model-resolver, summary-adapter, unit-tests]
requires: [settings-service, database-module, drizzle-orm]
provides: [article-ai-port, model-resolver, summary-adapter, ai-summary-controller]
affects: [server/src/ai/]
tech-stack:
  added: [ai@7.0.37, @ai-sdk/openai-compatible@3.0.14, zod@4.4.3]
  patterns: [ports-and-adapters, dependency-inversion]
key-files:
  created:
    - server/src/ai/ports/ai.port.ts
    - server/src/ai/model/ai-profile.ts
    - server/src/ai/model/model-resolver.service.ts
    - server/src/ai/adapters/html-to-text.ts
    - server/src/ai/adapters/summary.adapter.ts
    - server/src/ai/ai-summary.controller.ts
    - server/src/ai/model/ai-profile.spec.ts
    - server/src/ai/model/model-resolver.service.spec.ts
    - server/src/ai/adapters/summary.adapter.spec.ts
    - server/src/ai/adapters/html-to-text.spec.ts
  modified:
    - server/package.json
    - server/src/ai/ai.module.ts
  deleted:
    - server/src/ai/ai.controller.ts
    - server/src/ai/ai.service.ts
decisions:
  - Used AI SDK 7 parameter names exclusively (instructions, maxOutputTokens, name in createOpenAICompatible)
  - Extracted htmlToPlainText as standalone pure function for testability
  - Used ARTICLE_AI_PORT injection token for dependency inversion
  - resolveProfiles returns empty array (not throws) when no profiles configured, letting ModelResolver throw domain error
  - Error wrapping in SummaryAdapter catches LLM errors with generic message to prevent API key leakage
metrics:
  duration: 934s
  completed: 2026-07-26
  tasks: 2
  tests: 34
status: complete
---

# Phase 16 Plan 01: AI Model Router & Summary Architecture Summary

Rebuilt server/src/ai/ with ports/adapters/model architecture, replacing raw fetch with AI SDK 7 generateText, adding ModelResolver with profile resolution and legacy fallback, and comprehensive unit tests.

## What Was Done

### Task 1: End-to-end AI summary through new architecture

- Installed `ai@7.0.37`, `@ai-sdk/openai-compatible@3.0.14`, `zod@4.4.3` with pinned exact versions
- Created `ArticleAiPort` interface — framework-agnostic contract with `summarizeArticle(publicId)` method
- Created `AiProfile` type and `resolveProfiles()` function — reads `ai_profiles` JSON from settings, falls back to legacy `ai_summary_*` keys
- Created `ModelResolver` service — resolves `LanguageModel` from profiles using `createOpenAICompatible` with required `name` parameter
- Extracted `htmlToPlainText` as standalone pure function (from old `ai.service.ts` lines 134-161)
- Created `SummaryAdapter` implementing `ArticleAiPort` — uses AI SDK 7 `generateText` with `instructions` (not `system`), `maxOutputTokens: 500` (not `maxTokens`), `timeout: { totalMs: 30000 }`
- Created `AiSummaryController` — delegates to `ARTICLE_AI_PORT` injection token
- Rebuilt `AiModule` — wires `ModelResolver` and `SummaryAdapter` as `ARTICLE_AI_PORT`
- Deleted old `ai.controller.ts` and `ai.service.ts`

### Task 2: Unit tests

- `ai-profile.spec.ts` — 8 tests: valid JSON parsing, legacy fallback for empty/undefined/invalid `ai_profiles`, empty array when no config, missing key/url edge cases
- `model-resolver.service.spec.ts` — 6 tests: profileId match, defaultId fallback, first-enabled fallback, no-profile error, empty config, legacy profile resolution
- `summary.adapter.spec.ts` — 11 tests: AI SDK 7 parameter verification, missing article, empty contentHtml, invalid entity type, empty/undefined text, LLM error wrapping, default prompt, profile ID passthrough, empty plaintext
- `html-to-text.spec.ts` — 9 tests: tag stripping, entity decoding, code block removal, script/style removal, whitespace collapse, complex HTML

## Verification

1. `npx nest build` — compiled without errors
2. `npx vitest run src/ai/` — 34/34 tests passed across 4 test files

## Deviations from Plan

None — plan executed exactly as written.

## Key Architecture Decisions

1. **AI SDK 7 parameter names** — `instructions` (not `system`), `maxOutputTokens` (not `maxTokens`), `name` required in `createOpenAICompatible`
2. **Ports/Adapters pattern** — `ArticleAiPort` interface allows swapping LLM implementations without touching the controller or module wiring
3. **Legacy fallback** — `resolveProfiles()` gracefully handles users who only configured the old `ai_summary_*` keys, synthesizing a single profile with `id='legacy'`
4. **Error wrapping** — SummaryAdapter catches LLM errors and returns generic messages to prevent API key leakage in error responses
5. **Profile resolution chain** — ModelResolver tries: explicit profileId -> ai_default_profile_id -> first enabled profile

## Self-Check: PASSED

- All 11 created files exist on disk
- Both commit hashes (71dddcc, 9076aaf) found in git log
- Old ai.controller.ts and ai.service.ts confirmed deleted
- Build compiles without errors
- 34/34 unit tests pass
