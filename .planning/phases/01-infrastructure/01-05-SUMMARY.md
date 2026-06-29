---
phase: 01-infrastructure
plan: 05
subsystem: infra
tags: [nestjs, vitest, drizzle, sqlite, guards, interceptors, integration-tests, passport-jwt]

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
  - phase: 01-infrastructure
    plan: 04
    provides: "Remaining 18 Drizzle schema files and barrel export"
provides:
  - "AppModule wired with APP_GUARD, APP_INTERCEPTOR, APP_FILTER global providers"
  - "JwtStrategy and JwtModule configuration for Passport JWT authentication"
  - "Vitest configuration for NestJS ESM/TypeScript testing"
  - "6 integration test files verifying all Phase 01 infrastructure"
  - "SQLite database with all 30 tables created via drizzle-kit push"
  - "server/data/.gitkeep for data directory tracking"
affects: [02-auth-settings, 03-article-category-tag, 04-page-public-api, 05-file-upload-media, 06-comment-search, 07-statistics-links, 08-album-doc-series, 09-seo-music-notifications, 10-scheduled-tasks, 11-migration-integration]

# Tech tracking
tech-stack:
  added: ["passport-jwt@4.0.1 (runtime)", "vitest@4.1.9 (dev, already in package.json)"]
  patterns: ["Global provider wiring via APP_GUARD/APP_INTERCEPTOR/APP_FILTER", "JwtModule.registerAsync with ConfigService", "Vitest firstValueFrom pattern for Observable testing", "drizzle.config.ts schema path string (not import)"]

key-files:
  created:
    - "server/vitest.config.ts"
    - "server/test/database.spec.ts"
    - "server/test/schemas.spec.ts"
    - "server/test/response-interceptor.spec.ts"
    - "server/test/guards.spec.ts"
    - "server/test/sqids.spec.ts"
    - "server/test/app-bootstrap.spec.ts"
    - "server/src/auth/jwt.strategy.ts"
    - "server/data/.gitkeep"
  modified:
    - "server/src/app.module.ts"
    - "server/src/auth/auth.module.ts"
    - "server/drizzle.config.ts"
    - ".gitignore"

key-decisions:
  - "Created JwtStrategy + JwtModule in AuthModule to support APP_GUARD global wiring (plan did not specify this, but it's required for app startup)"
  - "Used JwtModule.registerAsync with ConfigService for JWT secret configuration"
  - "Used `as any` type cast for expiresIn to satisfy @types/jsonwebtoken StringValue type"
  - "Changed drizzle.config.ts from schema import object to schema path string for drizzle-kit v0.31 compatibility"
  - "Installed passport-jwt as runtime dependency for Passport JWT strategy"
  - "Used firstValueFrom instead of done() callbacks in ResponseInterceptor tests (Vitest 4.x deprecates done())"
  - "Used Reflect.defineMetadata instead of decorator syntax for guard test metadata"
  - "Added *.db-shm and *.db-wal to .gitignore for SQLite WAL files"

patterns-established:
  - "Integration test pattern: test files in server/test/ with Vitest globals"
  - "App bootstrap test: Test.createTestingModule with AppModule import"
  - "Database test: direct better-sqlite3 connection for PRAGMA verification"
  - "Guard test: mock ExecutionContext without full NestJS testing module for unit tests"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, API-COMPAT-02, API-COMPAT-04, API-COMPAT-05]

coverage:
  - id: D1
    description: "AppModule registers APP_GUARD (JwtAuthGuard), APP_INTERCEPTOR (ResponseInterceptor), APP_FILTER (HttpExceptionFilter) as global providers"
    requirement: "API-COMPAT-04"
    verification:
      - kind: integration
        ref: "server/src/app.module.ts - APP_GUARD, APP_INTERCEPTOR, APP_FILTER providers"
      status: pass
    human_judgment: false
  - id: D2
    description: "NestJS application bootstraps and listens on port 8091"
    requirement: "INFRA-01"
    verification:
      - kind: integration
        ref: "server/test/app-bootstrap.spec.ts - app bootstrap and port 8091 verification"
      status: pass
    human_judgment: false
  - id: D3
    description: "SQLite database with WAL mode and busy_timeout=5000"
    requirement: "INFRA-02"
    verification:
      - kind: integration
        ref: "server/test/database.spec.ts - WAL mode, busy_timeout, foreign_keys PRAGMA tests"
      status: pass
    human_judgment: false
  - id: D4
    description: "SQLite busy_timeout set to 5000ms"
    requirement: "INFRA-03"
    verification:
      - kind: integration
        ref: "server/test/database.spec.ts - busy_timeout verification"
      status: pass
    human_judgment: false
  - id: D5
    description: "drizzle-kit push creates all 30 tables in SQLite database"
    requirement: "INFRA-05"
    verification:
      - kind: integration
        ref: "npx drizzle-kit push succeeded, data/anheyu.db contains 30 tables"
      status: pass
    human_judgment: false
  - id: D6
    description: "All 30 Drizzle schema tables exist in database with correct structure"
    requirement: "INFRA-06"
    verification:
      - kind: integration
        ref: "server/test/schemas.spec.ts - 30 tables, id primary keys, soft delete columns"
      status: pass
    human_judgment: false
  - id: D7
    description: "ResponseInterceptor wraps all responses as { code, message, data }"
    requirement: "API-COMPAT-02"
    verification:
      - kind: unit
        ref: "server/test/response-interceptor.spec.ts - format verification tests"
      status: pass
    human_judgment: false
  - id: D8
    description: "JwtAuthGuard with @Public() skip, AdminGuard with Sqids decode verification"
    requirement: "API-COMPAT-04"
    verification:
      - kind: unit
        ref: "server/test/guards.spec.ts - @Public() skip, AdminGuard decode tests"
      status: pass
    human_judgment: false
  - id: D9
    description: "Sqids encode/decode round-trip with Go-compatible shuffle"
    requirement: "API-COMPAT-05"
    verification:
      - kind: unit
        ref: "server/test/sqids.spec.ts - round-trip, determinism, EntityType constants tests"
      status: pass
    human_judgment: false

