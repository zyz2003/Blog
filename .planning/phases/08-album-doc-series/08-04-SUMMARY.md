---
phase: 08
plan: 04
subsystem: album-doc-series
tags: [controllers, module-wiring, nestjs, api-compatibility]
dependency_graph:
  requires: [08-01, 08-02, 08-03]
  provides: [album-controllers, doc-series-controller, module-wiring]
  affects: [app-module]
tech_stack:
  added: []
  patterns: [nestjs-controller, @Public-decorator, AdminGuard, FileInterceptor, @Res-bypass]
key_files:
  created:
    - server/src/album/album.controller.ts
    - server/src/album/album-category.controller.ts
    - server/src/album/public-album.controller.ts
    - server/src/doc-series/doc-series.controller.ts
  modified:
    - server/src/album/album.module.ts
    - server/src/doc-series/doc-series.module.ts
decisions:
  - D-195: AlbumModule single module with 3 controllers (AlbumController, AlbumCategoryController, PublicAlbumController)
  - D-196: DocSeriesModule single module with DocSeriesController handling both admin and public endpoints
  - Album export uses @Res() to bypass ResponseInterceptor for file downloads
  - Album import uses FileInterceptor('file') for multipart upload
  - Public endpoints use @Public() decorator + JwtAuthOptionalGuard
  - Admin endpoints use @UseGuards(AdminGuard) at controller level
  - DocSeries :id param is Sqids string; Album :id param is integer
metrics:
  duration: 857s
  completed: "2026-07-12"
  tasks: 7
  files: 6
status: complete
---

# Phase 08 Plan 04: Controllers + Module Wiring Summary

Album and doc series controllers with full route parity to Go backend, plus module wiring.

## One-liner

All 4 controllers (AlbumController, AlbumCategoryController, PublicAlbumController, DocSeriesController) created with Go-compatible route patterns, guards, and module wiring complete.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create AlbumController | e787e74 | server/src/album/album.controller.ts |
| 2 | Create AlbumCategoryController | 45e3fbe | server/src/album/album-category.controller.ts |
| 3 | Create PublicAlbumController | b0b97bb | server/src/album/public-album.controller.ts |
| 4 | Create DocSeriesController | c1729f7 | server/src/doc-series/doc-series.controller.ts |
| 5 | Wire AlbumModule | d7d0a0d | server/src/album/album.module.ts |
| 6 | Wire DocSeriesModule | 510a968 | server/src/doc-series/doc-series.module.ts |
| 7 | Register modules in AppModule | N/A | Already registered in prior plans |

## Implementation Details

### AlbumController (Task 1)
- 8 admin endpoints matching Go backend route patterns exactly
- GET /api/albums/get with FindAlbumsQueryDto (page, pageSize, categoryId, tag, createdAt range, sort)
- POST /api/albums/add with CreateAlbumDto, returns null + "添加成功"
- POST /api/albums/batch-import with BatchImportRequestDto
- PUT /api/albums/update/:id with integer param + UpdateAlbumDto
- DELETE /api/albums/delete/:id with integer param
- DELETE /api/albums/batch-delete with BatchDeleteRequestDto (defined before parametric routes)
- POST /api/albums/export with @Res() bypass for file download (JSON or ZIP)
- POST /api/albums/import with FileInterceptor('file') for multipart upload
- AdminGuard applied at controller level

### AlbumCategoryController (Task 2)
- 5 admin CRUD endpoints at /api/album-categories
- POST returns 201 status code
- DELETE returns null + "删除成功"
- Integer ID params via ParseIntPipe
- AdminGuard applied at controller level

### PublicAlbumController (Task 3)
- 3 public endpoints with @Public() + JwtAuthOptionalGuard
- GET /api/public/albums with default pageSize=12 (not 10)
- GET /api/public/album-categories
- PUT /api/public/stat/:id with AlbumStatQueryDto (type: "view"|"download")

### DocSeriesController (Task 4)
- 3 public endpoints with @Public() decorator
- 5 admin endpoints with @UseGuards(AdminGuard) per-method
- :id param is Sqids string (not integer)
- Public and admin list/get share same service methods

### Module Wiring (Tasks 5-6)
- AlbumModule: 3 controllers added, imports DatabaseModule + PostTagModule + ThumbnailModule(forwardRef)
- DocSeriesModule: 1 controller added, imports DatabaseModule
- Both modules already registered in AppModule from prior plans

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation passes with no errors
- All album admin endpoints match Go backend paths exactly (albums/get, albums/add, albums/update/:id, albums/delete/:id, albums/batch-delete, albums/export, albums/import)
- Album export uses @Res() to bypass ResponseInterceptor for file downloads
- Album import uses FileInterceptor('file') for multipart upload
- Public album endpoints use @Public() + JwtAuthOptionalGuard
- Album stat endpoint PUT /api/public/stat/:id?type=view|download works
- DocSeries admin endpoints use AdminGuard per-method
- DocSeries public endpoints use @Public()
- DocSeries :id param is Sqids string
- Both modules registered in AppModule
- All response shapes match Go backend format (controllers return data, ResponseInterceptor wraps as { code, data, message })

## Self-Check: PASSED

- All 6 created/modified files exist on disk
- All 6 commits exist in git log
- TypeScript compilation passes (tsc --noEmit returns no errors)
