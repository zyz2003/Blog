---
phase: 08-album-doc-series
reviewed: 2026-07-13T00:00:00Z
depth: deep
files_reviewed: 27
files_reviewed_list:
  - server/src/album/album.controller.ts
  - server/src/album/album-category.controller.ts
  - server/src/album/public-album.controller.ts
  - server/src/album/album.service.ts
  - server/src/album/album-category.service.ts
  - server/src/album/album.repository.ts
  - server/src/album/album-category.repository.ts
  - server/src/album/album.module.ts
  - server/src/doc-series/doc-series.controller.ts
  - server/src/doc-series/doc-series.service.ts
  - server/src/doc-series/doc-series.repository.ts
  - server/src/doc-series/doc-series.module.ts
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
  - server/src/doc-series/dto/doc-series-response.dto.ts
  - server/src/doc-series/dto/doc-series-list-response.dto.ts
  - server/src/doc-series/dto/doc-series-with-articles.dto.ts
  - server/src/doc-series/dto/doc-article-item.dto.ts
  - server/src/doc-series/dto/create-doc-series-request.dto.ts
  - server/src/doc-series/dto/update-doc-series-request.dto.ts
  - server/src/doc-series/dto/list-doc-series-query.dto.ts
  - server/src/common/constants/error-codes.ts
  - server/src/post-tag/post-tag.service.ts
  - server/src/database/schemas/album.schema.ts
  - server/src/database/schemas/album-category.schema.ts
  - server/src/database/schemas/doc-series.schema.ts
  - server/src/database/schemas/article.schema.ts
findings:
  critical: 3
  warning: 8
  info: 10
  total: 21
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-07-13
**Depth:** deep
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the Album and DocSeries module implementations for API compatibility with the Go backend, business logic correctness, code quality, and security. Found 3 critical issues, 8 warnings, and 10 info items.

The most serious findings are: (1) `AlbumService.updateAlbum` converts `undefined` optional fields to empty/null values, causing partial updates to wipe existing data -- this breaks API compatibility with the Go backend which uses pointer types for partial updates; (2) `DocSeriesRepository.getByIdWithArticles` returns raw `Date` objects for article `created_at` instead of formatted ISO strings, breaking the response contract; (3) `AlbumRepository.createOrRestore` does not update `aspectRatio` during the restore path, leaving stale data.

Route paths, response shapes, soft-delete behavior, and the CreateOrRestore dedup logic are largely correct. The `applyDefaultAlbumParams` implementation matches the Go backend (no reverse fill, no published_at default). The `AlbumCategory` delete check correctly filters by `deletedAt IS NULL`. The `DocSeries` getByIdWithArticles correctly filters articles by `is_doc=true, status=PUBLISHED, deleted_at IS NULL`.

## Critical Issues

### CR-01: AlbumService.updateAlbum overwrites all fields -- breaks partial update API compatibility

**File:** `server/src/album/album.service.ts:292-304`
**Issue:** The `updateAlbum` method converts all optional `undefined` fields to empty strings or `null` before passing to the repository. In the Go backend, `UpdateAlbumRequest` uses pointer types (`*string`, `*int`) so the handler can distinguish "not provided" (nil, skip update) from "provided as empty" (update to empty). The NestJS implementation cannot make this distinction -- any field not sent by the client gets overwritten with its default value (empty string or null), destroying existing data.

For example, if a client sends `PUT /api/albums/update/1` with only `{ imageUrl: "new.jpg" }`, the service will set `bigImageUrl: ""`, `downloadUrl: ""`, `thumbParam: ""`, `bigParam: ""`, `tags: ""`, `title: ""`, `description: ""`, `location: ""`, `publishedAt: null`, `categoryId: null` -- wiping all existing values.

**Fix:**
```typescript
// In AlbumService.updateAlbum, only include fields that are explicitly provided
const updateData: Partial<CreateAlbumParams> = {};

if (params.imageUrl !== undefined) updateData.imageUrl = params.imageUrl;
if (params.bigImageUrl !== undefined) updateData.bigImageUrl = params.bigImageUrl;
if (params.downloadUrl !== undefined) updateData.downloadUrl = params.downloadUrl;
if (params.thumbParam !== undefined) updateData.thumbParam = params.thumbParam;
if (params.bigParam !== undefined) updateData.bigParam = params.bigParam;
if (params.tags !== undefined) updateData.tags = params.tags.join(',');
if (params.displayOrder !== undefined) updateData.displayOrder = params.displayOrder;
if (params.title !== undefined) updateData.title = params.title;
if (params.description !== undefined) updateData.description = params.description;
if (params.location !== undefined) updateData.location = params.location;
if (params.publishedAt !== undefined) updateData.publishedAt = params.publishedAt;
if (params.categoryId !== undefined) updateData.categoryId = params.categoryId;
```

