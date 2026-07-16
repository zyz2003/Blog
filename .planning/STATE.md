---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 10
current_phase_name: Scheduled Tasks
current_plan: 10-03 Complete
status: complete
stopped_at: Phase 11 context gathered
last_updated: "2026-07-16T13:26:45.600Z"
last_activity: 2026-07-16
progress:
  total_phases: 11
  completed_phases: 9
  total_plans: 50
  completed_plans: 50
  percent: 82
---

# STATE: anheyu-app NestJS + SQLite Backend

## Current Position

| Field | Value |
|-------|-------|
| Milestone | M3 - Production Ready |
| Phase | 10 — Scheduled Tasks |
| Current Plan | 10-03 Complete |
| Status | Complete |
| Last Activity | 2026-07-16 |

## Phase Status

| Phase | Name | Status | Plans | Last Updated |
|-------|------|--------|-------|--------------|
| 01 | Infrastructure | Complete | 5 | 2026-06-28 |
| 02 | Auth & Settings | Complete | 5 | 2026-06-29 |
| 03 | Article & Category & Tag | Complete | 5 | 2026-07-03 |
| 04 | Page & Public API | Complete | 4 | 2026-07-04 |
| 05 | File Upload & Media | Complete | 5 | 2026-07-05 |
| 06 | Comment & Search | Complete | 5 | 2026-07-10 |
| 07 | Statistics & Links | Complete | 5 | 2026-07-11 |
| 08 | Album & Doc Series | Complete | 5 | 2026-07-12 |
| 09 | SEO & Music & Notifications | Complete | 7 | 2026-07-14 |
| 10 | Scheduled Tasks | Complete | 3 | 2026-07-16 |
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
| D-160 | recordVisit fires async processing and returns immediately | Fire-and-forget via unawaited Promise, matches Go worker pool | 07 |
| D-164 | Full RecordVisit pipeline: IP extraction, dedup, UA parse, GeoIP, async DB writes | Matches Go processVisitTask async processing | 07 |
| D-168 | getBasicStatistics enriches today/yesterday from visitor_logs | Accuracy before daily aggregation runs, matches Go enrichTodayYesterdayFromVisitorLogs | 07 |
| D-169 | StatisticsController: 2 public endpoints (@Public()) + 5 admin endpoints | Matches Go public/admin route split | 07 |
| D-200 | Album FK onDelete set null matches Go backend | Go ent schema OnDelete: schema.SetNull | 08 |
| D-201 | Controllers return { data, message } for Chinese success messages | Go backend returns Chinese messages | 08 |
| D-202 | DocSeries update uses excludeDbId for name uniqueness | Previous get-and-compare had logic error | 08 |
| D-203 | aspectRatio persisted to DB on create | Was computed but not stored | 08 |
| D-204 | All Phase 08 tests use consistent Sqids seed | Prevents global singleton conflict | 08 |
| D-169 | StatisticsController: 2 public endpoints (@Public()) + 5 admin endpoints | Matches Go public/admin route split | 07 |

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
| Phases Completed | 10 / 11 |
| Plans Created | 53 |
| Plans Executed | 53 |
| Requirements Covered | 31 / 39 |
| API Endpoints Implemented | 59 / ~65+ |

---
*Last updated: 2026-07-11*

## Session

**Last session:** 2026-07-16T13:26:45.591Z
**Stopped at:** Phase 11 context gathered
**Resume file:** .planning/phases/11-migration-integration/11-CONTEXT.md

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 07 P04 | 64 | 3 tasks | 5 files |
| Phase 07 P05 | 13m | 1 tasks | 3 files |

## Decisions

- [Phase 07]: D-181: IUAParser removed from ua-parser.ts — ua-parser-js v2 no longer exports this type
- [Phase 07]: D-182: LinkCategoryResponseDto.links added as optional array for grouped public link list per D-178
- [Phase 09]: D-210: Node.js https with rejectUnauthorized:false for metings.qjqq.cn SSL bypass (matches Go InsecureSkipVerify)
- [Phase 09]: D-211: Playlist cached 5 minutes in MemoryCache (key: music:playlist, TTL: 300000ms); song resources NOT cached
- [Phase 10]: D-237: ScheduledPublishJob uses ArticleService instead of ArticleRepository (repo not exported from ArticleModule)
- [Phase 10]: D-238: CommentNotificationJob only sends email for reply comments (parentId exists), matching Go logic
- [Phase 10]: D-239: BackupService uses local time for filename timestamps (matches Go time.Now().Format)
- [Phase 10]: D-240: ScheduleModule is @Global() so ScheduleService can be injected anywhere without explicit module import
