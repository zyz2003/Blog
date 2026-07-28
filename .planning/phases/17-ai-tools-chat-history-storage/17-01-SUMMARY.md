---
phase: 17-ai-tools-chat-history-storage
plan: 01
subsystem: ai
tags: [framework-agnostic, tool-def, article-tools, fts5-search, ports-adapters, zod]

# Dependency graph
requires:
  - phase: 16-ai-model-router-summary-migration
    provides: AiModule structure, SettingsService, ModelResolver
  - phase: 06-comment-search
    provides: SearchService.search(query, page, size) with FTS5
  - phase: 03-article-category-tag
    provides: ArticleService.getPublic(slugOrId) returning ArticleDetailResponseDto
provides:
  - ToolDef generic interface (Zod schema + pure execute) — framework-agnostic tool definition type
  - ToolContext interface — { db, settings, getService<T>(token) } for DI-based service resolution
  - searchArticlesTool — delegates to SearchService.search, returns { articles: [{title, snippet, url}] }
  - getArticleTool — delegates to ArticleService.getPublic, returns { title, content, url } with 3000-char truncation
  - articleTools array — [searchArticlesTool, getArticleTool] for Phase 18 consumption
affects: [18-streaming-chat-endpoint, 19-context-compression-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Framework-agnostic tool definitions: ToolDef uses Zod schema + pure execute function, zero AI library imports"
    - "Service delegation via ToolContext.getService<T>(token): tools resolve domain services without NestJS decorators"
    - "TDD RED/GREEN cycle: test file committed first (failing), then implementation committed to pass"

key-files:
  created:
    - server/src/ai/tools/tool-def.ts
    - server/src/ai/tools/article-tools.ts
    - server/src/ai/tools/article-tools.spec.ts
  modified:
    - server/src/ai/ai.module.ts

key-decisions:
  - "D-350: ToolContext.getService<T>(token) resolves domain services — tools never import NestJS decorators or AI libraries"
  - "D-351: get_article truncates content to 3000 chars via htmlToPlainText then .slice(0, 3000)"
  - "Framework independence verified by source-text scanning in tests: article-tools.ts and tool-def.ts must not contain 'from ai' or '@ai-sdk' imports"

patterns-established:
  - "Tool definition pattern: { name, description, inputSchema: ZodType, execute: (input, ctx) => Promise<TResult> }"
  - "Service token pattern: ctx.getService<SearchService>('SearchService') — class name string as DI token"
  - "Test framework independence by reading source file as text and asserting no AI library import strings"

requirements-completed: [AI-03]

coverage:
  - id: D1
    description: "ToolDef and ToolContext types defined in tool-def.ts with zero AI library imports"
    requirement: "AI-03"
    verification:
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#tool-def.ts exports ToolDef interface and ToolContext interface"
        status: pass
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#tool-def.ts has zero imports from ai or @ai-sdk"
        status: pass
    human_judgment: false
  - id: D2
    description: "searchArticlesTool delegates to SearchService.search, returns { articles: [{title, snippet, url}] }"
    requirement: "AI-03"
    verification:
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#searchArticlesTool.execute calls SearchService.search and returns { articles: [{title, snippet, url}] }"
        status: pass
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#searchArticlesTool.execute maps hits to { title, snippet, url } shape, dropping other fields"
        status: pass
    human_judgment: false
  - id: D3
    description: "getArticleTool delegates to ArticleService.getPublic, truncates content to 3000 chars, builds /posts/{abbrlink||id} URL"
    requirement: "AI-03"
    verification:
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#getArticleTool.execute calls ArticleService.getPublic and returns { title, content, url }"
        status: pass
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#getArticleTool.execute truncates content to 3000 characters via htmlToPlainText then .slice(0, 3000)"
        status: pass
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#getArticleTool.execute builds url as /posts/{abbrlink || id}"
        status: pass
      - kind: unit
        ref: "server/src/ai/tools/article-tools.spec.ts#getArticleTool.execute handles null content_html by returning empty string content"
        status: pass
    human_judgment: false
  - id: D4
    description: "AiModule imports SearchModule and ArticleModule for ToolContext DI resolution"
    requirement: "AI-03"
    verification:
      - kind: unit
        ref: "grep 'SearchModule|ArticleModule' src/ai/ai.module.ts — both modules in imports array"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-28
status: complete
---

# Phase 17 Plan 01: Framework-Agnostic Tool Definition Layer Summary

**ToolDef type + search_articles/get_article tools with Zod schemas delegating to SearchService/ArticleService via ToolContext.getService — zero AI library imports, 19 unit tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-28T01:00:34Z
- **Completed:** 2026-07-28T01:05:52Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- ToolDef generic interface and ToolContext interface defined in tool-def.ts with zero AI library imports (only zod + SettingsService type import)
- searchArticlesTool delegates to SearchService.search via ctx.getService, returns { articles: [{title, snippet, url}] } — maps hits dropping extra fields
- getArticleTool delegates to ArticleService.getPublic via ctx.getService, strips HTML via htmlToPlainText, truncates to 3000 chars per D-351, builds /posts/{abbrlink||id} URL
- articleTools array exported for Phase 18 ChatService consumption
- AiModule updated to import SearchModule and ArticleModule, enabling ToolContext DI resolution
- 19 unit tests covering all behaviors + framework independence verification via source-text scanning

## Task Commits

Each task was committed atomically (TDD cycle):

1. **Task 1 RED: Failing tests for tool-def and article-tools** - `049e4c0` (test)
2. **Task 1 GREEN: ToolDef + article-tools implementation** - `81ac65c` (feat)

## Files Created/Modified
- `server/src/ai/tools/tool-def.ts` - ToolDef generic interface + ToolContext interface (zod + SettingsService type only)
- `server/src/ai/tools/article-tools.ts` - searchArticlesTool + getArticleTool + articleTools array (zero AI library runtime imports)
- `server/src/ai/tools/article-tools.spec.ts` - 19 vitest test cases covering schema validation, service delegation, content truncation, framework independence
- `server/src/ai/ai.module.ts` - Added SearchModule + ArticleModule to imports array

## Decisions Made
- D-350: ToolContext.getService<T>(token) used for service resolution — class name string as DI token, NestJS ModuleRef resolves in Phase 18
- D-351: Content truncated to 3000 chars via htmlToPlainText().slice(0, 3000) — sufficient for LLM summarization, prevents context bloat
- Framework independence verified by reading source file as text and asserting no "from 'ai'" or "@ai-sdk" strings in non-comment, non-type-import lines

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed framework independence test comment filtering**
- **Found during:** Task 1 (GREEN phase — tests failed on framework independence checks)
- **Issue:** JSDoc comment lines (starting with ` * `) contained the text "from 'ai'" as documentation, causing the source-text scan test to falsely report AI library imports
- **Fix:** Updated test filter to exclude `*` JSDoc comment lines in addition to `//` comment lines and `import type` lines
- **Files modified:** server/src/ai/tools/article-tools.spec.ts
- **Verification:** All 19 tests pass, framework independence checks correctly ignore comment text
- **Committed in:** 81ac65c (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test filter fix was necessary for framework independence verification to work correctly. No scope creep.

## Issues Encountered
- Framework independence test initially matched JSDoc comment text containing "from 'ai'" as documentation — fixed by improving the comment filter in the test

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ToolDef + articleTools ready for Phase 18 ChatService to import and convert to AI SDK tool() format
- AiModule has SearchModule + ArticleModule imported, enabling ToolContext.getService DI resolution
- Plan 02 (chat.schema.ts + ChatHistoryService) and Plan 03 (Drizzle migration) can proceed independently
- No blockers

## TDD Gate Compliance
- RED gate: `049e4c0` test commit exists (failing tests for all 17+ behaviors)
- GREEN gate: `81ac65c` feat commit exists after RED (implementation passing all tests)
- REFACTOR gate: No commit — code was already clean and minimal, no refactoring needed

## Self-Check: PASSED
- tool-def.ts: FOUND
- article-tools.ts: FOUND
- article-tools.spec.ts: FOUND
- ai.module.ts: FOUND (modified)
- Commit 049e4c0: FOUND
- Commit 81ac65c: FOUND

---
*Phase: 17-ai-tools-chat-history-storage*
*Completed: 2026-07-28*
