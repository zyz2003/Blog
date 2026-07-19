# Phase 12: Go Comparison Risk Marking

**Date:** 2026-07-19
**Source:** 12-API-INVENTORY.md (188 endpoints) + Go handler source comparison + Plan 02/03 test results
**Purpose:** Per D-280, mark risk level for each endpoint so Phases 13-15 can prioritize verification effort.

## Risk Grading Criteria

| Level | Definition | Examples |
|-------|-----------|----------|
| **HIGH** | Response format likely incompatible -- would break frontend | Field type mismatch, missing/extra fields, different nesting, Go implemented but NestJS 501, date format that breaks parsing |
| **MEDIUM** | Response format possibly incompatible -- may break frontend | Field nullability difference, value format difference ("" vs null), pagination structure difference, error message wording |
| **LOW** | Minor difference unlikely to break frontend | Date precision (RFC3339 vs ISO 8601), field ordering, non-functional header difference |
| **NONE** | Verified compatible | Test passes with field-by-field verification, identical response structure |

## Cross-Cutting Risk Patterns

These patterns apply across multiple modules and are documented once here rather than repeated per-endpoint.

### CCP-1: created_at/updated_at nullability (MEDIUM)

- **Go:** `time.Time` (non-pointer) -- never null, serializes as RFC3339 string (e.g., "2026-07-19T12:00:00Z"). Zero value is "0001-01-01T00:00:00Z".
- **NestJS:** `toISODateString(date)` -- returns `null` if date is null/undefined, otherwise ISO 8601 string (e.g., "2026-07-19T12:00:00.000Z").
- **Risk:** If SQLite DB has null created_at/updated_at, NestJS returns null while Go returns RFC3339 string. Frontend may break if it expects non-null.
- **Applies to:** All endpoints returning entities with created_at/updated_at fields (articles, pages, comments, categories, tags, albums, doc-series, links, storage policies, user groups).
- **Phase to fix:** Phase 13 (verify DB schema has NOT NULL constraints, or NestJS returns zero-time string instead of null).

### CCP-2: Date precision difference (LOW)

- **Go:** `time.Time` serializes as RFC3339 without milliseconds (e.g., "2026-07-19T12:00:00Z").
- **NestJS:** `.toISOString()` produces ISO 8601 with milliseconds (e.g., "2026-07-19T12:00:00.000Z").
- **Risk:** Frontend parsers handle both formats. Unlikely to break anything.
- **Applies to:** All date fields across all modules.
- **Phase to fix:** None needed (LOW risk, frontend handles both).

### CCP-3: ID type consistency (NONE)

- **Go:** Uses Sqids for public IDs (string type in JSON). Raw DB IDs (uint) only exposed for userGroupID.
- **NestJS:** Uses same Sqids encoding. userGroupID also exposed as raw number.
- **Risk:** None -- both use identical ID encoding.
- **Applies to:** All endpoints.

### CCP-4: Response wrapper format (NONE)

- **Go:** `response.Success(c, data, message)` produces `{ code: 200, message: "...", data: ... }`.
- **NestJS:** ResponseInterceptor produces identical `{ code: 200, message: "...", data: ... }`.
- **Risk:** None -- wrapper format is identical.
- **Applies to:** All endpoints.

---

## Auth Module (9 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 1 | POST /api/auth/login | NONE | Verified compatible via Plan 02 field-by-field test | LoginUserInfoResponse with all 13 userInfo fields, expires as int64 | Identical structure, expires as string (frontend expects string) | -- |
| 2 | POST /api/auth/register | HIGH (business decision needed) | Go implemented, NestJS 501 | auth_handler.Register creates user, sends activation email | Returns 501 { code: 501, message: "...", data: null } | Phase 15 decision |
| 3 | GET /api/auth/check-email | HIGH (business decision needed) | Go implemented, NestJS 501 | auth_handler.CheckEmail returns { exists: bool } | Returns 501 | Phase 15 decision |
| 4 | POST /api/auth/refresh-token | NONE | Verified compatible via Plan 02 dual-channel test | Header first, body fallback, returns { accessToken, expires } | Identical dual-channel logic, expires as string | -- |
| 5 | POST /api/auth/forgot-password | HIGH (business decision needed) | Go implemented, NestJS 501 | auth_handler.ForgotPasswordRequest sends reset email | Returns 501 | Phase 15 decision |
| 6 | POST /api/auth/reset-password | HIGH (business decision needed) | Go implemented, NestJS 501 | auth_handler.ResetPassword resets password | Returns 501 | Phase 15 decision |
| 7 | POST /api/auth/activate | HIGH (business decision needed) | Go implemented, NestJS 501 | auth_handler.ActivateUser activates account, returns login response | Returns 501 | Phase 15 decision |
| 8 | GET /api/public/captcha/config | NONE | Verified compatible via Plan 02 captcha test | Returns { provider, turnstile_site_key?, geetest_captcha_id?, image_captcha_length? } | Identical structure | -- |
| 9 | GET /api/public/captcha/image | NONE | Verified compatible via Plan 02 captcha test | Returns { captcha_id, image_base64 } | Identical structure | -- |

**Auth module notes:**
- expires format (Go int64 vs NestJS string): Plan 02 verified frontend expects string, NestJS returns string. Risk: NONE.
- 5 auth 501 endpoints: If business decision is to keep registration disabled, these are intentional feature differences, not compatibility gaps. Marked "HIGH (business decision needed)" per plan instructions.

