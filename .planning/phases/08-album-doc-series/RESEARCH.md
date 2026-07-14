# Phase 08: Album & Doc Series — Research

**Gathered:** 2026-07-12
**Status:** Complete

## API Endpoint Inventory

### Album Admin Endpoints (JWTAuth + AdminAuth)

| Method | Path | Handler | Request | Response |
|--------|------|---------|---------|----------|
| GET | /api/albums/get | GetAlbums | query: page, pageSize, categoryId, tag, createdAt[0], createdAt[1], sort | `{ list: AlbumResponse[], total, pageNum, pageSize }` |
| POST | /api/albums/add | AddAlbum | body: `{ categoryId?, imageUrl(req), bigImageUrl, downloadUrl, thumbParam, bigParam, tags[], width, height, fileSize, format, fileHash(req), displayOrder, title, description, location, created_at?, published_at? }` | `null` + message "添加成功" |
| POST | /api/albums/batch-import | BatchImportAlbums | body: `{ categoryId?, urls[](req,1-100), thumbParam, bigParam, tags[], displayOrder }` | `{ successCount, failCount, skipCount, total, errors?[], duplicates?[] }` |
| PUT | /api/albums/update/:id | UpdateAlbum | param: id(int), body: `{ categoryId?, imageUrl(req), bigImageUrl, downloadUrl, thumbParam, bigParam, tags[], displayOrder?, title, description, location, published_at? }` | `null` + message "更新成功" |
| DELETE | /api/albums/delete/:id | DeleteAlbum | param: id(int) | `null` + message "删除成功" |
| DELETE | /api/albums/batch-delete | BatchDeleteAlbums | body: `{ ids[](req,min=1) }` | `{ deleted: count }` |
| POST | /api/albums/export | ExportAlbums | body: `{ album_ids?[], format?("json"|"zip") }` | JSON file download or ZIP file download |
| POST | /api/albums/import | ImportAlbums | multipart: file(req), skip_existing(default:"true"), overwrite_existing(default:"false"), default_category_id? | `{ total_count, success_count, skipped_count, failed_count, created_ids[], errors?[] }` |

### Album Category Admin Endpoints (JWTAuth + AdminAuth)

| Method | Path | Handler | Request | Response |
|--------|------|---------|---------|----------|
| POST | /api/album-categories | CreateCategory | body: `{ name(req), description, displayOrder }` | AlbumCategoryDTO (201) |
| GET | /api/album-categories | ListCategories | — | AlbumCategoryDTO[] |
| GET | /api/album-categories/:id | GetCategory | param: id(int) | AlbumCategoryDTO |
| PUT | /api/album-categories/:id | UpdateCategory | param: id(int), body: `{ name(req), description, displayOrder }` | AlbumCategoryDTO |
| DELETE | /api/album-categories/:id | DeleteCategory | param: id(int) | `null` + message "删除成功" |

### Album Public Endpoints (no auth)

| Method | Path | Handler | Request | Response |
|--------|------|---------|---------|----------|
| GET | /api/public/albums | GetPublicAlbums | query: page(def:1), pageSize(def:12), categoryId, tag, createdAt[0], createdAt[1], sort(def:"display_order_asc") | `{ list: Album[], total, pageNum, pageSize }` |
| GET | /api/public/album-categories | GetPublicAlbumCategories | — | AlbumCategoryDTO[] |
| PUT | /api/public/stat/:id | UpdateAlbumStat | param: id(int), query: type("view"|"download") | `null` + message "更新成功" |

### DocSeries Admin Endpoints (JWTAuth + AdminAuth)

| Method | Path | Handler | Request | Response |
|--------|------|---------|---------|----------|
| GET | /api/doc-series | List | query: page(def:1), pageSize(def:20) | DocSeriesListResponse |
| GET | /api/doc-series/:id | Get | param: id(Sqids string) | DocSeriesResponse |
| POST | /api/doc-series | Create | body: `{ name(req), description, cover_url, sort }` | DocSeriesResponse |
| PUT | /api/doc-series/:id | Update | param: id(Sqids string), body: `{ name?, description?, cover_url?, sort? }` | DocSeriesResponse |
| DELETE | /api/doc-series/:id | Delete | param: id(Sqids string) | `null` + message "删除成功" |

### DocSeries Public Endpoints (no auth)

| Method | Path | Handler | Request | Response |
|--------|------|---------|---------|----------|
| GET | /api/public/doc-series | List | query: page(def:1), pageSize(def:20) | DocSeriesListResponse |
| GET | /api/public/doc-series/:id | Get | param: id(Sqids string) | DocSeriesResponse |
| GET | /api/public/doc-series/:id/articles | GetWithArticles | param: id(Sqids string) | DocSeriesWithArticles |

