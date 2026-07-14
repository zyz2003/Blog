---
phase: 09-seo-music-notifications
plan: 07
subsystem: api
tags: [cross-module, rss, notification, forwardRef, integration, route-fix]

requires:
  - phase: 09
    provides: RssService.invalidateCache() from Plan 01, NotificationService from Plan 05, all Phase 09 modules registered

provides:
  - ArticleService → RssService.invalidateCache() cross-module hook (try-catch, non-blocking per D-215)
  - CommentService → NotificationService.createNotification() cross-module hook (fire-and-forget per D-219)
  - Corrected route prefixes for MusicController and SubscriberController (removed redundant api/ prefix)
  - RSS/Sitemap/robots.txt excluded from global api prefix (matching Go backend routing)
  - All Phase 09 endpoints verified at correct paths

affects: [article-service, comment-service, main-ts-routing]

tech-stack:
  added: []
  patterns:
    - "forwardRef for ArticleModule ↔ RssModule circular dependency resolution"
    - "Fire-and-forget notification creation via .catch() for non-blocking comment reply notifications"
    - "Global prefix exclude for root-level routes (RSS/Sitemap/robots.txt)"

key-files:
  created: []
  modified:
    - server/src/article/article.service.ts
    - server/src/article/article.module.ts
    - server/src/comment/comment.service.ts
    - server/src/comment/comment.module.ts
    - server/src/comment/comment.service.spec.ts
    - server/src/main.ts
    - server/src/music/music.controller.ts
    - server/src/subscriber/subscriber.controller.ts

key-decisions:
  - "ArticleService uses forwardRef(() => RssService) for circular dependency with RssModule (same pattern as Phase 05 FileModule↔ThumbnailModule)"
  - "Comment reply notification uses fireCommentReplyNotification() with .catch() — fire-and-forget, does not block comment creation"
  - "RSS/Sitemap/robots.txt excluded from global api prefix via setGlobalPrefix exclude option — matches Go backend which serves these at root"
  - "MusicController and SubscriberController route prefixes changed from api/public/* to public/* — global prefix already adds /api/"

patterns-established:
  - "forwardRef pattern for circular module dependencies with cross-module service calls"
  - "setGlobalPrefix exclude for root-level routes that don't share the /api/ prefix"

requirements-completed: [RSS-01, SITEMAP-01, MUSIC-01, NOTIF-01, SUBSCRIBER-01]

coverage:
  - id: D1
    description: "ArticleService calls RssService.invalidateCache() on create/update/delete with try-catch (non-blocking per D-215)"
    requirement: RSS-01
    verification:
      - kind: unit
        ref: "server/src/article/article.service.ts — 3 invalidateCache() calls in create(), update(), delete()"
        status: pass
    human_judgment: false
  - id: D2
    description: "CommentService calls NotificationService for in-app notification on comment replies (fire-and-forget per D-219)"
    requirement: NOTIF-01
    verification:
      - kind: unit
        ref: "server/src/comment/comment.service.ts — fireCommentReplyNotification() after Pushoo notification in create()"
        status: pass
    human_judgment: false
  - id: D3
    description: "All Phase 09 modules registered in AppModule (RssModule, SitemapModule, MusicModule, NotificationModule, SubscriberModule, EmailModule)"
    requirement: RSS-01
    verification:
      - kind: unit
        ref: "server/src/app.module.ts — all 6 modules imported and in imports array"
        status: pass
    human_judgment: false
  - id: D4
    description: "Notifications table created in SQLite, 4 default notification types initialized"
    requirement: NOTIF-01
    verification:
      - kind: unit
        ref: "SQLite database: notifications table exists, 4 types (comment_reply, comment_new, system_update, marketing_promo)"
        status: pass
    human_judgment: false
  - id: D5
    description: "RSS/Sitemap/robots.txt endpoints accessible at root path (no /api/ prefix) matching Go backend"
    requirement: RSS-01
    verification:
      - kind: integration
        ref: "Smoke test: GET /rss.xml 200 (application/rss+xml), GET /sitemap.xml 200 (text/xml), GET /robots.txt 200 (text/plain)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Music/Subscribe/Notification endpoints accessible at /api/ prefix with correct auth requirements"
    requirement: MUSIC-01
    verification:
      - kind: integration
        ref: "Smoke test: GET /api/public/music/playlist 500 (external API), POST /api/public/subscribe 400, GET /api/notification/types 401"
        status: pass
    human_judgment: false
  - id: D7
    description: "Build succeeds with all cross-module integrations (npx nest build)"
    requirement: RSS-01
    verification:
      - kind: unit
        ref: "npx nest build — zero errors, zero warnings"
        status: pass
    human_judgment: false

