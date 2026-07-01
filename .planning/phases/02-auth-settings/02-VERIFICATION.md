---
phase: 02-auth-settings
status: passed
verified_at: 2026-07-01
verifier: orchestrator
---

# Phase 02 Verification: Auth & Settings

## Phase Goal

Admin can log in via JWT, manage user profile, configure site settings; visitors can read public config

## Must-Haves Verification

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | POST /api/auth/login returns JWT with Go-compatible token structure (HS256, UserID/UserGroupID payload) | PASS | Integration test: `phase02-integration.spec.ts#POST /api/auth/login returns correct structure`; TokenService generates HS256 JWT with public ID strings |
| 2 | Existing Go-issued JWT tokens are accepted by NestJS guards | PASS | Integration test: `phase02-integration.spec.ts#Go-issued JWT token is accepted by NestJS JwtStrategy` |
| 3 | Admin can read and update site settings via /api/settings | PASS | Unit tests: `settings.service.spec.ts` (31 tests), `settings.controller.spec.ts` (7 tests) |
| 4 | Visitors can read public site config via /api/public/site-config | PASS | Integration test: `phase02-integration.spec.ts#GET /api/public/site-config returns unflattened public settings` |
| 5 | Password hashing uses bcrypt | PASS | `auth.service.ts` uses `bcryptjs.compare()` and `bcryptjs.hash()`; integration test verifies bcrypt compatibility |
| 6 | Token refresh endpoint works | PASS | Integration test: `phase02-integration.spec.ts#POST /api/auth/refresh-token returns new accessToken`; Unit tests verify dual-source (header + body) |

## Requirement Traceability

| Requirement ID | Description | Plan | Status | Evidence |
|---------------|-------------|------|--------|----------|
| AUTH-01 | Admin login with JWT | 02-02, 02-04, 02-05 | PASS | Integration tests: login returns correct structure, userInfo fields, wrong password returns 401 |
| AUTH-02 | JWT token refresh | 02-02, 02-05 | PASS | Integration test: refresh-token returns new accessToken; unit tests: dual-source refresh |
| AUTH-03 | JWT compatible with Go backend tokens | 02-02, 02-05 | PASS | Integration test: Go-issued JWT accepted; TokenService uses HS256 with public ID strings |
| USER-01 | User profile management | 02-03, 02-05 | PASS | Integration test: GET /api/user/info returns profile; 27 unit tests for UserService + UserController |
| SETTING-01 | Site settings read/update | 02-01, 02-05 | PASS | 31 unit tests for SettingsService; 7 unit tests for SettingsController |
| SETTING-02 | Public site config query | 02-01, 02-05 | PASS | Integration test: GET /api/public/site-config returns unflattened config with _config_version |
| API-COMPAT-03 | API compatibility (auth) | 02-02, 02-05 | PASS | Go-issued JWT accepted; login response format matches Go exactly |
| API-COMPAT-06 | API compatibility (settings) | 02-01, 02-05 | PASS | Public setting keys match Go IsPublicSetting(); unflatten matches Go behavior |

## Automated Checks

- Unit tests: 151 passed (15 test files)
- Integration tests: 11 passed (phase02-integration.spec.ts)
- App bootstrap test: 3 passed

## Known Issues

1. **guards.spec.ts unhandled rejections**: JwtAuthGuard and JwtAuthOptionalGuard emit unhandled promise rejections when Passport strategy is not registered. The tests pass (12/12) but produce 2 unhandled errors. This is a pre-existing Phase 01 issue, not a Phase 02 regression.

2. **Fixed during verification**: SettingsModule and AuthModule were missing DatabaseModule imports (DI resolution failure). Fixed in commit `19b70e2`. Integration test was using Fastify-specific `app.inject()` instead of `supertest` for Express. Fixed in the same commit.

## human_verification

None required — all must-haves verified through automated tests.
