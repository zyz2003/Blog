---
phase: 06-comment-search
plan: 02
subsystem: search
tags: [fts5, sqlite, bm25, full-text-search, nestjs]

requires:
  - phase: 01-infrastructure
    provides: DatabaseModule, DRIZZLE token, Sqids encoder, SettingsService
  - phase: 03-article-category-tag
    provides: articles schema, articlePostCategories/articlePostTags pivot schemas, postCategories/postTags schemas

provides:
  - SearchService with FTS5 index management (ensureFts5Table, rebuildAllIndexes, indexArticle, deleteArticle)
  - SearchService with bm25 weighted search (title=10.0, content=1.0, keywords=5.0)
  - SearchService with extractSnippet and normalizeSearchHits
  - SearchController with GET /api/search endpoint
  - SearchQueryDto, SearchHitDto, SearchPaginationDto, SearchResultDto
  - SearchModule exporting SearchService for ArticleService FTS5 hooks

affects: [article, comment]

tech-stack:
  added: [sqlite-fts5, unicode61-tokenizer]
  patterns: [contentless-fts5-virtual-table, bm25-weighted-ranking, startup-index-rebuild]

key-files:
  created:
    - server/src/search/search.service.ts
    - server/src/search/search.controller.ts
    - server/src/search/search.module.ts
    - server/src/search/dto/search-query.dto.ts
    - server/src/search/dto/search-response.dto.ts
    - server/src/search/search.service.spec.ts
  modified: []

key-decisions:
  - "FTS5 contentless mode with unicode61 tokenizer for zero-dependency full-text search per D-145, D-146"
  - "bm25(articles_fts, 10.0, 1.0, 5.0) ranking matches Go SimpleSearcher title+10/content+1 weights per D-147"
  - "FTS5 index rebuilt on startup from all published articles per D-150"
  - "SearchService.indexArticle/deleteArticle exposed for ArticleService hooks per D-151"
  - "extractSnippet strips HTML and truncates to 150 chars with Unicode-safe slicing per D-152"
  - "normalizeSearchHits fills type and url per Go search_service.go lines 86-109"

patterns-established:
  - "Contentless FTS5 virtual table: CREATE VIRTUAL TABLE ... USING fts5(..., content='', tokenize='unicode61 tokens 0')"
  - "FTS5 rowid equals articles.id for correct JOIN back to source table"
  - "HTML stripping before FTS5 indexing to prevent tag name pollution in search results"
  - "SearchService exported from SearchModule for cross-module FTS5 index hooks"

requirements-completed: [SEARCH-01]

coverage:
  - id: D1
    description: "FTS5 virtual table articles_fts created with contentless mode and unicode61 tokenizer"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 1: should create articles_fts virtual table with contentless mode and unicode61 tokenizer"
        status: pass
    human_judgment: false
  - id: D2
    description: "rebuildAllIndexes inserts all published articles into FTS5 with HTML-stripped content"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 2: should insert all published articles into FTS5 with HTML-stripped content"
        status: pass
    human_judgment: false
  - id: D3
    description: "indexArticle inserts single article into FTS5 with rowid=article.id"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 3: should insert a single article into FTS5 with rowid=article.id"
        status: pass
    human_judgment: false
  - id: D4
    description: "deleteArticle removes article from FTS5 by rowid"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 4: should remove an article from FTS5 by rowid"
        status: pass
    human_judgment: false
  - id: D5
    description: "search returns matching articles with bm25 ranking, paginated"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 5: should return matching articles with bm25 ranking, paginated"
        status: pass
    human_judgment: false
  - id: D6
    description: "Empty query returns empty results"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 6: should return empty results for empty query"
        status: pass
    human_judgment: false
  - id: D7
    description: "extractSnippet strips HTML tags and truncates to 150 chars with ellipsis"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 7: should strip HTML tags and truncate to 150 chars with ellipsis"
        status: pass
    human_judgment: false
  - id: D8
    description: "normalizeSearchHits fills type and url per Go search_service.go"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 8: should fill type and url for non-doc and doc articles"
        status: pass
    human_judgment: false
  - id: D9
    description: "GET /api/search endpoint with @Public() decorator and SearchQueryDto validation"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.service.spec.ts#Test 5 and Test 6 (controller delegates to service)"
        status: pass
    human_judgment: false
  - id: D10
    description: "SearchModule exports SearchService for ArticleService FTS5 hooks"
    requirement: SEARCH-01
    verification:
      - kind: unit
        ref: "server/src/search/search.module.ts (SearchService in exports array)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-08
