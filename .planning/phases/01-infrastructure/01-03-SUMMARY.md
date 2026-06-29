---
phase: 01-infrastructure
plan: 03
subsystem: infra
tags: [drizzle, sqlite, better-sqlite3, schema, nestjs, database]

# Dependency graph
requires:
  - phase: 01-infrastructure
    plan: 01
    provides: "NestJS project scaffold with dependencies and module placeholders"
  - phase: 01-infrastructure
    plan: 02
    provides: "Common infrastructure with guards, interceptors, and Sqids"
provides:
  - "DatabaseModule with Drizzle provider via DRIZZLE injection token"
  - "DatabaseService with better-sqlite3 connection, WAL mode, busy_timeout=5000, foreign_keys=ON"
  - "drizzle.config.ts for drizzle-kit push"
  - "12 Drizzle schema files mapped from Go ent/schema"
  - "data/ directory with .gitkeep, *.db excluded from git"
affects: [02-auth-settings, 03-article-category-tag, 04-page-public-api, 05-file-upload-media, 06-comment-search, 07-statistics-links, 08-album-doc-series, 09-seo-music-notifications, 10-scheduled-tasks, 11-migration-integration]

# Tech tracking
tech-stack:
  added: ["better-sqlite3@12.11.1 (runtime)", "drizzle-orm@0.45.2 (runtime)", "drizzle-kit@0.31.10 (dev)"]
  patterns: ["Drizzle ORM + better-sqlite3 provider via NestJS DI", "WAL mode + busy_timeout PRAGMAs on connection init", "One-table-one-file schema organization", "sqliteTable with integer/text/index/uniqueIndex"]

key-files:
  created:
    - "server/src/database/database.service.ts"
    - "server/src/database/database.module.ts"
    - "server/drizzle.config.ts"
    - "server/src/database/schemas/index.ts"
    - "server/src/database/schemas/user.schema.ts"
    - "server/src/database/schemas/user-group.schema.ts"
    - "server/src/database/schemas/setting.schema.ts"
    - "server/src/database/schemas/article.schema.ts"
    - "server/src/database/schemas/article-history.schema.ts"
    - "server/src/database/schemas/post-category.schema.ts"
    - "server/src/database/schemas/post-tag.schema.ts"
    - "server/src/database/schemas/page.schema.ts"
    - "server/src/database/schemas/file.schema.ts"
    - "server/src/database/schemas/file-entity.schema.ts"
    - "server/src/database/schemas/entity.schema.ts"
    - "server/src/database/schemas/metadata.schema.ts"
    - "data/.gitkeep"
  modified:
    - "server/src/app.module.ts"
    - "server/tsconfig.json"
    - ".gitignore"

key-decisions:
  - "Used integer/text (not sqliteInteger/sqliteText) for Drizzle v0.45 column types"
  - "Used uniqueIndex() instead of index().unique() for Drizzle v0.45 API"
  - "Enabled esModuleInterop and allowSyntheticDefaultImports in tsconfig.json for better-sqlite3 default import"
  - "Added PRAGMA foreign_keys=ON alongside WAL and busy_timeout for referential integrity"

requirements-completed: [INFRA-02, INFRA-03, INFRA-06]

coverage:
  - id: D1
    description: "DatabaseService creates better-sqlite3 connection to data/anheyu.db with WAL, busy_timeout=5000, foreign_keys=ON"
    requirement: "INFRA-02"
    verification:
      - kind: unit
        ref: "server/src/database/database.service.ts - new Database(dbPath) + three PRAGMAs"
      status: pass
    human_judgment: false
  - id: D2
    description: "WAL mode and busy_timeout=5000 set on every connection initialization"
    requirement: "INFRA-03"
    verification:
      - kind: unit
        ref: "server/src/database/database.service.ts - sqlite.pragma('journal_mode = WAL') + sqlite.pragma('busy_timeout = 5000')"
      status: pass
    human_judgment: false
  - id: D3
    description: "12 Drizzle schema files define tables matching Go ent/schema definitions"
    requirement: "INFRA-06"
    verification:
      - kind: unit
        ref: "server/src/database/schemas/*.schema.ts - 12 files with sqliteTable definitions"
      status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-06-28
status: complete
---

# Phase 01 Plan 03: Database Infrastructure + Schema Files Summary

**Drizzle + better-sqlite3 connection with WAL mode and busy_timeout=5000, plus 12 schema files mapped from Go ent/schema covering users, articles, files, and metadata**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-28T12:47:18Z
- **Completed:** 2026-06-28T13:05:36Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- DatabaseService creates better-sqlite3 connection to data/anheyu.db with WAL, busy_timeout=5000, and foreign_keys=ON PRAGMAs
- data/ directory created with .gitkeep; *.db files excluded from git
- DatabaseModule provides Drizzle instance via DRIZZLE injection token in NestJS DI
- drizzle.config.ts configured for drizzle-kit push with schema import and SQLite dialect
- 12 schema files created: users, userGroups, settings, articles, articleHistories, postCategories, postTags, pages, files, fileEntities, entities, metadatas
- Type mapping from Go: Uint/Int/Int64 -> integer, String/Text -> text, Time -> integer(timestamp), JSON -> text(json), Bool -> integer(boolean), Enum -> text
- Article table has 40+ fields with 5 composite indexes matching Go schema
- Foreign key references use function references (() => userGroups.id) for lazy evaluation
- Indexes use Drizzle v0.45 API: index() for non-unique, uniqueIndex() for unique composite indexes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database connection infrastructure with Drizzle + better-sqlite3** - `7b1129d` (feat)
2. **Task 2: Create first 12 Drizzle schema files from Go ent/schema** - `912f027` (feat)