## Data Models

### AlbumResponse (Go handler inline struct)
```
id: uint, categoryId: *uint, imageUrl: string, bigImageUrl: string, downloadUrl: string,
thumbParam: string, bigParam: string, tags: string, viewCount: int, downloadCount: int,
fileSize: int64, format: string, aspectRatio: string, created_at: time, updated_at: time,
published_at: *time, width: int, height: int, widthAndHeight: string (computed "WxH"),
displayOrder: int, title: string, description: string, location: string
```

### AlbumCategoryDTO (Go model)
```
id: uint, name: string, description: string(omitempty), displayOrder: int
```
**IMPORTANT:** No cover_url, sort, or password fields. CONTEXT.md D-188 was incorrect.

### DocSeriesResponse
```
id: string(Sqids), created_at: time, updated_at: time, name: string, description: string,
cover_url: string, sort: int, doc_count: int
```

### DocSeriesListResponse
```
list: DocSeriesResponse[], total: int64, page: int, pageSize: int
```

### DocSeriesWithArticles
```
DocSeriesResponse + articles: DocArticleItem[]
```

### DocArticleItem
```
id: string(Sqids), title: string, abbrlink: string, doc_sort: int, created_at: time
```

## Business Logic Details

### CreateAlbum (CreateOrRestore pattern)
1. Compute effectiveFileHash: if fileHash non-empty use it; else SHA256(imageUrl)
2. Build Album model with all params, compute aspectRatio via gcd
3. applyDefaultAlbumParams: bigImageUrl defaults to imageUrl, downloadUrl defaults to imageUrl, thumbParam from settings, bigParam from settings
4. Call repo.CreateOrRestore(fileHash):
   - If not found → create new record → StatusCreated
   - If found + soft-deleted → restore + update fields → StatusRestored
   - If found + active → return existing → StatusExisted (error: "这张图片已存在，id是X，请勿重复添加")
5. On StatusCreated/StatusRestored: FindOrCreate tags
6. Apply defaults again on final result before returning

### applyDefaultAlbumParams
- bigImageUrl empty → bigImageUrl = imageUrl
- downloadUrl empty → downloadUrl = imageUrl
- thumbParam empty → read from settings key `'DEFAULT_THUMB_PARAM'`
- bigParam empty → read from settings key `'DEFAULT_BIG_PARAM'`

### getSimplifiedAspectRatioString(width, height)
- If width <= 0 or height <= 0 → "0:0"
- Compute gcd(width, height) → return "W/gcd:H/gcd"

### FindAlbums query options
- Sort modes: display_order_asc (default), created_at_asc, created_at_desc, view_count_desc
- Tag filter: SQL LIKE on comma-separated tags field (CONCAT(',',tags,',') LIKE '%,tag,%')
- Time range: created_at >= start AND created_at <= end
- Category filter: category_id = X

### BatchImportAlbums
1. Pre-load all existing fileHashes for dedup
2. For each URL (with displayOrder + i):
   a. fetchImageMetadata(url): HTTP GET with 60s timeout, decode image config for dimensions, SHA256 hash, format
   b. Check existingHashesMap → skip if duplicate
   c. Call CreateAlbum with imageUrl=bigImageUrl=bigImageUrl=downloadUrl=url
   d. Track success/fail/skip counts
3. Return BatchImportResult

### ExportAlbums
- ExportAlbumData: { version: "1.0", export_at, albums: ExportAlbumItem[], meta }
- ExportAlbumItem: all album fields with snake_case JSON keys
- If no album_ids specified → export all
- JSON format: direct JSON response with download headers
- ZIP format: albums.json + README.md in ZIP

### ImportAlbums
- From JSON: parse ExportAlbumData, iterate albums
- From ZIP: extract albums.json, then parse
- Pre-load existing categories for FK validation
- Pre-load existing hashes for dedup (effectiveAlbumFileHash)
- For each album: check dedup → validate categoryId → parse tags → CreateAlbum
- ImportAlbumResult: { total_count, success_count, skipped_count, failed_count, created_ids, errors }

### AlbumCategory Delete
- Check if any **active** album (deleted_at IS NULL) references this category → error "该分类下还有相册，无法删除"
- Otherwise hard delete the category (AlbumCategory has no SoftDeleteMixin)

### Album Delete (soft delete)
- Go backend uses SoftDeleteMixin on Album schema which intercepts DeleteOneID and converts to UpdateOneID setting deleted_at
- NestJS must implement as: UPDATE albums SET deleted_at = NOW() WHERE id = X (NOT a hard DELETE)
- findListByOptions and findById must filter WHERE deleted_at IS NULL
- createOrRestore queries must NOT filter by deleted_at (must find soft-deleted records for restore)
- findAllForDedup must include soft-deleted records for import dedup

