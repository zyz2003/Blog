---
phase: 08
plan: 05
subsystem: album-doc-series
tags: [integration-test, schema-verification, api-compatibility, bug-fix]
requires: [08-04]
provides: [album-integration-tests, docseries-integration-tests, startup-verification, api-compat-verified]
affects: [server/src/album, server/src/doc-series, server/src/database/schemas/album.schema.ts, server/test]
tech-stack:
  added: [vitest, supertest]
  patterns: [integration-test-with-app-bootstrap, unique-timestamp-test-data, sqids-seed-consistency]
key-files:
  created:
    - server/test/phase08-integration.spec.ts
    - server/test/phase08-startup.spec.ts
    - server/test/phase08-api-compat.spec.ts
  modified:
    - server/src/album/album.repository.ts
    - server/src/album/album.service.ts
    - server/src/album/album.controller.ts
    - server/src/album/album-category.controller.ts
    - server/src/album/album-category.service.ts
    - server/src/album/public-album.controller.ts
    - server/src/doc-series/doc-series.controller.ts
    - server/src/doc-series/doc-series.service.ts
    - server/src/database/schemas/album.schema.ts
decisions:
  - D-200: Album FK onDelete set null matches Go backend (ent schema OnDelete: schema.SetNull)
  - D-201: Controllers return { data, message } format for Chinese success messages matching Go backend
  - D-202: DocSeries update uses excludeDbId for name uniqueness check instead of get-and-compare
  - D-203: aspectRatio persisted to DB on create (was computed but not stored)
  - D-204: All Phase 08 tests use consistent Sqids seed to avoid global singleton conflict
metrics:
  duration: 69m
  completed: 2026-07-12
  tasks: 8
  files: 13
status: complete
---

# Phase 08 Plan 05: Integration Tests + Schema Verification + Final Wiring Summary

Integration tests and schema verification for all Phase 08 album and doc-series endpoints, with bug fixes discovered during testing.

## One-liner

Full lifecycle integration tests (33 tests), startup verification (7 tests), and API compatibility spot-checks (10 tests) for album and doc-series endpoints, with 4 bug fixes.

## Task Results

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Schema push verification | Done | dde82fd |
| 2 | Album CRUD integration test | Done | dde82fd |
| 3 | Album public endpoints test | Done | dde82fd |
| 4 | Album import/export test | Done | dde82fd |
| 5 | DocSeries CRUD integration test | Done | dde82fd |
| 6 | DocSeries public endpoints test | Done | dde82fd |
| 7 | AppModule startup verification | Done | 56155d2 |
| 8 | API compatibility spot-check | Done | b05cc7f |

## What Was Done

### Task 1: Schema Push Verification
- Ran `npx drizzle-kit push` — no changes detected (schema already synced)
- Verified all tables exist: albums (24 columns), album_categories (4 columns), doc_series (8 columns)
- Verified articles table has doc_series_id, doc_sort, is_doc fields
- Verified all indexes: albums_file_hash_unique, album_categories_name_unique, doc_series_name_unique, idx_articles_doc

### Tasks 2-6: Integration Tests (33 tests)
- Created `server/test/phase08-integration.spec.ts` with comprehensive tests
- Album CRUD: create category, list categories, create album, duplicate fileHash error, list albums format, update album, batch delete, soft-delete + CreateOrRestore restore path, category in-use check
- Album public endpoints: public albums (default pageSize=12), public categories, stat view increment, stat download increment, invalid stat type error
- Album import/export: JSON export with correct structure, JSON import with success count
- DocSeries CRUD: create with Sqids ID, duplicate name error, list, get, update, delete with docs blocked, delete without docs
- DocSeries public endpoints: public list, public get, get with articles

### Task 7: AppModule Startup Verification (7 tests)
- Created `server/test/phase08-startup.spec.ts`
- Verified app starts without module resolution errors
- Verified all Album, AlbumCategory, DocSeries routes registered
- Verified public album and doc-series routes accessible without auth
- Verified album stat route registered

### Task 8: API Compatibility Spot-Check (10 tests)
- Created `server/test/phase08-api-compat.spec.ts`
- Verified album list response format: { list, total, pageNum, pageSize }
- Verified AlbumResponse: integer id, camelCase fields, computed widthAndHeight
- Verified AlbumCategoryDTO: only id, name, description, displayOrder (no forbidden fields)
- Verified DocSeriesResponse: Sqids string id, snake_case fields
- Verified DocSeriesListResponse: { list, total, page, pageSize }
- Verified DocSeriesWithArticles: DocSeriesResponse + articles array
- Verified response wrapper: { code, message, data }
- Verified error response format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] aspectRatio not persisted to database**
- **Found during:** Task 2 (Album CRUD integration test)
- **Issue:** AlbumService.createAlbum() computed aspectRatio via getSimplifiedAspectRatioString() but never passed it to AlbumRepository.create(), so the DB column remained null
- **Fix:** Added aspectRatio to CreateAlbumParams interface and album repository create() values object; set albumParams.aspectRatio before DB insert
- **Files modified:** server/src/album/album.repository.ts, server/src/album/album.service.ts
- **Commit:** dde82fd

