---
gsd_state_version: 1.0
milestone: M5
milestone_name: AI Features
current_phase: 16
current_plan: 02
status: executing
stopped_at: Completed 16-02-SUMMARY.md
last_updated: "2026-07-27T12:55:00Z"
last_activity: 2026-07-27
last_activity_desc: Phase 16 Plan 02 executed — Frontend AI settings multi-profile upgrade
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 24
  completed_plans: 15
  percent: 25
current_phase_name: null
---

# STATE: anheyu-app NestJS + SQLite Backend

## Current Position

| Field | Value |
|-------|-------|
| Milestone | M5 - AI Features |
| Phase | 16 - AI Model Router & Summary Migration |
| Current Plan | 03/03 complete (pending human verify) |
| Status | Executing — All 3 plans done + quality fixes, awaiting human UAT |
| Last Activity | 2026-07-27 — Plan 02: Frontend AI settings multi-profile upgrade |

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
| 11 | Migration & Integration | Complete | 5 | 2026-07-18 |
| 12 | API Inventory & Auth & Settings Verification | Complete | 4/5 | 2026-07-19 |
| 13 | Content Verification | Complete | 6/6 | 2026-07-20 |
| 14 | Features Verification | Complete | 7/7 | 2026-07-22 |
| 15 | Final Integration & Cutover | Complete | 3/3 | 2026-07-23 |
| 16 | AI Model Router & Summary Migration | Executing | 3/3 (pending human verify) | 2026-07-27 |

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
| D-260 | Three-layer verification: frontend API scan + Go code diff + browser walkthrough | Cannot start Go backend (no PostgreSQL/Redis), use Go source code as spec | 12 |
| D-261 | Verification driven by frontend actual API calls, not backend endpoint list | Frontend is the real consumer — what it calls is what matters | 12 |
| D-262 | Default settings seeded from Go definition.go on startup | Go backend writes 331 defaults on first run; NestJS must do the same | post-11 fix |
| D-263 | sql<> template does NOT apply Drizzle mode:'timestamp' conversion | Use sql<number> + manual *1000 for raw SQL aggregate queries | post-11 fix |
| D-264 | ScheduleService backfill capped at 30 days | Prevents log spam on startup after long downtime | post-11 fix |
| D-307 | Added fileHash to AlbumResponseDto — Go Album model has it but handler response omits it | Full field coverage; frontend AlbumForm type uses fileHash | 14 |
| D-308 | Added total to BatchImportResult — Go handler adds total: len(req.URLs) | Frontend BatchImportAlbumsResult type has total field | 14 |
| D-309 | widthAndHeight is known deviation — present in Go AlbumResponse handler and NestJS, not in Go Album model | Computed field matching Go handler behavior | 14 |
| D-310 | Doc-series Sqids encoding verified consistent with Go — same DB id + same seed produces same Sqids string, EntityType.DocSeries=12 matches Go iota | Field verification confirms encoding consistency | 14 |
| D-311 | Statistics date format per CCP-2: only assert valid ISO date string, not exact format (Go RFC3339 vs NestJS ISO 8601 with ms) | Both formats valid, frontend handles both | 14 |
| D-312 | Statistics weekly/monthly trend arrays are always empty per Go backend | Go GetVisitorTrend only returns daily data | 14 |
| D-340a | Custom DomainError class replaces fragile string-matching in AI error catch blocks | instanceof check is safer than error.message?.includes('文章') — LLM error messages could contain those keywords | 16 |
| D-340b | normalizePurposes + normalizeProfile in resolveProfiles handle frontend object-format purposes { summary: true } → backend array ['summary'] | Frontend AiModelsForm stores purposes as object (checkbox state), backend AiProfile expects string[]; prevents type mismatch in Phase 18/19 chat | 16 |
| D-340c | Shared AiProfile type extracted to frontend/src/lib/settings/ai-profile.ts | AiModelsForm and AiSummaryForm both need the type; duplication caused drift risk | 16 |

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
- Drizzle sql<> template bypasses mode:'timestamp' conversion — raw SQL aggregates must use sql<number> + manual conversion
- Go backend seeds 331 default settings on first startup — NestJS must replicate this or frontend gets missing config keys
- Settings update endpoint must accept flat key-value pairs (Go additionalProperties: string), not nested wrapper objects
- Frontend may not send config keys that don't exist in DB — seed defaults first, then frontend can update them

