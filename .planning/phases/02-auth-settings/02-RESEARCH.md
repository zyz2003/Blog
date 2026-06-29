# Phase 2: Auth & Settings - Research

**Researched:** 2026-06-29
**Domain:** Authentication, User Management, Settings Management (NestJS + SQLite rewrite of Go backend)
**Confidence:** HIGH

## Summary

This research comprehensively documents every API endpoint, request/response format, business logic, and data flow for the Auth, User, and Settings domains by reading the actual Go source code. The Go backend uses a three-tier architecture (handler/service/repository) with JWT HS256 authentication, bcrypt password hashing, Sqids-encoded public IDs, and an in-memory settings cache with public/private key classification.

The login flow is the most critical compatibility point: it returns `{ userInfo, roles, accessToken, refreshToken, expires }` where `userInfo` contains both public IDs (Sqids-encoded strings for `id` and `userGroup.id`) and a raw database ID (number for `userGroupID`). The JWT payload stores public IDs as strings (`user_id`, `user_group_id`) plus a `permissions` byte array. The `expires` field is a millisecond timestamp from `claims.ExpiresAt.Time.UnixMilli()`.

Settings are stored as key-value pairs in the `settings` table, loaded entirely into memory at startup, with public/private classification derived from `internal/configdef/definition.go`'s `IsPublic` field. The `unflatten()` function converts flat dot-notation keys (e.g., `footer.owner.name`) into nested JSON objects, and also auto-parses JSON strings, booleans, and numbers.

**Primary recommendation:** Implement each Go handler/service method as a direct NestJS controller/service equivalent, preserving exact field names, JSON keys, error messages, and response structures. The existing Phase 01 guards, interceptors, and decorators provide the infrastructure; Phase 02 adds the business logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-30:** JWT_SECRET from settings table dynamically read (config_key = "JWT_SECRET"), queried on every token sign/verify
- **D-31:** Access token 15 minutes, refresh token 30 days (hardcoded, matching Go)
- **D-32:** Refresh token supports both Authorization header (Bearer) and request body refreshToken field
- **D-33:** Login response format: `{ userInfo, roles, accessToken, refreshToken, expires }`, expires is millisecond timestamp
- **D-34:** Captcha: /api/public/captcha/config returns provider type; implement Image captcha + none modes; Turnstile/Geetest deferred
- **D-35:** Phase 02 only implements login + refresh-token. Register/activate/forgot-password/reset-password/check-email return 501
- **D-36:** Password hashing uses bcrypt (bcryptjs), compatible with Go's golang.org/x/crypto/bcrypt (DefaultCost=10)
- **D-37:** Use @nestjs/throttler for IP rate limiting; login endpoint 10 requests per 5 seconds (Go: CustomRateLimit(10, 5))
- **D-38:** Settings key-value store with in-memory cache (Map), loaded at startup, refreshed on update
- **D-39:** Public/private key distinction via hardcoded list (public-setting-keys.ts), matching Go's IsPublicSetting()
- **D-40:** /api/public/site-config returns predefined public config set, not all public keys
- **D-41:** Config version (/api/public/site-config/version) returns millisecond timestamp, refreshed on every update
- **D-42:** Settings advanced features: AI profiles masking, CDN cache purge detection, auto-backup before update
- **D-43:** Full user interfaces: current user ops + admin user management (CRUD + reset-password + status)
- **D-44:** Avatar upload (/api/user/avatar) returns 501 (depends on Phase 05 file service)

### Claude's Discretion
- JwtStrategy validate() method extension for full CustomClaims
- AuthService and TokenService class design and method signatures
- SettingsService memory cache implementation details
- AI profiles masking implementation details
- CDN cache purge service interface design
- Config backup service implementation
- Admin user management DTO design

