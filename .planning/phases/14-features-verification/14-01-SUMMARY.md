---
phase: 14-features-verification
plan: 01
subsystem: api
tags: [link, sqids, int-id, verification, nestjs, drizzle]

requires:
  - phase: 07-statistics-links
    provides: Link service, controller, repository, DTOs
  - phase: 12-api-inventory-auth-verification
    provides: Risk marking (D-301, D-302, D-303) identifying Link.id type mismatch

provides:
  - Link.id returns raw DB int (number) instead of Sqids string, matching Go LinkDTO.id: int
  - Link path param parsing uses parseInt instead of decodePublicID
  - Batch delete/sort request DTOs accept numeric IDs (Go []int, not []string)
  - 25 link endpoint verification tests with field-by-field assertions
  - Fixed batchUpdateSort SQL syntax error (table-qualified columns in SET clause)
  - Fixed controller route ordering (PUT links/sort before PUT links/:id)
  - Added @HttpCode(HttpStatus.OK) to all PUT endpoints matching Go

affects: [15-final-integration-cutover]

tech-stack:
  added: []
  patterns: [raw-int-id-for-link-entities, parseInt-for-link-path-params]

key-files:
  created:
    - server/test/phase14-verification/link-verification.spec.ts
  modified:
    - server/src/link/link.service.ts
    - server/src/link/link.controller.ts
    - server/src/link/link.repository.ts
    - server/src/link/dto/batch-delete-links-request.dto.ts
    - server/src/link/dto/batch-update-sort-request.dto.ts

key-decisions:
  - "D-301/D-303: Link.id returns raw DB int (number), not Sqids string — matches Go LinkDTO.id: int"
  - "D-302: LinkCategory.id and LinkTag.id remain raw DB int (already correct)"
  - "Link path params use parseInt instead of decodePublicID — matches Go strconv.Atoi"
  - "BatchDeleteLinksRequestDto.ids changed from string[] to number[] — matches Go []int"
  - "BatchUpdateSortRequestDto.SortItem.id changed from string to number — matches Go int"
  - "All PUT endpoints use @HttpCode(HttpStatus.OK) — matches Go response.Success"

patterns-established:
  - "Raw int ID for Link entities (not Sqids-encoded) — differs from Article/Page which use Sqids"
  - "parseInt for link path param parsing with isNaN/<=0 validation — per T-14-01 threat mitigation"

requirements-completed: [LINK-FRIEND-01]

coverage:
  - id: D1
    description: "Link.id returns raw DB int in all 25 endpoint responses, matching Go LinkDTO.id: int"
    requirement: LINK-FRIEND-01
    verification:
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#GET /api/links returns list with numeric link.id"
        status: pass
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#POST /api/links creates link with numeric id"
        status: pass
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#PUT /api/links/:id with numeric ID updates link"
        status: pass
    human_judgment: false
  - id: D2
    description: "Link path param parsing uses parseInt with validation (not decodePublicID)"
    requirement: LINK-FRIEND-01
    verification:
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#PUT /api/links/:id with numeric ID updates link"
        status: pass
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#DELETE /api/links/:id with numeric ID deletes link"
        status: pass
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#PUT /api/links/:id/review with numeric ID succeeds"
        status: pass
    human_judgment: false
  - id: D3
    description: "Batch operations work with numeric IDs (batch-delete, sort)"
    requirement: LINK-FRIEND-01
    verification:
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#DELETE /api/links/batch-delete with numeric IDs succeeds"
        status: pass
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#PUT /api/links/sort with numeric IDs succeeds"
        status: pass
    human_judgment: false
  - id: D4
    description: "All 25 link endpoint verification tests pass with field-by-field Go DTO assertions"
    requirement: LINK-FRIEND-01
    verification:
      - kind: integration
        ref: "server/test/phase14-verification/link-verification.spec.ts#25 tests"
        status: pass
    human_judgment: false

duration: 51min
completed: 2026-07-21
status: complete
---

# Phase 14 Plan 01: Link ID Type Fix & Verification Summary

**Fixed Link.id to return raw DB int matching Go LinkDTO.id: int, verified all 25 friend link endpoints field-by-field**

## Performance