## Metrics

| Metric | Value |
|--------|-------|
| Phases Completed | 11 / 15 |
| Plans Created | 56 |
| Plans Executed | 56 |
| Requirements Covered | 33 / 39 |
| API Endpoints Implemented | 155 / 188 |
| API Compat Tests | 292 across 29 files |
| API Endpoints Risk Marked | 188 (HIGH 25, MEDIUM 72, LOW 18, NONE 69, N/A 4) |
| Known Unimplemented | config/export, config/import, proxy/download |
| Post-Phase-11 Bugs Fixed | 3 (ScheduleService log spam, settings seed, timestamp conversion) |

---
*Last updated: 2026-07-23*

## Session

**Last session:** 2026-07-27T12:55:00Z
**Stopped at:** Completed 16-02-SUMMARY.md
**Resume file:** .planning/phases/16-ai-model-router-summary-migration/16-02-SUMMARY.md

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 11 P05 | 22m | 5 tasks | 6 files |
| Phase 12 P01 | 18m | 3 tasks | 1 files |
| Phase 12 P02 | 26m | 3 tasks | 2 files |
| Phase 12 P03 | 27m | 3 tasks | 2 files |
| Phase 12 P04 | 18m | 2 tasks | 1 files |
| Phase 14 P02 | 25m | 2 tasks | 3 files |
| Phase 14 P03 | 15m | 2 tasks | 2 files |
| Phase 14 P04 | 25m | 2 tasks | 5 files |
| Phase 14 P05 | 11m | 2 tasks | 3 files |
| Phase 14 P06 | 11m | 2 tasks | 1 files |
| Phase 14 P07 | 24m | 2 tasks | 2 files |
| Phase 15 P01 | 11m | 3 tasks | 4 files |
| Phase 16 P01 | 16m | 2 tasks | 10 files |
| Phase 16 P02 | 63m | 2 tasks | 6 files |

## Decisions

