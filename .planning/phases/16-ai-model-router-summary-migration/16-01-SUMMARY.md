---
phase: 16
plan: 01
subsystem: ai
tags: [ports-adapters, ai-sdk-7, model-resolver, summary-adapter, unit-tests, domain-error, normalize-purposes]
requires: [settings-service, database-module, drizzle-orm]
provides: [article-ai-port, model-resolver, summary-adapter, ai-summary-controller, domain-error]
affects: [server/src/ai/]
tech-stack:
  added: [ai@7.0.37, @ai-sdk/openai-compatible@3.0.14, zod@4.4.3]
  patterns: [ports-and-adapters, dependency-inversion, custom-error-class]
key-files:
  created:
    - server/src/ai/ports/ai.port.ts
    - server/src/ai/model/ai-profile.ts
    - server/src/ai/model/model-resolver.service.ts
    - server/src/ai/adapters/html-to-text.ts
    - server/src/ai/adapters/summary.adapter.ts
    - server/src/ai/ai-summary.controller.ts
    - server/src/ai/domain-error.ts
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
  - D-340a: Custom DomainError class replaces fragile string-matching in error catch blocks
  - D-340b: normalizePurposes + normalizeProfile in resolveProfiles handle frontend object-format purposes { summary: true } → backend array ['summary']
metrics:
  duration: 934s
  completed: 2026-07-27
  tasks: 2
  tests: 37
  quality_fix_commit: 7301503
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

- `ai-profile.spec.ts` — 11 tests: valid JSON parsing, legacy fallback for empty/undefined/invalid `ai_profiles`, empty array when no config, missing key/url edge cases, purposes normalization (object→array, array passthrough, missing→default)
- `model-resolver.service.spec.ts` — 6 tests: profileId match, defaultId fallback, first-enabled fallback, no-profile DomainError, empty config, legacy profile resolution
- `summary.adapter.spec.ts` — 11 tests: AI SDK 7 parameter verification, missing article, empty contentHtml, invalid entity type, empty/undefined text, LLM error wrapping via DomainError, default prompt, profile ID passthrough, empty plaintext
- `html-to-text.spec.ts` — 9 tests: tag stripping, entity decoding, code block removal, script/style removal, whitespace collapse, complex HTML

### Quality Review Fixes (commit 7301503)

- **DomainError class** (D-340a): Replaced fragile `error.message?.includes(...)` string-matching in SummaryAdapter catch block with `instanceof DomainError` check. ModelResolver also throws DomainError for '未配置可用的 AI 模型'. Eliminates risk of LLM error messages containing keywords like "文章" being misidentified as domain errors.
- **normalizePurposes + normalizeProfile** (D-340b): Frontend AiModelsForm stores purposes as object `{ summary: true, chat: false }`, but backend AiProfile interface expects `string[]`. Added normalization in `resolveProfiles()` to convert both formats to `string[]`, preventing type mismatch bugs in Phase 18/19 when chat features filter profiles by purpose.
- **Test fix**: Changed double `await expect(...).rejects.toThrow()` pattern to single-call `catch(e => e)` + assert on error instance, avoiding mock consumption race conditions.

## Verification

1. `npx nest build` — compiled without errors
2. `(after quality fixes)` npx vitest run src/ai/` — 37/37 tests passed across 4 test files

## Deviations from Plan

None — plan executed exactly as written. Quality fixes addressed review findings post-execution.

## Key Architecture Decisions

1. **AI SDK 7 parameter names** — `instructions` (not `system`), `maxOutputTokens` (not `maxTokens`), `name` required in `createOpenAICompatible`
2. **Ports/Adapters pattern** — `ArticleAiPort` interface allows swapping LLM implementations without touching the controller or module wiring
3. **Legacy fallback** — `resolveProfiles()` gracefully handles users who only configured the old `ai_summary_*` keys, synthesizing a single profile with `id='legacy'`
4. **DomainError** — Custom error class distinguishes business-logic errors from LLM API errors, preventing API key leakage in error responses
5. **Purposes normalization** — Handles frontend/backend format mismatch transparently in resolveProfiles
6. **Profile resolution chain** — ModelResolver tries: explicit profileId -> ai_default_profile_id -> first enabled profile

## Self-Check: PASSED

- All 12 created files exist on disk (including domain-error.ts)
- Commits 71dddcc, 9076aaf, 7301503 found in git log
- Old ai.controller.ts and ai.service.ts confirmed deleted
- Build compiles without errors
- 37/37 unit tests pass
