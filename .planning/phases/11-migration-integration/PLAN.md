# Phase 11: Migration & Integration — Master Plan

**Phase:** 11-Migration & Integration
**Created:** 2026-07-16
**Status:** Planning

## Goal

SQLite→SQLite migration tool + full end-to-end API compatibility testing against Go backend responses. This is the final phase — completion means the project is production-ready.

## Requirements

- MIGRATION-01: SQLite→SQLite migration CLI tool
- INTEGRATION-01: End-to-end API compatibility testing

## Success Criteria

- Migration CLI tool reads from Go backend's SQLite .db file and writes to NestJS's .db file
- All 33 tables migrate with data integrity preserved
- ID seed values preserved so Sqids encoding produces identical public IDs
- JWT secret preserved so existing tokens work after migration
- Settings, file paths, and binary data all transfer correctly
- End-to-end API compatibility test suite passes for all endpoints
- Frontend connects to new backend and all features work without modification
- `npm run dev` starts both frontend and backend successfully

## Key Decisions

- D-300: SQLite→SQLite only (Go backend defaults to SQLite)
- D-301: Node.js CLI script (scripts/migrate.ts) using better-sqlite3
- D-302: Table migration in FK dependency order
- D-303: API compat tests based on Go source code reference
- D-304: vitest + supertest + NestJS Test module
- D-305: Test granularity: response shape only
- D-306: Cover all endpoints (P0 + P1 + P2)
- D-307: Tests organized by functional module
- D-308: Post-migration validation: row count + spot check
- D-309: Auto-backup target .db before migration
- D-310: id_seed and JWT_SECRET must be precisely copied

## Critical Data Transformation

**Timestamps**: Go Ent stores as ISO8601 text → NestJS Drizzle expects Unix epoch integer.
This is the most important transformation in the migration tool.

## Plan Structure

### Wave 1 (parallel, no cross-dependencies)

- **11-01-PLAN.md** — Migration CLI tool: scripts/migrate.ts with FK-ordered table migration, timestamp conversion, auto-backup, and post-migration validation (4 files)
- **11-02-PLAN.md** — API compat test infrastructure: shared helpers with typed TestContext interface, multipart upload helper, and 6 core module test files — auth, settings, version, user, article, page (7 files)

### Wave 2 (depends on Wave 1)

- **11-03-PLAN.md** — Content & file module tests: post-category, post-tag, comment, search, doc-series, article-history, file, storage-policy, thumbnail, direct-link (10 files)
- **11-04-PLAN.md** — Stats, links, album, SEO, notification module tests: statistics, link, album, album-category, rss, sitemap, music, notification, subscriber (9 files)

### Wave 3 (depends on all prior)

- **11-05-PLAN.md** — Remaining tests (backup, captcha, weather, proxy) + full test suite run + migration end-to-end verification + frontend smoke test + STATE/ROADMAP update (4 test files + 2 edits)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timestamp conversion errors | HIGH — breaks all date fields | Unit test conversion function with known Go→NestJS pairs |
| Pivot table name mismatch | MEDIUM — data loss in junction tables | Explicit name mapping in migration config |
| Self-referencing FK (comments, files) | LOW — FK checks disabled during migration | Single-pass insert with FK checks OFF, verify after |
| Test data conflicts between files | LOW — each file seeds independently | Use unique timestamps per test file |
| Multipart upload testing | MEDIUM — supertest .attach() pattern needed | Shared uploadFile helper in test infrastructure |