---

## Settings Module (5 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 10 | POST /api/settings/get-by-keys | MEDIUM | Non-admin filtering logic difference | Go filters public keys before calling GetByKeys | NestJS filters inside getByKeys() method | Phase 13 |
| 11 | POST /api/settings/update | NONE | Verified compatible via Plan 03 test | Accepts flat map[string]string body | Accepts flat key-value body (Plan 03 fixed test format) | -- |
| 12 | POST /api/settings/test-email | HIGH (business decision needed) | Go implemented, NestJS 501 | setting_handler.TestEmail sends test email | Returns 501 | Phase 15 decision |
| 13 | GET /api/public/site-config | NONE | Verified compatible via Plan 03 test | Returns unflattened public settings with _config_version | Identical structure, 249 public keys (Plan 03 fixed 57 private key exposure) | -- |
| 14 | GET /api/public/site-config/version | NONE | Verified compatible via Plan 03 test | Returns { version: int64 } (UnixMilli) | Returns { version: number } (UnixMilli) | -- |

**Settings module notes:**
- getByKeys non-admin filtering: Both produce same result but filtering logic path differs. Plan 03 verified non-admin JWT correctly excludes private keys. MEDIUM because edge cases may exist.
- Update body format: Plan 03 confirmed flat format { KEY: "value" } matches Go and frontend. Previously test used wrong wrapped format -- now fixed.
- 57 private keys exposure: Plan 03 fixed security bug where private keys (JWT_SECRET, SMTP credentials, etc.) were in PUBLIC_SETTING_KEYS. Now removed.

---

## Config/Backup Module (7 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 15 | GET /api/config/export | DEFERRED | New feature, not in verification scope (D-250) | configImportExportHandler.ExportConfig returns Blob | MISSING -- no controller route | Deferred |
| 16 | POST /api/config/import | DEFERRED | New feature, not in verification scope (D-251) | configImportExportHandler.ImportConfig accepts FormData | MISSING -- no controller route | Deferred |
| 17 | GET /api/config/backup/list | LOW | created_at/updated_at nullability (CCP-1) | Returns BackupInfo[] with time.Time dates | Returns backup list with ISO dates | Phase 13 |
| 18 | POST /api/config/backup/create | LOW | created_at/updated_at nullability (CCP-1) | Returns BackupInfo with time.Time dates | Returns backup with ISO dates | Phase 13 |
| 19 | POST /api/config/backup/restore | NONE | Simple void response | Returns void | Returns void | -- |
| 20 | POST /api/config/backup/delete | NONE | Simple void response | Returns void | Returns void | -- |
| 21 | POST /api/config/backup/clean | NONE | Simple void response | Returns void | Returns void | -- |

---

## Article Public Module (12 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 22 | GET /api/public/articles | MEDIUM | ArticleResponse created_at/updated_at nullability (CCP-1); pagination structure | ArticleListResponse { list, total, page, pageSize } | Same structure, but created_at/updated_at can be null | Phase 13 |
| 23 | GET /api/post-categories | MEDIUM | PostCategoryResponse created_at/updated_at nullability (CCP-1) | PostCategory[] with time.Time (never null) | PostCategory[] with string\|null dates | Phase 13 |
| 24 | GET /api/post-tags | MEDIUM | PostTagResponse created_at/updated_at nullability (CCP-1) | PostTag[] with time.Time (never null) | PostTag[] with string\|null dates | Phase 13 |
| 25 | POST /api/post-categories | MEDIUM | PostCategoryResponse created_at/updated_at nullability (CCP-1) | Returns PostCategory with time.Time | Returns PostCategory with string\|null | Phase 13 |
| 26 | POST /api/post-tags | MEDIUM | PostTagResponse created_at/updated_at nullability (CCP-1) | Returns PostTag with time.Time | Returns PostTag with string\|null | Phase 13 |
| 27 | PUT /api/post-categories/:id | MEDIUM | PostCategoryResponse created_at/updated_at nullability (CCP-1) | Returns PostCategory with time.Time | Returns PostCategory with string\|null | Phase 13 |
| 28 | PUT /api/post-tags/:id | MEDIUM | PostTagResponse created_at/updated_at nullability (CCP-1) | Returns PostTag with time.Time | Returns PostTag with string\|null | Phase 13 |
| 29 | DELETE /api/post-categories/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 30 | DELETE /api/post-tags/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 31 | GET /api/public/articles/statistics | MEDIUM | ArticleStatistics has extra fields in Go | Go returns { total_posts, total_words, avg_words, total_views, category_stats, tag_stats, top_viewed_posts, publish_trend } | Frontend only uses total_posts, total_words; extra fields may differ | Phase 13 |
| 32 | GET /api/public/articles/random | MEDIUM | ArticleResponse created_at/updated_at nullability (CCP-1) | Returns ArticleResponse with time.Time | Returns with string\|null | Phase 13 |
| 33 | GET /api/public/articles/archives | NONE | ArchiveSummaryResponse structure matches | { list: [{ year, month, count }] } | Same structure | -- |

---