### Deferred Ideas (OUT OF SCOPE)
- Turnstile/Geetest captcha implementation
- User registration/activation/forgot-password/reset-password
- Avatar upload (/api/user/avatar)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Admin login, JWT signing and verification | Go auth handler/service/token_service fully documented; JWT payload structure verified |
| AUTH-02 | Token refresh | Go RefreshToken handler documented; dual-source (header/body) token extraction verified |
| AUTH-03 | JWT compatible with Go backend | CustomClaims structure verified; HS256 signing; public ID encoding confirmed |
| USER-01 | Personal profile management | GetUserInfo, UpdateUserPassword, UpdateUserProfile handlers documented with exact DTOs |
| SETTING-01 | Read/update site configuration | SettingsService GetByKeys/UpdateSettings/GetSiteConfig documented; public/private filtering verified |
| SETTING-02 | Public configuration query | GetSiteConfig/GetConfigVersion handlers documented; unflatten logic verified |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT token generation/verification | API / Backend | — | Tokens are signed server-side with secret from settings table |
| Login authentication | API / Backend | — | Credential verification and session token creation are server-only |
| Password hashing | API / Backend | — | bcrypt runs server-side, never exposed to client |
| Settings CRUD | API / Backend | Database / Storage | Settings are persisted in SQLite, cached in memory |
| Public site config | API / Backend | CDN / Static | Read-only endpoint, may be cached by CDN (10s max-age) |
| Captcha generation | API / Backend | — | Server generates image, stores answer in cache |
| Rate limiting | API / Backend | — | IP-based throttling at middleware level |
| User management | API / Backend | Database / Storage | Admin CRUD operations on users table |
| AI profiles masking | API / Backend | — | Server-side data masking before sending to client |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/jwt | v11.0.2 | JWT token signing and verification | NestJS official JWT module [VERIFIED: npm registry] |
| @nestjs/passport | v11.0.5 | Passport integration for NestJS | NestJS official auth integration [VERIFIED: npm registry] |
| passport | v0.7.0 | Authentication middleware framework | Standard Node.js auth framework [VERIFIED: npm registry] |
| bcryptjs | v3.0.3 | Password hashing (Go-compatible) | Pure JS bcrypt, compatible with Go's golang.org/x/crypto/bcrypt DefaultCost=10 [VERIFIED: npm registry] |
| @nestjs/throttler | v6.5.0 | IP rate limiting | NestJS official throttler module [VERIFIED: npm registry] |
| class-validator | v0.15.1 | Request DTO validation | NestJS standard validation [VERIFIED: npm registry] |
| class-transformer | v0.5.1 | Response DTO transformation | NestJS standard transformation [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| svg-captcha | v1.4.0 | Image captcha generation | When captcha.provider = "image" [VERIFIED: npm registry] |
| uuid | (built-in Node.js crypto) | Captcha ID generation | Generate unique captcha session IDs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcryptjs | bcrypt (native) | bcrypt native is faster but requires native compilation; bcryptjs is pure JS, zero dependencies, cross-platform |
| svg-captcha | base64Captcha (Go equivalent) | svg-captcha is the Node.js equivalent; base64Captcha is Go-only |
| @nestjs/throttler | Custom rate limiter | @nestjs/throttler is NestJS-native, integrates with DI; custom limiter would be more Go-compatible but more code |

**Installation:**
```bash
npm install bcryptjs @nestjs/throttler svg-captcha class-validator class-transformer
npm install -D @types/bcryptjs
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| bcryptjs | npm | ~9 yrs | 10.5M/wk | github.com/dcodeIO/bcrypt.js | OK | Approved |
| @nestjs/throttler | npm | ~5 yrs | 2.9M/wk | github.com/nestjs/throttler | OK | Approved |
| svg-captcha | npm | ~7 yrs | 56K/wk | github.com/steambap/svg-captcha | OK | Approved |
| @nestjs/passport | npm | ~5 yrs | 3.7M/wk | github.com/nestjs/passport | OK | Approved |
| passport | npm | ~13 yrs | 7.5M/wk | github.com/jaredhanson/passport | OK | Approved |
| @nestjs/jwt | npm | ~5 yrs | 3.9M/wk | github.com/nestjs/jwt | OK | Approved |
| class-validator | npm | ~8 yrs | 10M/wk | github.com/typestack/class-validator | OK | Approved |
| class-transformer | npm | ~9 yrs | 10.8M/wk | github.com/typestack/class-transformer | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Client (Next.js)
    |
    v
[NestJS API Server :8091]
    |
    +-- Global Guards: JwtAuthGuard -> AdminGuard
    +-- Global Interceptors: ResponseInterceptor { code, data, message }
    +-- Global Filters: HttpExceptionFilter
    +-- Global Middleware: NoCacheMiddleware
    |
    +-- /api/auth/login          [Public + Throttler]
    +-- /api/auth/refresh-token  [Public]
    +-- /api/user/*              [JwtAuth]
    +-- /api/admin/users/*       [JwtAuth + Admin]
    +-- /api/settings/*          [JwtAuth (+ Admin for write)]
    +-- /api/public/site-config  [Public]
    +-- /api/public/captcha/*    [Public + Throttler]
    |
    v
[Services Layer]
    +-- AuthService  -> UserRepository, SettingService, TokenService
    +-- TokenService -> UserRepository, SettingService, CacheService
    +-- UserService  -> UserRepository, UserGroupRepository
    +-- SettingsService -> SettingRepository (in-memory cache)
    +-- CaptchaService -> SettingService, ImageCaptchaService
    |
    v
[Drizzle ORM + SQLite]
    +-- users table
    +-- user_groups table
    +-- settings table
```

### Recommended Project Structure
```
server/src/
├── auth/
│   ├── auth.module.ts          # (exists) AuthModule with JwtModule, PassportModule
│   ├── auth.controller.ts      # NEW: Login, RefreshToken, 501 stubs
│   ├── auth.service.ts         # NEW: Login business logic
│   ├── token.service.ts        # NEW: JWT generation, refresh, signed tokens
│   ├── jwt.strategy.ts         # (exists) Extend validate() for full CustomClaims
│   └── dto/
│       ├── login-request.dto.ts
│       ├── refresh-token-request.dto.ts
│       └── login-response.dto.ts
├── user/
│   ├── user.module.ts          # NEW
│   ├── user.controller.ts      # NEW: GetUserInfo, UpdatePassword, UpdateProfile, Admin CRUD
│   ├── user.service.ts         # NEW
│   └── dto/
│       ├── user-info-response.dto.ts
│       ├── update-password.dto.ts
│       ├── update-profile.dto.ts
│       ├── admin-user.dto.ts
│       └── admin-list-users-response.dto.ts
├── settings/
│   ├── settings.module.ts      # (exists) Expand
│   ├── settings.controller.ts  # NEW: GetByKeys, Update, GetSiteConfig, GetConfigVersion
│   ├── settings.service.ts     # NEW: In-memory cache, Get, GetByKeys, Update, IsPublicSetting
│   ├── public-setting-keys.ts  # NEW: Hardcoded public key list
│   └── dto/
│       └── get-by-keys-request.dto.ts
├── captcha/
│   ├── captcha.module.ts       # NEW
│   ├── captcha.controller.ts   # NEW: GetConfig, GenerateImage
│   ├── captcha.service.ts      # NEW: Unified captcha service
│   └── image-captcha.service.ts # NEW: SVG captcha generation
└── common/
    ├── guards/                 # (exists) JwtAuthGuard, JwtAuthOptionalGuard, AdminGuard
    ├── decorators/             # (exists) @Public(), @CurrentUser()
    ├── interceptors/           # (exists) ResponseInterceptor
    ├── filters/                # (exists) HttpExceptionFilter
    └── constants/              # (exists) ErrorCodes
```

### Pattern 1: Controller-Service-Repository with Public ID Translation
**What:** Every controller method that receives an ID from the client must decode the public ID (Sqids) to a database ID before passing to the service. Every response that includes an ID must encode the database ID to a public ID.
**When to use:** All endpoints that handle entity IDs (users, user groups, settings don't use public IDs for keys).
**Example:**
```typescript
// Controller: decode public ID from URL param
@Put(':id')
async AdminUpdateUser(@Param('id') publicId: string, @Body() dto: AdminUpdateUserDto) {
  const { dbID, entityType } = decodePublicID(publicId);
  if (entityType !== EntityType.User) {
    throw new BadRequestException('用户ID无效');
  }
  // Pass dbID to service
  await this.userService.adminUpdateUser(dbID, dto);
}

// Controller: encode database ID to public ID for response
const publicUserId = generatePublicID(user.id, EntityType.User);
```

### Pattern 2: Dynamic JWT Secret from Settings
**What:** JWT secret is NOT a static config value. It is read from the settings table via SettingService.Get('JWT_SECRET') on every token sign/verify operation.
**When to use:** All token generation and verification.
**Example:**
```typescript
// TokenService
async generateAccessToken(user: User): Promise<string> {
  const secret = this.settingsService.get('JWT_SECRET');
  if (!secret) throw new Error('JWT_SECRET 未从数据库加载');
  // Sign with dynamic secret
}
```

### Pattern 3: Settings In-Memory Cache with Unflatten
**What:** All settings loaded into a Map<string, string> at startup. GetByKeys returns unflattened nested objects where dot-notation keys become nested JSON, and values are auto-parsed as JSON/boolean/number.
**When to use:** All settings read operations.
**Example:**
```typescript
// Flat: { "footer.owner.name": "安知鱼", "footer.owner.since": "2020" }
// Unflattened: { footer: { owner: { name: "安知鱼", since: 2020 } } }
// Note: "2020" is auto-parsed as integer 2020, "true" as boolean true
```

### Pattern 4: Avatar URL Processing
**What:** If avatar does not start with "http://" or "https://", prepend the Gravatar base URL from settings.
**When to use:** Every response that includes a user avatar field.
**Example:**
```typescript
let avatar = user.avatar;
if (avatar && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
  const gravatarBaseURL = this.settingsService.get('GRAVATAR_URL');
  avatar = gravatarBaseURL.replace(/\/$/, '') + '/' + avatar.replace(/^\//, '');
}
```

### Pattern 5: Time Formatting with China Timezone
**What:** All time fields in user responses are formatted as "YYYY-MM-DD HH:mm:ss" in UTC+8 timezone. LastLoginAt is nullable (null when never logged in).
**When to use:** GetUserInfo, AdminListUsers, AdminCreateUser responses.
**Example:**
```typescript
// Go: utils.ToChina(user.CreatedAt).Format("2006-01-02 15:04:05")
// NestJS equivalent:
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
const chinaTime = toZonedTime(user.createdAt, 'Asia/Shanghai');
const formatted = format(chinaTime, 'yyyy-MM-dd HH:mm:ss');
```

### Anti-Patterns to Avoid
- **Static JWT secret in ConfigService:** Go reads JWT_SECRET from settings table dynamically. NestJS must do the same, not use a static env var.
- **Returning database IDs directly:** All user/userGroup IDs in responses must be Sqids-encoded public IDs (except `userGroupID` in login/userInfo which is intentionally the raw database ID as a number).
- **Omitting the `expires` field:** Go returns `expires` as a millisecond timestamp (UnixMilli), not seconds. Must use `Date.now()` style millisecond timestamps.
- **Flat settings response:** Go's `unflatten()` converts dot-notation keys to nested objects and auto-parses types. NestJS must replicate this exactly.
- **Missing AI profiles masking:** When returning settings that include `ai_profiles`, the API key must be masked (last 4 chars visible, rest as asterisks).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | bcryptjs | Must be compatible with Go's bcrypt; bcryptjs uses same algorithm and DefaultCost=10 |
| JWT token handling | Custom JWT implementation | @nestjs/jwt + jsonwebtoken | HS256 signing, standard claims, well-tested |
| Rate limiting | Custom rate limiter | @nestjs/throttler | NestJS-native, integrates with DI, configurable per-route |
| Image captcha | Custom canvas drawing | svg-captcha | Proven library, generates SVG captchas, configurable |
| ID encoding/decoding | Custom ID encoding | sqids (already in project) | Must match Go's Sqids output exactly |
| Request validation | Manual validation | class-validator + ValidationPipe | NestJS standard, declarative, auto-error messages |

**Key insight:** The Go backend uses standard, well-tested libraries for all crypto and auth operations. Reimplementing any of these in NestJS risks subtle incompatibilities, especially for bcrypt (password migration) and JWT (token cross-compatibility).

## Runtime State Inventory

> Not applicable — this is a greenfield implementation phase, not a rename/refactor/migration.

## Common Pitfalls

### Pitfall 1: Login Response userGroupID is Raw Database ID
**What goes wrong:** Implementing `userGroupID` as a public ID string when Go returns it as a raw database integer.
**Why it happens:** Most ID fields use public IDs, but `userGroupID` in `LoginUserInfoResponse` and `GetUserInfoResponse` is explicitly `uint` (raw database ID) while `userGroup.id` is a public ID string.
**How to avoid:** In login/userInfo responses: `userGroupID: user.userGroupID` (number), `userGroup: { id: publicUserGroupID }` (string).
**Warning signs:** Frontend admin panel breaks if userGroupID is a string instead of number.

### Pitfall 2: JWT Payload Uses Public IDs as Strings
**What goes wrong:** Storing database integer IDs in JWT claims instead of public ID strings.
**Why it happens:** Go's `CustomClaims` has `UserID string` and `UserGroupID string` — these are Sqids-encoded public IDs, not database IDs.
**How to avoid:** When generating tokens, encode database IDs to public IDs before putting them in the JWT payload. When reading claims, decode public IDs back to database IDs.
**Warning signs:** Existing Go-issued tokens will fail validation if NestJS expects integer IDs in claims.

### Pitfall 3: Settings unflatten Auto-Type-Parsing
**What goes wrong:** Returning all setting values as strings when Go auto-parses them as JSON objects, booleans, or numbers.
**Why it happens:** Settings are stored as text in the database, but Go's `unflatten()` converts "true" to `true`, "123" to `123`, and JSON strings to parsed objects.
**How to avoid:** Implement the same auto-parsing logic: try JSON parse first, then boolean, then number, then keep as string.
**Warning signs:** Frontend expects `footer.runtime.enable` as boolean `false`, not string `"false"`.

### Pitfall 4: Refresh Token Dual Source
**What goes wrong:** Only supporting refresh token from request body, ignoring Authorization header.
**Why it happens:** The Go handler checks Authorization header FIRST, then falls back to request body.
**How to avoid:** Extract from `Authorization: Bearer <token>` first. If empty, try `req.body.refreshToken`. If both empty, return 401.
**Warning signs:** Frontend may send refresh token via either method; both must work.

### Pitfall 5: bcryptjs Cost Factor Mismatch
**What goes wrong:** Using a different bcrypt cost factor than Go's DefaultCost (10).
**Why it happens:** Not checking Go's bcrypt.DefaultCost value.
**How to avoid:** Use bcryptjs with default cost (which is 10, matching Go). Do NOT specify a custom cost.
**Warning signs:** Existing Go-hashed passwords fail verification with "旧密码不正确".

### Pitfall 6: Time Null Handling
**What goes wrong:** Returning `null` for `lastLoginAt` when Go returns `null` for nil pointer, but returning empty string or "0001-01-01 00:00:00" for zero time.
**Why it happens:** Go's `*time.Time` nil becomes JSON `null`. NestJS must return `null` for users who never logged in, not an empty string or epoch time.
**How to avoid:** Check if `lastLoginAt` is null/undefined before formatting. If null, return null.
**Warning signs:** Frontend shows "1970-01-01" or empty string for new users' last login.

### Pitfall 7: Admin Guard Checks Decoded UserGroupID === 1
**What goes wrong:** Checking the public ID string against "1" instead of decoding it and checking the database ID.
**Why it happens:** The admin group always has database ID = 1, but its public ID is a Sqids-encoded string like "abc123".
**How to avoid:** Decode `claims.user_group_id` via Sqids, verify entityType === UserGroup, then check dbID === 1.
**Warning signs:** Admin users get 403 Forbidden on admin-only endpoints.

## Code Examples

### Login Response Structure (Go: auth handler.go lines 196-222)
```typescript
// Exact structure from Go's LoginUserInfoResponse + response.Success
{
  code: 200,
  message: "登录成功",
  data: {
    userInfo: {
      id: "SqidsEncodedString",        // public ID (string)
      created_at: "2025-06-28 00:21:55", // UTC+8 formatted time
      updated_at: "2025-06-28 00:21:55",
      username: "admin",
      nickname: "安知鱼",
      avatar: "https://cravatar.cn/avatar/xxx?d=identicon",
      email: "admin@example.com",
      lastLoginAt: "2025-08-11 18:39:11", // or null
      userGroupID: 1,                     // RAW DATABASE ID (number!)
      userGroup: {
        id: "SqidsEncodedString",         // public ID (string)
        name: "管理员",
        description: "系统管理员"
      },
      status: 1                           // 1=Active, 2=Inactive, 3=Banned
    },
    roles: ["1"],                         // userGroupID as string
    accessToken: "eyJhbGciOiJIUzI1NiIs...",
    refreshToken: "eyJhbGciOiJIUzI1NiIs...",
    expires: 1723397951000                // MILLISECOND timestamp
  }
}
```

### JWT CustomClaims Structure (Go: internal/pkg/auth/types.go)
```typescript
// JWT payload structure - must match Go exactly for cross-compatibility
{
  user_id: "SqidsEncodedString",      // public user ID (string)
  user_group_id: "SqidsEncodedString", // public user group ID (string)
  permissions: [0,1,2,3],             // byte array as JSON array of uints
  iss: "anheyu-app",                  // issuer
  iat: 1723397051,                    // issued at (seconds)
  exp: 1723397951,                    // expires at (seconds)
  nbf: 1723397051                     // not before (seconds)
}
// Note: Refresh token has same structure but WITHOUT user_group_id and permissions
```

### Settings GetByKeys with Public/Private Filtering (Go: setting handler.go lines 158-199)
```typescript
// Request: POST /api/settings/get-by-keys
// Body: { keys: ["APP_NAME", "JWT_SECRET", "footer.owner.name"] }

// For admin user: returns all keys
// For regular user: filters to public keys only, then returns
// Response includes unflattened structure with auto-type-parsing:
{
  code: 200,
  message: "获取配置成功",
  data: {
    APP_NAME: "安和鱼",
    footer: {
      owner: {
        name: "安知鱼"
      }
    }
    // JWT_SECRET is excluded for non-admin users
  }
}
```

### AI Profiles Masking (Go: setting handler.go lines 314-369)
```typescript
// Original (stored in DB):
[{ "id": "1", "name": "GPT-4", "provider": "openai", "api_url": "...", "model": "gpt-4", "enabled": true, "api_key": "sk-abc1234" }]

// Masked (returned to client):
[{ "id": "1", "name": "GPT-4", "provider": "openai", "api_url": "...", "model": "gpt-4", "enabled": true, "has_api_key": true, "api_key_masked": "************1234" }]

// Masking rule: if key length <= 4, return "****"; otherwise "************" + last 4 chars
// On update: if api_key matches api_key_masked (is masked), preserve the existing key from DB
```

### Rate Limiting Configuration (Go: router.go + rate_limit.go)
```typescript
// Go: CustomRateLimit(requestsPerMinute, burst)
// Login:     CustomRateLimit(10, 5)  -> 10 req/min, burst 5
// Register:  CustomRateLimit(5, 3)   -> 5 req/min, burst 3
// Captcha:   CustomRateLimit(10, 10) -> 10 req/min, burst 10
// CheckEmail: CustomRateLimit(10, 5) -> 10 req/min, burst 5

// NestJS @nestjs/throttler equivalent:
// Note: @nestjs/throttler uses time-window + limit, not token-bucket
// For login: Throttle({ default: { limit: 5, ttl: 10000 } }) = 5 requests per 10 seconds
// This approximates Go's CustomRateLimit(10, 5) behavior
```

## Auth Endpoints

| Method | Path | Handler | Request Body | Response Data | Auth Level | Rate Limit |
|--------|------|---------|-------------|---------------|------------|------------|
| POST | /api/auth/login | Login | `{ email, password, image_captcha_id?, image_captcha_answer?, turnstile_token?, geetest_* }` | `{ userInfo, roles, accessToken, refreshToken, expires }` | Public | CustomRateLimit(10, 5) |
| POST | /api/auth/refresh-token | RefreshToken | `{ refreshToken? }` (or Authorization header) | `{ accessToken, expires }` | Public | None |
| POST | /api/auth/register | Register | `{ email, nickname, password, repeat_password, captcha... }` | `{ activation_required: bool }` | Public | CustomRateLimit(5, 3) |
| POST | /api/auth/activate | ActivateUser | `{ id, sign }` | `{ userInfo, roles, accessToken, refreshToken, expires }` | Public | None |
| POST | /api/auth/forgot-password | ForgotPasswordRequest | `{ email, captcha... }` | `null` | Public | CustomRateLimit(5, 3) |
| POST | /api/auth/reset-password | ResetPassword | `{ id, sign, password, repeat_password }` | `null` | Public | CustomRateLimit(5, 3) |
| GET | /api/auth/check-email | CheckEmail | `?email=xxx` (query) | `{ exists: bool }` | Public | CustomRateLimit(10, 5) |

**Phase 02 scope:** Only Login and RefreshToken are fully implemented. Register, Activate, ForgotPassword, ResetPassword, and CheckEmail return 501 Not Implemented.

## User Endpoints

| Method | Path | Handler | Request Body | Response Data | Auth Level |
|--------|------|---------|-------------|---------------|------------|
| GET | /api/user/info | GetUserInfo | — | `GetUserInfoResponse` | JWT |
| POST | /api/user/update-password | UpdateUserPassword | `{ oldPassword, newPassword }` | `null` | JWT |
| PUT | /api/user/profile | UpdateUserProfile | `{ nickname?, website? }` | `null` | JWT |
| POST | /api/user/avatar | UploadAvatar | multipart/form-data: file | `{ url: string }` | JWT |
| GET | /api/admin/users | AdminListUsers | query: `page?, pageSize?, keyword?, groupID?, status?` | `{ users: AdminUserDTO[], total, page, size }` | JWT + Admin |
| POST | /api/admin/users | AdminCreateUser | `{ username, password, email, nickname?, userGroupID }` | `AdminUserDTO` | JWT + Admin |
| PUT | /api/admin/users/:id | AdminUpdateUser | `{ username?, email?, nickname?, userGroupID?, status? }` | `null` | JWT + Admin |
| DELETE | /api/admin/users/:id | AdminDeleteUser | — | `null` | JWT + Admin |
| POST | /api/admin/users/:id/reset-password | AdminResetPassword | `{ newPassword }` | `null` | JWT + Admin |
| PUT | /api/admin/users/:id/status | AdminUpdateUserStatus | `{ status }` | `null` | JWT + Admin |
| GET | /api/admin/user-groups | GetUserGroups | — | `UserGroupDTO[]` | JWT + Admin |

**Phase 02 scope:** All endpoints except UploadAvatar (returns 501, depends on Phase 05).

### User DTOs

**GetUserInfoResponse:**
```typescript
{
  id: string;              // public ID
  created_at: string;      // "YYYY-MM-DD HH:mm:ss" UTC+8
  updated_at: string;      // "YYYY-MM-DD HH:mm:ss" UTC+8
  username: string;
  nickname: string;
  avatar: string;          // full URL (Gravatar prepended if needed)
  email: string;
  website: string;
  lastLoginAt: string | null;  // "YYYY-MM-DD HH:mm:ss" UTC+8, or null
  userGroupID: number;     // RAW DATABASE ID (number, not public ID!)
  userGroup: {
    id: string;            // public ID
    name: string;
    description: string;
  };
  status: number;          // 1=Active, 2=Inactive, 3=Banned
}
```

**AdminUserDTO** (different from GetUserInfoResponse!):
```typescript
{
  id: string;              // public ID
  created_at: string;      // "YYYY-MM-DD HH:mm:ss" UTC+8
  updated_at: string;      // "YYYY-MM-DD HH:mm:ss" UTC+8
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  website: string;
  lastLoginAt: string | null;
  userGroupID: string;     // PUBLIC ID (string!) — different from GetUserInfoResponse!
  userGroup: {
    id: string;
    name: string;
    description: string;
  };
  status: number;
}
```

**CRITICAL:** In `GetUserInfoResponse`, `userGroupID` is a **number** (raw database ID). In `AdminUserDTO`, `userGroupID` is a **string** (public ID). This is an intentional inconsistency in the Go backend.

**AdminListUsersResponse:**
```typescript
{
  users: AdminUserDTO[];
  total: number;
  page: number;
  size: number;
}
```

**UserGroupDTO:**
```typescript
{
  id: string;      // public ID
  name: string;
  description: string;
}
```

**User Status Values:**
| Value | Constant | Meaning |
|-------|----------|---------|
| 1 | UserStatusActive | Normal active user |
| 2 | UserStatusInactive | Not yet activated (email verification pending) |
| 3 | UserStatusBanned | Banned user |

## Settings Endpoints

| Method | Path | Handler | Request Body | Response Data | Auth Level |
|--------|------|---------|-------------|---------------|------------|
| POST | /api/settings/get-by-keys | GetSettingsByKeys | `{ keys: string[] }` | `Record<string, any>` (unflattened, auto-typed) | JWT (public keys only for non-admin) |
| POST | /api/settings/update | UpdateSettings | `Record<string, string>` (flat key-value) | `null` | JWT + Admin |
| POST | /api/settings/test-email | TestEmail | `{ toEmail: string }` | `null` | JWT + Admin |
| GET | /api/public/site-config | GetSiteConfig | — | `Record<string, any>` (all public settings, unflattened + _config_version) | Public |
| GET | /api/public/site-config/version | GetConfigVersion | — | `{ version: number }` (millisecond timestamp) | Public |

**Phase 02 scope:** All settings endpoints implemented. TestEmail may return 501 if SMTP is not yet configured.

## JWT Token Lifecycle

### Token Generation (Go: internal/pkg/auth/jwt.go)

**Access Token:**
1. Input: `userID uint`, `permissions []byte`, `userGroupID uint`, `secretKey []byte`
2. Generate public IDs: `publicUserID = GeneratePublicID(userID, EntityTypeUser)`, `publicUserGroupID = GeneratePublicID(userGroupID, EntityTypeUserGroup)`
3. Create claims: `{ UserID: publicUserID, UserGroupID: publicUserGroupID, Permissions: permissions, RegisteredClaims: { ExpiresAt: now+15min, IssuedAt: now, NotBefore: now, Issuer: "anheyu-app" } }`
4. Sign with HS256: `jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secretKey)`

**Refresh Token:**
1. Input: `userID uint`, `secretKey []byte`
2. Generate public ID: `publicUserID = GeneratePublicID(userID, EntityTypeUser)`
3. Create claims: `{ UserID: publicUserID, RegisteredClaims: { ExpiresAt: now+30days, IssuedAt: now, NotBefore: now, Issuer: "anheyu-app" } }`
4. Note: Refresh token does NOT include `UserGroupID` or `Permissions`
5. Sign with HS256

### Token Verification (Go: internal/app/middleware/auth.go)

**JWTAuth (mandatory):**
1. Extract `Authorization: Bearer <token>` header
2. If missing: 401 "请求未携带Token，无权限访问"
3. If format wrong: 401 "Token格式不正确"
4. Parse token with dynamic secret from SettingService
5. If invalid/expired: 401 "无效或过期的Token"
6. Set claims in context

**JWTAuthOptional:**
1. If no Authorization header: pass through as guest
2. If header format wrong: pass through as guest
3. If token present but invalid: 401 "Token已过期" (triggers frontend refresh)
4. If token valid: set claims in context

**AdminAuth:**
1. Get claims from context
2. Decode `claims.UserGroupID` via Sqids
3. Verify entityType === EntityTypeUserGroup
4. Verify decoded dbID === 1
5. If any check fails: 403

### Refresh Token Flow (Go: token_service.go)

1. Extract refresh token from Authorization header (preferred) or request body
2. Parse refresh token with dynamic JWT secret
3. Decode `claims.UserID` (public ID) to database ID via Sqids
4. Verify entityType === EntityTypeUser
5. Look up user by database ID; verify user exists and status === Active
6. Generate new access token with user's current permissions and user group
7. Return `{ accessToken, expires }` where expires is millisecond timestamp

### Signed Token (for activation/password reset)

Go uses HMAC-SHA256 signed tokens (not JWT) for email verification links:
- `GenerateSignedToken(identifier, duration)`: creates `base64(HMAC-SHA256(identifier:expiry)) + ":" + expiry`
- `VerifySignedToken(identifier, sign)`: verifies HMAC signature and checks expiry
- These are used for email activation and password reset flows (deferred in Phase 02)

## Settings Key Classification

### How Public/Private is Determined

Public/private classification comes from `internal/configdef/definition.go` where each setting definition has an `IsPublic bool` field. The SettingService reads all definitions at startup and builds a `map[string]bool` of public keys.

### Key Categories

**Private (never exposed to non-admin users):**
- JWT_SECRET
- SMTP_* (all SMTP configuration)
- ENABLE_USER_ACTIVATION, ENABLE_REGISTRATION
- LOCAL_FILE_SIGNING_SECRET
- IP_API, IP_API_TOKEN
- VIPS_PATH, FFMPEG_PATH, LIBRAW_PATH
- IMAGE_STYLE_CACHE_PATH, IMAGE_STYLE_CACHE_MAX_MB, IMAGE_STYLE_CACHE_CLEANUP_INTERVAL
- QUEUE_THUMB_* (all queue configuration)
- CAPTCHA secret keys (turnstile.secret_key, geetest.captcha_key)
- Comment moderation settings (forbidden_words, AI detect config, notify settings)
- Email templates (all *_SUBJECT, *_TEMPLATE keys)
- CDN secrets (cdn.secret_id, cdn.secret_key)
- Wechat share app_secret
- Friend link notification internals

**Public (exposed to all authenticated users):**
- APP_NAME, SUB_TITLE, SITE_URL, APP_VERSION, API_URL
- LOGO_URL*, ICON_URL, GRAVATAR_URL, DEFAULT_GRAVATAR_TYPE
- APPEARANCE_SKIN, APPEARANCE_TOKENS
- SITE_ANNOUNCEMENT, CUSTOM_* (header/footer/CSS/JS/sidebar HTML)
- DEFAULT_THEME_MODE
- All footer.*, header.*, sidebar.*, about.page.* configurations
- All post.*, comment (public settings), album.* configurations
- Upload extension settings, external link warning, right menu settings
- Captcha provider type and public keys (turnstile.site_key, geetest.captcha_id)
- Image captcha length

### Site Config Response (Go: settings service.go GetSiteConfig)

Returns ALL public settings (unflattened) plus `_config_version`:
```typescript
{
  APP_NAME: "安和鱼",
  SUB_TITLE: "生活明朗，万物可爱",
  footer: {
    owner: { name: "安知鱼", since: 2020 },
    runtime: { enable: false, launch_time: "04/01/2021 00:00:00" }
  },
  header: { menu: [...], nav: { travelling: false, clock: false, menu: [...] } },
  // ... all other public settings in nested structure
  _config_version: 1723397951000  // millisecond timestamp
}
```

### Config Version (Go: settings service.go GetConfigVersion)

Returns `{ version: number }` where the number is a millisecond timestamp. This timestamp is updated on every settings write operation. Frontend uses this to detect when cached config is stale.

### Unflatten Algorithm (Go: settings service.go unflatten)

1. For each key-value pair in the flat map:
2. Trim whitespace from value
3. Try to parse as JSON (starts with `{` or `[` and ends with `}` or `]`): if success, use parsed object
4. Try to parse as boolean ("true"/"false" case-insensitive): if success, use boolean
5. Try to parse as number (float): if success and is integer, use int64; otherwise use float64
6. Otherwise keep as string
7. Split key by "." and create nested objects: `"footer.owner.name" -> { footer: { owner: { name: value } } }`

## Captcha

### Config Endpoint (GET /api/public/captcha/config)

Response structure from Go's `CaptchaConfig`:
```typescript
{
  provider: "none" | "turnstile" | "geetest" | "image",
  // Only present when provider = "turnstile":
  turnstile_site_key?: string,
  // Only present when provider = "geetest":
  geetest_captcha_id?: string,
  // Only present when provider = "image":
  image_captcha_length?: number  // default 4
}
```

The provider value is read from settings key `captcha.provider`. Phase 02 implements "image" and "none" only.

### Image Captcha Generation (GET /api/public/captcha/image)

**Rate limit:** CustomRateLimit(10, 10)

**Response:**
```typescript
{
  captcha_id: string,      // UUID v4
  image_base64: string     // Base64-encoded SVG image
}
```

**Implementation details from Go (imagecaptcha/service.go):**
- Uses `base64Captcha` library with `DriverString` config
- Height: 80px, Width: 240px
- Noise count: 2, Show line options: 2
- Character set: "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ" (excludes confusing chars like 0/O, 1/l/I)
- Background color: RGB(245, 245, 245) - light gray
- Font: "wqy-microhei.ttc"
- Captcha ID: UUID v4
- Answer stored in cache with TTL from `image_captcha.expire` setting (default 300 seconds / 5 minutes)
- Answer is stored as lowercase
- Verification is case-insensitive

**NestJS equivalent:** Use `svg-captcha` library with similar configuration. Store answer in the existing CacheService (Map-based TTL cache from Phase 01).

### Captcha Verification During Login

When `captcha.provider` is not "none":
1. Extract captcha params from login request body (`image_captcha_id`, `image_captcha_answer`)
2. Call `captchaSvc.Verify(ctx, params, clientIP)`
3. For image captcha: verify answer against cached answer (case-insensitive), delete cache entry after verification
4. If verification fails: 400 with error message
5. If provider is "none": skip verification entirely

## Rate Limiting

### Go Implementation (internal/app/middleware/rate_limit.go)

Go uses a token-bucket rate limiter (`golang.org/x/time/rate`) per IP address:
- `CustomRateLimit(requestsPerMinute, burst)` creates a per-IP limiter
- Each IP gets its own `rate.Limiter` instance
- Stale entries (>10 minutes unused) are cleaned up every 5 minutes
- 429 response: "请求过于频繁，请稍后再试"

### Specific Limits

| Endpoint | requestsPerMinute | burst | NestJS Approximation |
|----------|-------------------|-------|---------------------|
| /api/auth/login | 10 | 5 | Throttle({ limit: 5, ttl: 10000 }) |
| /api/auth/register | 5 | 3 | Throttle({ limit: 3, ttl: 12000 }) |
| /api/auth/forgot-password | 5 | 3 | Throttle({ limit: 3, ttl: 12000 }) |
| /api/auth/reset-password | 5 | 3 | Throttle({ limit: 3, ttl: 12000 }) |
| /api/auth/check-email | 10 | 5 | Throttle({ limit: 5, ttl: 10000 }) |
| /api/public/captcha/image | 10 | 10 | Throttle({ limit: 10, ttl: 60000 }) |

**Note:** @nestjs/throttler uses a fixed-window approach, not token-bucket. The approximations above convert Go's per-minute rate to NestJS's time-window format. The behavior will be similar but not identical — acceptable for a personal blog.

## Critical Compatibility Notes

### 1. Login Response userGroupID Type Inconsistency
In `LoginUserInfoResponse` and `GetUserInfoResponse`, `userGroupID` is `uint` (raw database ID, serialized as number). But in `AdminUserDTO`, `userGroupID` is `string` (public ID). This is an intentional inconsistency in the Go codebase that the frontend depends on.

### 2. Roles Array Format
The `roles` field in login response is `[]string{fmt.Sprintf("%d", user.UserGroupID)}` — the raw database userGroupID converted to string. For admin user, this is `["1"]`.

### 3. Time Format
Go uses `utils.ToChina(time).Format("2006-01-02 15:04:05")` which formats in UTC+8. NestJS must replicate this exact format. The `lastLoginAt` field uses `*time.Time` (pointer) in Go, which serializes as `null` when nil.

### 4. Avatar URL Processing Difference
In `GetUserInfo`, Go trims trailing slash from Gravatar URL and leading slash from avatar path before concatenating: `gravatarBaseURL = strings.TrimSuffix(gravatarBaseURL, "/")` then `avatar = strings.TrimPrefix(avatar, "/")` then `avatar = gravatarBaseURL + "/" + avatar`.

In `Login` and `AdminListUsers`, Go does NOT trim — it just concatenates: `avatar = gravatarBaseURL + avatar`.

This is an inconsistency in the Go codebase. NestJS should match each endpoint's behavior exactly.

### 5. Settings Update Uses Upsert
Go's `UpdateSettings` calls `repo.Upsert()` which creates the key if it doesn't exist. This is important for initial setup where settings may not be in the database yet.

### 6. AI Profiles on Update: Preserve Existing API Keys
When updating settings containing `ai_profiles`, if the incoming `api_key` is masked (matches `api_key_masked` or contains asterisks), the existing API key from the database must be preserved. This prevents accidental key deletion when the frontend sends back masked keys.

### 7. CDN Cache Purge Detection
After settings update, if any of these keys changed, CDN cache should be purged: `SITE_KEYWORDS`, `SITE_DESCRIPTION`, `FRONT_DESK_SITE_OWNER_NAME`, `ICON_URL`, `CUSTOM_HEADER_HTML`, `CUSTOM_FOOTER_HTML`, `CUSTOM_CSS`, `CUSTOM_JS`. Phase 02 should detect these changes and log a warning (actual CDN integration deferred).

### 8. Config Auto-Backup Before Update
Go creates a backup before every settings update. Phase 02 should implement this (JSON export to file).

### 9. bcrypt DefaultCost = 10
Go uses `bcrypt.DefaultCost` which is 10. bcryptjs also defaults to 10. This ensures password hash compatibility — existing Go-hashed passwords will verify correctly in NestJS without migration.

### 10. Permissions Field in JWT
The `permissions` field in CustomClaims is `[]byte` in Go. When serialized to JSON, Go's `jwt.MapClaims` serializes byte arrays as base64 strings. However, the Go codebase uses `json.Marshal` on Boolset which serializes as an array of uints. NestJS needs to handle this carefully — the permissions field may arrive as either a base64 string or an array of numbers depending on how the token was created.

## Dependencies on Phase 01

| Artifact | Location | How Phase 02 Uses It |
|----------|----------|---------------------|
| AuthModule | server/src/auth/auth.module.ts | Add AuthService, TokenService, AuthController providers |
| JwtStrategy | server/src/auth/jwt.strategy.ts | Extend validate() to return full CustomClaims; change secret to dynamic from SettingsService |
| JwtAuthGuard | server/src/common/guards/jwt-auth.guard.ts | Use directly on protected routes |
| JwtAuthOptionalGuard | server/src/common/guards/jwt-auth-optional.guard.ts | Use on routes that allow both guests and authenticated users |
| AdminGuard | server/src/common/guards/admin.guard.ts | Use on admin-only routes |
| @Public() decorator | server/src/common/decorators/public.decorator.ts | Mark login, refresh-token, and public endpoints |
| @CurrentUser() decorator | server/src/common/decorators/current-user.decorator.ts | Extract user from request in controllers |
| ResponseInterceptor | server/src/common/interceptors/response.interceptor.ts | Wraps all responses in { code, data, message } |
| HttpExceptionFilter | server/src/common/filters/http-exception.filter.ts | Formats all errors in { code, message, data: null } |
| ErrorCodes | server/src/common/constants/error-codes.ts | Use existing Chinese error messages |
| Sqids utils | server/src/common/utils/sqids.util.ts | generatePublicID/decodePublicID for all ID translation |
| Users schema | server/src/database/schemas/user.schema.ts | Drizzle queries for user CRUD |
| UserGroups schema | server/src/database/schemas/user-group.schema.ts | Drizzle queries for user group listing |
| Settings schema | server/src/database/schemas/setting.schema.ts | Drizzle queries for settings CRUD |
| CacheService | (Phase 01 memory cache) | Store captcha answers with TTL |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings unflatten logic | Simple key-value return | Replicate Go's unflatten() exactly | Frontend depends on nested structure and auto-type-parsing |
| AI profiles masking | Return raw API keys | Implement maskAISecret() from Go | Security: API keys must never be exposed to frontend |
| Admin permission check | String comparison on public ID | Decode public ID, check dbID === 1 | Admin group's public ID is a Sqids string, not "1" |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static JWT secret in env var | Dynamic JWT secret from settings table | Go backend design | Secret can be rotated without restart; must query DB on every sign/verify |
| Redis for caching | In-memory Map with TTL | This rewrite (D-38) | Simpler deployment; sufficient for single-instance blog |
| PostgreSQL tsvector | SQLite FTS5 | This rewrite | Different full-text search syntax (Phase 03+) |
| Go rate.Limiter (token bucket) | @nestjs/throttler (fixed window) | This rewrite | Slightly different rate limiting behavior; acceptable for blog |

**Deprecated/outdated:**
- Turnstile/Geetest captcha keys in settings: Use `captcha.provider` unified config instead of separate `turnstile.enable` flag

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bcryptjs default cost is 10 (matching Go's DefaultCost) | Password Hashing | Existing Go-hashed passwords would fail verification |
| A2 | @nestjs/throttler fixed-window approximates Go's token-bucket well enough for personal blog | Rate Limiting | Rate limiting behavior differs slightly; could allow more or fewer requests than Go |
| A3 | svg-captcha produces similar output to Go's base64Captcha | Captcha | Captcha images may look different but functionality is the same |
| A4 | The permissions field in JWT is serialized as base64 string by Go's jwt library | JWT Token Lifecycle | If permissions is serialized differently, token validation may fail |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Permissions field serialization in JWT**
   - What we know: Go's CustomClaims has `Permissions []byte`. Go's jwt library serializes byte arrays as base64 strings.
   - What's unclear: Whether the NestJS jwt library (jsonwebtoken) handles base64-encoded byte arrays in the same way when parsing Go-issued tokens.
   - Recommendation: Test with a real Go-issued JWT token to verify NestJS can parse it correctly. If not, add custom serialization/deserialization logic.

2. **SettingsService initialization timing**
   - What we know: Settings must be loaded into memory cache before any auth operation (since JWT_SECRET comes from settings).
   - What's unclear: Whether NestJS module lifecycle guarantees SettingsService is fully initialized before AuthModule tries to use it.
   - Recommendation: Use NestJS's `OnModuleInit` lifecycle hook in SettingsService to load all settings at startup. Ensure AuthModule imports SettingsModule.

3. **TestEmail endpoint**
   - What we know: Go implements TestEmail which sends a test email via SMTP.
   - What's unclear: Whether Phase 02 should implement this (requires SMTP configuration) or return 501.
   - Recommendation: Implement the endpoint structure but return 501 if SMTP is not configured. Full email support comes when SMTP settings are available.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v22+ | — |
| npm | Package manager | ✓ | 10+ | — |
| SQLite | Database | ✓ | better-sqlite3 | — |
| Drizzle Kit | Migrations | ✓ | 0.31.10 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing in project) |
| Config file | server/vitest.config.ts |
| Quick run command | `cd server && npx vitest run --reporter=verbose` |
| Full suite command | `cd server && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login with correct credentials returns JWT | unit | `npx vitest run --reporter=verbose auth.service.spec` | ❌ Wave 0 |
| AUTH-01 | Login with wrong password returns 401 | unit | `npx vitest run --reporter=verbose auth.service.spec` | ❌ Wave 0 |
| AUTH-01 | Login with inactive user returns error | unit | `npx vitest run --reporter=verbose auth.service.spec` | ❌ Wave 0 |
| AUTH-02 | Refresh token returns new access token | unit | `npx vitest run --reporter=verbose token.service.spec` | ❌ Wave 0 |
| AUTH-03 | Go-issued JWT is accepted by NestJS | integration | `npx vitest run --reporter=verbose jwt-compat.spec` | ❌ Wave 0 |
| USER-01 | GetUserInfo returns correct public IDs | unit | `npx vitest run --reporter=verbose user.service.spec` | ❌ Wave 0 |
| USER-01 | UpdatePassword verifies old password | unit | `npx vitest run --reporter=verbose user.service.spec` | ❌ Wave 0 |
| SETTING-01 | GetByKeys filters private keys for non-admin | unit | `npx vitest run --reporter=verbose settings.service.spec` | ❌ Wave 0 |
| SETTING-01 | UpdateSettings persists and refreshes cache | unit | `npx vitest run --reporter=verbose settings.service.spec` | ❌ Wave 0 |
| SETTING-02 | GetSiteConfig returns unflattened public settings | unit | `npx vitest run --reporter=verbose settings.service.spec` | ❌ Wave 0 |
| SETTING-02 | GetConfigVersion returns millisecond timestamp | unit | `npx vitest run --reporter=verbose settings.service.spec` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && npx vitest run --reporter=verbose --changed`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/auth/auth.service.spec.ts` — covers AUTH-01, AUTH-02
- [ ] `server/src/auth/token.service.spec.ts` — covers AUTH-02, AUTH-03
- [ ] `server/src/user/user.service.spec.ts` — covers USER-01
- [ ] `server/src/settings/settings.service.spec.ts` — covers SETTING-01, SETTING-02
- [ ] `server/src/auth/jwt-compat.spec.ts` — covers AUTH-03 (cross-compatibility)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | bcryptjs (cost=10) + JWT HS256 |
| V3 Session Management | yes | JWT with 15min access / 30day refresh |
| V4 Access Control | yes | AdminGuard (decode UserGroupID, check dbID===1) |
| V5 Input Validation | yes | class-validator DTOs + ValidationPipe |
| V6 Cryptography | yes | bcryptjs for hashing, jsonwebtoken for JWT signing |

### Known Threat Patterns for NestJS + SQLite Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Brute force login | Tampering | @nestjs/throttler rate limiting (5 req/10s on login) |
| JWT secret exposure | Information Disclosure | JWT_SECRET stored in settings table, never in env vars or client-facing code |
| Token replay | Spoofing | Short access token TTL (15min), refresh token rotation |
| SQL injection | Tampering | Drizzle ORM parameterized queries |
| Captcha bypass | Spoofing | Server-side captcha verification before auth |
| Privilege escalation | Elevation | AdminGuard decodes UserGroupID and checks dbID===1 |
| Settings data leak | Information Disclosure | Public/private key filtering for non-admin users |
| AI API key exposure | Information Disclosure | Masking with last-4-char display, preserve on update |

## Sources

### Primary (HIGH confidence)
- `internal/pkg/auth/jwt.go` — JWT token generation and parsing, HS256 signing
- `internal/pkg/auth/types.go` — CustomClaims structure: UserID, UserGroupID (strings), Permissions ([]byte)
- `internal/app/middleware/auth.go` — JWTAuth, JWTAuthOptional, AdminAuth middleware implementations
- `pkg/handler/auth/handler.go` — All auth handler methods with exact request/response structures
- `pkg/service/auth/auth_service.go` — Login, Register, ActivateUser business logic
- `pkg/service/auth/token_service.go` — GenerateSessionTokens, RefreshAccessToken, GenerateSignedToken
- `pkg/handler/user/handler.go` — All user handler methods with exact DTOs
- `pkg/service/user/user_service.go` — User service business logic
- `pkg/handler/setting/handler.go` — Settings handler with AI profiles masking
- `pkg/service/setting/service.go` — Settings service with in-memory cache and unflatten
- `pkg/constant/setting.go` — All setting key constants
- `internal/configdef/definition.go` — All setting definitions with IsPublic flags
- `pkg/handler/captcha/handler.go` — Captcha handler
- `pkg/service/captcha/service.go` — Unified captcha service
- `pkg/service/imagecaptcha/service.go` — Image captcha generation
- `internal/app/middleware/rate_limit.go` — Rate limiting implementation
- `internal/infra/router/router.go` — All route registrations
- `pkg/response/response.go` — Unified response structure { code, message, data }
- `internal/pkg/security/password.go` — bcrypt password hashing (DefaultCost)
- `pkg/domain/model/user.go` — User and UserGroup domain models, status constants
- `internal/pkg/utils/timezone.go` — UTC+8 timezone utilities
- `pkg/idgen/idgen.go` — Sqids public ID generation/decoding

### Secondary (MEDIUM confidence)
- `server/src/auth/jwt.strategy.ts` — Phase 01 JwtStrategy implementation
- `server/src/auth/auth.module.ts` — Phase 01 AuthModule configuration
- `server/src/common/guards/` — Phase 01 guard implementations
- `server/src/common/utils/sqids.util.ts` — Phase 01 Sqids Go-compatible implementation
- `server/src/database/schemas/` — Phase 01 Drizzle schemas

### Tertiary (LOW confidence)
- None — all findings verified against actual Go source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages verified on npm registry with legitimacy check
- Architecture: HIGH - all endpoints and DTOs documented from actual Go source code
- Pitfalls: HIGH - discovered by reading actual Go code, not assumed

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (30 days — stable domain, no fast-moving dependencies)
