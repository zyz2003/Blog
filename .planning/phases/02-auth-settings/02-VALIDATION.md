---
phase: "02"
slug: auth-settings
created: "2026-06-29"
---

# Phase 02: Auth & Settings - Validation Strategy

## Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @nestjs/testing |
| Quick run | `cd server && npx vitest run --reporter=verbose` |
| Full suite | `cd server && npx vitest run` |

## Requirements -> Test Map
| Req ID | Behavior | Test Type | Command | File |
|--------|----------|-----------|---------|------|
| AUTH-01 | Login with correct credentials returns JWT | integration | `npx vitest run -t "login"` | phase02-integration.spec.ts |
| AUTH-01 | Login with wrong password returns 401 | unit | `npx vitest run -t "login wrong"` | auth.service.spec.ts |
| AUTH-01 | Login with inactive/banned user returns 403 | unit | `npx vitest run -t "inactive\|banned"` | auth.service.spec.ts |
| AUTH-01 | Captcha verification during login | unit | `npx vitest run -t "captcha verify"` | captcha.service.spec.ts |
| AUTH-02 | Refresh token returns new access token | integration | `npx vitest run -t "refresh"` | phase02-integration.spec.ts |
| AUTH-02 | Refresh token from Authorization header | unit | `npx vitest run -t "refresh header"` | auth.controller.spec.ts |
| AUTH-02 | Refresh token from request body | unit | `npx vitest run -t "refresh body"` | auth.controller.spec.ts |
| AUTH-03 | Go-issued JWT accepted by NestJS | integration | `npx vitest run -t "Go JWT compat"` | phase02-integration.spec.ts |
| AUTH-03 | JWT payload has user_id/user_group_id as public IDs | unit | `npx vitest run -t "token payload"` | token.service.spec.ts |
| USER-01 | GetUserInfo returns correct public IDs and raw DB userGroupID | integration | `npx vitest run -t "user info"` | phase02-integration.spec.ts |
| USER-01 | UpdatePassword verifies old password | unit | `npx vitest run -t "update password"` | user.service.spec.ts |
| USER-01 | UpdateProfile updates nickname/website | unit | `npx vitest run -t "update profile"` | user.service.spec.ts |
| USER-01 | Admin user CRUD with pagination | unit | `npx vitest run -t "admin list users"` | user.service.spec.ts |
| USER-01 | AdminUserDTO.userGroupID is public ID string | unit | `npx vitest run -t "admin user DTO"` | user.service.spec.ts |
| SETTING-01 | GetByKeys filters private keys for non-admin | unit | `npx vitest run -t "get by keys"` | settings.service.spec.ts |
| SETTING-01 | UpdateSettings persists and refreshes cache | unit | `npx vitest run -t "update settings"` | settings.service.spec.ts |
| SETTING-01 | AI profiles masking on read | unit | `npx vitest run -t "AI profiles mask"` | settings.service.spec.ts |
| SETTING-01 | AI profiles preserve existing keys on update | unit | `npx vitest run -t "AI profiles preserve"` | settings.service.spec.ts |
| SETTING-01 | Config auto-backup before update | unit | `npx vitest run -t "auto backup"` | settings.service.spec.ts |
| SETTING-02 | GetSiteConfig returns unflattened public settings | unit | `npx vitest run -t "site config"` | settings.service.spec.ts |
| SETTING-02 | GetConfigVersion returns millisecond timestamp | unit | `npx vitest run -t "config version"` | settings.service.spec.ts |
| SETTING-02 | Unflatten auto-parses JSON/boolean/number | unit | `npx vitest run -t "unflatten"` | settings.service.spec.ts |
| API-COMPAT-03 | JWT HS256 with dynamic secret from settings | unit | `npx vitest run -t "dynamic secret"` | token.service.spec.ts |
| API-COMPAT-06 | Settings response format matches Go | unit | `npx vitest run -t "settings response"` | settings.controller.spec.ts |
| API-COMPAT-06 | Login response format matches Go | integration | `npx vitest run -t "login response"` | phase02-integration.spec.ts |

## Sampling Rate
- Per task: `cd server && npx vitest run --reporter=verbose`
- Per wave: `cd server && npx vitest run`
- Phase gate: Full suite green