## Article Admin Module (13 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 34 | GET /api/articles | MEDIUM | ArticleResponse created_at/updated_at nullability (CCP-1) | ArticleListResponse with time.Time dates | Same structure, dates can be null | Phase 13 |
| 35 | GET /api/articles/:id | MEDIUM | ArticleResponse created_at/updated_at nullability (CCP-1) | ArticleResponse with time.Time dates | Same structure, dates can be null | Phase 13 |
| 36 | DELETE /api/articles/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 37 | DELETE /api/articles/batch | NONE | BatchDeleteResult structure matches | { success_count, failed_count, failed_ids } | Same structure | -- |
| 38 | POST /api/articles | MEDIUM | ArticleResponse created_at/updated_at nullability (CCP-1) | Returns ArticleResponse with time.Time | Returns with string\|null | Phase 13 |
| 39 | PUT /api/articles/:id | MEDIUM | ArticleResponse created_at/updated_at nullability (CCP-1) | Returns ArticleResponse with time.Time | Returns with string\|null | Phase 13 |
| 40 | POST /api/articles/upload | NONE | Upload response structure matches | { url, file_id } | Same structure | -- |
| 41 | POST /api/articles/export | NONE | Returns ZIP blob | application/zip response | Same behavior | -- |
| 42 | POST /api/articles/import | MEDIUM | ImportResult field names may differ | ImportResult { total_count, success_count, skipped_count, failed_count } | Need to verify field names match | Phase 13 |
| 43 | GET /api/articles/:id/history | LOW | Date nullability (CCP-1) | ArticleHistoryListResponse with time.Time | Same structure, dates can be null | Phase 13 |
| 44 | GET /api/articles/:id/history/:version | LOW | Date nullability (CCP-1) | ArticleHistoryDetail with time.Time | Same structure, dates can be null | Phase 13 |
| 45 | POST /api/articles/:id/history/:version/restore | LOW | Date nullability (CCP-1) | ArticleHistoryDetail with time.Time | Same structure, dates can be null | Phase 13 |
| 46 | GET /api/articles/:id/history/count | NONE | Simple { count } response | { count: int } | Same structure | -- |

---

## Page Module (7 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 47 | GET /api/pages | MEDIUM | Page created_at/updated_at nullability (CCP-1) | PageListResponse with time.Time dates | Same structure, dates can be null | Phase 13 |
| 48 | GET /api/pages/:id | MEDIUM | Page created_at/updated_at nullability (CCP-1) | Page with time.Time dates | Same structure, dates can be null | Phase 13 |
| 49 | POST /api/pages | MEDIUM | Page created_at/updated_at nullability (CCP-1) | Returns Page with time.Time | Returns with string\|null | Phase 13 |
| 50 | PUT /api/pages/:id | MEDIUM | Page created_at/updated_at nullability (CCP-1) | Returns Page with time.Time | Returns with string\|null | Phase 13 |
| 51 | DELETE /api/pages/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 52 | POST /api/pages/initialize | NONE | Simple void response | Returns void | Returns void | -- |
| 53 | GET /api/public/pages/:path | MEDIUM | Page created_at/updated_at nullability (CCP-1) | Page with time.Time dates | Same structure, dates can be null | Phase 13 |

---

## File Manager Module (24 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 54 | GET /api/file | MEDIUM | FileListResponse structure: pagination uses page_size vs pageSize | Go Pagination { page, page_size, next_token, is_cursor } | Need to verify NestJS uses same field names | Phase 13 |
| 55 | PUT /api/file/upload | LOW | CreateUploadSessionResponse structure | Returns session info | Need to verify field names | Phase 13 |
| 56 | POST /api/file/upload/:sessionId/:index | NONE | Chunk upload, simple response | Returns upload status | Same behavior | -- |
| 57 | DELETE /api/file/upload | NONE | Delete session, simple response | Returns void | Same behavior | -- |
| 58 | POST /api/file/upload/finalize | LOW | Finalize response field names | { file_id, name, size } | Need to verify field names | Phase 13 |
| 59 | POST /api/file/create | NONE | Create empty file/dir | Returns file info | Same behavior | -- |
| 60 | PUT /api/folder/view | LOW | UpdateFolderViewResponse structure | Returns updated view config | Need to verify structure | Phase 13 |
| 61 | GET /api/file/upload/session/:sessionId | LOW | ValidateUploadSessionResponse structure | Returns session status | Need to verify structure | Phase 13 |
| 62 | DELETE /api/file | NONE | Delete items, simple response | Returns void | Same behavior | -- |
| 63 | PUT /api/file/rename | NONE | Rename item, simple response | Returns updated file info | Same behavior | -- |
| 64 | GET /api/file/:id | MEDIUM | FileInfoResponse structure: storagePolicy field naming | Go: { file, storagePolicy } | Need to verify NestJS uses same camelCase key | Phase 13 |
| 65 | GET /api/file/download-info/:id | LOW | DownloadInfo structure | Returns download credentials | Need to verify structure | Phase 13 |
| 66 | GET /api/file/download/:id | NONE | Returns file blob | application/octet-stream | Same behavior | -- |
| 67 | GET /api/folder/tree/:id | MEDIUM | FolderTreeResponse has expires as time.Time | Go: { folder_name, files, expires: time.Time } | NestJS: expires may be string or null | Phase 13 |
| 68 | GET /api/folder/size/:id | NONE | FolderSize structure matches | { logicalSize, storageConsumption, fileCount } | Same structure | -- |
| 69 | POST /api/folder/move | NONE | Simple void response | Returns null | Same behavior | -- |
| 70 | POST /api/folder/copy | NONE | Simple void response | Returns null | Same behavior | -- |
| 71 | POST /api/direct-links | LOW | CreateDirectLinksResponse structure | Returns direct link URLs | Need to verify structure | Phase 13 |
| 72 | GET /api/file/preview-urls | LOW | FilePreviewUrlsResponse structure | Returns preview URL list | Need to verify structure | Phase 13 |
| 73 | GET /api/thumbnail/:publicId | LOW | GetThumbnailCredentialResponse structure | Returns signed thumbnail URL | Need to verify structure | Phase 13 |
| 74 | POST /api/thumbnail/regenerate | NONE | Simple { status } response | { status } | Same structure | -- |
| 75 | PUT /api/file/content/:publicId | LOW | UpdateFileContentData structure | Returns updated file info | Need to verify structure | Phase 13 |
| 76 | POST /api/thumbnail/regenerate/directory | NONE | Simple { filesToProcess } response | { filesToProcess } | Same structure | -- |
| 77 | POST /api/files/share/create | N/A | Frontend-only definition, Go also lacks | N/A | MISSING (Go also lacks) | N/A |