- **Duration:** 51 min
- **Started:** 2026-07-21T12:18:37Z
- **Completed:** 2026-07-21T13:09:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Fixed Link.id type mismatch: raw DB int (number) instead of Sqids string, matching Go LinkDTO.id: int per D-301/D-303
- Replaced decodePublicID with parseInt in adminUpdateLink, adminDeleteLink, reviewLink — matches Go strconv.Atoi
- Updated BatchDeleteLinksRequestDto.ids from string[] to number[] and BatchUpdateSortRequestDto.SortItem.id from string to number
- Created comprehensive 25-test verification suite covering all link endpoints with field-by-field Go DTO assertions
- Fixed batchUpdateSort SQL syntax error (table-qualified columns invalid in SQLite SET clause)
- Fixed controller route ordering (PUT links/sort before PUT links/:id to prevent route conflict)
- Added @HttpCode(HttpStatus.OK) to all PUT endpoints matching Go response.Success behavior

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing test for Link.id numeric type** - `0cfe7aa` (test)
2. **Task 1 (GREEN): Fix Link.id to return raw DB int and verify endpoints** - `285f7dd` (feat)
3. **Task 2: Extend link verification tests to cover all 25 endpoints** - `9657093` (feat)

## Files Created/Modified
- `server/test/phase14-verification/link-verification.spec.ts` - 25 link endpoint verification tests with Go DTO field-by-field assertions
- `server/src/link/link.service.ts` - toLinkResponseDTO returns link.id as number; parseInt replaces decodePublicID; removed unused sqids imports
- `server/src/link/link.controller.ts` - Added @HttpCode(HttpStatus.OK) to all PUT endpoints; reordered PUT links/sort before PUT links/:id
- `server/src/link/link.repository.ts` - Fixed batchUpdateSort SQL (removed table-qualified column names in SET clause)
- `server/src/link/dto/batch-delete-links-request.dto.ts` - ids: string[] changed to ids: number[] with @IsInt validator
- `server/src/link/dto/batch-update-sort-request.dto.ts` - SortItem.id: string changed to number with @IsInt validator

## Decisions Made
- D-301/D-303 confirmed: Link.id returns raw DB int (number), not Sqids string, matching Go LinkDTO.id: int
- D-302 confirmed: LinkCategory.id and LinkTag.id remain raw DB int (already correct in existing code)
- Link path params use parseInt instead of decodePublicID, matching Go's strconv.Atoi behavior
- BatchDeleteLinksRequestDto.ids changed from string[] to number[], matching Go's []int
- BatchUpdateSortRequestDto.SortItem.id changed from string to number, matching Go's int
- All PUT endpoints use @HttpCode(HttpStatus.OK), matching Go's response.Success behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed batchUpdateSort SQL syntax error**
- **Found during:** Task 1 (verification)
- **Issue:** `UPDATE "links" SET "links"."sort_order" = CASE "links"."id"...` fails in SQLite — table-qualified column names are invalid in SET clause
- **Fix:** Rewrote SQL using raw `UPDATE links SET sort_order = CASE id...` without Drizzle table references
- **Files modified:** server/src/link/link.repository.ts
- **Verification:** PUT /api/links/sort test passes
- **Committed in:** 285f7dd (Task 1 commit)

**2. [Rule 1 - Bug] Fixed controller route ordering**
- **Found during:** Task 1 (verification)
- **Issue:** PUT links/sort declared after PUT links/:id, causing NestJS to match "sort" as :id param, returning 404
- **Fix:** Moved PUT links/sort before PUT links/:id in controller
- **Files modified:** server/src/link/link.controller.ts
- **Verification:** PUT /api/links/sort test passes
- **Committed in:** 285f7dd (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added @HttpCode(HttpStatus.OK) to PUT endpoints**
- **Found during:** Task 1 (verification)
- **Issue:** NestJS PUT defaults to 201, but Go returns 200 for all link PUT endpoints (response.Success)
- **Fix:** Added @HttpCode(HttpStatus.OK) to all PUT endpoints (links/:id, links/:id/review, links/sort, links/categories/:id, links/tags/:id)
- **Files modified:** server/src/link/link.controller.ts
- **Verification:** All PUT endpoint tests expect and receive 200
- **Committed in:** 285f7dd (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug fix x2, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for API compatibility with Go backend. No scope creep.

## Issues Encountered
- Review endpoint test initially failed with 400 because card-style category requires siteshot on approval — fixed by adding siteshot to test request
- Void responses (delete, review, sort) don't include `data` property in global interceptor wrapper — adjusted test assertions to not require `data` property

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Link.id type mismatch (HIGH risk per D-283) fully resolved
- All 25 link endpoints verified field-by-field against Go DTOs
- Ready for Phase 14 Plan 02 (next feature verification)

## Self-Check: PASSED

- All 6 modified/created files exist
- All 3 commits found in git log (0cfe7aa, 285f7dd, 9657093)
- No generatePublicID usage for EntityType.Link in link.service.ts
- No decodePublicID usage in link.service.ts
- 25/25 link verification tests pass
- 37/37 existing link API compat tests pass (no regression)

---
*Phase: 14-features-verification*
*Completed: 2026-07-21*
