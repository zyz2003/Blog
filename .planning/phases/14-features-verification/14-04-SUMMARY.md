---
phase: 14-features-verification
plan: 04
subsystem: storage-policy, user-management
tags: [verification, field-audit, storage-policy, user-management, api-compat, date-serialization, nullability]

dependency_graph:
  requires: [14-01, 14-02, 14-03]
  provides: [storage-policy-field-verification, user-management-field-verification, date-serialization-fix, description-nullability-fix]
  affects: [storage-policy-service, user-service]

tech_stack:
  added: []
  patterns: [toISODateString for date serialization, null coalescing for Go string zero value]

key_files:
  created:
    - server/test/phase14-verification/storage-policy-verification.spec.ts
    - server/test/phase14-verification/user-management-verification.spec.ts
  modified:
    - server/src/storage-policy/storage-policy.service.ts
    - server/src/user/user.service.ts
    - server/test/helpers/api-compat-helpers.ts

decisions:
  - id: D-313
    description: "Storage-policy dates use toISODateString instead of raw Date objects — consistent with all other modules (article, file, album, doc-series, page)"
    rationale: "While JSON.stringify handles Date objects via toISOString(), explicit conversion is consistent with other services and avoids potential issues with Date objects in non-serialized contexts."
  - id: D-314
    description: "UserGroup.description uses null coalescing (?? '') to return empty string for null DB values — matches Go string zero value"
    rationale: "Go UserGroup.Description is string type (not *string), so zero value is ''. When DB has NULL, NestJS must return '' to match Go behavior."
  - id: D-315
    description: "generateAdminToken now uses actual admin user DB ID from DB instead of hardcoded ID=1 — fixes 404 on user/info in file DB"
    rationale: "Seed data uses onConflictDoUpdate on username, so admin user's DB ID may not be 1 in the file DB after prior test runs. JWT token must encode the actual DB ID."

metrics:
  duration: 25m
  completed: "2026-07-22"
  tasks: 2
  files: 5
  tests_added: 31
  bugs_fixed: 2

status: complete
---

# Phase 14 Plan 04: Storage-Policy & User Management Verification Summary

Fixed storage-policy date serialization bug and UserGroup.description nullability, verified both modules field-by-field against Go handler response structures.

## What Was Done

### Task 1: Fix storage-policy date serialization and UserGroup.description nullability (TDD)

**Code fixes:**
1. `storage-policy.service.ts`: Changed `created_at: policy.createdAt` and `updated_at: policy.updatedAt` to use `toISODateString()` — consistent with all other modules (article, file, album, doc-series, page).
2. `user.service.ts`: Changed all 4 occurrences of `description: group.description` to `description: group.description ?? ''` — matches Go string zero value behavior where `UserGroup.Description` is `string` (not `*string`), so zero value is `""`.

**Test infrastructure fix:**
3. `api-compat-helpers.ts`: Fixed `generateAdminToken` to query actual admin user DB ID instead of hardcoding ID=1. Added `generateAdminTokenWithId` helper. This fixes 404 errors on `GET /api/user/info` and `POST /api/user/update-password` when the file DB has accumulated data from prior test runs.

**Created test suites:**
- `storage-policy-verification.spec.ts`: 11 tests covering 7 endpoints (list, get, create, update, delete, OneDrive 501 stubs)
- `user-management-verification.spec.ts`: 17 tests covering 12 endpoints (admin users CRUD, user-groups, user info, profile, password, avatar, notification settings)

### Task 2: Verify user center and notification settings structures

Extended user management test with edge cases:
- UserGroup.description nullability: Inserted group with null description in DB, verified API returns empty string ""
- GetUserInfoResponse.userGroupID: Verified it's raw number (Go uint inconsistency) vs AdminUserDTO.userGroupID which is Sqids string
- Added 3 edge case tests (total 20 user management tests)

## Key Findings

1. **Storage-policy dates were raw Date objects** — While `JSON.stringify` handles Date objects via `toISOString()`, explicit conversion with `toISODateString()` is consistent with all other modules and avoids potential issues.
2. **UserGroup.description could be null** — Go `UserGroup.Description` is `string` type (zero value `""`), but NestJS returned `null` when DB had `NULL`. Fixed with `?? ''`.
3. **GetUserInfoResponse.userGroupID is raw number** — This is a Go design inconsistency: `GetUserInfoResponse.userGroupID` is `uint` (raw number) while `AdminUserDTO.userGroupID` is `string` (Sqids). NestJS replicates this inconsistency.
4. **generateAdminToken was broken for file DB** — Always encoded ID=1, but admin user may have different ID after prior test runs. Fixed by querying actual DB ID.
5. **SimpleUserNotificationSettingsResponse has exactly 1 field** — `allowCommentReplyNotification: boolean`, matching Go struct.
6. **Storage-policy access_key/secret_key are masked** — Non-empty keys show as `'********'`, empty keys show as `''`.

