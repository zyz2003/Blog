---
phase: 11-migration-integration
reviewed: 2026-07-18T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - server/test/helpers/api-compat-helpers.ts
  - server/test/api-compat/auth-api-compat.spec.ts
  - server/test/api-compat/article-api-compat.spec.ts
  - server/test/api-compat/comment-api-compat.spec.ts
  - server/test/api-compat/file-api-compat.spec.ts
  - server/test/api-compat/link-api-compat.spec.ts
  - server/test/api-compat/album-api-compat.spec.ts
  - server/test/api-compat/backup-api-compat.spec.ts
  - server/test/api-compat/statistics-api-compat.spec.ts
findings:
  critical: 3
  warning: 8
  info: 5
  total: 16
status: issues_found
---

# Phase 11: API Compat Test Suite Code Review Report

**Reviewed:** 2026-07-18
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The API compatibility test suite covers 7 domain areas with ~80 test cases, verifying endpoint existence, auth enforcement, and basic response shapes. However, the tests suffer from three systemic problems that undermine their stated purpose of verifying Go backend API compatibility:

1. **Tests validate NestJS-specific behavior, not Go compatibility** -- Multiple POST endpoints return `code: 201` in NestJS (due to default HTTP 201 status for POST) but `code: 200` in Go (which uses `response.Success()` for HTTP 200). Tests assert `code: 201`, silently codifying the incompatibility instead of catching it.

2. **The majority of admin endpoint tests only verify 401 rejection** -- They confirm auth guards work but provide zero confidence that the response shape matches Go when auth succeeds. ~40% of all test cases are "returns 401 without JWT" with no corresponding happy-path assertion.

3. **Shallow field-level assertions miss real compatibility drift** -- Most tests check only `toHaveProperty('list')` and `toHaveProperty('total')` on paginated responses, ignoring the specific field names, types, nesting, and null-sentinel behavior that differs between Go and NestJS.

## Critical Issues

### CR-01: Tests assert `code: 201` for POST endpoints where Go returns `code: 200` -- masking a real API incompatibility

**Files:**
- `server/test/api-compat/auth-api-compat.spec.ts:36` (login)
- `server/test/api-compat/auth-api-compat.spec.ts:84` (refresh-token)
- `server/test/api-compat/comment-api-compat.spec.ts:119` (create comment)
- `server/test/api-compat/article-api-compat.spec.ts:65` (create article)
- `server/test/api-compat/statistics-api-compat.spec.ts:63` (record visit)
- `server/test/api-compat/backup-api-compat.spec.ts:44` (create backup)
- `server/test/api-compat/backup-api-compat.spec.ts:160` (clean backups)
- `server/test/api-compat/album-api-compat.spec.ts:67` (add album)
- `server/test/api-compat/album-api-compat.spec.ts:91` (batch import)
- `server/test/api-compat/link-api-compat.spec.ts:49` (apply link)
- `server/test/api-compat/link-api-compat.spec.ts:159` (create link)
- `server/test/api-compat/link-api-compat.spec.ts:298` (health check)
- `server/test/api-compat/link-api-compat.spec.ts:378` (create category)
- `server/test/api-compat/link-api-compat.spec.ts:448` (create tag)

**Issue:** The Go backend uses `response.Success()` for most POST endpoints, which returns HTTP 200 with `code: 200`. NestJS POST endpoints default to HTTP 201, and the `ResponseInterceptor` copies the HTTP status into `res.body.code`. This means NestJS returns `{ code: 201, ... }` while Go returns `{ code: 200, ... }`. The tests explicitly assert `assertSuccessResponse(res, 201)`, which **validates the incompatible NestJS behavior** rather than catching the incompatibility. The project's core constraint is "frontend zero changes" -- if the frontend checks `code === 200`, it will break.

Affected Go endpoints using `response.Success()` (HTTP 200):
- Login, RefreshToken, Article Create, Comment Create, Album Add, Album BatchImport, Backup Create, Backup Clean, Statistics RecordVisit, Link Apply

Only a few Go endpoints use `SuccessWithStatus(c, http.StatusCreated, ...)`: AlbumCategory Create, Link Create, Link CreateCategory, Link CreateTag, Link Import.

**Fix:** Two-part fix:
1. NestJS POST endpoints that should return `code: 200` need `@HttpCode(HttpStatus.OK)` decorator to match Go.
2. Tests should assert the **Go-expected** status code, not the NestJS-default one. For endpoints where Go returns 200, tests must assert `code: 200`.