### DocSeries Create
- Check name uniqueness → error if exists
- Create with all fields
- Return DocSeriesResponse with Sqids-encoded ID

### DocSeries Update
- If name changed → check uniqueness (excluding self)
- Partial update: only update non-nil fields
- Return DocSeriesResponse

### DocSeries Delete
- Check doc_count > 0 → error "无法删除，该系列下还有 N 篇文档"
- Otherwise delete

### DocSeries GetByIDWithArticles
- Decode Sqids publicID → dbID
- Query doc_series by dbID
- Query articles WHERE doc_series_id=dbID AND is_doc=true AND status=PUBLISHED AND deleted_at IS NULL
- Order by doc_sort ASC, created_at ASC
- Each article: encode ID with EntityType.Article, include abbrlink

### UpdateAlbumStat
- PUT /api/public/stat/:id?type=view|download
- IncrementViewCount or IncrementDownloadCount on album record

## Schema Status

### albums (album.schema.ts) — COMPLETE, no changes needed
All 20+ fields defined including fileHash(unique), categoryId(FK), deletedAt(soft delete)

### album_categories (album-category.schema.ts) — NEEDS UPDATE
Current: id, name, description, displayOrder
Go backend has same fields. **No cover_url/sort/password needed** (CONTEXT.md was wrong).

### doc_series (doc-series.schema.ts) — COMPLETE, no changes needed
All fields defined: id, createdAt, updatedAt, name, description, coverUrl, sort, docCount

### articles (article.schema.ts) — ALREADY HAS docSeriesId + docSort
Fields already exist: docSeriesId, docSort, isDoc + index idx_articles_doc

### Sqids — EntityType.DocSeries = 12 ALREADY EXISTS
No changes needed.

## Error Codes Needed

```typescript
// Phase 08 - Album error messages
ALBUM_NOT_FOUND: '相册不存在',
ALBUM_FILE_HASH_EXISTS: '这张图片已存在',
ALBUM_CATEGORY_NOT_FOUND: '相册分类不存在',
ALBUM_CATEGORY_NAME_EXISTS: '分类名称已存在',
ALBUM_CATEGORY_IN_USE: '该分类下还有相册，无法删除',
ALBUM_BATCH_IMPORT_FAILED: '批量导入失败',
ALBUM_EXPORT_FAILED: '导出失败',
ALBUM_IMPORT_FAILED: '导入失败',
ALBUM_IMPORT_FILE_INVALID: '不支持的文件格式',
ALBUM_STAT_TYPE_INVALID: '无效的统计类型',

// Phase 08 - DocSeries error messages
DOCSERIES_NOT_FOUND: '系列不存在',
DOCSERIES_NAME_EXISTS: '系列名称已存在',
DOCSERIES_HAS_DOCS: '无法删除，该系列下还有文档',
```

## Integration Points

1. AlbumModule → DatabaseModule (DRIZZLE token)
2. AlbumModule → SettingsModule (for default thumbParam/bigParam)
3. AlbumModule → ThumbnailModule (for thumbnail generation — already exists)
4. DocSeriesModule → DatabaseModule (DRIZZLE token)
5. DocSeriesModule needs to query articles table (doc_series_id, is_doc, doc_sort)
6. Public album endpoints go in a PublicAlbumController (or extend existing public controller)
7. Public doc-series endpoints go in DocSeriesController with @Public() decorator
8. Album stat endpoint PUT /api/public/stat/:id — in PublicAlbumController
9. Both modules register in AppModule

## Key Corrections vs CONTEXT.md

1. **D-188 AlbumCategoryDTO**: CONTEXT.md says cover_url/sort/password/album_count. **Actual Go model**: only id/name/description/displayOrder. No album_count in DTO either.
2. **D-187 Album schema**: CONTEXT.md says "published_at" field. **Confirmed**: Go ent schema has published_at as Optional/Nillable Time field.
3. **D-191 applyDefaultAlbumParams**: CONTEXT.md says "image_url empty → use big_image_url" and "published_at empty → use created_at". **Actual Go code**: Only bigImageUrl defaults to imageUrl, downloadUrl defaults to imageUrl, thumbParam from settings, bigParam from settings. No image_url←big_image_url reverse, no published_at default.
4. **D-192 Album query**: Sort field names confirmed: display_order_asc, created_at_asc, created_at_desc, view_count_desc.
5. **D-193 DocSeries public endpoints**: Go router shows `docSeriesPublic.GET("/:id/articles", ...)` not `GET("/:id/articles")`. The route is `:id/articles` not `:id/articles`.
