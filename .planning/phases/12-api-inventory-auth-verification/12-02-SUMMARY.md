---
phase: "12"
plan: "02"
subsystem: "auth-api-compat"
tags: ["test", "auth", "captcha", "token-refresh", "api-compat"]
dependency_graph:
  requires: ["12-01"]
  provides: ["auth-api-compat-tests"]
  affects: ["server/test/api-compat/auth-api-compat.spec.ts", "server/test/helpers/api-compat-helpers.ts"]
tech_stack:
  added: ["@nestjs/throttler (ThrottlerStorage for test clearing)"]
  patterns: ["field-by-field response verification", "dual-channel token refresh testing", "captcha provider switching in tests"]
key_files:
  created: []
  modified:
    - "server/test/api-compat/auth-api-compat.spec.ts"
    - "server/test/helpers/api-compat-helpers.ts"
decisions:
  - "Use onConflictDoUpdate on username instead of onConflictDoNothing on id for test user seeding (fixes pre-existing bug)"
  - "Clear ThrottlerStorage between captcha behavior tests instead of overriding ThrottlerGuard"
  - "Document expires format gap as Risk: NONE since NestJS matches frontend contract"
  - "Document 5 unimplemented auth endpoints as Risk: HIGH functional gap"
metrics:
  duration: "26m"
  completed: "2026-07-19"
  tasks: 3
  files: 2
  tests_added: 9
  tests_total: 16
status: complete
---

# Phase 12 Plan 02: Auth Verification (test code) Summary

Enhanced auth API compatibility tests with field-by-field login response verification, captcha flow end-to-end tests, token refresh dual-channel tests, and 501 format verification for all unimplemented auth endpoints.

## What Was Done

### Task 1: Login response field-by-field verification and token refresh dual-channel test

Replaced basic login assertions with comprehensive field-by-field verification matching Go's LoginUserInfoResponse struct:
- All 13 userInfo fields verified: id (string/Sqids), created_at (ISO 8601 or null), updated_at (ISO 8601 or null), username (non-empty string), nickname (string or null), avatar (string or null), email (matches login email), lastLoginAt (ISO 8601 or null), userGroupID (number/raw DB ID), userGroup.id (string/Sqids), userGroup.name (non-empty string), userGroup.description (string or null), status (number, 1=active)
- Top-level fields verified: accessToken (non-empty JWT), refreshToken (non-empty JWT), expires (string type, valid future timestamp), roles (string[] with roles[0] === String(userGroupID))
- Cross-field consistency: roles[0] must equal String(userInfo.userGroupID)
- Token refresh dual-channel: Authorization header, body refreshToken, no token (401)
- Refresh response expires verified as string type with valid future timestamp

### Task 2: Captcha flow end-to-end test and 501 response format verification

- Captcha Structure Verification: config with provider=none, no image_captcha_length when none, image generation with provider=image
- Captcha Behavior Verification: login without captcha when none, wrong captcha answer when image (400 error), captcha fields accepted when none
- All 5 unimplemented auth endpoints verified with exact 501 format: status=501, code=501, message=non-empty Chinese string, data=null
- Added missing activate endpoint 501 test

### Task 3: Frontend expires consumption verification and compatibility documentation

- Verified frontend/src/lib/api/client.ts TokenManager.updateToken(accessToken, expires: string) expects string
- Verified handleRefreshToken() checks data?.expires (truthy, works with string)
- Documented 3 Known Compatibility Gaps in test file header:
  1. expires format: Go returns number, NestJS returns string. Risk: NONE
  2. 5 auth endpoints: Go implemented, NestJS 501. Risk: HIGH
  3. created_at/updated_at: Go never null, NestJS can be null. Risk: MEDIUM

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed test user seeding failure due to username unique constraint**
- **Found during:** Task 1 (pre-test baseline run)
- **Issue:** seedBaseData used onConflictDoNothing on id, but the file DB already had a user with username=admin (id=38). The username unique constraint blocked insertion silently, causing all login tests to fail with 401.
- **Fix:** Changed to onConflictDoUpdate with target=users.username, updating passwordHash, email, nickname, userGroupId, and status to match test expectations.
- **Files modified:** server/test/helpers/api-compat-helpers.ts
- **Commit:** 8548039

**2. [Rule 3 - Blocking] Fixed ThrottlerGuard rate limiting causing 429 in captcha behavior tests**
- **Found during:** Task 2 (captcha behavior test run)
- **Issue:** The auth login endpoint has @Throttle({ limit: 5, ttl: 60000 }). After 5+ login calls in prior tests, captcha behavior tests received 429 instead of expected 200/400.
- **Fix:** Added clearThrottleStorage() helper that accesses ThrottlerStorage via app.get() and clears the internal Map. Called before each captcha behavior test.
- **Files modified:** server/test/helpers/api-compat-helpers.ts, server/test/api-compat/auth-api-compat.spec.ts
- **Commit:** ba1516f

**3. [Rule 2 - Missing Critical] Added settingsService to TestContext**
- **Found during:** Task 2 (captcha provider switching)
- **Issue:** Captcha tests need to switch captcha.provider between "none" and "image" via SettingsService.update(), but TestContext did not expose the service.
- **Fix:** Added settingsService field to TestContext interface and populated it in createTestApp().
- **Files modified:** server/test/helpers/api-compat-helpers.ts
- **Commit:** ba1516f

## Test Results

All 16 tests pass:
- POST /api/auth/login -- success: field-by-field LoginUserInfoResponse (1 test)
- POST /api/auth/login -- invalid credentials: 401 (1 test)
- POST /api/auth/refresh-token -- dual-channel: header, body, no token (3 tests)
- POST /api/auth/register: 501 format (1 test)
- POST /api/auth/activate: 501 format (1 test)
- POST /api/auth/forgot-password: 501 format (1 test)
- POST /api/auth/reset-password: 501 format (1 test)
- GET /api/auth/check-email: 501 format (1 test)
- Captcha Structure Verification: config none, no image_captcha_length, image generation (3 tests)
- Captcha Behavior Verification: login without captcha, wrong captcha, captcha fields accepted (3 tests)

## Known Stubs

None -- all test assertions are fully wired.

## Threat Flags

None -- test code only, no production changes.

## Self-Check: PASSED

- server/test/api-compat/auth-api-compat.spec.ts: FOUND
- server/test/helpers/api-compat-helpers.ts: FOUND
- .planning/phases/12-api-inventory-auth-verification/12-02-SUMMARY.md: FOUND
- Commit 8548039 (Task 1): FOUND
- Commit ba1516f (Task 2): FOUND
- Commit c1e1fc9 (Task 3): FOUND