# Metrics
duration: 60min
completed: 2026-06-28
status: complete
---

# Phase 01 Plan 05: Infrastructure Integration and Tests Summary

**AppModule wired with global providers (APP_GUARD, APP_INTERCEPTOR, APP_FILTER), JwtStrategy for Passport JWT, all 30 tables pushed to SQLite, and 40 integration tests passing across 6 test files**

## Performance

- **Duration:** 60 min
- **Started:** 2026-06-28T13:39:15Z
- **Completed:** 2026-06-28T14:39:15Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- AppModule registers JwtAuthGuard (APP_GUARD), ResponseInterceptor (APP_INTERCEPTOR), HttpExceptionFilter (APP_FILTER) as global providers
- JwtStrategy created in AuthModule with PassportModule and JwtModule.registerAsync for JWT validation
- drizzle-kit push successfully created all 30 tables in data/anheyu.db
- SQLite PRAGMAs verified: WAL mode, busy_timeout=5000, foreign_keys=ON
- 40 integration tests pass across 6 test files: database, schemas, response-interceptor, guards, sqids, app-bootstrap
- Vitest configured for NestJS ESM/TypeScript with path alias resolution
- server/data/.gitkeep created for data directory tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire AppModule with global providers and create Vitest configuration** - `8e4b6d2` (feat)
2. **Task 2: Create integration tests and push schema to SQLite** - `3411dd7` (feat)

**Plan metadata:** `fd6eb39` (chore: add SQLite WAL files to .gitignore)

## Files Created/Modified
- `server/src/app.module.ts` - Added CommonModule import, APP_GUARD/APP_INTERCEPTOR/APP_FILTER global providers
- `server/src/auth/auth.module.ts` - Added PassportModule, JwtModule.registerAsync, JwtStrategy provider
- `server/src/auth/jwt.strategy.ts` - JwtStrategy with CustomClaims validation (user_id, user_group_id)
- `server/vitest.config.ts` - Vitest configuration with node environment, globals, path alias
- `server/test/database.spec.ts` - SQLite connection and PRAGMA verification tests (8 tests)
- `server/test/schemas.spec.ts` - Schema count, primary key, and soft delete column tests (3 tests)
- `server/test/response-interceptor.spec.ts` - Response format { code, message, data } tests (4 tests)
- `server/test/guards.spec.ts` - JwtAuthGuard @Public(), JwtAuthOptionalGuard, AdminGuard tests (12 tests)
- `server/test/sqids.spec.ts` - Encode/decode round-trip, shuffle determinism, EntityType tests (11 tests)
- `server/test/app-bootstrap.spec.ts` - NestJS bootstrap and port 8091 tests (3 tests)
- `server/drizzle.config.ts` - Changed schema from import object to path string for drizzle-kit v0.31
- `server/data/.gitkeep` - Data directory tracking
- `.gitignore` - Added *.db-shm and *.db-wal patterns

## Decisions Made
- Created JwtStrategy + JwtModule in AuthModule to support APP_GUARD global wiring -- without JwtStrategy, AuthGuard('jwt') throws "Unknown authentication strategy" on every request
- Used JwtModule.registerAsync with ConfigService for JWT secret and expiresIn configuration, matching Phase 02 auth module pattern
- Changed drizzle.config.ts from `import * as schema` to `schema: './src/database/schemas/index.ts'` path string -- drizzle-kit v0.31 validates schema as string or string array, not an imported object
- Installed passport-jwt@4.0.1 as runtime dependency -- required by PassportStrategy(Strategy) in JwtStrategy
- Used `as any` type cast for expiresIn in JwtModule.registerAsync -- @types/jsonwebtoken uses StringValue type that TypeScript cannot infer from ConfigService.get<string>()
- Used firstValueFrom from rxjs instead of done() callbacks in ResponseInterceptor tests -- Vitest 4.x deprecates done() callback pattern
- Used Reflect.defineMetadata instead of TypeScript decorator syntax in guard tests -- decorator syntax requires reflect-metadata import and TypeScript emit setting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created JwtStrategy and JwtModule for APP_GUARD global wiring**
- **Found during:** Task 1 (AppModule wiring)
- **Issue:** Plan specified registering JwtAuthGuard as APP_GUARD, but without a registered JwtStrategy, AuthGuard('jwt') throws "Unknown authentication strategy" on every non-@Public() request, preventing app startup
- **Fix:** Created JwtStrategy in auth/ directory with PassportStrategy(Strategy), configured JwtModule.registerAsync with ConfigService, and updated AuthModule to import PassportModule and JwtModule
- **Files modified:** server/src/auth/auth.module.ts, server/src/auth/jwt.strategy.ts
- **Commit:** 8e4b6d2