**File module notes:**
- File manager is the most complex module with 24 endpoints. Most are LOW risk because they return simple status objects or blobs.
- Key MEDIUM risks: pagination field naming (page_size vs pageSize), FolderTreeResponse.expires type, FileInfoResponse.storagePolicy field naming.
- Endpoint #77 is a frontend-only definition with no Go backend route -- not a compatibility gap.

---

## Comment Public Module (8 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 78 | GET /api/public/comments/latest | MEDIUM | Comment Response created_at nullability (CCP-1); ListResponse has extra total_with_children field | ListResponse { list, total, total_with_children, page, pageSize, has_more } | Need to verify total_with_children and has_more fields | Phase 13 |
| 79 | GET /api/public/comments | MEDIUM | Same as #78 | Same ListResponse structure | Need to verify extra fields | Phase 13 |
| 80 | GET /api/public/comments/:id/children | MEDIUM | Same as #78 | Same ListResponse structure | Need to verify extra fields | Phase 13 |
| 81 | POST /api/public/comments | MEDIUM | Comment Response created_at nullability (CCP-1) | Returns Comment Response with time.Time | Returns with string\|null | Phase 13 |
| 82 | POST /api/public/comments/:id/like | NONE | Returns like count number | Returns number | Same behavior | -- |
| 83 | POST /api/public/comments/:id/unlike | NONE | Returns like count number | Returns number | Same behavior | -- |
| 84 | POST /api/public/comments/upload | NONE | UploadImageResponse { id } | Returns { id } | Same structure | -- |
| 85 | GET /api/public/comments/qq-info | LOW | QQInfoResponse structure | Returns QQ avatar/name info | Need to verify structure | Phase 13 |

**Comment module notes:**
- Go ListResponse has `total_with_children` and `has_more` fields that may not be in NestJS response. These are extra fields -- frontend may or may not use them. MEDIUM risk because missing fields could break frontend pagination logic.

---

## Comment Admin Module (8 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 86 | GET /api/comments | MEDIUM | Same ListResponse extra fields as public comments | ListResponse with total_with_children, has_more | Need to verify | Phase 13 |
| 87 | DELETE /api/comments | NONE | Simple void response | Returns void | Returns void | -- |
| 88 | PUT /api/comments/:id/status | NONE | Simple void response | Returns void | Returns void | -- |
| 89 | PUT /api/comments/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 90 | PUT /api/comments/:id/info | NONE | Simple void response | Returns void | Returns void | -- |
| 91 | PUT /api/comments/:id/pin | NONE | Simple void response | Returns void | Returns void | -- |
| 92 | POST /api/comments/export | NONE | Returns blob | Returns blob | Same behavior | -- |
| 93 | POST /api/comments/import | MEDIUM | ImportResult field names may differ | ImportResult { total_count, success_count, skipped_count, failed_count, error_messages } | Need to verify field names | Phase 13 |

---