## Files Created/Modified
- `server/src/database/database.service.ts` - DatabaseService with better-sqlite3 connection, WAL + busy_timeout + foreign_keys PRAGMAs, drizzle instance creation
- `server/src/database/database.module.ts` - DatabaseModule with DRIZZLE injection token provider
- `server/drizzle.config.ts` - drizzle-kit config with defineConfig, SQLite dialect, schema import
- `server/src/database/schemas/index.ts` - Barrel export of all 12 schema files
- `server/src/database/schemas/user.schema.ts` - users table with userGroupId FK to user_groups
- `server/src/database/schemas/user-group.schema.ts` - userGroups table with permissions/settings as JSON text
- `server/src/database/schemas/setting.schema.ts` - settings table with configKey unique immutable
- `server/src/database/schemas/article.schema.ts` - articles table with 40+ fields, 5 composite indexes
- `server/src/database/schemas/article-history.schema.ts` - articleHistories table with unique (articleId, version) index
- `server/src/database/schemas/post-category.schema.ts` - postCategories table with slug unique, isSeries boolean
- `server/src/database/schemas/post-tag.schema.ts` - postTags table with slug unique, count for references
- `server/src/database/schemas/page.schema.ts` - pages table with path unique, customJs/Css
- `server/src/database/schemas/file.schema.ts` - files table with unique (parentId, name, ownerId) index
- `server/src/database/schemas/file-entity.schema.ts` - fileEntities table with isCurrent boolean
- `server/src/database/schemas/entity.schema.ts` - entities table with policyId, recycleOptions as JSON
- `server/src/database/schemas/metadata.schema.ts` - metadatas table with unique (fileId, name) index
- `data/.gitkeep` - Placeholder to track empty data/ directory
- `server/src/app.module.ts` - Added DatabaseModule import
- `server/tsconfig.json` - Added esModuleInterop and allowSyntheticDefaultImports
- `.gitignore` - Added *.db exclusion

## Decisions Made
- Used `integer` and `text` (lowercase) from drizzle-orm/sqlite-core instead of `sqliteInteger`/`sqliteText` -- Drizzle v0.45 exports are lowercase function names
- Used `uniqueIndex()` instead of `index().unique()` -- the .unique() method does not exist on IndexBuilder in Drizzle v0.45; uniqueIndex() is the correct API
- Added PRAGMA foreign_keys=ON alongside WAL and busy_timeout -- Go backend expects referential integrity enforcement, which is off by default in SQLite
- Enabled esModuleInterop and allowSyntheticDefaultImports in tsconfig.json -- required for `import Database from 'better-sqlite3'` default import syntax

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Drizzle v0.45 API column type names**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Plan specified `sqliteInteger` and `sqliteText` imports from drizzle-orm/sqlite-core, but Drizzle v0.45 exports `integer` and `text` instead
- **Fix:** Changed all schema files to import `integer` and `text` from drizzle-orm/sqlite-core
- **Files modified:** All 12 schema files
- **Commit:** 912f027

**2. [Rule 3 - Blocking] Fixed index().unique() to uniqueIndex()**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Drizzle v0.45 IndexBuilder does not have a `.unique()` method; unique indexes require `uniqueIndex()` instead
- **Fix:** Changed `index().on(...).unique()` to `uniqueIndex().on(...)` in article-history, file, and metadata schemas
- **Files modified:** article-history.schema.ts, file.schema.ts, metadata.schema.ts
- **Commit:** 912f027

**3. [Rule 3 - Blocking] Fixed better-sqlite3 default import**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `import Database from 'better-sqlite3'` requires esModuleInterop flag in tsconfig.json
- **Fix:** Added esModuleInterop and allowSyntheticDefaultImports to tsconfig.json
- **Files modified:** server/tsconfig.json
- **Commit:** 7b1129d

## Issues Encountered
- None beyond the auto-fixed TypeScript compilation issues above

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DatabaseModule is ready for injection in any feature module via DRIZZLE token
- 12 schema files cover core entities (users, articles, pages, files, settings)
- 18 remaining schema files needed for Phase 01 completion (Plan 04)
- drizzle-kit push will create tables in data/anheyu.db once all schemas are ready
- DatabaseService.onModuleDestroy ensures clean SQLite connection shutdown

## Self-Check: PASSED

- All key files verified present (database.service.ts, database.module.ts, drizzle.config.ts, 12 schema files)
- Both task commits verified in git log (7b1129d, 912f027)
- Full TypeScript compilation passes with no errors

---
*Phase: 01-infrastructure*
*Completed: 2026-06-28*
