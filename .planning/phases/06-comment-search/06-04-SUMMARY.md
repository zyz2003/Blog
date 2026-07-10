---
phase: 06-comment-search
plan: 04
subsystem: api
tags: [nestjs, controller, guard, dto, comment]

# Dependency graph
requires:
  - phase: 06-03
    provides: CommentService with all business logic methods
provides:
  - CommentController with 7 public endpoints at /api/public/comments
  - CommentAdminController with 6 admin endpoints at /api/comments
  - CommentModule wired with DatabaseModule, SettingsModule, StoragePolicyModule, FileModule
affects: [06-05, app.module]

# Tech tracking
tech-stack:
  added: []
  patterns: [public-controller-with-optional-auth, admin-controller-with-class-level-guard, forwardRef-module-import]

key-files:
  created:
    - server/src/comment/comment.controller.ts
    - server/src/comment/comment-admin.controller.ts
  modified:
    - server/src/comment/comment.module.ts

key-decisions:
  - "D-144: FileModule and StoragePolicyModule imported in CommentModule despite plan saying they'd be deferred to Plan 05 — CommentService has hard dependencies on UploadService, StoragePolicyService, FileService that would cause DI failure"
  - "D-145: FileModule imported via forwardRef for circular dependency safety matching FileModule<->ThumbnailModule pattern"

patterns-established:
  - "Public controller pattern: @Public() class decorator + @UseGuards(JwtAuthOptionalGuard) on create/upload methods"
  - "Admin controller pattern: @UseGuards(AdminGuard) at class level, no @Public()"
  - "Route ordering: specific routes (latest, upload) declared before parametric (:id) to prevent capture"

requirements-completed: [COMMENT-01]

coverage:
  - id: D1
    description: "CommentController with 7 public endpoints matching Go commentsPublic route group"
    requirement: COMMENT-01
    verification:
      - kind: unit
        ref: "server/src/comment/comment.service.spec.ts#CommentService tests (service methods called by controller)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CommentAdminController with 6 admin endpoints matching Go commentsAdmin route group"
    requirement: COMMENT-01
    verification:
      - kind: unit
        ref: "server/src/comment/comment.service.spec.ts#CommentService admin operation tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "CommentModule wired with all required dependency modules"
    requirement: COMMENT-01
    verification:
      - kind: unit
        ref: "server/src/comment/comment.service.spec.ts#all 57 tests pass with module wiring"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-07-09
status: complete
---

# Phase 06 Plan 04: Comment Controllers & Module Wiring Summary

**CommentController (7 public endpoints) and CommentAdminController (6 admin endpoints) with correct guards, route ordering, and CommentModule dependency wiring**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-09T13:56:41Z
- **Completed:** 2026-07-09T14:09:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- CommentController with 7 public endpoints matching Go commentsPublic route group (listByPath, listLatest, listChildren, create, uploadImage, like, unlike)
- CommentAdminController with 6 admin endpoints matching Go commentsAdmin route group (adminList, delete, updateContent, updateCommentInfo, updateStatus, setPin)
- Correct guard configuration: @Public() + JwtAuthOptionalGuard for public create/upload, AdminGuard at class level for admin endpoints
- IP extraction with x-forwarded-for proxy header support in create method
- Route ordering prevents 'latest' and 'upload' from being captured as :id param
- CommentModule wired with DatabaseModule, SettingsModule, StoragePolicyModule, FileModule

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CommentController and CommentAdminController** - `9dd2f82` (feat)
2. **Task 2: Wire CommentModule with all dependencies** - `d56cd89` (feat)

## Files Created/Modified
- `server/src/comment/comment.controller.ts` - 7 public endpoints at /api/public/comments with @Public() and JwtAuthOptionalGuard
- `server/src/comment/comment-admin.controller.ts` - 6 admin endpoints at /api/comments with AdminGuard
- `server/src/comment/comment.module.ts` - Module wiring with DatabaseModule, SettingsModule, StoragePolicyModule, FileModule (forwardRef)

## Decisions Made
- **D-144:** Imported FileModule and StoragePolicyModule in CommentModule despite plan saying they'd be deferred to Plan 05. CommentService has hard (non-@Optional) dependencies on UploadService, StoragePolicyService, and FileService — omitting these imports would cause NestJS DI failure at runtime.
- **D-145:** Used forwardRef(() => FileModule) for FileModule import to handle potential circular dependency, matching the established pattern from FileModule<->ThumbnailModule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added FileModule and StoragePolicyModule imports to CommentModule**
- **Found during:** Task 2 (CommentModule wiring)
- **Issue:** Plan specified only DatabaseModule and SettingsModule imports, deferring FileModule and WeatherModule to Plan 05. However, CommentService constructor has hard dependencies on UploadService (from FileModule), StoragePolicyService (from StoragePolicyModule), and FileService (from FileModule) — none marked @Optional. Without these imports, NestJS dependency injection would fail at runtime.
- **Fix:** Added StoragePolicyModule and FileModule (via forwardRef) imports alongside DatabaseModule and SettingsModule. WeatherModule remains omitted since GeoIPService is @Optional.
- **Files modified:** server/src/comment/comment.module.ts
- **Verification:** All 57 comment tests pass; TypeScript compilation succeeds for controller files
- **Committed in:** d56cd89 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix was necessary for runtime correctness. No scope creep — the imports are required by existing CommentService code from Plan 03.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CommentController and CommentAdminController ready for integration testing
- Plan 05 will add WeatherModule import for GeoIPService (replacing HTTP fallback)
- Plan 05 will add QQ info and IP location endpoints (Go router.go lines 266-267)
- Plan 05 will add export/import admin endpoints (Go router.go lines 287-288)

## Self-Check: PASSED

- 06-04-SUMMARY.md: FOUND
- Task 1 commit 9dd2f82: FOUND
- Task 2 commit d56cd89: FOUND

---
*Phase: 06-comment-search*
*Completed: 2026-07-09*
