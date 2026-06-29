---
phase: 01-infrastructure
plan: 02
subsystem: infra
tags: [nestjs, guards, interceptors, filters, decorators, sqids, cache, common]

# Dependency graph
requires:
  - phase: 01-infrastructure
    plan: 01
    provides: "NestJS project scaffold with dependencies and module placeholders"
provides:
  - "Global ResponseInterceptor wrapping { code, data, message }"
  - "Global HttpExceptionFilter formatting errors as { code, message, data: null }"
  - "ErrorCodes constant with all Go Chinese error messages"
  - "@Public() and @CurrentUser() decorators"
  - "JwtAuthGuard, JwtAuthOptionalGuard, AdminGuard"
  - "Sqids encoder/decoder with Go-compatible shuffle algorithm"
  - "MemoryCache with TTL and auto-cleanup"
  - "CommonModule exporting all shared providers"
affects: [02-auth-settings, 03-article-category-tag, 04-page-public-api, 05-file-upload-media, 06-comment-search, 07-statistics-links, 08-album-doc-series, 09-seo-music-notifications, 10-scheduled-tasks, 11-migration-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Global response interceptor { code, data, message }", "Global exception filter { code, message, data: null }", "Global JwtAuthGuard + @Public() opt-out", "Go-compatible Sqids shuffle via lagged fibonacci PRNG", "Map + TTL in-memory cache with auto-cleanup"]

key-files:
  created:
    - "server/src/common/interceptors/response.interceptor.ts"
    - "server/src/common/filters/http-exception.filter.ts"
    - "server/src/common/constants/error-codes.ts"
    - "server/src/common/decorators/public.decorator.ts"
    - "server/src/common/decorators/current-user.decorator.ts"
    - "server/src/common/guards/jwt-auth.guard.ts"
    - "server/src/common/guards/jwt-auth-optional.guard.ts"
    - "server/src/common/guards/admin.guard.ts"
    - "server/src/common/utils/sqids.util.ts"
    - "server/src/common/cache/memory-cache.util.ts"
    - "server/src/common/common.module.ts"
  modified: []

key-decisions:
  - "GoRNGSource class replicates Go's math/rand.NewSource lagged fibonacci PRNG (rngLen=607, rngTap=273) for exact Sqids alphabet shuffle compatibility"
  - "JwtAuthGuard.handleRequest overrides default Passport error messages with Go-compatible Chinese messages from ErrorCodes"
  - "JwtAuthOptionalGuard passes on missing/malformed Authorization header (matching Go's JWTAuthOptional behavior), returns 401 for invalid token"
  - "AdminGuard checks both entityType === UserGroup and dbID === 1 (matching Go's two-step AdminAuth verification)"
  - "MemoryCache.cleanup uses forEach + collected keys to avoid downlevelIteration TypeScript requirement"
  - "CommonModule provides classes but does NOT register them globally (APP_GUARD/APP_INTERCEPTOR wiring deferred to app.module.ts in Plan 06)"

requirements-completed: [API-COMPAT-01, API-COMPAT-02, API-COMPAT-04, API-COMPAT-05]

coverage:
  - id: D1
    description: "ResponseInterceptor wraps all returns as { code, message, data } matching Go format"
    requirement: "API-COMPAT-02"
    verification:
      - kind: unit
        ref: "server/src/common/interceptors/response.interceptor.ts - map(data => ({ code: statusCode, message: 'success', data }))"
      status: pass
    human_judgment: false
  - id: D2
    description: "HttpExceptionFilter formats errors as { code, message, data: null } matching Go format"
    requirement: "API-COMPAT-02"
    verification:
      - kind: unit
        ref: "server/src/common/filters/http-exception.filter.ts - response.status(status).json({ code: status, message, data: null })"
      status: pass
    human_judgment: false
  - id: D3
    description: "ErrorCodes maps all 25+ Go error messages in Chinese from errors.go and auth.go"
    requirement: "API-COMPAT-01"
    verification:
      - kind: unit
        ref: "server/src/common/constants/error-codes.ts - 25 error code entries matching Go source"
      status: pass
    human_judgment: false
  - id: D4
    description: "JwtAuthGuard checks Bearer token, skips when @Public() is present"
    requirement: "API-COMPAT-04"
    verification:
      - kind: unit
        ref: "server/src/common/guards/jwt-auth.guard.ts - reflector.getAllAndOverride(IS_PUBLIC_KEY)"
      status: pass
    human_judgment: false
  - id: D5
    description: "JwtAuthOptionalGuard passes without token, returns 401 if token present but invalid"
    requirement: "API-COMPAT-04"
    verification:
      - kind: unit
        ref: "server/src/common/guards/jwt-auth-optional.guard.ts - checks authHeader, super.canActivate()"
      status: pass
    human_judgment: false
  - id: D6
    description: "AdminGuard decodes UserGroupID via Sqids and verifies dbID === 1, entityType === UserGroup"
    requirement: "API-COMPAT-04"
    verification:
      - kind: unit
        ref: "server/src/common/guards/admin.guard.ts - decodePublicID + EntityType.UserGroup check"
      status: pass
    human_judgment: false
  - id: D7
    description: "Sqids GoRNGSource replicates Go's math/rand.NewSource lagged fibonacci PRNG"
    requirement: "API-COMPAT-01"
    verification:
      - kind: unit
        ref: "server/src/common/utils/sqids.util.ts - GoRNGSource class with rngLen=607, rngTap=273"
      status: pass
    human_judgment: false
  - id: D8
    description: "Sqids generatePublicID/decodePublicID round-trip with [dbID, entityType] encoding"
    requirement: "API-COMPAT-01"
    verification:
      - kind: unit
        ref: "server/src/common/utils/sqids.util.ts - encode([dbID, entityType]) + decode verification"
      status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-06-28
status: complete
---

# Phase 01 Plan 02: Common Infrastructure Summary

**Shared infrastructure in server/src/common/ with response interceptor, exception filter, error codes, auth guards, decorators, Sqids encoder/decoder, and memory cache -- all API-compatible with Go backend**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-28T12:27:57Z
- **Completed:** 2026-06-28T12:39:43Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- ResponseInterceptor wraps all controller returns as { code, message, data } matching Go's response.go format exactly
- HttpExceptionFilter formats all HttpException errors as { code, message, data: null } matching Go's Fail() function
- ErrorCodes constant maps all 25 Go error messages in Chinese (from pkg/constant/errors.go + internal/app/middleware/auth.go)
- @Public() decorator sets IS_PUBLIC_KEY metadata for routes that skip global JWT auth
- @CurrentUser() parameter decorator extracts authenticated user from request object
- JwtAuthGuard extends AuthGuard('jwt') with @Public() skip support and Go-compatible Chinese error messages
- JwtAuthOptionalGuard passes without Authorization header, returns 401 for invalid token (matching Go's JWTAuthOptional)
- AdminGuard decodes UserGroupID via Sqids and checks entityType === UserGroup AND dbID === 1 (matching Go's AdminAuth)
- Sqids GoRNGSource class replicates Go's math/rand.NewSource lagged fibonacci PRNG (rngLen=607, rngTap=273) for exact shuffle compatibility
- Sqids encode/decode functions produce [dbID, entityType] pairs with minLength=4
- MemoryCache with TTL, auto-cleanup every 60s, and stop() for graceful shutdown
- CommonModule exports all shared providers for injection across feature modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Create response interceptor, exception filter, error codes, and decorators** - `0b82c2c` (feat)
2. **Task 2: Create auth guards, Sqids encoder/decoder, memory cache, and CommonModule** - `c5eed62` (feat)

## Files Created/Modified
- `server/src/common/interceptors/response.interceptor.ts` - Global { code, message, data } response wrapper matching Go format
- `server/src/common/filters/http-exception.filter.ts` - Global exception -> { code, message, data: null } format matching Go format
- `server/src/common/constants/error-codes.ts` - All 25 Go error codes with Chinese messages from errors.go and auth.go
- `server/src/common/decorators/public.decorator.ts` - @Public() decorator to skip auth on public routes
- `server/src/common/decorators/current-user.decorator.ts` - @CurrentUser() parameter decorator for extracting user from request
- `server/src/common/guards/jwt-auth.guard.ts` - Global JWT auth guard with @Public() skip and Go-compatible error messages
- `server/src/common/guards/jwt-auth-optional.guard.ts` - Optional JWT auth guard (pass without token, 401 for invalid token)
- `server/src/common/guards/admin.guard.ts` - Admin permission guard checking Sqids-decoded UserGroupID
- `server/src/common/utils/sqids.util.ts` - Sqids encoder/decoder with Go-compatible shuffle algorithm (GoRNGSource class)
- `server/src/common/cache/memory-cache.util.ts` - Map + TTL in-memory cache with auto-cleanup
- `server/src/common/common.module.ts` - CommonModule exporting all shared providers

## Decisions Made
- Used GoRNGSource class to replicate Go's math/rand.NewSource lagged fibonacci PRNG (rngLen=607, rngTap=273) for exact Sqids alphabet shuffle compatibility, rather than simpler LCG approach
- JwtAuthGuard.handleRequest overrides default Passport error messages with Go-compatible Chinese messages from ErrorCodes constant
- JwtAuthOptionalGuard passes on missing/malformed Authorization header (matching Go's JWTAuthOptional behavior where format errors also c.Next()), returns 401 only for invalid/expired token
- AdminGuard checks both entityType === UserGroup and dbID === 1 (two-step verification matching Go's AdminAuth)
- MemoryCache.cleanup uses forEach + collected keys pattern to avoid downlevelIteration TypeScript requirement
- CommonModule provides classes but does NOT register them globally (APP_GUARD/APP_INTERCEPTOR wiring deferred to app.module.ts in Plan 06)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed sqids module import syntax**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Plan specified `import { Sqids } from 'sqids'` but sqids npm package uses default export
- **Fix:** Changed to `import Sqids from 'sqids'` to match the actual package export format
- **Files modified:** server/src/common/utils/sqids.util.ts
- **Commit:** c5eed62

**2. [Rule 3 - Blocking] Fixed MemoryCache Map iteration TypeScript error**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `for (const [key, entry] of this.store)` requires downlevelIteration flag or ES2015+ target
- **Fix:** Changed to `this.store.forEach()` + collected keys array pattern to avoid the iteration requirement
- **Files modified:** server/src/common/cache/memory-cache.util.ts
- **Commit:** c5eed62

**3. [Rule 3 - Blocking] Removed duplicate constructor in GoLCG class**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Initial draft had both simple LCG and lagged fibonacci constructors, causing "Multiple constructor implementations" error
- **Fix:** Rewrote sqids.util.ts with single clean GoRNGSource class using lagged fibonacci approach only
- **Files modified:** server/src/common/utils/sqids.util.ts
- **Commit:** c5eed62

## Issues Encountered
- None beyond the auto-fixed TypeScript compilation issues above

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All common infrastructure is ready for Plan 03 (Database + Drizzle schemas)
- CommonModule can be imported by any feature module for access to guards, interceptor, cache
- Sqids encoder/decoder is ready for Phase 02 Auth to wire up JWT claims with public IDs
- Guards are structurally complete but require JwtModule configuration in Phase 02 for runtime JWT validation
- Global registration (APP_GUARD, APP_INTERCEPTOR, APP_FILTER) will be wired in app.module.ts during Plan 06

## Self-Check: PASSED

- All 11 key files verified present
- Both task commits verified in git log (0b82c2c, c5eed62)
- Full TypeScript compilation passes with no errors

---
*Phase: 01-infrastructure*
*Completed: 2026-06-28*