### CR-02: `assertSuccessResponse` does not verify HTTP status code -- only checks body `code` field

**File:** `server/test/helpers/api-compat-helpers.ts:147-151`

**Issue:** `assertSuccessResponse` checks `res.body.code` against `expectedCode` but never checks `res.status`. A response with HTTP 500 and body `{ code: 200, message: "success", data: null }` would pass this assertion. This could happen if the `ResponseInterceptor` runs on an error response (e.g., if an exception filter wraps the error into a success-shaped body). The function also does not verify that `data` is not `undefined` -- a response with `data: undefined` (which serializes to the key being absent in JSON) would pass `toHaveProperty('data')` if the key exists with value `undefined`, but in practice JSON serialization drops `undefined` values, so the key would be missing and the assertion would fail. However, `data: null` would pass, which may not be the expected shape for endpoints that should return structured data.

**Fix:** Add `expect(res.status).toBe(expectedCode)` to `assertSuccessResponse` to verify both the HTTP status and the body code field match.

### CR-03: Comment test creates comment but never verifies the full comment response shape against Go's `CommentResponseDto`

**File:** `server/test/api-compat/comment-api-compat.spec.ts:108-127`

**Issue:** The test creates a comment and only checks `id` and `content_html`. Go's `CommentResponse` has 17+ fields (`nickname`, `email_md5`, `qq_number`, `avatar_url`, `website`, `is_admin_comment`, `is_anonymous`, `ip_location`, `user_agent`, `target_path`, `target_title`, `parent_id`, `reply_to_id`, `reply_to_nick`, `like_count`, `total_children`, `children`). If NestJS omits or renames any of these fields (e.g., `email_md5` vs `emailMd5`, `is_admin_comment` vs `isAdminComment`), the frontend would break. This is a compatibility test suite -- its purpose is to catch exactly this kind of drift.

**Fix:** After creating a comment, assert all fields from Go's `CommentResponse` DTO exist with correct types:
```typescript
expect(data).toHaveProperty('nickname');
expect(data).toHaveProperty('email_md5');
expect(data).toHaveProperty('is_admin_comment');
expect(typeof data.is_admin_comment).toBe('boolean');
expect(data).toHaveProperty('like_count');
expect(typeof data.like_count).toBe('number');
expect(data).toHaveProperty('total_children');
expect(data).toHaveProperty('target_path');
expect(data).toHaveProperty('children');
expect(Array.isArray(data.children)).toBe(true);
// ... etc
```

## Warnings

### WR-01: ~40% of test cases are "returns 401 without JWT" with no corresponding happy-path shape validation

**Files:**
- `server/test/api-compat/comment-api-compat.spec.ts:193-258` (6 endpoints, 401-only)
- `server/test/api-compat/file-api-compat.spec.ts:128-333` (11 endpoints, 401-only)
- `server/test/api-compat/link-api-compat.spec.ts:169-484` (8 endpoints, 401-only)
- `server/test/api-compat/album-api-compat.spec.ts:120-192` (4 endpoints, 401-only)
- `server/test/api-compat/backup-api-compat.spec.ts:56-73` (1 endpoint, 401-only)

**Issue:** These endpoints are only tested for auth rejection. When a valid JWT is provided, the response shape is never verified. This means the test suite provides zero confidence that the data structure returned to the frontend matches Go. For a compatibility test suite, this is a major coverage gap.

Key endpoints with **no happy-path shape assertions**:
- `PUT /api/comments/:id` (update content)
- `PUT /api/comments/:id/status` (update status)
- `PUT /api/comments/:id/pin` (set pin)
- `PUT /api/comments/:id/info` (update info)
- `DELETE /api/comments` (batch delete)
- `POST /api/file/create` (create file -- only checked in "may fail" conditional)
- `PUT /api/file/rename` (rename)
- `DELETE /api/file` (delete items)
- `PUT /api/folder/view` (update view)
- `POST /api/folder/move` (move items)
- `POST /api/folder/copy` (copy items)
- `PUT /api/links/:id` (update link)
- `DELETE /api/links/:id` (delete link)
- `PUT /api/links/:id/review` (review link)
- `DELETE /api/links/batch-delete` (batch delete)
- `PUT /api/links/sort` (batch sort)
- `PUT /api/links/categories/:id` (update category)
- `DELETE /api/links/categories/:id` (delete category)
- `PUT /api/links/tags/:id` (update tag)
- `DELETE /api/links/tags/:id` (delete tag)
- `PUT /api/albums/update/:id` (update album)
- `DELETE /api/albums/delete/:id` (delete album)
- `DELETE /api/albums/batch-delete` (batch delete)
- `POST /api/albums/import` (import)

