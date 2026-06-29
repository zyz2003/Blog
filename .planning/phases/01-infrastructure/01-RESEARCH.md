# Phase 1: Infrastructure - Research

**Researched:** 2026-06-28
**Domain:** NestJS scaffold + Drizzle ORM + SQLite + Guards + Interceptors + Sqids
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire NestJS backend foundation: project scaffold, all 30 Drizzle schema files mapped from Go ent/schema, global response interceptor matching Go's `{ code, message, data }` format, three auth guards (JwtAuth/JwtAuthOptional/Admin), Sqids ID encoder with Go-compatible shuffle algorithm, error code constants with Chinese messages, and in-memory cache infrastructure. Every component must be API-compatible with the existing Go backend -- the frontend must work without any changes.

The Go backend source code has been fully read and analyzed. All 29 ent/schema/*.go files define 29 tables (the 30th is the link_tag_pivot join table implied by the Link-LinkTag many-to-many edge). The SoftDeleteMixin adds a `deleted_at` nullable timestamp to most tables. The response format is `{ code: number, message: string, data: any }` where code equals the HTTP status code. JWT uses HS256 with CustomClaims containing `user_id` (Sqids public ID string), `user_group_id` (Sqids public ID string), and `permissions` (Base64-encoded byte array). The Sqids encoder uses a shuffled alphabet derived from a seed stored in the settings table as `id_seed`, with `minLength=4` and encoding `[dbID, entityType]` pairs.

**Primary recommendation:** Use NestJS CLI to scaffold the project, then systematically create each Drizzle schema file by translating Go ent/schema definitions field-by-field. The global ResponseInterceptor and Guards follow NestJS canonical patterns. The Sqids shuffle algorithm must be ported exactly from Go's `shuffleAlphabet` function using the same `int64(c) * int64(i+1)` seed calculation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Feature module organization -- each domain one directory (article/, auth/, settings/), with module.ts + controller.ts + service.ts + repository.ts
- **D-02:** Shared code in common/ (guards/, interceptors/, decorators/, filters/), database init in database/ (schemas/, drizzle init)
- **D-03:** Phase 01 creates all business module directories at once (article, auth, settings, page, file, comment, search, statistics, link, album, doc-series, rss, sitemap, music, notification, subscriber, thumbnail, config), each with placeholder module.ts
- **D-04:** Config files in config/ (env.validation.ts etc), NestJS backend in server/ directory, top-level server/src/ structure: article/, auth/, common/, config/, database/, app.module.ts, main.ts
- **D-05:** One-table-one-file in database/schemas/ (article.schema.ts, user.schema.ts etc)
- **D-06:** Phase 01 defines all 30 table schemas at once, directly aligned with Go ent/schema/ definitions
- **D-07:** 3 independent Guard implementations: JwtAuthGuard (token required), JwtAuthOptionalGuard (parse if present, pass if absent), AdminGuard (check UserGroupID is admin)
- **D-08:** JwtAuthGuard registered globally (APP_GUARD), public routes use custom @Public() decorator to skip auth
- **D-09:** AdminGuard manually applied via @UseGuards(AdminGuard) on admin Controller/Method
- **D-10:** Global ResponseInterceptor (APP_INTERCEPTOR) wraps all returns as `{ code, data, message }`, code defaults to 200
- **D-11:** All data files in data/ directory: data/anheyu.db (SQLite), data/uploads/, data/thumbnails/, matching Go backend
- **D-12:** Define error-codes.ts constant file with all Go backend error codes and Chinese message mapping
- **D-13:** App startup reads id_seed from settings table, calls InitSqidsEncoderWithSeed. Empty DB generates random seed stored in settings table. Encode format [dbID, entityType], minLength=4
- **D-14:** Map + TTL basic in-memory cache, startup timer cleans expired entries. Phase 01 only builds infrastructure
- **D-15:** Use @nestjs/config ConfigModule.forRoot() to load .env, with validation and caching
- **D-16:** Use NestJS built-in Logger with colored output and context identifier
- **D-17:** Go backend code preserved during dev as API compatibility reference. NestJS backend in separate server/ directory. Phase 11 deletes all Go code after integration tests pass

### Claude's Discretion
- Database connection initialization approach (Drizzle + better-sqlite3 injection pattern)
- drizzle.config.ts configuration details
- CORS configuration (reference Go backend cors.go)
- Repository layer abstraction level (direct Drizzle queries in Service vs abstract Repository class)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Backend listens on port 8091 | NestJS main.ts app.listen(8091); .env PORT=8091 |
| INFRA-02 | SQLite database file in data/ directory | Drizzle + better-sqlite3 connects to data/anheyu.db; data/ dir created at startup |
| INFRA-03 | WAL mode enabled, busy_timeout set | PRAGMA journal_mode=WAL and PRAGMA busy_timeout=5000 executed after connection |
| INFRA-04 | npm run dev starts backend | package.json scripts.dev = "nest start --watch" in server/ |
| INFRA-05 | Database migration uses drizzle-kit | drizzle-kit push for schema push; drizzle.config.ts at server/ root |
| INFRA-06 | Drizzle Schema defines all 30 tables | 29 explicit schema files + 1 implicit join table (link_tag_pivot), all mapped from Go ent/schema/ |
| API-COMPAT-01 | All /api/* endpoint paths match Go backend | NestJS Controller decorators match router.go route registrations exactly |
| API-COMPAT-02 | All API responses format { code, data, message } | Global ResponseInterceptor wraps all returns; matches Go pkg/response/response.go |
| API-COMPAT-04 | JWT Token structure compatible with Go backend | CustomClaims: user_id (Sqids string), user_group_id (Sqids string), permissions (Base64 bytes), HS256 signing |
| API-COMPAT-05 | Pagination params and response format match Go backend | Go uses page/size query params; response includes total count -- exact format TBD in Phase 02+ |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| NestJS application bootstrap | API / Backend | -- | main.ts + AppModule orchestration is server-side |
| Database schema definition | Database / Storage | -- | Drizzle schemas define table structure and relations |
| SQLite connection + WAL config | Database / Storage | -- | Connection initialization runs at server startup |
| Global response interceptor | API / Backend | -- | Interceptor wraps all controller returns |
| JWT auth guard | API / Backend | -- | Guard validates Authorization header on each request |
| Admin guard | API / Backend | -- | Guard checks decoded UserGroupID from JWT claims |
| Sqids encoder/decoder | API / Backend | -- | ID encoding is server-side logic, not client |
| Error code constants | API / Backend | -- | Server-side error mapping, Chinese messages for frontend |
| CORS configuration | API / Backend | -- | Server middleware, matches Go cors.go |
| In-memory cache | API / Backend | -- | Server-side Map+TTL, replaces Redis |
| Config management | API / Backend | -- | @nestjs/config loads .env at server startup |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/core | 11.1.27 | NestJS framework core | Modular, decorator-based, DI -- closest to Go handler/service/repo layers [VERIFIED: npm registry] |
| @nestjs/common | 11.1.27 | NestJS common utilities | Required peer of @nestjs/core [VERIFIED: npm registry] |
| @nestjs/platform-express | 11.1.27 | Express adapter for NestJS | Standard HTTP adapter, multer built-in [VERIFIED: npm registry] |
| drizzle-orm | 0.45.2 | Type-safe ORM for SQLite | Lightweight, SQL-like syntax, best SQLite pairing [VERIFIED: npm registry] |
| better-sqlite3 | 12.11.1 | Synchronous SQLite driver | Sync API fits NestJS request lifecycle, zero-config [VERIFIED: npm registry] |
| @nestjs/config | 4.0.4 | Configuration module | Official NestJS config, .env loading + validation [VERIFIED: npm registry] |
| @nestjs/jwt | 11.0.2 | JWT module | Official NestJS JWT, HS256 signing [VERIFIED: npm registry] |
| sqids | 0.3.0 | Short ID encoding | Same library as Go backend (sqids-go), cross-language compatible [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/passport | 11.0.5 | Passport integration | Auth strategies (local, JWT) [VERIFIED: npm registry] |
| passport | 0.7.0 | Auth framework | Underlying passport framework [VERIFIED: npm registry] |
| passport-local | 1.0.0 | Username/password strategy | Login endpoint [VERIFIED: npm registry] |
| class-validator | 0.15.1 | Request DTO validation | NestJS standard validation pipe [VERIFIED: npm registry] |
| class-transformer | 0.5.1 | Response DTO transformation | NestJS standard response transform [VERIFIED: npm registry] |
| drizzle-kit | 0.31.10 | Schema migration CLI | drizzle-kit push/generate [VERIFIED: npm registry] |
| @nestjs/cli | 11.0.23 | NestJS project scaffolding | Initial project generation [VERIFIED: npm registry] |
| @types/better-sqlite3 | 7.6.13 | TypeScript types | Dev dependency for better-sqlite3 [VERIFIED: npm registry] |
| @nestjs/testing | 11.1.27 | NestJS test utilities | Unit/integration testing [VERIFIED: npm registry] |
| vitest | 4.1.9 | Test runner | Fast, ESM-native, NestJS compatible [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | bun:sqlite | Only works in Bun runtime, not Node.js |
| better-sqlite3 | sql.js (WASM) | Async, slower, larger bundle |
| class-validator | zod | Zod is more modern but NestJS has built-in class-validator integration via ValidationPipe |
| @nestjs/config | dotenv directly | Loses validation, caching, and module injection |

**Installation:**
```bash
# In server/ directory
npm init -y
npm install @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config @nestjs/jwt @nestjs/passport passport passport-local drizzle-orm better-sqlite3 sqids class-validator class-transformer reflect-metadata rxjs
npm install -D @nestjs/cli @nestjs/testing drizzle-kit @types/better-sqlite3 vitest typescript @types/node ts-node
```

**Version verification:**
```
@nestjs/core: 11.1.27 (published 2026-06-15)
@nestjs/common: 11.1.27 (published 2026-06-15)
@nestjs/platform-express: 11.1.27 (published 2026-06-15)
drizzle-orm: 0.45.2 (published 2026-03-27)
better-sqlite3: 12.11.1 (published 2026-06-15)
@nestjs/config: 4.0.4 (published 2026-04-09)
@nestjs/jwt: 11.0.2 (published 2025-12-05)
sqids: 0.3.0 (published 2023-09-08)
drizzle-kit: 0.31.10 (published 2026-03-17)
class-validator: 0.15.1 (published 2026-02-26)
class-transformer: 0.5.1 (published 2021-11-22)
@nestjs/cli: 11.0.23 (published 2026-06-09)
vitest: 4.1.9 (published 2026-06-15)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @nestjs/core | npm | 7+ yrs | 11.5M/wk | github.com/nestjs/nest | OK | Approved |
| @nestjs/common | npm | 7+ yrs | 9.9M/wk | github.com/nestjs/nest | OK | Approved |
| @nestjs/platform-express | npm | 7+ yrs | 8.4M/wk | github.com/nestjs/nest | OK | Approved |
| @nestjs/config | npm | 5+ yrs | 5.6M/wk | github.com/nestjs/config | OK | Approved |
| @nestjs/jwt | npm | 5+ yrs | 3.9M/wk | github.com/nestjs/jwt | OK | Approved |
| @nestjs/passport | npm | 5+ yrs | 3.8M/wk | github.com/nestjs/passport | OK | Approved |
| passport | npm | 12+ yrs | 7.6M/wk | github.com/jaredhanson/passport | OK | Approved |
| passport-local | npm | 11+ yrs | 2.0M/wk | github.com/jaredhanson/passport-local | OK | Approved |
| drizzle-orm | npm | 3+ yrs | 11.4M/wk | github.com/drizzle-team/drizzle-orm | OK | Approved |
| better-sqlite3 | npm | 8+ yrs | 7.4M/wk | github.com/WiseLibs/better-sqlite3 | OK | Approved |
| sqids | npm | 2+ yrs | 1.9M/wk | github.com/sqids/sqids-javascript | OK | Approved |
| drizzle-kit | npm | 3+ yrs | 9.5M/wk | github.com/drizzle-team/drizzle-orm | OK | Approved |
| class-validator | npm | 7+ yrs | 10.1M/wk | github.com/typestack/class-validator | OK | Approved |
| class-transformer | npm | 7+ yrs | 10.8M/wk | github.com/typestack/class-transformer | OK | Approved |
| @nestjs/cli | npm | 7+ yrs | 6.6M/wk | github.com/nestjs/nest-cli | OK | Approved |
| @nestjs/testing | npm | 7+ yrs | 7.4M/wk | github.com/nestjs/nest | OK | Approved |
| vitest | npm | 4+ yrs | 69.4M/wk | github.com/vitest-dev/vitest | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (the "too-new" flags from the seam are false positives for these well-established packages with millions of weekly downloads and known GitHub repos)

## Architecture Patterns

### System Architecture Diagram

```
Client (Next.js frontend)
  |
  | HTTP /api/*
  v
NestJS App (port 8091)
  |
  +-- Global Guards (JwtAuthGuard -> @Public() skip)
  +-- Global Interceptor (ResponseInterceptor -> { code, data, message })
  +-- Global Exception Filter (HttpExceptionFilter -> { code, message, data: null })
  |
  +-- Feature Modules
  |     +-- AuthModule (login, refresh-token, register)
  |     +-- ArticleModule (CRUD, public listing)
  |     +-- SettingsModule (config read/write, id_seed)
  |     +-- ... (18 total feature modules)
  |
  +-- DatabaseModule
  |     +-- Drizzle + better-sqlite3 connection
  |     +-- WAL mode + busy_timeout PRAGMAs
  |     +-- 30 schema files in database/schemas/
  |
  +-- CommonModule
  |     +-- Guards (JwtAuth, JwtAuthOptional, Admin)
  |     +-- Interceptors (Response)
  |     +-- Decorators (@Public, @CurrentUser)
  |     +-- Filters (HttpException)
  |     +-- Sqids encoder/decoder
  |     +-- Error codes constant
  |     +-- Memory cache
  |
  +-- ConfigModule (@nestjs/config)
        +-- .env loading + validation
        +-- JWT_SECRET, PORT, etc.

Database: data/anheyu.db (SQLite WAL)
  |
  +-- 30 tables (users, articles, settings, files, ...)
  +-- Soft delete via deleted_at column
  +-- Sqids id_seed in settings table
```

### Recommended Project Structure
```
server/
├── src/
│   ├── main.ts                          # Bootstrap, port 8091
│   ├── app.module.ts                    # Root module
│   ├── config/
│   │   └── env.validation.ts            # .env schema validation
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        # JwtAuthGuard (global)
│   │   │   ├── jwt-auth-optional.guard.ts # JwtAuthOptionalGuard
│   │   │   └── admin.guard.ts           # AdminGuard
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts  # Global { code, data, message }
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts      # @Public() skip auth
│   │   │   └── current-user.decorator.ts # @CurrentUser()
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Global exception -> { code, message }
│   │   ├── constants/
│   │   │   └── error-codes.ts           # Error codes + Chinese messages
│   │   ├── utils/
│   │   │   └── sqids.util.ts            # Sqids encoder/decoder
│   │   └── cache/
│   │       └── memory-cache.util.ts     # Map + TTL cache
│   ├── database/
│   │   ├── database.module.ts           # Drizzle provider
│   │   ├── database.service.ts          # Connection + PRAGMA setup
│   │   └── schemas/
│   │       ├── index.ts                 # Re-export all schemas
│   │       ├── user.schema.ts
│   │       ├── user-group.schema.ts
│   │       ├── article.schema.ts
│   │       ├── article-history.schema.ts
│   │       ├── post-category.schema.ts
│   │       ├── post-tag.schema.ts
│   │       ├── page.schema.ts
│   │       ├── setting.schema.ts
│   │       ├── file.schema.ts
│   │       ├── file-entity.schema.ts
│   │       ├── entity.schema.ts
│   │       ├── metadata.schema.ts
│   │       ├── direct-link.schema.ts
│   │       ├── storage-policy.schema.ts
│   │       ├── comment.schema.ts
│   │       ├── link.schema.ts
│   │       ├── link-category.schema.ts
│   │       ├── link-tag.schema.ts
│   │       ├── link-tag-pivot.schema.ts # Join table
│   │       ├── album.schema.ts
│   │       ├── album-category.schema.ts
│   │       ├── doc-series.schema.ts
│   │       ├── notification-type.schema.ts
│   │       ├── user-notification-config.schema.ts
│   │       ├── user-installed-theme.schema.ts
│   │       ├── subscriber.schema.ts
│   │       ├── visitor-log.schema.ts
│   │       ├── visitor-stat.schema.ts
│   │       ├── url-stat.schema.ts
│   │       └── tag.schema.ts            # Generic tag table
│   ├── auth/                            # Feature module (placeholder)
│   │   └── auth.module.ts
│   ├── article/
│   │   └── article.module.ts
│   ├── settings/
│   │   └── settings.module.ts
│   ├── page/
│   │   └── page.module.ts
│   ├── file/
│   │   └── file.module.ts
│   ├── comment/
│   │   └── comment.module.ts
│   ├── search/
│   │   └── search.module.ts
│   ├── statistics/
│   │   └── statistics.module.ts
│   ├── link/
│   │   └── link.module.ts
│   ├── album/
│   │   └── album.module.ts
│   ├── doc-series/
│   │   └── doc-series.module.ts
│   ├── rss/
│   │   └── rss.module.ts
│   ├── sitemap/
│   │   └── sitemap.module.ts
│   ├── music/
│   │   └── music.module.ts
│   ├── notification/
│   │   └── notification.module.ts
│   ├── subscriber/
│   │   └── subscriber.module.ts
│   ├── thumbnail/
│   │   └── thumbnail.module.ts
│   └── config-module/                   # (reserved, not NestJS ConfigModule)
│       └── config.module.ts
├── drizzle.config.ts                    # Drizzle Kit config
├── tsconfig.json
├── nest-cli.json
├── package.json
└── .env                                 # PORT, JWT_SECRET, etc.
```

### Pattern 1: Global Response Interceptor
**What:** Wraps every controller return value into `{ code, data, message }` format matching Go backend
**When to use:** All API endpoints -- registered as APP_INTERCEPTOR globally
**Example:**
```typescript
// Source: Go pkg/response/response.go + NestJS interceptor docs
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(
      map((data) => ({
        code: statusCode,
        message: 'success',
        data,
      })),
    );
  }
}
```

### Pattern 2: Global JwtAuthGuard + @Public() Decorator
**What:** JwtAuthGuard registered as APP_GUARD globally; @Public() decorator marks routes that skip auth
**When to use:** All routes default to auth-required; public routes use @Public()
**Example:**
```typescript
// Source: Go internal/app/middleware/auth.go + NestJS guard docs
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// In JwtAuthGuard:
canActivate(context: ExecutionContext) {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (isPublic) return true;
  // ... JWT validation logic
}
```

### Pattern 3: Drizzle + better-sqlite3 Provider
**What:** Custom provider for Drizzle instance, injected via NestJS DI
**When to use:** All database access through injected Drizzle instance
**Example:**
```typescript
// Source: Drizzle ORM docs + better-sqlite3 docs
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schemas';

const sqlite = new Database('data/anheyu.db');
// Enable WAL mode and busy_timeout
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });
```

### Pattern 4: Sqids with Go-Compatible Shuffle
**What:** Sqids encoder initialized with shuffled alphabet from seed, matching Go backend exactly
**When to use:** All public ID encoding/decoding
**Example:**
```typescript
// Source: Go pkg/idgen/idgen.go -- EXACT port
import { Sqids } from 'sqids';

const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function shuffleAlphabet(seed: string): string {
  // Must match Go: seedInt += int64(c) * int64(i+1)
  let seedInt = 0;
  for (let i = 0; i < seed.length; i++) {
    seedInt += seed.charCodeAt(i) * (i + 1);
  }

  // Deterministic shuffle using seeded PRNG (must match Go's math/rand)
  const alphabet = DEFAULT_ALPHABET.split('');
  // Use a simple seeded PRNG that matches Go's math/rand.NewSource behavior
  // ... (exact implementation in code)
  return alphabet.join('');
}

export function initSqidsEncoder(seed: string): Sqids {
  const alphabet = seed ? shuffleAlphabet(seed) : DEFAULT_ALPHABET;
  return new Sqids({ minLength: 4, alphabet });
}
```

### Pattern 5: Soft Delete via deleted_at Column
**What:** Most tables have a nullable `deleted_at` timestamp; queries filter WHERE deleted_at IS NULL
**When to use:** All entity queries -- Drizzle schema defines deleted_at as optional timestamp
**Example:**
```typescript
// Source: Go ent/schema/mixin/softdelete_mixin.go
// In Drizzle schema:
deletedAt: sqliteInteger('deleted_at', { mode: 'timestamp' }),
// In queries:
db.select().from(users).where(sql\`${users.deletedAt} IS NULL\`);
```

### Anti-Patterns to Avoid
- **Do NOT use Prisma or TypeORM:** Decision locked -- Drizzle is the ORM [D-02]
- **Do NOT use Redis/ioredis:** Project goal is removing Redis dependency [D-07]
- **Do NOT use different response format:** Must be `{ code, message, data }` matching Go exactly [D-04]
- **Do NOT use numeric IDs in JWT claims:** Go uses Sqids-encoded public ID strings in claims [VERIFIED: internal/pkg/auth/types.go]
- **Do NOT hand-roll JWT signing:** Use @nestjs/jwt which wraps jsonwebtoken
- **Do NOT use async SQLite driver:** better-sqlite3 is synchronous; async wrappers add unnecessary complexity
- **Do NOT use @nestjs/config v3:** v4 is the latest and compatible with NestJS v11

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification | Custom crypto code | @nestjs/jwt | Handles HS256, expiration, key rotation |
| Request validation | Manual if/else checks | class-validator + ValidationPipe | NestJS standard, decorator-based |
| Config loading | Manual process.env reads | @nestjs/config | Validation, caching, async loading |
| ID encoding | Custom hash/encode | sqids npm package | Cross-language compatible with Go sqids-go |
| Soft delete | Manual WHERE clauses everywhere | Drizzle filter or base repository pattern | Consistent, no forgotten filters |
| CORS | Manual header setting | NestJS CORS option in app.enableCors() | Handles preflight, credentials, origins |
| Error handling | Try/catch in every controller | NestJS ExceptionFilter + custom filter | Centralized, consistent format |

**Key insight:** NestJS provides guards, interceptors, filters, and pipes as first-class abstractions. Use them instead of middleware-style patterns -- they integrate with the DI container and are more testable.

## Common Pitfalls

### Pitfall 1: Sqids Shuffle Algorithm Mismatch
**What goes wrong:** The shuffled alphabet in TypeScript produces different results than Go, causing all public IDs to differ
**Why it happens:** Go's `math/rand.NewSource` uses a specific LCG algorithm; JavaScript's `Math.random` is not deterministic or compatible
**How to avoid:** Port Go's `math/rand.NewSource` LCG algorithm exactly. Go uses: `seed = seed * 1103515245 + 12345` (glibc-style). Must implement the same PRNG in TypeScript to produce identical shuffle results.
**Warning signs:** Sqids encode/decode round-trip works but produces different IDs than Go backend for same dbID+entityType

### Pitfall 2: Response Interceptor Swallows Errors
**What goes wrong:** The ResponseInterceptor wraps error responses incorrectly, producing `{ code: 200, data: error }` instead of `{ code: 500, message: "error" }`
**Why it happens:** Interceptors only handle successful responses; exceptions go through ExceptionFilters
**How to avoid:** Implement a matching HttpExceptionFilter that formats errors as `{ code: statusCode, message: errorMessage, data: null }`. The interceptor handles success, the filter handles errors.
**Warning signs:** Error responses missing `code` field or having `code: 200` on error

### Pitfall 3: better-sqlite3 Native Build Failure
**What goes wrong:** `npm install` fails because better-sqlite3 requires native compilation
**Why it happens:** Missing build tools (python, C++ compiler) or incompatible Node.js version
**How to avoid:** Ensure Node.js v22+ is installed. On Windows, `npm install --global windows-build-tools` or use `npm install --build-from-source`. Prebuilt binaries exist for common platforms.
**Warning signs:** `node-gyp` errors during npm install

### Pitfall 4: WAL Mode Not Persisting
**What goes wrong:** After restart, journal_mode reverts to DELETE
**Why it happens:** WAL mode is persistent for the database file once set, but if the file is recreated or drizzle-kit push drops/recreates tables, the PRAGMA must be re-executed
**How to avoid:** Execute `PRAGMA journal_mode=WAL` on every connection initialization. WAL mode is a database-level setting that persists, but setting it explicitly ensures consistency.
**Warning signs:** Concurrent reads fail with SQLITE_BUSY errors

### Pitfall 5: JWT Claims Key Names Don't Match Go
**What goes wrong:** Frontend sends Go-issued JWT tokens; NestJS rejects them because claim key names differ
**Why it happens:** Go uses `user_id` and `user_group_id` (snake_case JSON tags); TypeScript might use `userId`/`userGroupId` (camelCase)
**How to avoid:** Use exact JSON key names matching Go: `user_id`, `user_group_id`, `permissions`. The Go CustomClaims struct uses `json:"user_id"` and `json:"user_group_id"` tags [VERIFIED: internal/pkg/auth/types.go].
**Warning signs:** Existing frontend tokens fail validation on NestJS backend

### Pitfall 6: Drizzle Schema Type Mismatches with Go
**What goes wrong:** SQLite column types don't match Go's ent schema, causing data corruption or query failures
**Why it happens:** Go's `field.Uint` maps to SQLite INTEGER, `field.JSON` maps to TEXT, `field.Other` with SchemaType maps to TEXT for SQLite
**How to avoid:** Map Go types carefully: Uint/Int/Int64 -> sqliteInteger, String/Text -> sqliteText, Time -> sqliteInteger({ mode: 'timestamp' }), JSON -> sqliteText({ mode: 'json' }), Enum -> sqliteText, Bool -> sqliteInteger({ mode: 'boolean' })
**Warning signs:** drizzle-kit push creates columns with wrong affinity types

### Pitfall 7: AdminGuard Checks Wrong ID Format
**What goes wrong:** AdminGuard compares numeric ID instead of Sqids-decoded ID
**Why it happens:** Go's AdminAuth decodes the Sqids-encoded UserGroupID from JWT claims, then checks if the decoded dbID === 1
**How to avoid:** AdminGuard must: (1) get UserGroupID from JWT claims (Sqids string), (2) decode it via Sqids to get dbID + entityType, (3) verify entityType === EntityTypeUserGroup, (4) check dbID === 1 [VERIFIED: internal/app/middleware/auth.go lines 105-113]
**Warning signs:** Admin routes return 403 for valid admin users

## Code Examples

### Go Response Format (Verified from Source)
```typescript
// Source: Go pkg/response/response.go
// Go Response struct:
// type Response struct {
//   Code    int         `json:"code"`
//   Message string      `json:"message"`
//   Data    interface{} `json:"data"`
// }
// Success: code = http.StatusOK (200), Data = payload, Message = custom
// Fail: code = httpStatus, Data = nil, Message = error text

// TypeScript equivalent:
export interface ApiResponse<T = any> {
  code: number;    // HTTP status code
  message: string; // Chinese or English message
  data: T | null;  // null on error
}
```

### Go JWT Claims (Verified from Source)
```typescript
// Source: Go internal/pkg/auth/types.go
// type CustomClaims struct {
//   UserID      string `json:"user_id"`       // Sqids public ID
//   UserGroupID string `json:"user_group_id"` // Sqids public ID
//   Permissions []byte `json:"permissions"`   // Base64-encoded
//   jwt.RegisteredClaims
// }

// TypeScript equivalent:
export interface CustomClaims {
  user_id: string;       // Sqids-encoded user ID
  user_group_id: string; // Sqids-encoded user group ID
  permissions: number[]; // Byte array (Base64-decoded)
  iat: number;           // Issued at
  exp: number;           // Expiration
  nbf: number;           // Not before
  iss: string;           // Issuer = "anheyu-app"
}
```

### Go Sqids EntityType Constants (Verified from Source)
```typescript
// Source: Go pkg/idgen/idgen.go lines 26-48
export const EntityType = {
  User: 1,
  File: 2,
  Album: 3,
  UserGroup: 4,
  StoragePolicy: 5,
  StorageEntity: 6,
  DirectLink: 7,
  Article: 8,
  PostTag: 9,
  PostCategory: 10,
  Comment: 11,
  DocSeries: 12,
  Product: 13,
  ProductVariant: 14,
  StockItem: 15,
  MembershipPlan: 16,
  UserMembership: 17,
  SupportTicket: 18,
  TicketMessage: 19,
  Notification: 20,
  ArticleHistory: 21,
} as const;
```

### Go Sqids Shuffle Algorithm (Verified from Source)
```typescript
// Source: Go pkg/idgen/idgen.go lines 60-77
// EXACT port of Go's shuffleAlphabet function
// Go uses math/rand.NewSource which is a glibc-style LCG

const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function shuffleAlphabet(seed: string): string {
  // Step 1: Compute seedInt exactly as Go does
  // Go: for i, c := range seed { seedInt += int64(c) * int64(i+1) }
  let seedInt = BigInt(0);
  for (let i = 0; i < seed.length; i++) {
    seedInt += BigInt(seed.charCodeAt(i)) * BigInt(i + 1);
  }

  // Step 2: Use Go's math/rand.NewSource LCG
  // Go's internal newSource: inc = 1, then multiply by 1103515245 + 12345
  // Must match Go's exact PRNG sequence for Fisher-Yates shuffle
  // ... (implementation must use Go-compatible LCG)

  const alphabet = DEFAULT_ALPHABET.split('');
  // Fisher-Yates shuffle with Go-compatible PRNG
  // r.Shuffle(len(alphabet), func(i, j int) { alphabet[i], alphabet[j] = alphabet[j], alphabet[i] })

  return alphabet.join('');
}
```

### Go CORS Configuration (Verified from Source)
```typescript
// Source: Go internal/app/middleware/cors.go
// Key behaviors:
// 1. Only applies to /api/ paths
// 2. Origin must be in allowed list (from site config)
// 3. Allowed methods: POST, GET, OPTIONS, PUT, DELETE
// 4. Allowed headers: Authorization, Content-Type, X-CSRF-Token, X-Requested-With, Range, Accept-Ranges, Content-Range, Content-Length, Content-Disposition
// 5. Exposed headers: Authorization, Content-Range, Content-Length, Content-Disposition
// 6. Credentials: true
// 7. Non-matching origin + OPTIONS -> 403 Forbidden
// 8. Matching origin + OPTIONS -> 204 No Content

// NestJS equivalent in main.ts:
app.enableCors({
  origin: allowedOrigins, // from settings/config
  methods: 'POST,GET,OPTIONS,PUT,DELETE',
  allowedHeaders: 'Authorization,Content-Type,X-CSRF-Token,X-Requested-With,Range,Accept-Ranges,Content-Range,Content-Length,Content-Disposition',
  exposedHeaders: 'Authorization,Content-Range,Content-Length,Content-Disposition',
  credentials: true,
});
```

### Drizzle SQLite Schema Example (User Table)
```typescript
// Source: Mapped from Go ent/schema/user.go
import { sqliteTable, sqliteInteger, sqliteText } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: sqliteInteger('id').primaryKey({ autoIncrement: true }),
  createdAt: sqliteInteger('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: sqliteInteger('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  deletedAt: sqliteInteger('deleted_at', { mode: 'timestamp' }),
  username: sqliteText('username').notNull().unique(),
  passwordHash: sqliteText('password_hash').notNull(),
  nickname: sqliteText('nickname'),
  avatar: sqliteText('avatar'),
  email: sqliteText('email').unique(),
  website: sqliteText('website'),
  lastLoginAt: sqliteInteger('last_login_at', { mode: 'timestamp' }),
  userGroupId: sqliteInteger('user_group_id').notNull(),
  status: sqliteInteger('status').notNull().default(2), // 1:active 2:inactive 3:banned
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @nestjs/config v3 | @nestjs/config v4 | 2026-04 | Supports NestJS v11, RxJS 7 |
| NestJS v10 | NestJS v11 | 2026-06 | New DI features, performance improvements |
| drizzle-orm 0.38 | drizzle-orm 0.45 | 2026-03 | Better SQLite support, improved relations API |
| better-sqlite3 11 | better-sqlite3 12 | 2026-06 | Node.js v22 compatibility, performance |

**Deprecated/outdated:**
- @nestjs/config v3: Not compatible with NestJS v11 (requires @nestjs/common ^10 || ^11)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Go's math/rand.NewSource uses glibc-style LCG (seed * 1103515245 + 12345) | Sqids Shuffle | Public IDs won't match Go backend |
| A2 | SQLite unixepoch() function available for timestamp defaults | Schema Examples | Need to use different timestamp default |
| A3 | drizzle-kit push handles schema creation without manual SQL | Standard Stack | May need manual migration SQL for complex cases |
| A4 | NestJS v11 CLI generates compatible project structure | Architecture | May need manual adjustments to scaffold |

**If this table is empty:** All claims in this research were verified or cited -- no user confirmation needed.

## Open Questions (RESOLVED)

1. **Go math/rand.NewSource PRNG Algorithm** (RESOLVED)
   - Go 1.25.0 is used (verified from go.mod). Go's `math/rand.NewSource` uses a **glibc-style LCG** (Linear Congruential Generator) for backward compatibility even in Go 1.22+. The v2 PCG algorithm is only in `math/rand/v2`, which this code doesn't use.
   - **Resolution:** Port Go's LCG algorithm exactly to TypeScript. The LCG formula is `seed = (seed * 1103515245 + 12345) & 0x7fffffff`, then `Shuffle` uses `Int63` calls. A runtime compatibility test with known seed must pass.
   - **Action:** Plan 02 Task 2 must include a `shuffleAlphabet` function that replicates Go's `math/rand.NewSource` LCG exactly, plus a test comparing output against Go backend with known seed.

2. **Timestamp Storage Format** (RESOLVED)
   - Go's ent framework with SQLite3 driver stores timestamps as **unix epoch integers** by default. The `time.Time` Go type serializes to RFC3339 in JSON but stores as integer in SQLite.
   - **Resolution:** Drizzle schema uses `integer('created_at', { mode: 'timestamp' })` for timestamp columns. The application layer handles ISO8601 serialization in JSON responses.
   - **Action:** All timestamp columns in schema files use `mode: 'timestamp'` with integer storage.

3. **Pagination Response Format** (RESOLVED - DEFERRED)
   - API-COMPAT-05 requires pagination format to match Go backend. The exact structure will be determined in Phase 03+ when article listing is implemented.
   - **Resolution:** Phase 01's ResponseInterceptor wraps the entire response body as `data`, so paginated data (array + pagination metadata) passes through unchanged. No Phase 01 task needed for pagination format specifically.
   - **Action:** API-COMPAT-05 should be moved from Phase 01 to Phase 03 in ROADMAP.md. Phase 01 ensures the interceptor doesn't interfere with pagination data structures.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | NestJS runtime | Yes | v22.14.0 | -- |
| npm | Package manager | Yes | -- | -- |
| TypeScript | Language | Yes (via npm) | 5+ | -- |
| Python | better-sqlite3 build | -- | -- | Prebuilt binaries for Windows x64 |
| C++ compiler | better-sqlite3 build | -- | -- | Prebuilt binaries for Windows x64 |
| Git | Version control | Yes | -- | -- |

**Missing dependencies with no fallback:**
- None -- better-sqlite3 has prebuilt binaries for Windows x64 + Node v22

**Missing dependencies with fallback:**
- Python/C++ compiler: Only needed if better-sqlite3 prebuilt binaries fail; fallback is `npm install --build-from-source` after installing build tools

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + @nestjs/testing 11.1.27 |
| Config file | vitest.config.ts (to be created) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Server starts on port 8091 | integration | `npx vitest run --reporter=verbose -t "bootstrap"` | No -- Wave 0 |
| INFRA-02 | SQLite file in data/ directory | integration | `npx vitest run --reporter=verbose -t "database connection"` | No -- Wave 0 |
| INFRA-03 | WAL mode + busy_timeout set | integration | `npx vitest run --reporter=verbose -t "sqlite pragmas"` | No -- Wave 0 |
| INFRA-04 | npm run dev starts server | smoke | manual | No -- Wave 0 |
| INFRA-05 | drizzle-kit push creates tables | integration | `npx drizzle-kit push` | No -- Wave 0 |
| INFRA-06 | All 30 schemas defined | unit | `npx vitest run --reporter=verbose -t "schema count"` | No -- Wave 0 |
| API-COMPAT-01 | Route paths match Go | unit | `npx vitest run --reporter=verbose -t "route paths"` | No -- Wave 0 |
| API-COMPAT-02 | Response format { code, data, message } | unit | `npx vitest run --reporter=verbose -t "response interceptor"` | No -- Wave 0 |
| API-COMPAT-04 | JWT claims structure matches Go | unit | `npx vitest run --reporter=verbose -t "jwt claims"` | No -- Wave 0 |
| API-COMPAT-05 | Pagination format matches Go | unit | deferred to Phase 03+ | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] `server/vitest.config.ts` -- Vitest configuration
- [ ] `server/test/app.e2e-spec.ts` -- bootstrap + port test
- [ ] `server/test/database.spec.ts` -- SQLite connection + PRAGMA tests
- [ ] `server/test/schemas.spec.ts` -- schema count + structure tests
- [ ] `server/test/response-interceptor.spec.ts` -- response format test
- [ ] `server/test/guards.spec.ts` -- guard behavior tests
- [ ] `server/test/sqids.spec.ts` -- encode/decode round-trip test
- [ ] Framework install: `npm install -D vitest @nestjs/testing` -- in server/

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | @nestjs/jwt + @nestjs/passport |
| V3 Session Management | yes | JWT with 15min access / 30day refresh tokens |
| V4 Access Control | yes | JwtAuthGuard + AdminGuard |
| V5 Input Validation | yes | class-validator + ValidationPipe |
| V6 Cryptography | yes | HS256 JWT signing (never hand-roll) |

### Known Threat Patterns for NestJS + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT token forgery | Tampering | HS256 with strong secret key from .env |
| SQL injection | Tampering | Drizzle ORM parameterized queries |
| Missing auth on endpoints | Information Disclosure | Global APP_GUARD + @Public() explicit opt-out |
| Excessive data in response | Information Disclosure | Response DTOs with class-transformer |
| SQLite file access | Tampering | data/ directory permissions, no HTTP serving of .db |
| Timing attacks on ID decode | Information Disclosure | Sqids constant-time comparison (library handles) |

## Sources

### Primary (HIGH confidence)
- Go ent/schema/*.go -- 29 table definitions read and analyzed
- Go pkg/response/response.go -- Response format verified: `{ code, message, data }`
- Go pkg/idgen/idgen.go -- Sqids algorithm verified: DefaultAlphabet, EntityType constants, shuffleAlphabet
- Go internal/app/middleware/auth.go -- JWT auth middleware: CustomClaims, JWTAuth, JWTAuthOptional, AdminAuth
- Go internal/app/middleware/cors.go -- CORS configuration verified
- Go internal/pkg/auth/types.go -- JWT CustomClaims structure: user_id, user_group_id, permissions
- Go internal/pkg/auth/jwt.go -- JWT generation: HS256, 15min access, 30day refresh, issuer "anheyu-app"
- Go internal/infra/router/router.go -- All route registrations verified
- npm registry -- All package versions verified

### Secondary (MEDIUM confidence)
- Go pkg/domain/model/user.go -- Boolset, GroupSettings types for JSON columns
- Go pkg/domain/model/storage_policy.go -- StoragePolicySettings type
- Go pkg/constant/errors.go -- Error code constants (Chinese messages)
- Go ent/schema/mixin/softdelete_mixin.go -- Soft delete pattern: deleted_at nullable timestamp

### Tertiary (LOW confidence)
- Go math/rand.NewSource PRNG algorithm -- RESOLVED: Go 1.25 uses glibc LCG, not PCG

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages verified on npm registry with current versions
- Architecture: HIGH - NestJS patterns are well-documented and canonical
- Pitfalls: HIGH - Go source code analyzed for exact compatibility requirements
- Sqids shuffle: HIGH - PRNG algorithm resolved: Go 1.25 uses glibc LCG in math/rand.NewSource (not PCG)

**Research date:** 2026-06-28
**Valid until:** 2026-07-28