## Friends/Links Module (25 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 94 | GET /api/links | MEDIUM | LinkDTO.id is int in Go, may be string in NestJS (Sqids) | LinkDTO { id: int, name, url, ... } | Need to verify ID type | Phase 14 |
| 95 | POST /api/links | MEDIUM | Same ID type question | Returns LinkDTO | Need to verify | Phase 14 |
| 96 | PUT /api/links/:id | MEDIUM | Same ID type question | Returns LinkDTO | Need to verify | Phase 14 |
| 97 | DELETE /api/links/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 98 | DELETE /api/links/batch-delete | MEDIUM | BatchDeleteLinksResponse structure | { total, success, failed, failed_list } | Need to verify structure | Phase 14 |
| 99 | PUT /api/links/:id/review | NONE | Simple void response | Returns void | Returns void | -- |
| 100 | GET /api/links/categories | MEDIUM | LinkCategoryDTO.id is int in Go | LinkCategoryDTO { id: int, name, style, description } | Need to verify ID type | Phase 14 |
| 101 | POST /api/links/categories | MEDIUM | Same ID type question | Returns LinkCategoryDTO | Need to verify | Phase 14 |
| 102 | PUT /api/links/categories/:id | MEDIUM | Same ID type question | Returns LinkCategoryDTO | Need to verify | Phase 14 |
| 103 | DELETE /api/links/categories/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 104 | GET /api/links/tags | MEDIUM | LinkTagDTO.id is int in Go | LinkTagDTO { id: int, name, color } | Need to verify ID type | Phase 14 |
| 105 | POST /api/links/tags | MEDIUM | Same ID type question | Returns LinkTagDTO | Need to verify | Phase 14 |
| 106 | PUT /api/links/tags/:id | MEDIUM | Same ID type question | Returns LinkTagDTO | Need to verify | Phase 14 |
| 107 | DELETE /api/links/tags/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 108 | POST /api/links/import | MEDIUM | ImportLinksResponse structure | { total, success, failed, skipped, success_list, failed_list, skipped_list } | Need to verify structure | Phase 14 |
| 109 | GET /api/links/export | MEDIUM | ExportLinksResponse structure | { links, total } | Need to verify structure | Phase 14 |
| 110 | POST /api/links/health-check | MEDIUM | LinkHealthCheckResponse structure | { total, healthy, unhealthy, unhealthy_ids: []int } | Need to verify structure and ID type | Phase 14 |
| 111 | GET /api/links/health-check/status | MEDIUM | Same as #110 | Same structure | Need to verify | Phase 14 |
| 112 | PUT /api/links/sort | NONE | Simple void response | Returns void | Returns void | -- |
| 113 | GET /api/public/links | MEDIUM | PublicLinkListResponse + LinkDTO ID type | LinkListResponse with LinkDTO | Need to verify | Phase 14 |
| 114 | POST /api/public/links | NONE | Simple void response | Returns void | Returns void | -- |
| 115 | GET /api/public/links/check-exists | NONE | CheckLinkExistsResponse matches | { exists, url } | Same structure | -- |
| 116 | GET /api/public/links/random | MEDIUM | LinkDTO ID type | Returns LinkItem[] | Need to verify ID type | Phase 14 |
| 117 | GET /api/public/link-categories | MEDIUM | LinkCategoryDTO ID type | Returns LinkCategory[] | Need to verify | Phase 14 |
| 118 | GET /api/public/links/applications | MEDIUM | LinkListResponse + LinkDTO ID type | LinkListResponse | Need to verify | Phase 14 |

**Links module notes:**
- Go LinkDTO uses `id: int` (raw DB ID), while NestJS may use Sqids (string). This is a significant difference -- the frontend may expect int IDs for links. Need to verify in Phase 14.
- Go LinkCategoryDTO and LinkTagDTO also use `id: int`. Same concern.

---

## Album Module (15 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 119 | GET /api/albums/get | MEDIUM | Album created_at/updated_at nullability (CCP-1); Album uses camelCase fields | Album { id: uint, created_at, updated_at, imageUrl, bigImageUrl, ... } | Need to verify field naming (camelCase vs snake_case) | Phase 14 |
| 120 | POST /api/albums/add | NONE | Simple void response | Returns void | Returns void | -- |
| 121 | PUT /api/albums/update/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 122 | DELETE /api/albums/delete/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 123 | DELETE /api/albums/batch-delete | NONE | Simple { deleted } response | { deleted } | Same structure | -- |
| 124 | GET /api/album-categories | MEDIUM | AlbumCategoryDTO field naming (camelCase) | AlbumCategoryDTO { id: uint, name, description, displayOrder } | Need to verify field naming | Phase 14 |
| 125 | POST /api/album-categories | MEDIUM | Same field naming question | Returns AlbumCategoryDTO | Need to verify | Phase 14 |
| 126 | PUT /api/album-categories/:id | MEDIUM | Same field naming question | Returns AlbumCategoryDTO | Need to verify | Phase 14 |
| 127 | DELETE /api/album-categories/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 128 | POST /api/albums/batch-import | MEDIUM | BatchImportAlbumsResult structure | Returns import result | Need to verify structure | Phase 14 |
| 129 | POST /api/albums/import | MEDIUM | ImportAlbumsResult structure | Returns import result | Need to verify structure | Phase 14 |
| 130 | POST /api/albums/export | NONE | Returns blob | Returns blob | Same behavior | -- |
| 131 | GET /api/public/albums | MEDIUM | Album camelCase field naming | PublicAlbumListData with Album fields | Need to verify field naming | Phase 14 |
| 132 | GET /api/public/album-categories | MEDIUM | AlbumCategoryDTO field naming | PublicAlbumCategory[] | Need to verify | Phase 14 |
| 133 | PUT /api/public/stat/:id | NONE | Simple void response | Returns void | Returns void | -- |

**Album module notes:**
- Go Album model uses camelCase JSON tags (imageUrl, bigImageUrl, downloadUrl, etc.) while most other Go models use snake_case. This is a Go inconsistency. NestJS may normalize to snake_case, which would break the frontend that expects camelCase for album fields. This is a HIGH-risk concern within the MEDIUM category.

---

## Doc Series Module (5 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 134 | GET /api/doc-series | MEDIUM | DocSeriesResponse created_at/updated_at nullability (CCP-1) | DocSeriesListResponse with time.Time dates | Same structure, dates can be null | Phase 14 |
| 135 | POST /api/doc-series | MEDIUM | DocSeriesResponse created_at/updated_at nullability (CCP-1) | Returns DocSeriesResponse with time.Time | Returns with string\|null | Phase 14 |
| 136 | PUT /api/doc-series/:id | MEDIUM | DocSeriesResponse created_at/updated_at nullability (CCP-1) | Returns DocSeriesResponse with time.Time | Returns with string\|null | Phase 14 |
| 137 | DELETE /api/doc-series/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 138 | GET /api/public/doc-series/:id/articles | MEDIUM | DocSeriesWithArticles created_at nullability (CCP-1) | DocSeriesWithArticles with time.Time dates | Same structure, dates can be null | Phase 14 |