- [Phase 07]: D-181: IUAParser removed from ua-parser.ts — ua-parser-js v2 no longer exports this type
- [Phase 07]: D-182: LinkCategoryResponseDto.links added as optional array for grouped public link list per D-178
- [Phase 09]: D-210: Node.js https with rejectUnauthorized:false for metings.qjqq.cn SSL bypass (matches Go InsecureSkipVerify)
- [Phase 09]: D-211: Playlist cached 5 minutes in MemoryCache (key: music:playlist, TTL: 300000ms); song resources NOT cached
- [Phase 10]: D-237: ScheduledPublishJob uses ArticleService instead of ArticleRepository (repo not exported from ArticleModule)
- [Phase 10]: D-238: CommentNotificationJob only sends email for reply comments (parentId exists), matching Go logic
- [Phase 10]: D-239: BackupService uses local time for filename timestamps (matches Go time.Now().Format)
- [Phase 10]: D-240: ScheduleModule is @Global() so ScheduleService can be injected anywhere without explicit module import
- [Phase 11]: D-241: REVISED — Go and NestJS have 5 schema mismatches requiring migration mapping: metadata→metadatas table name, links.link_category_links→category_id column, comments.article_comments exclusion, link_tag_pivot extra columns (id, created_at), links missing timestamps
- [Phase 11]: D-242: Notifications table is NestJS-only, skipped during Go→NestJS migration
- [Phase 11]: D-243: better-sqlite3 resolved via direct require path from server/node_modules for scripts/ directory
- [Phase 11]: D-244: REVISED — POST endpoints now return code:200 via @HttpCode(HttpStatus.OK), matching Go backend. Only 5 endpoints return 201 (link create, link category/tag create, link import, album category create)
- [Phase 11]: D-245: Page service create() defaults isPublished to true (matching Go backend and schema default), markdownContent/customJs/customCss to empty string (not null) to match NOT NULL schema
- [Phase 11]: D-246: Global prefix exclude for RSS/sitemap/robots.txt routes added to test helpers (matching main.ts)
- [Phase 11]: D-247: Notification settings DTO uses allowCommentReplyNotification (simplified, not type-based flags)
- [Phase 11]: D-248: Album stat increment for nonexistent ID succeeds silently (no 404)
- [Phase 11]: D-249: needcache/download/:public_id added to global prefix exclude (Go registers this route outside /api group)
- [Phase 11]: D-250: config/export and config/import endpoints not yet implemented in NestJS (exist in Go backend)
- [Phase 11]: D-251: proxy/download endpoint not yet implemented in NestJS (exist in Go backend)
- [Phase 11]: D-252: decodePublicID try-catch added to all 11 service files — invalid Sqids IDs return 404/400 instead of 500
- [Phase 11]: D-253: Migration tool adds TABLE_NAME_MAP, COLUMN_NAME_MAP, COLUMN_EXCLUSIONS, COLUMN_DEFAULTS for Go→NestJS schema differences
- [Phase 11]: D-254: assertSuccessResponse now verifies both HTTP status code and body code field
- [Phase 11]: D-255: seedBaseData now includes link category, link tag, storage policy, album category for more complete test data
- [Phase 11]: D-256: Go backend source archived to _go-backend-archive/ (gitignored, 578 .go files for reference)
- [Phase 11]: D-257: Codegraph indexes two projects: main project (NestJS TS) + _go-backend-archive (Go) for cross-reference
- [Post-11]: D-260: Three-layer verification: frontend API scan + Go code diff + browser walkthrough (Go backend cannot start without PostgreSQL/Redis)
- [Post-11]: D-261: Verification driven by frontend actual API calls, not backend endpoint list
- [Post-11]: D-262: Default settings seeded from Go definition.go on startup (331 entries)
- [Post-11]: D-263: sql<> template bypasses Drizzle mode:'timestamp' — use sql<number> + manual *1000
- [Post-11]: D-264: ScheduleService backfill capped at 30 days to prevent log spam
- [Phase ?]: D-274-REVISED: Auth 501 endpoints are compatibility gaps -- Go has real handlers
- [Phase ?]: D-275-CONFIRMED: Theme Mall 20 endpoints all MISSING from NestJS -- no theme controller
- [Phase ?]: D-276-CONFIRMED: config/export/import have service methods but no controller routes
- [Phase ?]: D-277-CONFIRMED: files/share/create is frontend-only -- Go router also lacks it
- [Phase ?]: Removed 57 private keys from PUBLIC_SETTING_KEYS that were incorrectly exposed
- [Phase ?]: Settings update test uses flat key-value format matching Go handler, not wrapped { settings: {...} } format
- [Phase 12]: D-278: Login response field-by-field verification matches Go LoginUserInfoResponse struct (userGroupID is number, other IDs are Sqids strings)
- [Phase 12]: D-279: ThrottlerStorage cleared between captcha behavior tests to avoid 429 rate limiting
- [Phase 12]: D-280: Test user seeding uses onConflictDoUpdate on username (not onConflictDoNothing on id) to handle existing admin user in file DB
- [Phase 12]: D-281: CCP-1 created_at/updated_at nullability is MEDIUM risk (DB likely has NOT NULL constraints, but needs verification in Phase 13)
- [Phase 12]: D-282: Album camelCase field naming may be HIGH risk if frontend depends on camelCase (Go uses camelCase, NestJS may normalize to snake_case)
- [Phase 12]: D-283: Link/LinkCategory/LinkTag ID type may be HIGH risk if frontend expects int (Go uses int, NestJS may use Sqids string)
- [Phase ?]: D-301/D-303: Link.id returns raw DB int (number), not Sqids string, matching Go LinkDTO.id: int
- [Phase ?]: D-301/D-303: BatchDeleteLinksRequestDto.ids and SortItem.id changed from string to number, matching Go []int
- [Phase 14]: D-310: Doc-series Sqids encoding verified consistent with Go (EntityType.DocSeries=12)
- [Phase 14]: D-311: Statistics date format per CCP-2 — only assert valid ISO, not exact format
- [Phase 14]: D-312: Statistics weekly/monthly trend arrays always empty per Go backend
- [Phase ?]: D-313: Storage-policy dates use toISODateString for consistency with other modules
- [Phase ?]: D-314: UserGroup.description uses null coalescing to return empty string for null DB values, matching Go string zero value
- [Phase 14]: D-316: Music playlist tests handle external API unavailability gracefully — verify either success structure or error format
- [Phase ?]: D-314 extended: PostCategory.description uses null coalescing (?? '') for Go string zero-value compatibility
- [Phase ?]: Comment export/import tests updated from stale 404 to 200 expectations matching implemented endpoints
- [Phase ?]: Auth refresh-token tests use beforeAll admin re-seed for batch isolation (onConflictDoUpdate on username)