## Test Coverage

| Endpoint Group | Endpoints | Tests | Status |
|---------------|-----------|-------|--------|
| Storage-policy list | GET /api/policies | 5 | All pass |
| Storage-policy get | GET /api/policies/:id | 1 | All pass |
| Storage-policy create | POST /api/policies | 1 | All pass |
| Storage-policy update | PUT /api/policies/:id | 1 | All pass |
| Storage-policy delete | DELETE /api/policies/:id | 1 | All pass |
| OneDrive stubs | GET/POST onedrive | 2 | All pass (501) |
| Admin users list | GET /api/admin/users | 4 | All pass |
| Admin users create | POST /api/admin/users | 1 | All pass |
| Admin users update | PUT /api/admin/users/:id | 1 | All pass |
| Admin users delete | DELETE /api/admin/users/:id | 1 | All pass |
| Admin reset password | POST /api/admin/users/:id/reset-password | 1 | All pass |
| Admin update status | PUT /api/admin/users/:id/status | 1 | All pass |
| Admin user-groups | GET /api/admin/user-groups | 2 | All pass |
| User info | GET /api/user/info | 1 | All pass |
| User profile | PUT /api/user/profile | 1 | All pass |
| User password | POST /api/user/update-password | 1 | All pass |
| User avatar | POST /api/user/avatar | 1 | All pass (501) |
| Notification settings | GET/PUT /api/user/notification-settings | 2 | All pass |
| Edge cases | UserGroup null desc, userGroupID types | 3 | All pass |

**Total: 31 tests, all passing**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed generateAdminToken for file DB compatibility**
- **Found during:** Task 1 test run (GET /api/user/info returned 404)
- **Issue:** `generateAdminToken` always encodes DB ID=1, but admin user may have different ID in file DB after prior test runs. JWT token with wrong ID causes `getUserInfo(1)` to throw NotFoundException.
- **Fix:** Query actual admin user from DB, use their real ID to generate JWT token. Added `generateAdminTokenWithId` helper function.
- **Files modified:** server/test/helpers/api-compat-helpers.ts
- **Commit:** 60166fb

**2. [Rule 1 - Bug] Fixed password state dependency in update-password test**
- **Found during:** Task 1 test run (POST /api/user/update-password returned 401)
- **Issue:** Previous admin reset-password test changed password to 'newpassword123', so subsequent update-password test with oldPassword='password123' failed with 401.
- **Fix:** Reset password to known value via admin endpoint before testing update-password.
- **Files modified:** server/test/phase14-verification/user-management-verification.spec.ts
- **Commit:** 60166fb

**3. [Rule 1 - Bug] Fixed DELETE void response assertion**
- **Found during:** Task 1 test run (DELETE /api/policies/:id failed with "expected to have property data")
- **Issue:** `assertSuccessResponse` expects `data` property, but void responses from global interceptor don't include `data`.
- **Fix:** Changed to direct status/code/message assertions without requiring `data` property.
- **Files modified:** server/test/phase14-verification/storage-policy-verification.spec.ts
- **Commit:** 60166fb

---

**Total deviations:** 3 auto-fixed (1 blocking fix, 2 bug fixes)
**Impact on plan:** All auto-fixes necessary for test reliability and API compatibility. No scope creep.

## TDD Gate Compliance

- Task 1: Tests written first (RED), code fixes applied (GREEN), all tests pass
- Task 2: Edge case tests added, all pass immediately
- Both test suites verify field-by-field Go struct compatibility

## Known Deviations

| Field | Go Behavior | NestJS Behavior | Status |
|-------|-------------|-----------------|--------|
| GetUserInfoResponse.userGroupID | uint (raw number) | number | Consistent — Go design inconsistency replicated |
| AdminUserDTO.userGroupID | string (Sqids) | string (Sqids) | Consistent |
| UserGroup.description | string (zero value "") | string ("" for null) | Fixed — now matches Go |
| StoragePolicy.created_at | time.Time (JSON: ISO string) | toISODateString() | Fixed — now consistent with other modules |

## Self-Check: PASSED

- [x] server/test/phase14-verification/storage-policy-verification.spec.ts exists
- [x] server/test/phase14-verification/user-management-verification.spec.ts exists
- [x] server/src/storage-policy/storage-policy.service.ts contains toISODateString
- [x] server/src/user/user.service.ts contains description ?? '' (4 occurrences)
- [x] server/test/helpers/api-compat-helpers.ts contains generateAdminTokenWithId
- [x] Commit 60166fb exists (Task 1)
- [x] Commit e57a222 exists (Task 2)
- [x] 11 storage-policy tests pass
- [x] 20 user management tests pass
- [x] All 115 phase14 tests pass together (no regression)