---

## Music Module (1 endpoint)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 139 | GET /api/public/music/playlist | LOW | Response structure: Go uses gin.H{ songs, total } | { songs: [], total: int } | Need to verify structure matches | Phase 14 |

---

## Storage Policy Module (7 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 140 | GET /api/policies | MEDIUM | StoragePolicyResponse created_at/updated_at nullability (CCP-1); ID type | StoragePolicyResponse { id: string, created_at: time.Time, ... } | Need to verify ID type and date format | Phase 14 |
| 141 | GET /api/policies/:id | MEDIUM | Same as #140 | StoragePolicyResponse | Need to verify | Phase 14 |
| 142 | POST /api/policies | NONE | Simple void response | Returns void | Returns void | -- |
| 143 | PUT /api/policies/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 144 | DELETE /api/policies/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 145 | GET /api/policies/connect/onedrive/:id | HIGH (business decision needed) | Go implemented, NestJS 501 | storage_policy_handler.ConnectOneDrive returns auth URL | Returns 501 | Phase 15 decision |
| 146 | POST /api/policies/authorize/onedrive | HIGH (business decision needed) | Go implemented, NestJS 501 | storage_policy_handler.AuthorizeOneDrive completes auth | Returns 501 | Phase 15 decision |

---

## User Management Module (7 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 147 | GET /api/admin/users | MEDIUM | User response created_at/updated_at nullability (CCP-1); userGroupID type | AdminUserListResponse with time.Time dates, userGroupID: uint | Need to verify userGroupID is number not string | Phase 14 |
| 148 | POST /api/admin/users | MEDIUM | AdminUser created_at/updated_at nullability (CCP-1) | Returns AdminUser with time.Time | Returns with string\|null | Phase 14 |
| 149 | PUT /api/admin/users/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 150 | DELETE /api/admin/users/:id | NONE | Simple void response | Returns void | Returns void | -- |
| 151 | POST /api/admin/users/:id/reset-password | NONE | Simple void response | Returns void | Returns void | -- |
| 152 | PUT /api/admin/users/:id/status | NONE | Simple void response | Returns void | Returns void | -- |
| 153 | GET /api/admin/user-groups | MEDIUM | UserGroup.description: Go string (""), NestJS string\|null | UserGroup { id, name, description: string } | description can be null | Phase 14 |

**User module notes:**
- UserGroup.description: Go uses `string` type (zero value ""), NestJS uses `string | null`. If DB has null, NestJS returns null while Go returns "". This is a known MEDIUM risk from research.
- userGroupID: Go uses `uint` (number in JSON), matching frontend type `number`. NestJS should also return number. Need to verify.

---

## User Center Module (5 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 154 | PUT /api/user/profile | NONE | Simple void response | Returns null | Returns null | -- |
| 155 | POST /api/user/update-password | NONE | Simple void response | Returns null | Returns null | -- |
| 156 | POST /api/user/avatar | LOW | UploadAvatarResponseData structure | Returns avatar URL info | Need to verify structure | Phase 14 |
| 157 | GET /api/user/notification-settings | LOW | UserNotificationSettings structure | Returns notification settings | Need to verify structure | Phase 14 |
| 158 | PUT /api/user/notification-settings | NONE | Simple void response | Returns null | Returns null | -- |

---

## Statistics/Admin Module (6 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 159 | GET /api/statistics/summary | MEDIUM | StatisticsSummary structure may differ | Returns summary stats | Need to verify structure | Phase 14 |
| 160 | GET /api/public/statistics/basic | NONE | VisitorStatistics structure matches Go model | { today_visitors, today_views, yesterday_visitors, yesterday_views, month_views, year_views } | Same structure | -- |
| 161 | POST /api/public/statistics/visit | NONE | Simple void response | Returns void | Returns void | -- |
| 162 | GET /api/statistics/trend | MEDIUM | VisitorTrendData.Date is time.Time in Go | { daily, weekly, monthly: [{ date: time.Time, visitors, views }] } | date field may be string or null | Phase 14 |
| 163 | GET /api/statistics/analytics | MEDIUM | VisitorAnalytics structure | { top_countries, top_cities, top_browsers, top_os, top_devices, top_referers } | Need to verify structure | Phase 14 |
| 164 | GET /api/statistics/top-pages | MEDIUM | URLStatistics.last_visited_at is *time.Time in Go | URLStatistics[] with last_visited_at: *time.Time | last_visited_at may differ | Phase 14 |

---

## Theme Mall Module (20 endpoints)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 165-184 | All 20 theme/ssr-theme endpoints | HIGH | No NestJS implementation at all | Go has full theme handler + SSR theme handler | MISSING -- no theme controller in NestJS | Future phase |

**Theme module notes:**
- All 20 theme endpoints are MISSING in NestJS. Go has full implementations for theme management (install, switch, uninstall, upload, validate, settings, config) and SSR theme management (install, list, uninstall, start, stop, status).
- These are HIGH risk because the frontend admin panel has a full theme management UI that calls these endpoints.
- However, theme management is a complex feature that may be deferred to a future phase beyond Phase 15.

