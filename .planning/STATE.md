---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 07
current_phase_name: Statistics & Links
current_plan: Not started
status: executing
stopped_at: Plan 06-05 complete
last_updated: "2026-07-10T12:46:08.892Z"
last_activity: 2026-07-10
progress:
  total_phases: 11
  completed_phases: 6
  total_plans: 29
  completed_plans: 30
  percent: 55
---

# STATE: anheyu-app NestJS + SQLite Backend

## Current Position

| Field | Value |
|-------|-------|
| Milestone | M2 - Full Feature Parity |
| Phase | 07 — Statistics & Links |
| Current Plan | Not started |
| Status | Executing Phase 06 |
| Last Activity | 2026-07-10 |

## Phase Status

| Phase | Name | Status | Plans | Last Updated |
|-------|------|--------|-------|--------------|
| 01 | Infrastructure | Complete | 5 | 2026-06-28 |
| 02 | Auth & Settings | Complete | 5 | 2026-06-29 |
| 03 | Article & Category & Tag | Complete | 5 | 2026-07-03 |
| 04 | Page & Public API | Complete | 4 | 2026-07-04 |
| 05 | File Upload & Media | Complete | 5 | 2026-07-05 |
| 06 | Comment & Search | Executing | 5 | 2026-07-10 |
| 07 | Statistics & Links | Not Started | 0 | 2026-06-28 |
| 08 | Album & Doc Series | Not Started | 0 | 2026-06-28 |
| 09 | SEO & Music & Notifications | Not Started | 0 | 2026-06-28 |
| 10 | Scheduled Tasks | Not Started | 0 | 2026-06-28 |
| 11 | Migration & Integration | Not Started | 0 | 2026-06-28 |

## Active Decisions