**Fix:** For each admin endpoint, add at least one happy-path test that creates a resource, performs the operation with a valid JWT, and validates the response shape matches Go's DTO.

### WR-02: Statistics admin endpoints (analytics, top-pages, trend, summary, visitor-logs) have zero `data` field validation

**File:** `server/test/api-compat/statistics-api-compat.spec.ts:78-169`

**Issue:** All 5 admin statistics endpoints only call `assertSuccessResponse(res)` which checks `{ code, message, data }` exists but does not validate any fields within `data`. Go returns specific structures for each:
- Analytics: `{ browsers: [...], os: [...], devices: [...], cities: [...], countries: [...], referers: [...] }`
- Top Pages: `[{ path, title, views }]`
- Trend: `{ daily: [...], weekly: [], monthly: [] }`
- Summary: `{ basic_stats, top_pages, analytics, trend_data }`
- Visitor Logs: `{ list, total, page, page_size }`

If NestJS returns different field names (e.g., `page_size` vs `pageSize`, `daily` vs `daily_data`), the test passes but the frontend breaks.

**Fix:** Add field-level assertions for each statistics endpoint's response data shape.

### WR-03: `assertPaginatedResponse` helper defaults to `pageKey = 'pageNum'` but most NestJS responses use `page`

**File:** `server/test/helpers/api-compat-helpers.ts:158`

**Issue:** The default `pageKey = 'pageNum'` matches the album response format but not the article or comment response format (which use `page`). Although `assertPaginatedResponse` is never actually called (see IN-01), the default is misleading and would cause false failures if anyone uses it for article/comment tests.

**Fix:** Change default to `pageKey = 'page'` since article and comment responses (the majority) use `page`, or remove the default and require explicit specification.

### WR-04: Link test uses numeric ID `1` for `PUT /api/links/:id` but the API uses Sqids string IDs

**File:** `server/test/api-compat/link-api-compat.spec.ts:227-228`

**Issue:** `PUT /api/links/999999` and `DELETE /api/links/1` pass numeric IDs, but the API expects Sqids-encoded string IDs. The test only checks for error status, so this is not a false positive, but it also does not verify what happens with a valid Sqids ID. If the controller fails to decode Sqids properly for update/delete, these tests would not catch it because they never test with a valid ID.

**Fix:** Create a link first (which returns a Sqids ID), then test update/delete with that ID and verify the response shape.

### WR-05: Album test uses numeric IDs directly but never creates an album with a valid ID to test update/delete

**File:** `server/test/api-compat/album-api-compat.spec.ts:110-146`

**Issue:** `PUT /api/albums/update/999999` and `DELETE /api/albums/delete/999999` use arbitrary numeric IDs. The `addAlbum` test creates an album (line 56-68) but does not capture the returned ID, and the add response returns `{ data: null }` per the controller. So there is no way to test the update/delete happy path where update/delete succeed for albums. This means the album CRUD cycle is untested beyond creation.

**Fix:** After adding an album, query the album list to get a valid ID, then test update and delete with that ID.

### WR-06: File upload session test at line 232 accepts any `status >= 200` as success

**File:** `server/test/api-compat/file-api-compat.spec.ts:232`

**Issue:** `expect(res.status).toBeGreaterThanOrEqual(200)` is a tautology for any HTTP response. Every valid HTTP response has status >= 200. This test provides zero confidence that the upload session status endpoint returns the correct shape. It would pass even if the endpoint returned a 200 with an empty object.

**Fix:** Assert specific status code and response shape:
```typescript
expect(res.status).toBe(200);
assertSuccessResponse(res);
expect(res.body.data).toHaveProperty('session_id');
```

### WR-07: Backup test for non-admin JWT uses `Bearer invalid-token` which is not a valid JWT

**File:** `server/test/api-compat/backup-api-compat.spec.ts:66-73`

**Issue:** The test sets `authorization: Bearer invalid-token` and expects `[401, 403]`. This only tests that a completely invalid token is rejected. It does not test the **authorization** gap: a valid JWT for a non-admin user. If the admin guard only checks JWT validity (not admin group membership), a regular user could access backup endpoints. The test gives false confidence that authorization is correct.

