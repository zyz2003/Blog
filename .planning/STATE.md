---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 02
current_phase_name: Auth & Settings
status: completed
stopped_at: Phase 2 context gathered
last_updated: "2026-06-29T13:26:07.953Z"
last_activity: 2026-06-29
progress:
  total_phases: 11
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 9
---

# STATE: anheyu-app NestJS + SQLite Backend

## Current Position

| Field | Value |
|-------|-------|
| Milestone | M1 - Core CMS Operational |
| Phase | 02 — Auth & Settings |
| Status | Completed plan 01-05, Phase 01 complete |
| Last Activity | 2026-06-29 |

## Phase Status

| Phase | Name | Status | Plans | Last Updated |
|-------|------|--------|-------|--------------|
| 01 | Infrastructure | Complete | 5 | 2026-06-28 |
| 02 | Auth & Settings | Not Started | 0 | 2026-06-28 |
| 03 | Article & Category & Tag | Not Started | 0 | 2026-06-28 |
| 04 | Page & Public API | Not Started | 0 | 2026-06-28 |
| 05 | File Upload & Media | Not Started | 0 | 2026-06-28 |
| 06 | Comment & Search | Not Started | 0 | 2026-06-28 |
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
| D-18 | CommonModule provides but does NOT globally register guards/interceptors | APP_GUARD/APP_INTERCEPTOR wiring deferred to app.module.ts in Plan 06 | 01 |
| D-19 | Drizzle v0.45 uses integer/text (not sqliteInteger/sqliteText) | API changed in v0.45; lowercase function names are correct exports | 01 |
| D-20 | uniqueIndex() replaces index().unique() in Drizzle v0.45 | IndexBuilder.unique() removed; uniqueIndex() is the correct API | 01 |
| D-21 | PRAGMA foreign_keys=ON added alongside WAL and busy_timeout | Go backend expects referential integrity, SQLite defaults to off | 01 |
| D-22 | ES module imports for FK references in schema files | Matches Plan 03 pattern (user.schema.ts); require() is CJS syntax | 01 |
| D-23 | real() column type for Go field.Float in url_stat avgDuration | Drizzle v0.45 exports real() for SQLite REAL column type | 01 |
| D-24 | linkTagPivot explicit join table for Link-LinkTag many-to-many | Implied by Go edge.StorageKey(edge.Table("link_tag_pivot")), not in ent/schema dir | 01 |
| D-25 | JwtStrategy + JwtModule created in Phase 01 for APP_GUARD wiring | Without registered strategy, AuthGuard('jwt') throws on every request | 01 |
| D-26 | drizzle.config.ts uses schema path string, not import object | drizzle-kit v0.31 Zod validation rejects imported schema objects | 01 |
| D-27 | passport-jwt@4.0.1 required as runtime dependency for JwtStrategy | PassportStrategy(Strategy) from passport-jwt needed for JWT validation | 01 |
| D-28 | Vitest 4.x uses firstValueFrom instead of done() callbacks | done() callback pattern deprecated in Vitest 4.x | 01 |
| D-29 | Guard test uses Reflect.defineMetadata for @Public() mock | Reflector.getAllAndOverride uses Reflect.getMetadata, not direct property access | 01 |

## Blockers

(None)

## Pending Todos

- [x] Create PLAN.md for Phase 01 (Infrastructure)
- [x] Verify Go backend API response format by reading original source code
- [x] Confirm Sqids alphabet/seed configuration from Go source
- [x] Confirm JWT payload structure (UserID, UserGroupID field names) from Go source

## Key Learnings

- SQLite write concurrency requires WAL mode + busy_timeout; serialize writes at app layer for safety
- ID encoding seed is stored in database settings table as `id_seed`, generated once at first install
- Go JWT payload uses `UserID` and `UserGroupID` as public ID strings, not database integers
- Frontend expects exact Chinese error messages from Go backend; error message mapping is required
- Chunked upload uses session-based flow: create session, upload chunks by index, finalize assembly
- SQLite FTS5 replaces PostgreSQL tsvector; different syntax but sufficient for blog search
- Date serialization must match Go's time.Time format (ISO8601/RFC3339)
- Null vs undefined handling differs: Go nil serializes to JSON null, TypeScript undefined omits the key

## Metrics

| Metric | Value |
|--------|-------|
| Phases Completed | 0 / 11 |
| Plans Created | 5 |
| Plans Executed | 5 |
| Requirements Covered | 20 / 39 |
| API Endpoints Implemented | 0 / ~60+ |

---

*Last updated: 2026-06-28*

## Session

**Last session:** 2026-06-29T13:26:07.945Z
**Stopped at:** Phase 2 context gathered
**Resume file:** .planning/phases/02-auth-settings/02-CONTEXT.md
