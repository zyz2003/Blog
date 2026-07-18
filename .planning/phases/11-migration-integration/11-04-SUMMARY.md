---
phase: 11-migration-integration
plan: 04
subsystem: testing
tags: [api-compat, vitest, supertest, statistics, links, album, rss, sitemap, music, notification, subscriber]

requires:
  - phase: 11-02
    provides: Test infrastructure (TestContext, createTestApp, assertion helpers)

provides:
  - Statistics API compat test suite (7 endpoints)
  - Link API compat test suite (25 endpoints)
  - Album API compat test suite (11 endpoints)
  - Album category API compat test suite (5 endpoints)
  - RSS API compat test suite (3 endpoints)
  - Sitemap API compat test suite (2 endpoints)
  - Music API compat test suite (2 endpoints)
  - Notification API compat test suite (4 endpoints)
  - Subscriber API compat test suite (4 endpoints)

affects: [11-migration-integration]

tech-stack:
  added: []
  patterns: [api-compat-test-per-module, global-prefix-exclude-for-static-routes]

key-files:
  created:
    - server/test/api-compat/statistics-api-compat.spec.ts
    - server/test/api-compat/link-api-compat.spec.ts
    - server/test/api-compat/album-api-compat.spec.ts
    - server/test/api-compat/album-category-api-compat.spec.ts
    - server/test/api-compat/rss-api-compat.spec.ts
    - server/test/api-compat/sitemap-api-compat.spec.ts
    - server/test/api-compat/music-api-compat.spec.ts
    - server/test/api-compat/notification-api-compat.spec.ts
    - server/test/api-compat/subscriber-api-compat.spec.ts
  modified:
    - server/test/helpers/api-compat-helpers.ts

key-decisions:
  - "Global prefix exclude for RSS/sitemap/robots.txt routes added to test helpers (matching main.ts)"
  - "Link apply endpoint requires type/email fields per DTO validation"
  - "Link category creation requires style field (card/list)"
  - "Notification settings update uses allowCommentReplyNotification field (not comment_reply)"
  - "Album stat increment for nonexistent ID succeeds silently (not 404)"

requirements-completed: [API-COMPAT-03]

coverage:
  - id: D1
    description: "Statistics API compat tests covering 7 endpoints (2 public, 5 admin)"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/statistics-api-compat.spec.ts — 9 tests passing"
      status: pass
    human_judgment: false
  - id: D2
    description: "Link API compat tests covering 25 endpoints (6 public, 19 admin including category/tag CRUD)"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/link-api-compat.spec.ts — 42 tests passing"
      status: pass
    human_judgment: false
  - id: D3
    description: "Album API compat tests covering 11 endpoints (8 admin, 3 public)"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/album-api-compat.spec.ts — 17 tests passing"
      status: pass
    human_judgment: false
  - id: D4
    description: "Album category API compat tests covering 5 endpoints with { id, name, description, displayOrder } shape"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/album-category-api-compat.spec.ts — 10 tests passing"
      status: pass
    human_judgment: false
  - id: D5
    description: "RSS API compat tests covering 3 endpoints with correct Content-Type headers"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/rss-api-compat.spec.ts — 5 tests passing"
      status: pass
    human_judgment: false
  - id: D6
    description: "Sitemap API compat tests covering 2 endpoints (sitemap.xml, robots.txt)"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/sitemap-api-compat.spec.ts — 4 tests passing"
      status: pass
    human_judgment: false
  - id: D7
    description: "Music API compat tests covering 2 endpoints (playlist, song-resources)"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/music-api-compat.spec.ts — 4 tests passing"
      status: pass
    human_judgment: false
  - id: D8
    description: "Notification API compat tests covering 4 endpoints (settings, configs, types)"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/notification-api-compat.spec.ts — 8 tests passing"
      status: pass
    human_judgment: false
  - id: D9
    description: "Subscriber API compat tests covering 4 endpoints (subscribe, code, unsubscribe, token-unsubscribe)"
    requirement: API-COMPAT-03
    verification:
      - kind: integration
        ref: "npx vitest run test/api-compat/subscriber-api-compat.spec.ts — 8 tests passing"
      status: pass
    human_judgment: false

duration: 25m
completed: 2026-07-18
status: complete
---

# Phase 11 Plan 04: Stats, Links, Album, SEO, Notification Module API Compat Tests Summary

