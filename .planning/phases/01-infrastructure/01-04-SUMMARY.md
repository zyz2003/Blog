---
phase: 01-infrastructure
plan: 04
subsystem: infra
tags: [drizzle, sqlite, schema, database, nestjs]

# Dependency graph
requires:
  - phase: 01-infrastructure
    plan: 01
    provides: "NestJS project scaffold with dependencies and module placeholders"
  - phase: 01-infrastructure
    plan: 02
    provides: "Common infrastructure with guards, interceptors, and Sqids"
  - phase: 01-infrastructure
    plan: 03
    provides: "Database infrastructure with first 12 Drizzle schema files"
provides:
  - "18 additional Drizzle schema files completing the full set of 30"
  - "schemas/index.ts barrel export re-exporting all 30 schema tables"
  - "link-tag-pivot join table for Link-LinkTag many-to-many"
affects: [02-auth-settings, 03-article-category-tag, 04-page-public-api, 05-file-upload-media, 06-comment-search, 07-statistics-links, 08-album-doc-series, 09-seo-music-notifications, 10-scheduled-tasks, 11-migration-integration]

# Tech tracking
tech-stack:
  added: ["real column type from drizzle-orm/sqlite-core for Float fields"]
  patterns: ["ES module imports for FK references (not require())", "real() for Go field.Float mapping", "Join table pattern for many-to-many edges"]

key-files:
  created:
    - "server/src/database/schemas/direct-link.schema.ts"
    - "server/src/database/schemas/storage-policy.schema.ts"
    - "server/src/database/schemas/comment.schema.ts"
    - "server/src/database/schemas/link.schema.ts"
    - "server/src/database/schemas/link-category.schema.ts"
    - "server/src/database/schemas/link-tag.schema.ts"
    - "server/src/database/schemas/link-tag-pivot.schema.ts"
    - "server/src/database/schemas/album.schema.ts"
    - "server/src/database/schemas/album-category.schema.ts"
    - "server/src/database/schemas/doc-series.schema.ts"
    - "server/src/database/schemas/notification-type.schema.ts"
    - "server/src/database/schemas/user-notification-config.schema.ts"
    - "server/src/database/schemas/user-installed-theme.schema.ts"
    - "server/src/database/schemas/subscriber.schema.ts"
    - "server/src/database/schemas/visitor-log.schema.ts"
    - "server/src/database/schemas/visitor-stat.schema.ts"
    - "server/src/database/schemas/url-stat.schema.ts"
    - "server/src/database/schemas/tag.schema.ts"
  modified:
    - "server/src/database/schemas/index.ts"

key-decisions:
  - "Used ES module imports for FK references (matching Plan 03 pattern) instead of require()"
  - "Used real() from drizzle-orm/sqlite-core for Go field.Float (avgDuration in url_stats)"
  - "link-tag-pivot join table created as explicit table (not in Go ent/schema directory, implied by many-to-many edge)"

requirements-completed: [INFRA-06]

coverage:
  - id: D1
    description: "All 30 Drizzle schema files exist matching Go ent/schema definitions"
    requirement: "INFRA-06"
    verification:
      - kind: integration
        ref: "ls server/src/database/schemas/*.schema.ts | wc -l = 30"
      status: pass
    human_judgment: false
  - id: D2
    description: "schemas/index.ts re-exports all 30 schema tables"
    requirement: "INFRA-06"
    verification:
      - kind: integration
        ref: "grep -c 'export * from' server/src/database/schemas/index.ts = 30"
      status: pass
    human_judgment: false
  - id: D3
    description: "link-tag-pivot join table exists for Link-LinkTag many-to-many"
    requirement: "INFRA-06"
    verification:
      - kind: unit
        ref: "server/src/database/schemas/link-tag-pivot.schema.ts - linkTagPivot table with linkId and linkTagId FKs"
      status: pass
    human_judgment: false
  - id: D4
    description: "TypeScript compilation passes with all 30 schemas and barrel export"
    requirement: "INFRA-06"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit returns no errors"
      status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-06-28
status: complete
---

# Phase 01 Plan 04: Remaining Schema Files Summary

**18 additional Drizzle schema files completing the full set of 30 mapped from Go ent/schema, plus barrel export for all schemas**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-28T13:11:00Z
- **Completed:** 2026-06-28T13:19:00Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- 18 new Drizzle schema files created covering all remaining Go ent/schema tables
- link-tag-pivot join table created for Link-LinkTag many-to-many edge
- schemas/index.ts updated to re-export all 30 schema tables
- Full TypeScript compilation passes with zero errors
- All Go schema fields mapped with correct type mappings: Uint/Int/Int64 -> integer, String/Text -> text, Time -> integer(timestamp), JSON -> text(json), Enum -> text, Bool -> integer(boolean), Float -> real
- All Go schema indexes translated to Drizzle index/uniqueIndex definitions
- Foreign keys use ES module imports with lazy function references matching Plan 03 pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create remaining 18 schema files from Go ent/schema** - `8c18a6f` (feat)
2. **Task 2: Create schemas/index.ts barrel export** - `3a5674a` (feat)