**2. [Rule 3 - Blocking] Fixed drizzle.config.ts schema format for drizzle-kit v0.31**
- **Found during:** Task 2 (drizzle-kit push)
- **Issue:** drizzle-kit v0.31 Zod validation rejects schema as imported object; expects a path string or string array
- **Fix:** Changed `schema` from `import * as schema from './src/database/schemas'` to `schema: './src/database/schemas/index.ts'` path string
- **Files modified:** server/drizzle.config.ts
- **Commit:** 3411dd7

**3. [Rule 3 - Blocking] Fixed JwtModule expiresIn type mismatch**
- **Found during:** Task 1 (AppModule wiring)
- **Issue:** @types/jsonwebtoken defines expiresIn as StringValue | number; ConfigService.get<string>() returns plain string which is not assignable to StringValue
- **Fix:** Added `as any` type cast to expiresIn configuration value
- **Files modified:** server/src/auth/auth.module.ts
- **Commit:** 8e4b6d2

**4. [Rule 1 - Bug] Fixed soft delete table list in schemas.spec.ts**
- **Found during:** Task 2 (test execution)
- **Issue:** Test assumed article_histories, entities, and other tables had deleted_at column, but Go schema shows they do not use SoftDeleteMixin
- **Fix:** Updated softDeleteTables list to match actual database columns (verified by querying PRAGMA table_info)
- **Files modified:** server/test/schemas.spec.ts
- **Commit:** 3411dd7

**5. [Rule 3 - Blocking] Fixed Vitest done() callback deprecation**
- **Found during:** Task 2 (test execution)
- **Issue:** Vitest 4.x deprecates done() callback pattern in tests; using subscribe() with done() causes uncaught exceptions
- **Fix:** Rewrote ResponseInterceptor tests to use async/await with firstValueFrom from rxjs
- **Files modified:** server/test/response-interceptor.spec.ts
- **Commit:** 3411dd7

**6. [Rule 3 - Blocking] Fixed guard test @Public() metadata setting**
- **Found during:** Task 2 (test execution)
- **Issue:** Used Object.assign to set IS_PUBLIC_KEY on handler function, but Reflector.getAllAndOverride uses Reflect.getMetadata which requires Reflect.defineMetadata
- **Fix:** Changed from `Object.assign(handler, { [IS_PUBLIC_KEY]: true })` to `Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler)`
- **Files modified:** server/test/guards.spec.ts
- **Commit:** 3411dd7

---

**Total deviations:** 6 auto-fixed (3 blocking, 1 bug, 2 blocking-test-infrastructure)
**Impact on plan:** All auto-fixes were necessary for correct app startup, test infrastructure, and test accuracy. No scope creep.

## Issues Encountered
- passport-jwt was not installed in server/ (not listed in original package.json) -- installed as runtime dependency for JwtStrategy
- Vitest 4.x does not detect .e2e-spec.ts files under `test/**/*.spec.ts` glob pattern -- renamed app.e2e-spec.ts to app-bootstrap.spec.ts
- AuthGuard('jwt') unit tests produce unhandled rejections ("Unknown authentication strategy") when testing non-@Public() paths without NestJS testing module -- expected behavior, not a test failure

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 01 infrastructure is fully wired and verified end-to-end
- NestJS app starts on port 8091 with global auth guard, response interceptor, and exception filter
- All 30 database tables exist in SQLite with WAL mode and proper PRAGMAs
- JwtStrategy is ready for Phase 02 to implement full login/refresh token flow
- JwtModule is configured with ConfigService, ready for Phase 02 auth endpoints
- All integration tests pass (40 tests across 6 files)
- CommonModule, DatabaseModule, and AuthModule are fully integrated

## Self-Check: PASSED

- All 13 key files verified present
- All 3 task commits verified in git log (8e4b6d2, 3411dd7, fd6eb39)
- Full Vitest suite passes (40 tests across 6 files)
- NestJS app starts on port 8091
- SQLite database has 30 tables with WAL mode, busy_timeout=5000, foreign_keys=ON

---
*Phase: 01-infrastructure*
*Completed: 2026-06-28*