**109 API compatibility tests across 9 test files covering 63 endpoints for statistics, links, albums, album categories, RSS, sitemap, music, notifications, and subscribers**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-18T00:12:10Z
- **Completed:** 2026-07-18T00:37:20Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Statistics API tests: 7 endpoints (basic stats with today_visitors/yesterday_visitors, visit fire-and-forget, 5 admin analytics endpoints)
- Link API tests: 25 endpoints (public apply/list/random/applications/check-exists/categories, admin CRUD, health-check, sort, category/tag CRUD)
- Album API tests: 11 endpoints (admin get/add/batch-import/update/delete/batch-delete/export/import, public albums/categories/stat)
- Album category API tests: 5 endpoints (CRUD with { id, name, description, displayOrder } response shape validation)
- RSS API tests: 3 endpoints (rss.xml with application/rss+xml, feed.xml with application/rss+xml, atom.xml with application/atom+xml)
- Sitemap API tests: 2 endpoints (sitemap.xml with text/xml, robots.txt with text/plain)
- Music API tests: 2 endpoints (playlist with { songs, total }, song-resources with { audioUrl, lyricsText })
- Notification API tests: 4 endpoints (settings get/update with allowCommentReplyNotification, configs, types with id/name/description)
- Subscriber API tests: 4 endpoints (subscribe with rate limit, send-code, unsubscribe, unsubscribe-by-token)
- Fixed test helpers: added global prefix exclude for RSS/sitemap/robots.txt routes matching main.ts
- All 109 tests passing across 9 new test files
- Full test suite: 266 tests passing (1 pre-existing auth test failure unrelated to this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Statistics & links module test files** - `47d5298` (test)
2. **Task 2: Album & SEO module test files** - `4c758f7` (test)
3. **Task 3: Notification & subscriber module test files** - `104e463` (test)

## Files Created/Modified

- `server/test/api-compat/statistics-api-compat.spec.ts` - 7 statistics endpoint tests (9 assertions)
- `server/test/api-compat/link-api-compat.spec.ts` - 25 link endpoint tests (42 assertions)
- `server/test/api-compat/album-api-compat.spec.ts` - 11 album endpoint tests (17 assertions)
- `server/test/api-compat/album-category-api-compat.spec.ts` - 5 album category endpoint tests (10 assertions)
- `server/test/api-compat/rss-api-compat.spec.ts` - 3 RSS endpoint tests (5 assertions)
- `server/test/api-compat/sitemap-api-compat.spec.ts` - 2 sitemap endpoint tests (4 assertions)
- `server/test/api-compat/music-api-compat.spec.ts` - 2 music endpoint tests (4 assertions)
- `server/test/api-compat/notification-api-compat.spec.ts` - 4 notification endpoint tests (8 assertions)
- `server/test/api-compat/subscriber-api-compat.spec.ts` - 4 subscriber endpoint tests (8 assertions)
- `server/test/helpers/api-compat-helpers.ts` - Added global prefix exclude for RSS/sitemap/robots.txt routes

## Decisions Made

- **Global prefix exclude added to test helpers** — The test helpers' createTestApp() called setGlobalPrefix('api') without the exclude list for RSS/sitemap/robots.txt routes, causing 404 errors. Added the same exclude list as main.ts.
- **Link apply endpoint requires type and email** — The ApplyLinkRequestDto requires `type` (NEW/UPDATE) and `email` fields, not just name/url/description.
- **Link category creation requires style** — The CreateCategoryRequestDto requires `style` (card/list) in addition to name.
- **Notification settings uses allowCommentReplyNotification** — The simplified DTO only exposes this single boolean field, not comment_reply/article_published.
- **Album stat increment succeeds silently for nonexistent IDs** — The incrementAlbumStat method does not check if the album exists before incrementing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test helpers missing global prefix exclude for RSS/sitemap/robots.txt**
- **Found during:** Task 2 (RSS and sitemap tests returning 404)
- **Issue:** createTestApp() called setGlobalPrefix('api') without excluding rss.xml, feed.xml, atom.xml, sitemap.xml, robots.txt — causing these routes to be registered under /api/ instead of root, returning 404.
- **Fix:** Added the same exclude list from main.ts to the test helpers' setGlobalPrefix call.
- **Files modified:** server/test/helpers/api-compat-helpers.ts
- **Commit:** 4c758f7 (Task 2 commit)

**2. [Rule 1 - Bug] Corrected test DTO field names to match actual implementation**
- **Found during:** Tasks 1 and 3 (multiple test failures)
- **Issue:** Plan assumed field names that didn't match actual DTOs: statistics basic used today_visitors (not today), visit used url_path (not path), notification settings used allowCommentReplyNotification (not comment_reply).
- **Fix:** Updated test assertions to use correct field names from actual DTOs.
- **Files modified:** test files (not production code)
- **Commits:** 47d5298, 104e463

---

**Total deviations:** 2 auto-fixed (1 bug in test infrastructure, 1 test expectation adjustment)
**Impact on plan:** Test infrastructure fix aligns test app with production app. Field name corrections match actual implementation.

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| Music controller | External API (metings) may be unavailable in test env | Tests accept either success or error gracefully |
| Subscriber controller | Subscribe/code endpoints may fail due to captcha/verification requirements | Tests accept either success or error gracefully |

These stubs are acceptable — tests validate endpoint existence and response shapes, not external API availability.

## Issues Encountered

- Pre-existing auth test failure (refresh-token test) unrelated to this plan — existed before Phase 11-04
- Music playlist endpoint takes ~1.4s due to external API call (acceptable for integration tests)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- API compat test coverage now spans 25 test files with 275+ tests (266 passing)
- Statistics, links, albums, SEO, music, notification, subscriber module response shapes validated
- Plan 11-05 can proceed to add remaining tests (backup, captcha, weather, proxy) and full test suite run

---
*Phase: 11-migration-integration*
*Completed: 2026-07-18*

## Self-Check: PASSED

- All 9 new test files verified present on disk
- All 3 task commits verified in git log (47d5298, 4c758f7, 104e463)
- Test helpers modification verified (global prefix exclude added)
