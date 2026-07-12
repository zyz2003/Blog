---
phase: 08-album-doc-series
plan: 01
subsystem: database, api
tags: [drizzle, sqlite, sqids, class-validator, repository-pattern, dto]

requires:
  - phase: 07
    provides: established repository/DTO patterns, DRIZZLE injection, error-codes pattern

provides:
  - AlbumRepository with createOrRestore dedup, soft delete, paginated queries
  - AlbumCategoryRepository with FK-protected hard delete
  - DocSeriesRepository with Sqids-encoded IDs and article association queries
  - All Album DTOs (9 files: response, create, update, query, batch-import, batch-delete, export, import, stat)
  - All AlbumCategory DTOs (3 files: response, create, update)
  - All DocSeries DTOs (7 files: response, list-response, with-articles, article-item, create, update, list-query)
  - Phase 08 error codes (13 constants: 10 album + 3 doc-series)

affects: [08-02, 08-03, 08-04, 08-05]

tech-stack:
  added: []
  patterns:
    - "CreateOrRestore dedup pattern: query WITHOUT deletedAt filter, handle created/restored/existed statuses"
    - "Soft delete filter: all album queries MUST include WHERE deleted_at IS NULL"
    - "Sqids-encoded IDs for DocSeries (EntityType.DocSeries=12), integer IDs for Album/AlbumCategory"
    - "Tag filter: SQLite CONCAT(',', tags, ',') LIKE '%,tag,%' for comma-separated tag search"

key-files:
  created:
    - server/src/album/album.repository.ts
    - server/src/album/album-category.repository.ts
    - server/src/album/dto/album-response.dto.ts
    - server/src/album/dto/create-album-request.dto.ts
    - server/src/album/dto/update-album-request.dto.ts
    - server/src/album/dto/find-albums-query.dto.ts
    - server/src/album/dto/batch-import-request.dto.ts
    - server/src/album/dto/batch-delete-request.dto.ts
    - server/src/album/dto/export-albums-request.dto.ts
    - server/src/album/dto/import-albums-query.dto.ts
    - server/src/album/dto/album-stat-query.dto.ts
    - server/src/album/dto/album-category-response.dto.ts
    - server/src/album/dto/create-album-category-request.dto.ts
    - server/src/album/dto/update-album-category-request.dto.ts
    - server/src/doc-series/doc-series.repository.ts
    - server/src/doc-series/dto/doc-series-response.dto.ts
    - server/src/doc-series/dto/doc-series-list-response.dto.ts
    - server/src/doc-series/dto/doc-series-with-articles.dto.ts
    - server/src/doc-series/dto/doc-article-item.dto.ts
    - server/src/doc-series/dto/create-doc-series-request.dto.ts
    - server/src/doc-series/dto/update-doc-series-request.dto.ts
    - server/src/doc-series/dto/list-doc-series-query.dto.ts
  modified:
    - server/src/common/constants/error-codes.ts

key-decisions:
  - "AlbumRepository.createOrRestore queries WITHOUT deletedAt filter to find soft-deleted records for restore path (D-190)"
  - "AlbumRepository.delete uses soft delete (sets deletedAt), NOT hard delete, matching Go SoftDeleteMixin"
  - "AlbumRepository.findAllForDedup includes soft-deleted records for import dedup"
  - "AlbumCategoryRepository.delete checks only active albums (deletedAt IS NULL) before hard delete"
  - "DocSeriesRepository uses Sqids-encoded IDs (EntityType.DocSeries=12) per D-183"
  - "DocSeriesRepository.getByIdWithArticles filters articles by is_doc=true AND status=PUBLISHED AND deleted_at IS NULL"

patterns-established:
  - "CreateOrRestore dedup: query without soft-delete filter, handle 3 statuses (created/restored/existed)"
  - "Soft delete consistency: findById/findListByOptions filter deletedAt IS NULL; createOrRestore/findAllForDedup do NOT"
  - "Sqids encoding in repository: encode on return, decode on input, keep db operations on integer IDs"
  - "Tag search in SQLite: CONCAT(',', tags, ',') LIKE '%,tag,%' for comma-separated field matching"

