---
phase: 02-auth-settings
plan: 02
subsystem: auth
tags: [jwt, hs256, bcryptjs, passport, dynamic-secret, public-id, refresh-token]

requires:
  - phase: 02
    provides: SettingsService with in-memory cache and dynamic JWT_SECRET
provides:
  - TokenService with Go-compatible JWT generation (HS256, public ID strings)
  - AuthService with login logic and Go-compatible response format
  - AuthController with login, refresh-token, and 501 stubs
  - JwtStrategy with dynamic secret from SettingsService
  - DTOs for login and refresh-token requests
affects: [user, captcha, app-module]

tech-stack:
  added: [bcryptjs, jsonwebtoken, @nestjs/throttler]
  patterns: [dynamic-jwt-secret-via-secretOrKeyProvider, refresh-token-dual-source-header-body]

key-files:
  created:
    - server/src/auth/token.service.ts
    - server/src/auth/auth.service.ts
    - server/src/auth/auth.controller.ts
    - server/src/auth/dto/login-request.dto.ts
    - server/src/auth/dto/refresh-token-request.dto.ts
    - server/src/auth/dto/login-response.dto.ts
    - server/src/auth/token.service.spec.ts
    - server/src/auth/auth.service.spec.ts
    - server/src/auth/auth.controller.spec.ts
  modified:
    - server/src/auth/jwt.strategy.ts
    - server/src/auth/auth.module.ts

key-decisions:
  - "TokenService uses jsonwebtoken directly (not JwtService) for dynamic secret per sign/verify call"
  - "JwtStrategy uses secretOrKeyProvider instead of static secretOrKey"
  - "Refresh token payload has only user_id (no user_group_id, no permissions)"
  - "Login response userInfo.userGroupID is raw DB integer, not public ID string (matches Go inconsistency)"

patterns-established:
  - "Dynamic JWT secret: secretOrKeyProvider reads from SettingsService cache on every request"
  - "Refresh token dual source: Authorization header first, then request body"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, API-COMPAT-03]

coverage:
  - id: D1
    description: "TokenService generates HS256 JWT with Go-compatible payload (user_id, user_group_id as public ID strings)"
    requirement: AUTH-03
    verification:
      - kind: unit
        ref: "token.service.spec.ts#Test 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Access token 15min, refresh token 30 days"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "token.service.spec.ts#Test 1, Test 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "JWT_SECRET read dynamically from SettingsService"
    requirement: AUTH-03
    verification:
      - kind: unit
        ref: "token.service.spec.ts#Test 1 (mockSettingsService.get called)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Login returns Go-compatible response with userInfo, roles, accessToken, refreshToken, expires"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "auth.service.spec.ts#Test 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "userInfo.userGroupID is raw database ID number, userInfo.id is public ID string"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "auth.service.spec.ts#Test 6"
        status: pass
    human_judgment: false
  - id: D6
    description: "Refresh token works from both Authorization header and request body"
    requirement: AUTH-02
    verification:
      - kind: unit
        ref: "auth.controller.spec.ts#Test 9, Test 10"
        status: pass
    human_judgment: false
  - id: D7
    description: "All 501 stub endpoints return proper error"
    requirement: API-COMPAT-03
    verification:
      - kind: unit
        ref: "auth.controller.spec.ts#Test 12-16"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-06-30
status: complete
---

# Phase 02 Plan 02 Summary

**Go-compatible JWT auth with TokenService, AuthService, and AuthController — dynamic secret, public ID encoding, dual-source refresh**

## Accomplishments
- TokenService generates HS256 JWT with public ID strings matching Go's CustomClaims
- JwtStrategy uses secretOrKeyProvider for dynamic JWT_SECRET from SettingsService
- AuthService implements login with bcrypt password verification and status checks
- Login response matches Go format exactly (userInfo.userGroupID = raw DB int)
- AuthController with refresh-token dual source (header + body) and 501 stubs

## Task Commits
1. **Task 1: TokenService + JwtStrategy** - `66fd9a4` (feat)
2. **Task 2: AuthService + AuthController** - `975c336` (feat)

## Files Created/Modified
- `server/src/auth/token.service.ts` - JWT generation with dynamic secret
- `server/src/auth/auth.service.ts` - Login business logic
- `server/src/auth/auth.controller.ts` - REST endpoints
- `server/src/auth/jwt.strategy.ts` - Updated to dynamic secret
- `server/src/auth/auth.module.ts` - Removed JwtModule.registerAsync
- `server/src/auth/dto/` - LoginRequest, RefreshTokenRequest, LoginResponse DTOs
- Test files: token.service.spec.ts (8), auth.service.spec.ts (8), auth.controller.spec.ts (9)

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
- vi.spyOn doesn't work with ESM module namespace (bcryptjs) — resolved with vi.mock()

## Next Phase Readiness
- Auth endpoints ready for captcha integration (Plan 02-04)
- TokenService ready for UserService token operations (Plan 02-03)