| ID | Decision | Rationale | Phase |
|----|----------|-----------|-------|
| D-01 | NestJS v11 framework | Structured, decorator-based, closest to Go handler/service/repo layers | 01 |
| D-02 | Drizzle ORM + better-sqlite3 | Lightweight, type-safe, best SQLite pairing | 01 |
| D-03 | SQLite WAL + busy_timeout=5000 | Concurrent reads, serialized writes with timeout | 01 |
| D-04 | Global response interceptor `{ code, data, message }` | Must match Go backend response format exactly | 01 |
| D-05 | Sqids with Go-compatible seed | Public ID encoding must be identical to Go backend | 01 |
| D-06 | JWT HS256 with Go-compatible payload | Token structure must accept existing Go-issued tokens | 02 |
| D-07 | In-memory cache (Map + TTL) instead of Redis | Single-user blog does not need Redis overhead | 01 |
| D-08 | Port 8091 | Matches Go backend, frontend next.config.ts needs no change | 01 |
| D-09 | Feature module organization | article/ auth/ etc with module+controller+service+repository | 01 |
| D-10 | NestJS backend in server/ directory | Go code preserved during dev, deleted after Phase 11 | 01 |
| D-11 | One-table-one-file schemas in database/schemas/ | Aligned with Go ent/schema/ structure | 01 |
| D-12 | 3 separate Guards (JwtAuth/JwtAuthOptional/Admin) | Matches Go JWTAuth/JWTAuthOptional/AdminAuth pattern | 01 |
| D-13 | Global JwtAuthGuard + @Public() decorator | Public routes skip auth, matches Go global middleware | 01 |
| D-14 | Error codes constant file with Chinese messages | Frontend depends on Chinese error message text | 01 |
| D-15 | Sqids init from DB settings table id_seed | Same as Go backend, shuffled alphabet | 01 |
| D-16 | @nestjs/config + NestJS built-in Logger | Official NestJS solutions, no extra dependencies | 01 |
| D-17 | GoRNGSource replicates Go's math/rand lagged fibonacci PRNG | rngLen=607, rngTap=273 for exact Sqids shuffle compatibility | 01 |
| D-18 | CommonModule provides but does NOT globally register guards/interceptors | APP_GUARD/APP_INTERCEPTOR wiring deferred to app.module.ts | 01 |
| D-19 | Drizzle v0.45 uses integer/text (not sqliteInteger/sqliteText) | API changed in v0.45; lowercase function names are correct exports | 01 |
| D-20 | uniqueIndex() replaces index().unique() in Drizzle v0.45 | IndexBuilder.unique() removed; uniqueIndex() is the correct API | 01 |
| D-21 | PRAGMA foreign_keys=ON added alongside WAL and busy_timeout | Go backend expects referential integrity, SQLite defaults to off | 01 |
| D-22 | ES module imports for FK references in schema files | Matches Plan 03 pattern (user.schema.ts); require() is CJS syntax | 01 |
| D-23 | real() column type for Go field.Float in url_stat avgDuration | Drizzle v0.45 exports real() for SQLite REAL column type | 01 |
| D-24 | linkTagPivot explicit join table for Link-LinkTag many-to-many | Implied by Go edge.StorageKey(edge.Table("link_tag_pivot")) | 01 |
| D-25 | JwtStrategy + JwtModule created in Phase 01 for APP_GUARD wiring | Without registered strategy, AuthGuard('jwt') throws | 01 |
| D-26 | drizzle.config.ts uses schema path string, not import object | drizzle-kit v0.31 Zod validation rejects imported schema objects | 01 |
| D-27 | passport-jwt@4.0.1 required as runtime dependency for JwtStrategy | PassportStrategy(Strategy) from passport-jwt needed | 01 |
| D-30 | JWT_SECRET from settings table dynamically read | Same as Go backend SettingService.Get("JWT_SECRET") | 02 |
| D-31 | Access token 15min, refresh token 30d (hardcoded) | Matches Go backend time.Minute*15 and time.Hour*24*30 | 02 |
| D-38 | Settings key-value + in-memory cache (Map) | Loaded at startup, refreshed on update | 02 |
| D-39 | Public/private key distinction via hardcoded list | Matches Go IsPublicSetting() | 02 |
| D-44 | Avatar upload now functional | StoragePolicyService + ThumbnailService available after Phase 05 | 05 |
| D-94 | Upload sessions in memory Map with 60s cleanup, 24h TTL | Matches Go backend session lifecycle pattern | 05 |
| D-95 | Chunk temp files in data/uploads/tmp/{sessionId}/ | Cleaned up on session completion and startup | 05 |
| D-96 | Auto-merge triggers on last chunk (uploadedChunks.size === totalChunks) | Matches Go backend auto-merge behavior | 05 |
| D-99 | Only type='local' allowed for storage policies; cloud types return 400 | Cloud storage deferred to future release | 05 |
| D-100 | Policy max_size=0 means unlimited | Matches Go backend behavior | 05 |
| D-101 | Flag uniqueness among non-deleted policies; 3 allowed flags | article_image, comment_image, user_avatar | 05 |
| D-103 | Post-upload thumbnail generation via forwardRef | Circular dependency FileModule <-> ThumbnailModule | 05 |
| D-104 | WebP thumbnails at max 400x400 using sharp | Matches Go backend thumbnail dimensions | 05 |
| D-105 | HMAC-SHA256 signing with 15-min expiry for thumbnails | Prevents unauthorized thumbnail access | 05 |
| D-106 | Thumbnail failure does not block file upload | Matches Go backend error handling | 05 |
| D-107 | Direct links use EntityType.DirectLink=7 | NOT EntityType.File — critical for correct ID decoding | 05 |
| D-108 | Short-link download with Content-Disposition header | Matches Go backend download behavior | 05 |
| D-112 | File download via createReadStream for streaming | Efficient memory usage for large files | 05 |
| D-113 | ArticleController.uploadImage with FileInterceptor | Replaced Phase 03 501 stub | 05 |
| D-114 | ServeStaticModule for data/uploads at /uploads | Provides direct URL access for article images | 05 |
| D-143 | GeoIPService injected from WeatherModule into CommentService | Replaces @Optional() HTTP fallback per D-143 | 06 |
| D-151 | FTS5 index hooks in ArticleService CRUD (try-catch) | Index failure never blocks article operations | 06 |

## Blockers

(None)

## Key Learnings

- SQLite write concurrency requires WAL mode + busy_timeout; serialize writes at app layer for safety
- ID encoding seed is stored in database settings table as `id_seed`, generated once at first install
- Go JWT payload uses `UserID` and `UserGroupID` as public ID strings, not database integers
- Frontend expects exact Chinese error messages from Go backend; error message mapping is required
- Chunked upload uses session-based flow: create session, upload chunks by index, finalize assembly
- Circular dependency between FileModule and ThumbnailModule resolved via forwardRef()
- Upload sessions must be stored in-memory (Map) — not in DB — for performance per D-94
- Sharp import must use `import sharp from 'sharp'` (default export), not namespace import
- Direct link publicIDs must use EntityType.DirectLink=7, NOT EntityType.File=2 (critical pitfall)

## Metrics

| Metric | Value |
|--------|-------|
| Phases Completed | 5 / 11 |
| Plans Created | 24 |
| Plans Executed | 29 |
| Requirements Covered | 30 / 39 |
| API Endpoints Implemented | 47 / ~60+ |

---
*Last updated: 2026-07-10*

## Session

**Last session:** 2026-07-10T12:22:46Z
**Stopped at:** Plan 06-05 complete
**Resume file:** .planning/phases/06-comment-search/06-05-SUMMARY.md