requirements-completed: []

coverage:
  - id: D1
    description: "Phase 08 error codes added to error-codes.ts (10 album + 3 doc-series constants)"
    verification:
      - kind: unit
        ref: "TypeScript compilation (tsc --noEmit) passes with new error codes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Album DTOs (9 files) with class-validator decorators matching Go request/response structures"
    verification:
      - kind: unit
        ref: "TypeScript compilation (tsc --noEmit) passes with all DTOs"
        status: pass
    human_judgment: false
  - id: D3
    description: "AlbumCategory DTOs (3 files) with correct fields per D-188 (no cover_url/sort/password)"
    verification:
      - kind: unit
        ref: "TypeScript compilation (tsc --noEmit) passes"
        status: pass
    human_judgment: false
  - id: D4
    description: "DocSeries DTOs (7 files) with Sqids-encoded string IDs and snake_case JSON keys"
    verification:
      - kind: unit
        ref: "TypeScript compilation (tsc --noEmit) passes"
        status: pass
    human_judgment: false
  - id: D5
    description: "AlbumRepository with createOrRestore dedup, soft delete, paginated queries, and stat increments"
    verification:
      - kind: unit
        ref: "TypeScript compilation (tsc --noEmit) passes; createOrRestore handles all 3 statuses; delete sets deletedAt not hard delete"
        status: pass
    human_judgment: true
    rationale: "CreateOrRestore 3-way branching logic and soft-delete filter consistency need runtime verification"
  - id: D6
    description: "AlbumCategoryRepository with FK-protected hard delete checking only active albums"
    verification:
      - kind: unit
        ref: "TypeScript compilation (tsc --noEmit) passes"
        status: pass
    human_judgment: true
    rationale: "FK-protected delete logic (checking only active albums with deletedAt IS NULL) needs runtime verification"
  - id: D7
    description: "DocSeriesRepository with Sqids-encoded IDs, article association queries, and doc_count sync"
    verification:
      - kind: unit
        ref: "TypeScript compilation (tsc --noEmit) passes"
        status: pass
    human_judgment: true
    rationale: "Sqids encode/decode round-trip and article association query filters need runtime verification"

duration: 17min
completed: 2026-07-12
status: complete
---

# Phase 08 Plan 01: Album & DocSeries Repository Layer + DTOs + Error Codes Summary

**AlbumRepository with CreateOrRestore dedup/soft-delete, AlbumCategoryRepository with FK-protected delete, DocSeriesRepository with Sqids IDs, plus 19 DTO files and 13 error codes**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-12T08:00:43Z
- **Completed:** 2026-07-12T08:17:48Z
- **Tasks:** 7
- **Files modified:** 20

## Accomplishments
- AlbumRepository with full CRUD + CreateOrRestore dedup pattern (3 statuses: created/restored/existed)
- AlbumRepository soft delete (sets deletedAt) with consistent deletedAt IS NULL filtering on all read queries
- AlbumRepository.findAllForDedup includes soft-deleted records for import dedup
- AlbumCategoryRepository with FK-protected hard delete (checks only active albums)
- DocSeriesRepository with Sqids-encoded IDs (EntityType.DocSeries=12) and article association queries
- 19 DTO files across Album (9), AlbumCategory (3), and DocSeries (7) with class-validator decorators
- 13 error code constants (10 album + 3 doc-series) matching Go backend Chinese messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Phase 08 error codes** - `728182a` (feat)
2. **Task 2: Create Album DTOs** - `d7b1e49` (feat)
3. **Task 3: Create AlbumCategory DTOs** - `5b0e2bf` (feat)
4. **Task 4: Create DocSeries DTOs** - `6d1cb0a` (feat)
5. **Task 5: Create AlbumRepository** - `fc0a68d` (feat)
6. **Task 6: Create AlbumCategoryRepository** - `dd65c6b` (feat)
7. **Task 7: Create DocSeriesRepository** - `77ac20b` (feat)