## Files Created/Modified
- `server/src/database/schemas/direct-link.schema.ts` - directLinks table with fileId unique FK to files
- `server/src/database/schemas/storage-policy.schema.ts` - storagePolicies table with JSON settings, nodeId
- `server/src/database/schemas/comment.schema.ts` - comments table with nested replies, moderation, 4 indexes
- `server/src/database/schemas/link.schema.ts` - links table with categoryId FK to linkCategories, enum status
- `server/src/database/schemas/link-category.schema.ts` - linkCategories table with enum style (card/list)
- `server/src/database/schemas/link-tag.schema.ts` - linkTags table with unique name, default color
- `server/src/database/schemas/link-tag-pivot.schema.ts` - linkTagPivot join table with linkId and linkTagId FKs
- `server/src/database/schemas/album.schema.ts` - albums table with unique fileHash, categoryId FK
- `server/src/database/schemas/album-category.schema.ts` - albumCategories table with unique name
- `server/src/database/schemas/doc-series.schema.ts` - docSeries table with unique name, docCount
- `server/src/database/schemas/notification-type.schema.ts` - notificationTypes with unique code, category index
- `server/src/database/schemas/user-notification-config.schema.ts` - userNotificationConfigs with unique (userId, notificationTypeId), dual FKs
- `server/src/database/schemas/user-installed-theme.schema.ts` - userInstalledThemes with 5 indexes including unique (userId, themeName)
- `server/src/database/schemas/subscriber.schema.ts` - subscribers with unique email and token
- `server/src/database/schemas/visitor-log.schema.ts` - visitorLogs with 6 indexes including composite (createdAt, visitorId)
- `server/src/database/schemas/visitor-stat.schema.ts` - visitorStats with unique date index
- `server/src/database/schemas/url-stat.schema.ts` - urlStats with unique urlPath, real() avgDuration
- `server/src/database/schemas/tag.schema.ts` - tags table with unique name
- `server/src/database/schemas/index.ts` - Barrel export of all 30 schema files

## Decisions Made
- Used ES module imports (`import { files } from './file.schema'`) for FK references, matching the pattern established in Plan 03 (user.schema.ts)
- Used `real()` from drizzle-orm/sqlite-core for Go `field.Float` type (avgDuration in url_stats) -- Drizzle v0.45 exports `real` for SQLite REAL column type
- Created `linkTagPivot` table as explicit join table with `linkId` and `linkTagId` foreign keys -- this table is implied by Go's `edge.To("tags", LinkTag.Type).StorageKey(edge.Table("link_tag_pivot"))` but not present as a standalone file in ent/schema/
- Subscriber schema has no `deletedAt` column -- Go schema does not use SoftDeleteMixin for Subscriber
- LinkCategory and LinkTag schemas have no timestamp columns -- Go schemas do not define created_at/updated_at for these tables
- AlbumCategory schema has no timestamp columns or deletedAt -- Go schema only has id, name, description, display_order
- DocSeries schema has no deletedAt -- Go schema does not use SoftDeleteMixin
- NotificationType schema has no deletedAt -- Go schema does not use SoftDeleteMixin
- VisitorLog and VisitorStat schemas have no deletedAt -- Go schemas do not use SoftDeleteMixin

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed require() to ES module imports for FK references**
- **Found during:** Task 1 implementation
- **Issue:** Initial implementation used `require('./file.schema')` for foreign key references, which is CJS syntax and inconsistent with the ES module import pattern established in Plan 03
- **Fix:** Changed all FK references to use ES module imports (e.g., `import { files } from './file.schema'`) with lazy function references (`() => files.id`), matching Plan 03's user.schema.ts pattern
- **Files modified:** direct-link.schema.ts, link.schema.ts, link-tag-pivot.schema.ts, album.schema.ts, user-notification-config.schema.ts, user-installed-theme.schema.ts
- **Commit:** 8c18a6f

**2. [Rule 1 - Bug] Fixed avgDuration type from integer to real for Go field.Float**
- **Found during:** Task 1 implementation
- **Issue:** Go url_stat.go uses `field.Float("avg_duration")` which maps to SQLite REAL, not INTEGER
- **Fix:** Changed avgDuration from `integer('avg_duration')` to `real('avg_duration')` using Drizzle's `real()` column type
- **Files modified:** url-stat.schema.ts
- **Commit:** 8c18a6f

## Issues Encountered
- None beyond the auto-fixed issues above

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 30 Drizzle schema files are now complete, covering every Go ent/schema table definition
- schemas/index.ts barrel export enables drizzle.config.ts and DatabaseModule to import all schemas
- drizzle-kit push can now create all 30 tables in data/anheyu.db
- DatabaseModule + DatabaseService are ready for schema registration
- All feature modules can now reference their corresponding schema tables

## Self-Check: PASSED

- All 30 schema files verified present (ls *.schema.ts | wc -l = 30)
- Both task commits verified in git log (8c18a6f, 3a5674a)
- Full TypeScript compilation passes with no errors (npx tsc --noEmit = 0 errors)
- Barrel export has exactly 30 export lines (grep -c = 30)

---
*Phase: 01-infrastructure*
*Completed: 2026-06-28*