Also update the `UpdateAlbumDto` to use `@IsOptional()` without default coercion, and ensure the controller passes `undefined` (not empty string) for fields not present in the request body.

### CR-02: DocSeriesRepository.getByIdWithArticles returns raw Date object for article created_at

**File:** `server/src/doc-series/doc-series.repository.ts:183`
**Issue:** The `getByIdWithArticles` method sets `created_at: row.createdAt` for each article item, where `row.createdAt` is a `Date` object (from Drizzle's `mode: 'timestamp'`). The Go backend returns `created_at` as a formatted ISO string. The `DocSeriesService.toAPIResponse` correctly uses `toISODateString()` for the series' own `created_at`/`updated_at`, but the articles bypass this formatting. The response will contain a raw Date object that JSON.stringify converts to an inconsistent format, breaking the API contract.

**Fix:**
```typescript
// In DocSeriesRepository.getByIdWithArticles, line 183
import { toISODateString } from '../common/utils/time.util';

const articleItems = articleRows.map((row: any) => ({
  id: generatePublicID(row.id, EntityType.Article),
  title: row.title,
  abbrlink: row.abbrlink,
  doc_sort: row.docSort,
  created_at: toISODateString(row.createdAt),  // Format to ISO string
}));
```

### CR-03: AlbumRepository.createOrRestore does not update aspectRatio during restore

**File:** `server/src/album/album.repository.ts:106-125`
**Issue:** When a soft-deleted album is restored, the `.set()` call updates all fields except `aspectRatio`. The `AlbumService.createAlbum` computes `aspectRatio` from `width`/`height` and sets it on `albumParams` (line 184), but the repository's restore path does not include `aspectRatio` in the update set. If the new params have different dimensions, the restored record will have a stale `aspectRatio` value from the original insert.

**Fix:**
```typescript
// In AlbumRepository.createOrRestore, add aspectRatio to the .set() call
const [restored] = await this.db
  .update(albums)
  .set({
    deletedAt: null,
    imageUrl: params.imageUrl,
    bigImageUrl: params.bigImageUrl ?? existing.bigImageUrl,
    downloadUrl: params.downloadUrl ?? existing.downloadUrl,
    thumbParam: params.thumbParam ?? existing.thumbParam,
    bigParam: params.bigParam ?? existing.bigParam,
    tags: params.tags ?? existing.tags,
    width: params.width ?? existing.width,
    height: params.height ?? existing.height,
    fileSize: params.fileSize ?? existing.fileSize,
    format: params.format ?? existing.format,
    aspectRatio: params.aspectRatio ?? existing.aspectRatio,  // ADD THIS
    displayOrder: params.displayOrder ?? existing.displayOrder,
    categoryId: params.categoryId ?? existing.categoryId,
    title: params.title ?? existing.title,
    description: params.description ?? existing.description,
    location: params.location ?? existing.location,
    publishedAt: params.publishedAt ?? existing.publishedAt,
    updatedAt: new Date(),
  })
  .where(eq(albums.id, existing.id))
  .returning();
```

## Warnings

### WR-01: AlbumController.importAlbums throws plain Error instead of BadRequestException

**File:** `server/src/album/album.controller.ts:209`
**Issue:** `throw new Error('未选择文件')` results in a 500 Internal Server Error. The Go backend returns a 400 Bad Request for missing file. Should use `BadRequestException` for proper HTTP status code and consistent error response format.

**Fix:**
```typescript
if (!file) {
  throw new BadRequestException('未选择文件');
}
```

### WR-02: PublicAlbumController.getPublicAlbums uses `@Query() query: any` -- no input validation

**File:** `server/src/album/public-album.controller.ts:43`
**Issue:** The public albums endpoint uses `@Query() query: any` which bypasses all class-validator validation. The admin endpoint uses `FindAlbumsQueryDto` with proper validation. The public endpoint is vulnerable to: (1) `parseInt` producing `NaN` for non-numeric query params, which would cause unexpected repository behavior; (2) no type coercion or bounds checking on `page`/`pageSize`/`categoryId`; (3) the `createdAt` handling is a fragile inline expression that duplicates logic from the DTO's `@Transform` decorator.

**Fix:** Use the same `FindAlbumsQueryDto` (or a public variant with different defaults) for the public endpoint:
```typescript
@Get('public/albums')
async getPublicAlbums(@Query() query: FindAlbumsQueryDto) {
  return this.albumService.findAlbums({
    page: query.page || 1,
    pageSize: query.pageSize || 12,  // Default 12 for public, not 10
    categoryId: query.categoryId,
    tag: query.tag,
    createdAtStart: query.createdAt?.[0],
    createdAtEnd: query.createdAt?.[1],
    sort: query.sort || 'display_order_asc',
  });
}
```

### WR-03: AlbumRepository.batchDelete does not filter by deletedAt IS NULL -- inflates deleted count

**File:** `server/src/album/album.repository.ts:198-205`
**Issue:** The `batchDelete` method soft-deletes all records matching the given IDs, including already-soft-deleted ones. The Go backend's `BatchDeleteAlbums` uses `SoftDeleteMixin` which only soft-deletes active records. The returned `deleted` count will include already-soft-deleted records, giving an incorrect count to the client.

**Fix:**
```typescript
async batchDelete(ids: number[]) {
  const result = await this.db
    .update(albums)
    .set({ deletedAt: new Date() })
    .where(and(inArray(albums.id, ids), isNull(albums.deletedAt)))
    .returning();
  return result.length;
}
```

### WR-04: AlbumRepository.update has 16 lines of redundant field mapping

**File:** `server/src/album/album.repository.ts:155-170`
**Issue:** The `update` method spreads `data` into `updateData` on line 152 (`{ ...data, updatedAt: new Date() }`), then re-assigns every field from `data` back to `updateData` on lines 155-170. These 16 lines are completely redundant -- they just re-assign the same values that are already present from the spread. This is dead code that adds maintenance burden and confusion.

**Fix:** Remove lines 155-170. The spread on line 152 already copies all fields from `data`:
```typescript
async update(id: number, data: Partial<CreateAlbumParams>) {
  const updateData: Record<string, any> = { ...data, updatedAt: new Date() };
  const [album] = await this.db
    .update(albums)
    .set(updateData)
    .where(and(eq(albums.id, id), isNull(albums.deletedAt)))
    .returning();
  return album ?? null;
}
```

### WR-05: AlbumService.updateAlbum does not call findOrCreate for tags

**File:** `server/src/album/album.service.ts:268-321`
**Issue:** The `createAlbum` method calls `postTagService.findOrCreate(params.tags)` for 'created' and 'restored' statuses, ensuring new tags are created in the tag table. The `updateAlbum` method does not call `findOrCreate` for tags. If a client updates an album with a new tag name that doesn't exist in the tag table, the tag will be stored in the album's `tags` field but won't appear in the tag list. The Go backend's `UpdateAlbum` also calls `findOrCreate` for tags.

**Fix:** Add `findOrCreate` call in `updateAlbum`:
```typescript
// After the update, ensure tags exist
if (params.tags && params.tags.length > 0) {
  try {
    await this.postTagService.findOrCreate(params.tags);
  } catch (err) {
    this.logger.warn(`处理更新图片标签时发生错误: ${err}`);
  }
}
```

### WR-06: AlbumController.createAlbum does not validate createdAt date string

**File:** `server/src/album/album.controller.ts:92`
**Issue:** `dto.created_at ? new Date(dto.created_at) : undefined` creates a Date from an unvalidated string. If the string is invalid (e.g., e.g., `"not-a-date"`, `new Date()` produces an Invalid Date object that passes the truthiness check in the repository (`if (params.createdAt)`), resulting in an invalid timestamp being stored. The import path correctly validates with `isNaN(d.getTime())`, but the direct create path does not.

**Fix:**
```typescript
createdAt: dto.created_at ? (() => {
  const d = new Date(dto.created_at);
  return isNaN(d.getTime()) ? undefined : d;
})() : undefined,
```

### WR-07: AlbumService.exportAlbums uses magic number pageSize=100000 to fetch all records

**File:** `server/src/album/album.service.ts:564-567`
**Issue:** When no `albumIds` are specified, the export fetches all albums using `pageSize: 100000`. If there are more than 100,000 albums, some will be silently omitted from the export. The repository should have a `findAll()` method that returns all records without pagination limits.

**Fix:** Add a `findAll()` method to `AlbumRepository`:
```typescript
async findAll() {
  return this.db
    .select()
    .from(albums)
    .where(isNull(albums.deletedAt));
}
```
Then use it in the export:
```typescript
if (!albumIds || albumIds.length === 0) {
  albumsToExport = await this.albumRepo.findAll();
}
```

### WR-08: AlbumService.importAlbums ignores overwriteExisting flag

**File:** `server/src/album/album.service.ts:95`
**Issue:** The `ImportAlbumRequest` interface defines `overwriteExisting: boolean` and the controller passes it from the form fields, but the `importAlbums` method never checks or uses this flag. The Go backend supports overwriting existing albums during import. The current implementation always skips existing albums regardless of the `overwriteExisting` setting.

**Fix:** Implement overwrite logic in `importAlbums`:
```typescript
if (req.overwriteExisting && existingHashesMap.has(importKey)) {
  // Update existing album instead of skipping
  const existingId = existingHashesMap.get(importKey);
  await this.updateAlbum(existingId, { ...albumParamsFromFile });
  result.success_count++;
  continue;
}
```

## Info

### IN-01: ThumbnailService injected but never used in AlbumService

**File:** `server/src/album/album.service.ts:11,117`
**Issue:** `ThumbnailService` is imported and injected into `AlbumService` but `this.thumbnailService` is never called. The `AlbumModule` also imports `ThumbnailModule` with `forwardRef` unnecessarily.

**Fix:** Remove the `ThumbnailService` import, injection, and the `ThumbnailModule`/`forwardRef` import from `AlbumModule`.

### IN-02: DRIZZLE injected but never used in DocSeriesService

**File:** `server/src/doc-series/doc-series.service.ts:8,24`
**Issue:** `@Inject(DRIZZLE) private readonly db: any` is injected but `this.db` is never used. All database queries go through `DocSeriesRepository`.

**Fix:** Remove the `DRIZZLE` import, `@Inject(DRIZZLE)` injection, and the `Inject` import from `@nestjs/common`.

### IN-03: EntityType imported but unused in DocSeriesService

**File:** `server/src/doc-series/doc-series.service.ts:9`
**Issue:** `EntityType` is imported from `sqids.util` but never used in the service. It's only used in the repository.

**Fix:** Remove `EntityType` from the import: `import { decodePublicID } from '../common/utils/sqids.util';`

### IN-04: Multiple unused imports in AlbumController

**File:** `server/src/album/album.controller.ts:15-16,20`
**Issue:** `HttpCode`, `HttpStatus` are imported but never used. `ImportAlbumResult` is imported but never referenced.

**Fix:** Remove unused imports.

### IN-05: BadRequestException imported but unused in PublicAlbumController

**File:** `server/src/album/public-album.controller.ts:9`
**Issue:** `BadRequestException` is imported but never thrown in the controller.

**Fix:** Remove the unused import.

### IN-06: AlbumCategoryRepository.findAllForImport is dead code

**File:** `server/src/album/album-category.repository.ts:111-121`
**Issue:** The `findAllForImport` method is defined but never called. The `AlbumService.importAlbums` uses `albumCategoryRepo.findAll()` instead.

**Fix:** Remove the unused method.

### IN-07: Multiple error code constants defined but never used

**File:** `server/src/common/constants/error-codes.ts:138,142-145,150-151`
**Issue:** The following error codes are defined but never referenced in any service:
- `ALBUM_FILE_HASH_EXISTS` (service uses hardcoded string with album ID)
- `ALBUM_BATCH_IMPORT_FAILED`
- `ALBUM_EXPORT_FAILED`
- `ALBUM_IMPORT_FAILED`
- `ALBUM_IMPORT_FILE_INVALID`
- `DOCSERIES_NAME_EXISTS` (service uses hardcoded string with name)
- `DOCSERIES_HAS_DOCS` (service uses hardcoded string with count)

**Fix:** Either use these constants in the corresponding services (replacing hardcoded strings), or remove them from the error codes file.

### IN-08: AlbumService.applyDefaultAlbumParams called redundantly in findAlbums

**File:** `server/src/album/album.service.ts:331-333`
**Issue:** `applyDefaultAlbumParams` is called on each album in `findAlbums`, then `toResponseDTO` is called which also applies the same defaults (via `||` fallbacks). The double application is harmless but redundant.

**Fix:** Remove the `applyDefaultAlbumParams` loop since `toResponseDTO` already handles defaults at read time.

### IN-09: AlbumService.createAlbum uses intermediate albumLike object for applyDefaultAlbumParams

**File:** `server/src/album/album.service.ts:186-198`
**Issue:** The `applyDefaultAlbumParams` method mutates its argument in-place, requiring a shallow copy (`albumLike`) and manual field copying back. This pattern is fragile and could be simplified by making `applyDefaultAlbumParams` return a new object or by applying defaults directly to `albumParams`.

**Fix:** Refactor `applyDefaultAlbumParams` to accept and return a params object, or apply defaults directly to `albumParams` without the intermediate copy.

### IN-10: DocSeriesService.delete uses `as any` cast for docCount access

**File:** `server/src/doc-series/doc-series.service.ts:159,161`
**Issue:** `(series as any).docCount` is used twice. The `getById` method returns an object with `...series` spread, so `docCount` should be directly accessible. The `as any` cast suppresses TypeScript's type checking.

**Fix:** Define a proper return type for `getById` that includes `docCount`, or access it without the cast: `series.docCount`.

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