---

## Changelog Module (1 endpoint)

| # | Endpoint | Risk | Issue | Go Behavior | NestJS Behavior | Phase to Fix |
|---|----------|------|-------|-------------|-----------------|--------------|
| 185 | GET (external changelog API) | N/A | External API, not proxied through backend | N/A | N/A | N/A |

---

## Prioritized Risk Summary

### Phase 13 (Content Verification) Priority List

Content-related endpoints ranked by risk level. Verify HIGH risk first with field-by-field comparison, then MEDIUM, then LOW/NONE with lighter touch.

**MEDIUM risk (verify with field-by-field comparison):**

| Priority | Endpoints | Key Risk |
|----------|-----------|----------|
| 1 | #22 GET /api/public/articles | ArticleResponse created_at/updated_at nullability; pagination structure |
| 2 | #34 GET /api/articles | Same as #22 |
| 3 | #35 GET /api/articles/:id | Same as #22 |
| 4 | #38 POST /api/articles | Same as #22 |
| 5 | #39 PUT /api/articles/:id | Same as #22 |
| 6 | #23 GET /api/post-categories | PostCategoryResponse date nullability |
| 7 | #24 GET /api/post-tags | PostTagResponse date nullability |
| 8 | #25-28 POST/PUT categories & tags | Same date nullability |
| 9 | #31 GET /api/public/articles/statistics | ArticleStatistics extra fields |
| 10 | #32 GET /api/public/articles/random | ArticleResponse date nullability |
| 11 | #42 POST /api/articles/import | ImportResult field names |
| 12 | #47-50, #53 Pages CRUD + public | Page date nullability |
| 13 | #54 GET /api/file | Pagination field naming (page_size vs pageSize) |
| 14 | #64 GET /api/file/:id | FileInfoResponse.storagePolicy field naming |
| 15 | #67 GET /api/folder/tree/:id | FolderTreeResponse.expires type |
| 16 | #78-81 Public comments | ListResponse extra fields (total_with_children, has_more) |
| 17 | #86 GET /api/comments | Same ListResponse extra fields |
| 18 | #93 POST /api/comments/import | ImportResult field names |

**LOW risk (verify response structure):**

| Priority | Endpoints | Key Risk |
|----------|-----------|----------|
| 1 | #43-45 Article history | Date nullability |
| 2 | #55, #58, #60, #61 File upload/finalize/view/session | Response structure verification |
| 3 | #65, #71, #72, #73, #75 File detail/links/preview | Response structure verification |
| 4 | #85 GET /api/public/comments/qq-info | QQInfoResponse structure |

**NONE risk (confirm response structure only):**

| Priority | Endpoints | Key Risk |
|----------|-----------|----------|
| 1 | #29, #30 Delete category/tag | Void response |
| 2 | #33 GET /api/public/articles/archives | Verified structure match |
| 3 | #36, #37 Delete article/batch | Void/batch result |
| 4 | #40 POST /api/articles/upload | Verified { url, file_id } |
| 5 | #41 POST /api/articles/export | Blob response |
| 6 | #46 GET /api/articles/:id/history/count | Simple { count } |
| 7 | #51, #52 Delete/initialize page | Void response |
| 8 | #56, #57, #59, #62, #63 File chunk/delete/create/rename | Simple responses |
| 9 | #66, #68-70, #74, #76 File download/size/move/copy/thumbnail | Simple responses |
| 10 | #77 POST /api/files/share/create | N/A (frontend-only) |
| 11 | #82-84 Comment like/unlike/upload | Simple responses |
| 12 | #87-92 Comment admin CRUD | Void responses |

### Phase 14 (Features Verification) Priority List

Feature-related endpoints ranked by risk level.

**HIGH risk (must verify first):**

| Priority | Endpoints | Key Risk |
|----------|-----------|----------|
| 1 | #165-184 All 20 theme endpoints | MISSING -- no NestJS implementation |

**MEDIUM risk (verify with field-by-field comparison):**

| Priority | Endpoints | Key Risk |
|----------|-----------|----------|
| 1 | #94-96, #98, #100-102, #104-106 Links CRUD | LinkDTO.id type (int vs string/Sqids) |
| 2 | #108, #109 Links import/export | Response structure |
| 3 | #110, #111 Links health-check | LinkHealthCheckResponse structure |
| 4 | #113, #116-118 Public links | LinkDTO ID type |
| 5 | #119, #131 Public albums | Album camelCase field naming |
| 6 | #124-126 Album categories | AlbumCategoryDTO field naming |
| 7 | #128, #129 Album import | Import result structure |
| 8 | #134-136, #138 Doc series | Date nullability |
| 9 | #140, #141 Storage policies | Date nullability, ID type |
| 9 | #147, #148 User management | Date nullability, userGroupID type |
| 10 | #153 User groups | description nullability |
| 11 | #159, #162-164 Statistics | Date fields, structure verification |

**LOW risk (verify response structure):**

| Priority | Endpoints | Key Risk |
|----------|-----------|----------|
| 1 | #139 GET /api/public/music/playlist | Response structure |
| 2 | #156 POST /api/user/avatar | UploadAvatarResponseData structure |
| 3 | #157 GET /api/user/notification-settings | NotificationSettings structure |