**Fix:** Generate a valid JWT for a non-admin user (user_group_id != 1) and verify it returns 403, not 200.

### WR-08: `seedBaseData` does not seed enough data for all tests -- album categories, link categories, storage policies are missing

**File:** `server/test/helpers/api-compat-helpers.ts:87-125`

**Issue:** The seed data only creates: one user group, one admin user, and 5 settings. Several tests silently fail into their "else" branches because required data is missing:
- `POST /api/links` (admin create) sends `category_id: 1` but no link category with id=1 exists -- test enters fallback branch
- `POST /api/file/create` may fail because storage policies are not seeded
- `PUT /api/file/upload` (create upload session) may fail because `policy_id: 'local'` has no storage policy
- Album categories are not seeded for album tests

The tests paper over these failures with `if (res.body?.code === 201) ... else expect(res.status).toBeGreaterThanOrEqual(400)` patterns, which means they pass regardless of whether the endpoint works correctly.

**Fix:** Add the following to `seedBaseData`:
- A link category (id=1) for link creation tests
- A link tag for link tag tests
- A storage policy with flag `article_image` and `local` for file upload tests
- An album category for album tests

## Info

### IN-01: `assertPaginatedResponse` is imported in 8 test files but never called

**Files:**
- `server/test/api-compat/article-api-compat.spec.ts:8`
- `server/test/api-compat/comment-api-compat.spec.ts:8`
- `server/test/api-compat/file-api-compat.spec.ts:7`
- `server/test/api-compat/link-api-compat.spec.ts:7`
- `server/test/api-compat/album-api-compat.spec.ts:7`
- `server/test/api-compat/statistics-api-compat.spec.ts:7`

**Issue:** The import exists but the function is never invoked. Each test file manually replicates the pagination assertions inline, which is inconsistent and error-prone.

**Fix:** Either use the helper or remove the import.

### IN-02: `uploadFile` helper is imported but unused in article and comment test files

**Files:**
- `server/test/api-compat/article-api-compat.spec.ts:9`
- `server/test/api-compat/comment-api-compat.spec.ts:9`

**Issue:** The `uploadFile` helper is imported but never called in these files. The article upload test (`POST /api/articles/upload`) at line 80-88 tests only the "no file" error case, never a successful upload.

**Fix:** Remove unused imports, or add a successful upload test using the helper.

### IN-03: `TestContext.ts` timestamp is set once in `createTestApp` and shared across all tests in a file

**File:** `server/test/helpers/api-compat-helpers.ts:75`

**Issue:** `ts = Date.now()` is set once during `beforeAll`. If tests run slowly enough, multiple test cases using `ctx.ts` for unique data could theoretically collide with other test files using the same approach. In practice this is unlikely but could cause flaky tests in parallel execution.

**Fix:** Use `Date.now()` inline in each test case, or use a counter incremented per test.

### IN-04: `closeTestApp` does not clean up seeded test data or temporary files

**File:** `server/test/helpers/api-compat-helpers.ts:186-190`

**Issue:** After tests run, the SQLite database, backup files, uploaded files, and any created test data persist. If the database is in-memory this is fine, but if it is file-based, running tests repeatedly could accumulate stale data. The backup tests create actual backup files on disk that are never cleaned up.

**Fix:** Add cleanup in `closeTestApp` or `afterAll` to delete backup files and other artifacts created during tests.

### IN-05: Article detail endpoint (`GET /api/articles/:id`) returns `ArticleDetailResponseDto` with `prev_article`, `next_article`, `related_articles` but test does not check these fields

**File:** `server/test/api-compat/article-api-compat.spec.ts:92-123`

**Issue:** The test checks 12 article fields but misses the navigation fields that `ArticleDetailResponseDto` adds: `prev_article`, `next_article`, `related_articles`. The Go backend returns these as part of the public article detail response, and the frontend relies on them for navigation. If NestJS omits them or returns them with different structure, the frontend breaks silently.

**Fix:** Add assertions for navigation fields:
```typescript
expect(data).toHaveProperty('prev_article');
expect(data).toHaveProperty('next_article');
expect(data).toHaveProperty('related_articles');
expect(Array.isArray(data.related_articles)).toBe(true);
```

---

_Reviewed: 2026-07-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