**2. [Rule 1 - Bug] DocSeries update name uniqueness check rejected self-rename**
- **Found during:** Task 5 (DocSeries CRUD integration test)
- **Issue:** DocSeriesService.update() checked existsByName(dto.name) without excluding the current series, so renaming a series always failed with "已存在" because the query found the series itself
- **Fix:** Used decodePublicID() to get dbID, then passed it as excludeDbId to existsByName() — the repository already supported this parameter
- **Files modified:** server/src/doc-series/doc-series.service.ts
- **Commit:** dde82fd

**3. [Rule 2 - Missing] Controllers returned English "success" instead of Chinese messages**
- **Found during:** Task 2 (Album CRUD integration test)
- **Issue:** Controllers returned `null` which ResponseInterceptor wrapped as `{ message: 'success' }`. Go backend returns Chinese messages like "添加成功", "更新成功", "删除成功"
- **Fix:** Changed controllers to return `{ data: null, message: '添加成功' }` format which ResponseInterceptor recognizes and preserves the Chinese message
- **Files modified:** album.controller.ts, album-category.controller.ts, public-album.controller.ts, doc-series.controller.ts
- **Commit:** dde82fd

**4. [Rule 2 - Missing] Album FK onDelete not specified in Drizzle schema**
- **Found during:** Task 2 (Album CRUD integration test — category delete after soft-delete)
- **Issue:** Go backend uses `OnDelete: schema.SetNull` on the album→category FK, meaning deleting a category sets album.category_id to NULL. Drizzle schema didn't specify this, though the DB already had it from a prior migration
- **Fix:** Added `{ onDelete: 'set null' }` to the categoryId FK reference in album.schema.ts
- **Files modified:** server/src/database/schemas/album.schema.ts
- **Commit:** dde82fd

**5. [Rule 3 - Blocking] Sqids seed conflict when tests run in parallel**
- **Found during:** Running all Phase 08 tests together
- **Issue:** initSqidsEncoderWithSeed() sets a global singleton. Different test files used different seeds, causing the second test's seed to override the first's
- **Fix:** Aligned all three test files to use the same seed 'phase08-integration-test-seed'
- **Files modified:** server/test/phase08-startup.spec.ts, server/test/phase08-api-compat.spec.ts
- **Commit:** 7489277

## Key Decisions

- **D-200:** Album FK `onDelete: 'set null'` matches Go backend ent schema `OnDelete: schema.SetNull` — deleting a category nullifies album.category_id instead of blocking
- **D-201:** Controllers return `{ data, message }` format for Chinese success messages — ResponseInterceptor detects this and preserves the message instead of defaulting to 'success'
- **D-202:** DocSeries update uses `excludeDbId` for name uniqueness check — cleaner than the previous get-and-compare approach that had a logic error
- **D-203:** aspectRatio persisted to DB on create — was previously computed but not stored, causing null in list responses
- **D-204:** All Phase 08 tests use consistent Sqids seed — prevents global singleton conflict when vitest runs tests in parallel

## Test Coverage Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| phase08-integration.spec.ts | 33 | Album CRUD, public endpoints, import/export, DocSeries CRUD, public doc-series, soft-delete/restore, category in-use |
| phase08-startup.spec.ts | 7 | App startup, route registration, public endpoint access |
| phase08-api-compat.spec.ts | 10 | Response shapes, field naming, ID encoding, error format |
| **Total** | **50** | |

## Verification

- [x] Schema push succeeds with no errors
- [x] Album CRUD all endpoints return correct response shapes
- [x] Album CreateOrRestore dedup works correctly (created + existed error)
- [x] Album soft-delete: deleted albums not returned in list queries
- [x] Album soft-delete + restore: creating album with same fileHash after soft-delete restores the record
- [x] Album export/import round-trip works
- [x] Album stat endpoint increments correct counter (view + download)
- [x] DocSeries CRUD all endpoints return correct response shapes
- [x] DocSeries name uniqueness enforced
- [x] DocSeries delete blocked when docCount > 0
- [x] DocSeriesWithArticles includes articles with Sqids IDs
- [x] Public endpoints work without authentication
- [x] Admin endpoints require JWT + Admin guard
- [x] All Phase 08 routes registered and accessible
- [x] All response shapes match Go backend format

## Self-Check: PASSED

- All 3 test files exist
- All 4 commits exist (dde82fd, 56155d2, b05cc7f, 7489277)
- No accidental file deletions
- No untracked files left
