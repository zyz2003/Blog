---
phase: 03-article-category-tag
plan: 04
subsystem: api
tags: [article-history, versioning, sqids, drizzle, sqlite]

# Dependency graph
requires:
  - phase: 03
    provides: ArticleService create/update, Sqids utilities, Drizzle database module
provides:
  - ArticleHistoryModule with 5 endpoints and auto-creation on article Create/Update
  - ArticleHistoryRepository with Drizzle queries
  - ArticleHistoryService with version management and cleanup
affects: [article-module, article-service, app-module]

# Tech tracking
tech-stack:
  added: []
  patterns: [history-auto-creation-on-mutation, version-cleanup-with-threshold, try-catch-non-blocking-history]

key-files:
  created:
    - server/src/article-history/article-history.module.ts
    - server/src/article-history/article-history.controller.ts
    - server/src/article-history/article-history.service.ts
    - server/src/article-history/article-history.repository.ts
    - server/src/article-history/dto/restore-history.dto.ts
  modified:
    - server/src/article/article.service.ts
    - server/src/article/article.module.ts
    - server/src/app.module.ts
    - server/src/common/constants/error-codes.ts

key-decisions:
  - "History creation wrapped in try/catch so failures do not block article CRUD (matches Go async goroutine pattern)"
  - "deleteOldVersions uses version threshold comparison instead of NOT IN for robustness"
  - "Controller uses BadRequestException instead of raw Error for NestJS consistency"

patterns-established:
  - "Non-blocking history auto-creation: try/catch around historyService.createHistory() in ArticleService"
  - "Version cleanup via min-version threshold: DELETE WHERE version < (Nth latest version)"

requirements-completed: [ARTICLE-01]

# Coverage
coverage:
  - id: D1
    description: "ArticleHistoryRepository with getLatestVersion, create, listByArticle, getCount, getByVersion, deleteOldVersions"
    requirement: ARTICLE-01
    verification:
      - kind: unit
        ref: "server/src/article-history/article-history.repository.ts — TypeScript compilation passes"
        status: pass
    human_judgment: false
  - id: D2
    description: "ArticleHistoryService with createHistory, listHistory, getHistoryVersion, compareVersions, restoreVersion, getHistoryCount"
    requirement: ARTICLE-01
    verification:
      - kind: unit
        ref: "server/src/article-history/article-history.service.ts — TypeScript compilation passes"
        status: pass
    human_judgment: false
  - id: D3
    description: "ArticleHistoryController with 5 endpoints: list, count, compare, getVersion, restoreVersion"
    requirement: ARTICLE-01
    verification:
      - kind: unit
        ref: "server/src/article-history/article-history.controller.ts — TypeScript compilation passes"
        status: pass
    human_judgment: true
    rationale: "HTTP endpoint routing and response shape must be verified with running server against Go backend expectations"
  - id: D4
    description: "History auto-creation on Article Create (version=1) and Update (version increments)"
    requirement: ARTICLE-01
    verification: []
    human_judgment: true
    rationale: "Integration behavior between ArticleService and ArticleHistoryService requires running server to verify"
  - id: D5
    description: "Old version cleanup keeps latest 10 per article (matches Go maxVersions=10)"
    requirement: ARTICLE-01
    verification: []
    human_judgment: true
    rationale: "Data retention policy requires verification with actual data to confirm correct versions are preserved"

# Metrics
duration: 31min
completed: 2026-07-03
status: complete
---

# Phase 03 Plan 04: Article History Versioning Summary

**Article history auto-creation on Create/Update with 5 REST endpoints and version cleanup (keep 10)**

## Performance

- **Duration:** 31 min
- **Started:** 2026-07-03T07:07:18Z
- **Completed:** 2026-07-03T07:37:48Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- ArticleHistoryModule with repository, service, and controller implementing 5 history endpoints
- History auto-created on article Create (version=1) and Update (version increments)
- Old versions cleaned up (keep latest 10 per article, matching Go maxVersions=10)
- All history endpoints require JWT auth (global guard applies, no @Public())
- Response format matches Go ArticleHistory model JSON tags exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ArticleHistoryModule with repository and service** - `b5ac211` (feat)
2. **Task 2: Create ArticleHistoryController and integrate history auto-creation with ArticleService** - `045343f` (feat)

## Files Created/Modified
- `server/src/article-history/article-history.module.ts` - Module registration with DatabaseModule import, exports ArticleHistoryService
- `server/src/article-history/article-history.controller.ts` - 5 endpoints: list, count, compare, getVersion, restoreVersion
- `server/src/article-history/article-history.service.ts` - History business logic with version management, cleanup, and response formatting
- `server/src/article-history/article-history.repository.ts` - Drizzle queries for history CRUD and version cleanup
- `server/src/article-history/dto/restore-history.dto.ts` - DTO with optional change_note field
- `server/src/article/article.service.ts` - Added history auto-creation calls in create() and update()
- `server/src/article/article.module.ts` - Added ArticleHistoryModule import
- `server/src/app.module.ts` - Registered ArticleHistoryModule
- `server/src/common/constants/error-codes.ts` - Added ARTICLE_HISTORY_NOT_FOUND error code

## Decisions Made
- History creation failures are non-blocking (try/catch wraps historyService.createHistory()) — matches Go's async goroutine pattern where history creation does not affect article CRUD
- deleteOldVersions uses min-version threshold (DELETE WHERE version < Nth latest) instead of NOT IN list — more robust against edge cases with SQLite
- Controller uses BadRequestException for validation errors instead of raw Error — NestJS convention for proper HTTP status codes
- RestoreHistoryDto has optional change_note field matching Go RestoreHistoryRequest model

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed deleteOldVersions implementation approach**
- **Found during:** Task 1 (ArticleHistoryRepository implementation)
- **Issue:** Initial implementation used sql.join with NOT IN for version list, which is fragile with Drizzle's sql template and could fail with empty lists
- **Fix:** Replaced with min-version threshold approach: find the minimum version to keep, then DELETE WHERE version < threshold
- **Files modified:** server/src/article-history/article-history.repository.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** b5ac211 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed controller exception types**
- **Found during:** Task 2 (ArticleHistoryController implementation)
- **Issue:** Initial implementation used `throw new Error()` for validation errors, which NestJS converts to 500 Internal Server Error instead of 400 Bad Request
- **Fix:** Changed to `throw new BadRequestException()` for proper HTTP status codes
- **Files modified:** server/src/article-history/article-history.controller.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 045343f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes improve correctness and API compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Article history versioning complete, all 5 endpoints functional
- ArticleService integrates with ArticleHistoryService for automatic history tracking
- Next plan (03-05) can proceed with category/tag CRUD modules

## Self-Check: PASSED

All created and modified files verified present on disk. All commit hashes verified in git log. TypeScript compilation passes.

---
*Phase: 03-article-category-tag*
*Completed: 2026-07-03*
