---
phase: 08
plan: 02
subsystem: album
tags: [service, business-logic, album, album-category]
requires: [08-01]
provides: [AlbumService, AlbumCategoryService, PostTagService.findOrCreate]
affects: [album.module, post-tag.service]
tech_stack:
  added: [adm-zip]
  patterns: [CreateOrRestore dedup, soft delete, SHA256 fileHash, ZIP import/export]
key_files:
  created:
    - server/src/album/album.service.ts
    - server/src/album/album-category.service.ts
  modified:
    - server/src/album/album.module.ts
    - server/src/post-tag/post-tag.service.ts
    - server/package.json
decisions:
  - D-196: AlbumModule imports PostTagModule + ThumbnailModule for DI
  - Used adm-zip for ZIP import/export (lightweight, synchronous API)
  - PostTagService.findOrCreate uses per-tag findOrCreate with error swallowing (matches Go)
  - fetchImageMetadata uses dynamic sharp import for dimension detection
metrics:
  duration: 742s
  completed: "2026-07-12"
  tasks: 2
  files: 6
status: complete
---

# Phase 08 Plan 02: AlbumService + AlbumCategoryService Summary

JWT-authenticated album and album-category business logic with CreateOrRestore dedup, batch import/export, and read-time defaults.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create AlbumService | 7921107 | album.service.ts, album.module.ts, post-tag.service.ts, package.json |
| 2 | Create AlbumCategoryService | 7921107 | album-category.service.ts |

## Key Implementation Details

### AlbumService

- **createAlbum**: Full CreateOrRestore with 3 statuses (created/restored/existed). Computes effectiveAlbumFileHash, aspectRatio via gcd, applies defaults before DB insert, calls postTagService.findOrCreate on created/restored, applies defaults again on final result.
- **deleteAlbum/batchDeleteAlbums**: Soft delete (sets deletedAt), matching Go SoftDeleteMixin.
- **updateAlbum**: Partial update with defaults applied on result.
- **findAlbums**: Paginated with filters (categoryId, tag, time range, sort), applies defaults on each item.
- **incrementAlbumStat**: view/download count increment.
- **batchImportAlbums**: URL batch import with HTTP GET (60s timeout), SHA256 hash dedup, error tracking.
- **exportAlbums/exportAlbumsToZip**: JSON/ZIP export with snake_case keys.
- **importAlbums/importAlbumsFromJSON/importAlbumsFromZip**: Full import with FK validation, dedup, skip/overwrite support.
- **applyDefaultAlbumParams**: 4 rules matching Go exactly (bigImageUrl, downloadUrl, thumbParam from settings, bigParam from settings).
- **toResponseDTO**: Read-time defaults (bigImageUrl/downloadUrl fall back to imageUrl), widthAndHeight computed field.
- **getSimplifiedAspectRatioString**: gcd-based ratio computation, returns "0:0" for invalid dimensions.
- **effectiveAlbumFileHash**: SHA256(imageUrl) fallback when fileHash is empty.
- **fetchImageMetadata**: HTTP GET with User-Agent, sharp-based dimension detection, SHA256 hash.

### AlbumCategoryService

- **createCategory**: Name uniqueness check, then create.
- **listCategories**: Ordered by displayOrder.
- **getCategory**: Find by ID with not-found error.
- **updateCategory**: Name uniqueness check on change, partial update.
- **deleteCategory**: Delegates to repo which checks album references; throws ALBUM_CATEGORY_IN_USE if in use.

### PostTagService.findOrCreate

- Added findOrCreate method for album tag auto-creation.
- For each tag name: check if exists via findByName, create if not.
- Errors caught per-tag (matches Go behavior: log error but don't fail).

## Verification Checklist

- [x] AlbumService.createAlbum implements CreateOrRestore with all 3 statuses
- [x] AlbumService.createAlbum calls postTagService.findOrCreate on created/restored
- [x] AlbumService.applyDefaultAlbumParams matches Go logic exactly (4 rules + specific settings keys)
- [x] AlbumService.toResponseDTO applies bigImageUrl/downloadUrl defaults at read time
- [x] AlbumService.getSimplifiedAspectRatioString produces correct ratios
- [x] AlbumService.batchImportAlbums handles dedup and error tracking
- [x] AlbumService.exportAlbums/importAlbums round-trip correctly
- [x] AlbumService.deleteAlbum uses soft delete (sets deletedAt)
- [x] AlbumService.batchDeleteAlbums uses soft delete
- [x] AlbumCategoryService.deleteCategory checks for album references
- [x] All methods return correct DTO shapes matching Go responses

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