**NONE risk (confirm response structure only):**

| Priority | Endpoints | Key Risk |
|----------|-----------|----------|
| 1 | #97, #99, #103, #107, #112 Links delete/review/sort | Void responses |
| 2 | #114, #115 Public links apply/check | Void/simple response |
| 2 | #120-123, #127, #130, #133 Album add/update/delete/export/stat | Void/simple responses |
| 3 | #137 DELETE /api/doc-series/:id | Void response |
| 4 | #142-144 Storage policy create/update/delete | Void responses |
| 5 | #149-152 User update/delete/reset-password/status | Void responses |
| 6 | #154, #155, #158 User profile/password/notification | Void responses |
| 7 | #160, #161 Statistics basic/visit | Verified/simple responses |

### Phase 15 (Final Integration) Must-Fix List

These HIGH risk items must be resolved before production cutover. They would break the frontend.

| # | Item | Risk | Resolution |
|---|------|------|------------|
| 1 | created_at/updated_at nullability (CCP-1) | MEDIUM (cross-cutting) | Verify DB has NOT NULL constraints OR NestJS returns zero-time string instead of null. Affects 50+ endpoints. |
| 2 | Album camelCase field naming | MEDIUM (may be HIGH) | Verify NestJS returns camelCase (imageUrl, bigImageUrl, etc.) matching Go, not snake_case. Frontend expects camelCase for album fields. |
| 3 | Link/LinkCategory/LinkTag ID type | MEDIUM (may be HIGH) | Verify NestJS returns int IDs for links (matching Go LinkDTO.id: int), not Sqids strings. Frontend may expect int. |
| 4 | Comment ListResponse extra fields | MEDIUM | Verify NestJS includes total_with_children and has_more fields. Frontend may use these for pagination. |
| 5 | File pagination field naming | MEDIUM | Verify NestJS uses page_size (matching Go) not pageSize for file list pagination. |

**Business decision needed (not must-fix, but must decide):**

| # | Item | Risk | Resolution |
|---|------|------|------------|
| 1 | 5 auth 501 endpoints (#2,3,5,6,7) | HIGH (business decision) | If registration stays disabled, these are intentional. If needed, implement in future phase. |
| 2 | test-email 501 (#12) | HIGH (business decision) | If email testing not needed, keep 501. Otherwise implement. |
| 3 | 2 OneDrive 501 endpoints (#145,146) | HIGH (business decision) | If OneDrive integration not needed, keep 501. Otherwise implement. |
| 4 | 20 theme endpoints (#165-184) | HIGH | Theme management is a major feature. Decide if needed for launch or can be deferred. |

### Deferred Items

These items are intentionally not fixed in Phases 12-14:

| # | Item | Reason | Phase |
|---|------|--------|-------|
| 1 | 5 auth 501 endpoints (#2,3,5,6,7) | Business decision needed -- may be intentional (registration disabled) | Phase 15 decision |
| 2 | test-email 501 (#12) | Business decision needed | Phase 15 decision |
| 3 | 2 OneDrive 501 endpoints (#145,146) | Business decision needed | Phase 15 decision |
| 4 | config/export (#15) | DEFERRED -- new feature, not in verification scope (D-250) | Future phase |
| 5 | config/import (#16) | DEFERRED -- new feature, not in verification scope (D-251) | Future phase |
| 6 | 20 theme/ssr-theme endpoints (#165-184) | MISSING -- requires new controller, major feature | Future phase |
| 7 | files/share/create (#77) | Frontend-only definition, Go also lacks | N/A |

### Summary Statistics

| Risk Level | Count | Percentage | Description |
|-----------|-------|-----------|-------------|
| HIGH | 25 | 13.4% | 5 auth 501 + 1 test-email 501 + 2 OneDrive 501 + 20 theme MISSING + 1 proxy/download (not in inventory) |
| MEDIUM | 72 | 38.7% | Date nullability, ID type differences, field naming, response structure differences |
| LOW | 18 | 9.7% | Date precision, response structure verification needed |
| NONE | 69 | 37.1% | Verified compatible or simple void responses |
| N/A/DEFERRED | 4 | 2.2% | External API, frontend-only, deferred features |
| **Total** | **188** | **100%** | |

**HIGH risk breakdown:**
- 8 endpoints: Go implemented, NestJS 501 (5 auth + 1 test-email + 2 OneDrive) -- business decision needed
- 20 endpoints: Theme/SSR-theme MISSING -- requires new controller
- Total HIGH: 28 (but 8 are "business decision needed", not "must fix")

**MEDIUM risk breakdown:**
- ~40 endpoints: created_at/updated_at nullability (CCP-1 cross-cutting)
- ~15 endpoints: ID type or field naming differences
- ~10 endpoints: Response structure differences (extra/missing fields)
- ~7 endpoints: Other (pagination, import result, etc.)

**Key takeaway for Phases 13-15:**
1. The single biggest risk is CCP-1 (date nullability) -- affects 40+ endpoints. Resolve this first by checking DB schema.
2. Album camelCase field naming and Link ID type are the next biggest risks -- may actually be HIGH if frontend depends on specific format.
3. The 8 "501" endpoints and 20 "MISSING theme" endpoints are known gaps that need business decisions, not technical fixes.
4. 69 endpoints (37%) are NONE risk and need only light verification.