## Files Created/Modified
- `server/src/common/constants/error-codes.ts` - Added 13 Phase 08 error code constants
- `server/src/album/album.repository.ts` - AlbumRepository with createOrRestore, soft delete, paginated queries
- `server/src/album/album-category.repository.ts` - AlbumCategoryRepository with FK-protected hard delete
- `server/src/album/dto/album-response.dto.ts` - AlbumResponseDto with integer IDs and widthAndHeight
- `server/src/album/dto/create-album-request.dto.ts` - CreateAlbumDto with imageUrl + fileHash required
- `server/src/album/dto/update-album-request.dto.ts` - UpdateAlbumDto with partial update, nullable categoryId
- `server/src/album/dto/find-albums-query.dto.ts` - FindAlbumsQueryDto with pagination/filters/sort
- `server/src/album/dto/batch-import-request.dto.ts` - BatchImportRequestDto with urls array 1-100
- `server/src/album/dto/batch-delete-request.dto.ts` - BatchDeleteRequestDto with ids array
- `server/src/album/dto/export-albums-request.dto.ts` - ExportAlbumsRequestDto with album_ids + format
- `server/src/album/dto/import-albums-query.dto.ts` - ImportAlbumsQueryDto with skip/overwrite booleans
- `server/src/album/dto/album-stat-query.dto.ts` - AlbumStatQueryDto with type (view/download)
- `server/src/album/dto/album-category-response.dto.ts` - AlbumCategoryResponseDto per D-188
- `server/src/album/dto/create-album-category-request.dto.ts` - CreateAlbumCategoryRequestDto
- `server/src/album/dto/update-album-category-request.dto.ts` - UpdateAlbumCategoryRequestDto
- `server/src/doc-series/doc-series.repository.ts` - DocSeriesRepository with Sqids IDs
- `server/src/doc-series/dto/doc-series-response.dto.ts` - DocSeriesResponseDto with Sqids string ID
- `server/src/doc-series/dto/doc-series-list-response.dto.ts` - DocSeriesListResponseDto
- `server/src/doc-series/dto/doc-series-with-articles.dto.ts` - DocSeriesWithArticlesDto
- `server/src/doc-series/dto/doc-article-item.dto.ts` - DocArticleItemDto
- `server/src/doc-series/dto/create-doc-series-request.dto.ts` - CreateDocSeriesRequestDto
- `server/src/doc-series/dto/update-doc-series-request.dto.ts` - UpdateDocSeriesRequestDto
- `server/src/doc-series/dto/list-doc-series-query.dto.ts` - ListDocSeriesQueryDto

## Decisions Made
- AlbumRepository.createOrRestore queries WITHOUT deletedAt IS NULL filter to find soft-deleted records for restore (per D-190)
- AlbumRepository.findAllForDedup includes soft-deleted records so import dedup catches both active and deleted albums
- AlbumCategoryRepository.delete checks only active albums (WHERE deleted_at IS NULL) before allowing hard delete
- DocSeriesRepository encodes/decodes Sqids at repository boundary, keeping all DB operations on integer IDs
- DocSeriesRepository.getByIdWithArticles filters articles by is_doc=true AND status=PUBLISHED AND deleted_at IS NULL per Go backend

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All repository methods and DTOs ready for Plan 08-02 (AlbumService + AlbumCategoryService)
- AlbumRepository.createOrRestore ready for service-layer CreateOrRestore flow
- DocSeriesRepository ready for Plan 08-03 (DocSeriesService)
- Error codes ready for service-layer error handling
- No schema changes needed (all schemas already exist from Phase 01)

## Self-Check: PASSED

All 23 files verified present. All 7 task commits verified in git log. TypeScript compilation (tsc --noEmit) passes with zero errors.

---
*Phase: 08-album-doc-series*
*Completed: 2026-07-12*