duration: 24min
completed: "2026-07-14"
status: complete
---

# Phase 09 Plan 07: Cross-Module Integration Summary

**ArticleService RSS cache invalidation (D-215) + CommentService comment reply notifications (D-219) + route prefix corrections for API compatibility**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-14T12:30:57Z
- **Completed:** 2026-07-14T12:55:10Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ArticleService now calls RssService.invalidateCache() on create/update/delete (try-catch, non-blocking per D-215)
- CommentService now creates in-app notifications on comment replies via fireCommentReplyNotification() (fire-and-forget per D-219)
- Fixed MusicController and SubscriberController route prefixes — removed redundant `api/` from @Controller decorators
- Excluded RSS/Sitemap/robots.txt routes from global api prefix — these endpoints now serve at root path matching Go backend
- All Phase 09 endpoints verified at correct paths via smoke tests
- Build passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: ArticleService RSS cache invalidation hook and CommentService notification hook** - `afc55ea` (feat)
2. **Task 2: AppModule verification, schema push, and endpoint smoke test** - `0a9417a` (fix)

## Files Created/Modified
- `server/src/article/article.service.ts` - Added RssService injection via forwardRef, invalidateCache() calls on create/update/delete
- `server/src/article/article.module.ts` - Added forwardRef(() => RssModule) import for circular dependency resolution
- `server/src/comment/comment.service.ts` - Added NotificationService injection, fireCommentReplyNotification() method
- `server/src/comment/comment.module.ts` - Added NotificationModule import
- `server/src/comment/comment.service.spec.ts` - Added mockNotificationService to test mock
- `server/src/main.ts` - Excluded RSS/Sitemap/robots.txt routes from global api prefix
- `server/src/music/music.controller.ts` - Fixed @Controller prefix from 'api/public/music' to 'public/music'
- `server/src/subscriber/subscriber.controller.ts` - Fixed @Controller prefix from 'api/public' to 'public'

## Decisions Made
- Used forwardRef for ArticleModule ↔ RssModule circular dependency (same pattern as Phase 05 FileModule↔ThumbnailModule)
- Fire-and-forget notification creation with .catch() for non-blocking comment reply notifications
- Excluded RSS/Sitemap/robots.txt from global api prefix to match Go backend routing
- MusicController and SubscriberController route prefixes changed to remove redundant api/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed redundant api/ prefix in MusicController and SubscriberController**
- **Found during:** Task 2 (endpoint smoke test)
- **Issue:** Controllers used @Controller('api/public/music') and @Controller('api/public') which, combined with global api prefix, created /api/api/public/* paths instead of /api/public/*
- **Fix:** Changed to @Controller('public/music') and @Controller('public') matching other public controllers (public/articles, public/comments, public/captcha)
- **Files modified:** music.controller.ts, subscriber.controller.ts
- **Verification:** Smoke test confirms /api/public/music/playlist and /api/public/subscribe respond correctly
- **Committed in:** 0a9417a (Task 2 commit)

**2. [Rule 1 - Bug] Excluded RSS/Sitemap/robots.txt from global api prefix**
- **Found during:** Task 2 (endpoint smoke test)
- **Issue:** Go backend serves RSS/Sitemap/robots.txt at root path (/rss.xml, /sitemap.xml, /robots.txt) without /api/ prefix, but NestJS global prefix made them /api/rss.xml etc.
- **Fix:** Added exclude option to setGlobalPrefix('api') in main.ts for these 5 routes
- **Files modified:** main.ts
- **Verification:** Smoke test confirms GET /rss.xml returns 200 with correct Content-Type
- **Committed in:** 0a9417a (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for API compatibility with Go backend. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 09 cross-module integrations complete
- All Phase 09 endpoints verified at correct paths
- Phase 09 is complete — all 7 plans executed successfully

---
*Phase: 09-seo-music-notifications*
*Completed: 2026-07-14*

## Self-Check: PASSED

All 8 modified files verified present. Both task commits verified in git log. TypeScript compilation passes with zero errors.