status: complete
---

# Phase 06 Plan 02: FTS5 Full-Text Search Module Summary

**FTS5 full-text search with contentless virtual table, bm25 weighted ranking (title=10/content=1/keywords=5), and Go-compatible SearchResult format**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-08T13:48:26Z
- **Completed:** 2026-07-08T14:08:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SearchService with FTS5 index management: ensureFts5Table, rebuildAllIndexes, indexArticle, deleteArticle
- FTS5 search with bm25(articles_fts, 10.0, 1.0, 5.0) weighted ranking per D-147
- extractSnippet strips HTML and truncates to 150 chars with Unicode-safe slicing per D-152
- normalizeSearchHits fills type and url per Go search_service.go lines 86-109
- SearchController with GET /api/search endpoint and @Public() decorator per D-149
- SearchQueryDto with q (required), page (default 1), size (default 10) validation
- SearchHitDto, SearchPaginationDto, SearchResultDto matching Go SearchHit format per D-148
- SearchModule exports SearchService for ArticleService FTS5 hooks in Plan 05
- All 10 unit tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SearchService with FTS5 index management and search queries** (TDD)
   - `ca506fe` (test) — RED: failing tests for SearchService
   - `e04e870` (feat) — GREEN: SearchService implementation with all tests passing

2. **Task 2: Create SearchController, search DTOs, and wire SearchModule**
   - `995f59f` (feat) — SearchController, DTOs, and SearchModule wiring

## Files Created/Modified
- `server/src/search/search.service.ts` — SearchService with FTS5 index management, bm25 search, extractSnippet, normalizeSearchHits
- `server/src/search/search.controller.ts` — GET /api/search endpoint with @Public() decorator
- `server/src/search/search.module.ts` — SearchModule importing DatabaseModule/SettingsModule, exporting SearchService
- `server/src/search/dto/search-query.dto.ts` — SearchQueryDto with q, page, size validation
- `server/src/search/dto/search-response.dto.ts` — SearchHitDto, SearchPaginationDto, SearchResultDto interfaces
- `server/src/search/search.service.spec.ts` — 10 unit tests for SearchService

## Decisions Made
- FTS5 contentless mode with unicode61 tokenizer for zero-dependency full-text search per D-145, D-146
- bm25(articles_fts, 10.0, 1.0, 5.0) ranking matches Go SimpleSearcher title+10/content+1 weights per D-147
- FTS5 index rebuilt on startup from all published articles per D-150
- SearchService.indexArticle/deleteArticle exposed for ArticleService hooks per D-151
- extractSnippet strips HTML and truncates to 150 chars with Unicode-safe slicing per D-152
- normalizeSearchHits fills type and url per Go search_service.go lines 86-109

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test mocking required understanding Drizzle's sql`` tagged template object structure (queryChunks with StringChunk objects and raw parameter values) — resolved by implementing getSqlString/getSqlParams helpers that parse the Drizzle SQL object format
- Sqids encoder must be initialized before tests that call generatePublicID — resolved by calling initSqidsEncoderWithSeed('test-seed') at module level in test file

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SearchModule complete and registered in AppModule
- SearchService exported for ArticleService FTS5 hooks (Plan 05 will wire indexArticle/deleteArticle into ArticleService CRUD)
- FTS5 index rebuilds on startup ensuring data consistency
- GET /api/search endpoint ready for frontend integration testing

---
*Phase: 06-comment-search*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 7 created files verified present. All 3 task commits verified in git log (ca506fe, e04e870, 995f59f).
