# Phase 13: Content Verification - Research

**Researched:** 2026-07-19
**Domain:** API compatibility verification (Go DTO + Frontend TypeScript types + NestJS implementation)
**Confidence:** HIGH

## Summary

Phase 13 verifies that all ~50 content-related endpoints (articles, categories, tags, pages, files, comments, search) in the NestJS backend produce responses matching the Go backend's behavior. The verification uses a three-layer approach: Go DTO structs as the authoritative reference, frontend TypeScript types as the actual consumer specification, and NestJS implementation as the verification target.

The single biggest cross-cutting concern (CCP-1) is date nullability. Schema audit confirms ALL 28 tables with `created_at`/`updated_at` fields already have `.notNull()` + `.default(sql\`(unixepoch())\`)` constraints, meaning null dates cannot exist in the database. This resolves CCP-1 at the schema level -- no NestJS code changes needed for date nullability. Two tables (`link_categories`, `album_categories`) lack timestamp fields entirely, but these are Phase 14 scope.

The most significant structural mismatches found are: (1) File module pagination uses `pageSize` (camelCase) instead of `page_size` (snake_case) and lacks `next_token`/`is_cursor` cursor-based fields, (2) File module `toFileItem` returns raw `Date` objects for `created_at`/`updated_at` instead of ISO strings, and (3) File module `permission`/`capability` field types differ from Go/frontend expectations. These are the MEDIUM-risk items requiring field-by-field verification and potential fixes.

**Primary recommendation:** Execute CCP-1 schema audit first (quick grep confirms all constraints present), then verify MEDIUM-risk endpoints field-by-field against Go DTOs, then LOW-risk, then NONE-risk confirmation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-290:** CCP-1 resolution strategy is verifying DB NOT NULL constraints -- audit all 30+ tables' Drizzle schema, confirm created_at/updated_at all have .notNull() + default. If constraints exist, null won't appear, no NestJS code changes needed
- **D-291:** CCP-1 constraint check scope covers ALL tables (resolve once), not limited to Phase 13 content tables. Because CCP-1 is cross-phase, checking all at once is cleaner
- **D-292:** When missing constraints are found, fix schema directly and drizzle-kit push, not just record the bug
- **D-293:** Phase 13 does field-by-field verification for ALL endpoints (including NONE risk), not just MEDIUM/HIGH. Most thorough approach
- **D-294:** Field-by-field verification baseline source is Go DTO struct + Frontend TypeScript type definition dual comparison. Go DTO is authoritative reference, frontend types are actual consumer
- **D-295:** MEDIUM risk endpoints (18) verified first, then LOW (8), then NONE (24)
- **D-296:** New server/test/phase13-verification/ directory for verification tests, separate from existing server/test/api-compat/
- **D-297:** Reuse existing helpers (createTestApp, seedBaseData, generateAdminToken, assertSuccessResponse etc.), but test cases written fresh
- **D-298:** Tests organized by module: article-verification.spec.ts, category-verification.spec.ts, tag-verification.spec.ts, page-verification.spec.ts, file-verification.spec.ts, comment-verification.spec.ts, search-verification.spec.ts
- **D-299:** File module 24 endpoints: MEDIUM (3) + LOW (9) all field-by-field verified, NONE (12) only confirm existing api-compat tests pass
- **D-300:** Skip #77 POST /api/files/share/create (frontend-only definition, Go also lacks this endpoint)

### Claude's Discretion
- Specific assertion list for field-by-field verification (which fields to verify per endpoint)
- Go DTO struct reading depth (handler DTO vs service DTO vs domain model)
- Frontend type definition reading scope (types/ directory vs inline types in hooks/)
- Specific organization of each test file under phase13-verification/
- CCP-1 schema fix specific .notNull() + default value syntax
- drizzle-kit push execution method and verification

### Deferred Ideas (OUT OF SCOPE)
- Browser end-to-end walkthrough -- Phase 15 Final Integration & Cutover
- Features endpoint field-by-field verification (stats/links/album/doc-series/SEO/music/notifications/cron/backup) -- Phase 14
- 5 auth 501 endpoint implementation (register/activate/forgot-password/reset-password/check-email) -- Phase 15 business decision
- test-email 501 endpoint -- Phase 15 business decision
- 2 OneDrive 501 endpoints -- Phase 15 business decision
- 20 Theme/SSR-theme endpoints -- future phase
- config/export, config/import endpoint implementation -- future phase
- proxy/download endpoint implementation -- future phase
- Album camelCase field naming verification -- Phase 14 (but CCP-1 constraint audit covers all tables once)
- Link/LinkCategory/LinkTag ID type verification -- Phase 14
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VERIFY-03 | Content verification: article/category/tag/page/file/comment/search | This entire research document supports field-by-field verification of all 50 content endpoints |
| API-COMPAT-07 | Frontend all API calls work with new backend | 12-API-INVENTORY.md provides the complete frontend API call list; verification tests confirm each call works |
| API-COMPAT-08 | Frontend-used response fields match Go backend | Go DTO structs + frontend TypeScript types provide the dual baseline for field-by-field comparison |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Article CRUD + list + statistics | API / Backend | — | All article logic is server-side; frontend only consumes API responses |
| Category/Tag CRUD | API / Backend | — | Simple CRUD with date fields; server owns data model |
| Page CRUD + public access | API / Backend | — | Page management is server-side; public pages served via API |
| File upload + management | API / Backend | CDN / Static (for serving) | Upload processing is server-side; file serving uses signed URLs |
| Comment CRUD + moderation | API / Backend | — | Comment logic including nested replies is server-side |
| Search (FTS5) | API / Backend | — | Full-text search runs on SQLite FTS5 index |
| Date serialization | API / Backend | — | toISODateString utility in server; schema constraints prevent null dates |
| Pagination format | API / Backend | — | Pagination structure is defined by backend response format |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.10 | Test framework | Already used for 292 existing api-compat tests |
| supertest | (existing) | HTTP request testing | Standard for NestJS integration tests |
| drizzle-kit | 0.31.10 | Schema migration | Required for CCP-1 schema fix if constraints missing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-validator | 0.15.1 | Request validation | Already in project for DTO validation |
| class-transformer | 0.5.1 | Response transformation | Used in comment DTOs with @Expose() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New phase13-verification/ directory | Extend existing api-compat/ | Separation per D-296; api-compat tests are structural, phase13 tests are field-by-field |

**Installation:**
No new packages needed. All dependencies already installed.

**Version verification:**
```
vitest: 4.1.10 (verified via npx vitest --version)
drizzle-kit: 0.31.10 (verified via npx drizzle-kit --version)
Node.js: v22.14.0 (verified via node --version)
```

## Package Legitimacy Audit

> No new packages are installed in this phase. All work uses existing test infrastructure and tools.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | No new packages |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

## Architecture Patterns

### System Architecture Diagram

```
Go DTO Structs          Frontend TypeScript Types         NestJS Implementation
(Authoritative)         (Consumer Spec)                   (Verification Target)
     |                        |                                  |
     |   Dual Comparison      |                                  |
     +----------+-------------+                                  |
                |                                                |
                v                                                |
     Field-by-Field Baseline                                    |
                |                                                |
                +----------> Verification Tests <---------------+
                             (phase13-verification/)
                                |
                +---------------+---------------+
                |               |               |
                v               v               v
         CCP-1 Schema     MEDIUM/LOW        NONE Risk
           Audit          Field Verify      Confirm Pass
                |               |               |
                v               v               v
         Fix if needed    Fix if needed    No action
         drizzle-kit      NestJS code
           push            changes
```

### Recommended Project Structure
```
server/test/phase13-verification/
├── article-verification.spec.ts    # 25 article endpoints (public 12 + admin 13)
├── category-verification.spec.ts   # 4 category endpoints (GET/POST/PUT/DELETE)
├── tag-verification.spec.ts        # 4 tag endpoints (GET/POST/PUT/DELETE)
├── page-verification.spec.ts       # 7 page endpoints
├── file-verification.spec.ts       # 24 file endpoints (MEDIUM+LOW field verify, NONE confirm)
├── comment-verification.spec.ts    # 16 comment endpoints (public 8 + admin 8)
└── search-verification.spec.ts     # 1 search endpoint
```

### Pattern 1: Field-by-Field Verification Test
**What:** Each MEDIUM/LOW endpoint gets a test that creates data, calls the endpoint, and asserts every response field name, type, and nullability against the Go DTO struct.
**When to use:** All MEDIUM and LOW risk endpoints per D-293/D-295.
**Example:**
```typescript
// Source: Go model/article.go ArticleResponse + frontend/src/types/article.ts Article
it('GET /api/articles/:id returns all ArticleResponse fields', async () => {
  const res = await supertest(ctx.app.getHttpServer())
    .get(`/api/articles/${articleId}`)
    .set('authorization', `Bearer ${ctx.adminToken}`);

  assertSuccessResponse(res);
  const data = res.body.data;

  // Field names match Go ArticleResponse JSON tags
  expect(data).toHaveProperty('id');
  expect(typeof data.id).toBe('string');
  expect(data).toHaveProperty('created_at');
  expect(typeof data.created_at).toBe('string'); // NOT null (CCP-1 resolved)
  expect(data).toHaveProperty('updated_at');
  expect(typeof data.updated_at).toBe('string');
  expect(data).toHaveProperty('title');
  expect(data).toHaveProperty('status');
  expect(data).toHaveProperty('view_count');
  // ... all 30+ fields from Go ArticleResponse
});
```

### Pattern 2: CCP-1 Schema Audit
**What:** Grep all Drizzle schema files for `created_at`/`updated_at` fields, verify each has `.notNull()` + `.default()`.
**When to use:** First task in Phase 13 per D-290/D-291.
**Example:**
```typescript
// Schema audit result format:
// Table: articles - created_at: .notNull().default() ✓, updated_at: .notNull().default() ✓
// Table: link_categories - NO created_at/updated_at fields (Phase 14 scope)
```

### Pattern 3: NONE Risk Confirmation
**What:** For NONE risk endpoints, only confirm existing api-compat tests pass. No new field-by-field tests needed.
**When to use:** NONE risk endpoints per D-299.
**Example:**
```typescript
// NONE risk: just run existing tests
// npx vitest run server/test/api-compat/post-category-api-compat.spec.ts
```

### Anti-Patterns to Avoid
- **Testing only field existence without type checking:** Must verify `typeof data.field` matches Go DTO type (string vs number vs boolean vs null)
- **Testing only happy path:** Some endpoints have different response shapes for admin vs public views (e.g., comment Response has admin-only fields)
- **Ignoring Date serialization format:** Go returns RFC3339 without milliseconds ("2026-07-19T12:00:00Z"), NestJS returns ISO 8601 with milliseconds ("2026-07-19T12:00:00.000Z"). Both are valid but must be documented
- **Assuming class-transformer @Expose() works globally:** ClassSerializerInterceptor is NOT registered globally; @Expose() decorators in comment DTOs have no effect unless manually calling instanceToPlain()

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test app bootstrap | Custom NestJS test setup | createTestApp() from helpers | Already handles Sqids seed, JWT, data seeding, global prefix |
| Admin token generation | Manual JWT construction | generateAdminToken() from helpers | Handles Sqids encoding, HS256 signing, correct payload structure |
| Response format assertion | Custom expect chains | assertSuccessResponse() / assertPaginatedResponse() | Already validates { code, message, data } wrapper |
| Schema constraint check | Manual SQL queries | Grep Drizzle schema files | Schema definitions ARE the constraint specification; drizzle-kit push enforces them |

**Key insight:** The existing test infrastructure (createTestApp, seedBaseData, generateAdminToken, assertSuccessResponse, assertPaginatedResponse, uploadFile) covers all the boilerplate. Phase 13 tests only need to add field-level assertions.

## Runtime State Inventory

> This is a verification phase, not a rename/refactor/migration. Runtime state inventory is not applicable.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | N/A — verification phase | None |
| Live service config | N/A — verification phase | None |
| OS-registered state | N/A — verification phase | None |
| Secrets/env vars | N/A — verification phase | None |
| Build artifacts | N/A — verification phase | None |

## Common Pitfalls

### Pitfall 1: File Module Pagination Field Naming Mismatch
**What goes wrong:** NestJS returns `pagination: { page, pageSize, total }` but Go/frontend expects `pagination: { page, page_size, next_token, is_cursor }`. The `pageSize` vs `page_size` naming difference and missing cursor fields will break the frontend file manager.
**Why it happens:** NestJS file.service.ts line 101 uses camelCase `pageSize` while Go model/file.go Pagination struct uses snake_case `page_size`. NestJS also lacks cursor-based pagination fields.
**How to avoid:** Verify against Go Pagination struct and frontend file-manager.ts Pagination interface. Fix NestJS to return `page_size` (snake_case) and add `next_token`/`is_cursor` fields.
**Warning signs:** Frontend file manager pagination breaks; "Load more" button doesn't work.

### Pitfall 2: File Module toFileItem Returns Raw Date Objects
**What goes wrong:** `toFileItem()` returns `created_at: file.createdAt` and `updated_at: file.updatedAt` as raw Date objects, while other modules use `toISODateString()`. JSON.stringify serializes Date objects to ISO strings, but the format includes milliseconds (CCP-2), and the type in the response is technically a Date object being serialized, not a pre-formatted string.
**Why it happens:** File module's `toFileItem()` was written without using the `toISODateString()` utility that other modules use.
**How to avoid:** Apply `toISODateString()` to `created_at`/`updated_at` in `toFileItem()`, matching the pattern used in article.service.ts, page.service.ts, etc.
**Warning signs:** Date fields in file responses have milliseconds while other modules don't; potential timezone issues.

### Pitfall 3: File Module permission/capability Type Mismatch
**What goes wrong:** NestJS `toFileItem()` returns `permission: 0` (number) and `capability: 0` (number), but Go returns `permission: interface{}` (null in practice) and `capability: string`. Frontend expects `permission: Record<string, unknown> | null` and `capability: string`.
**Why it happens:** NestJS used placeholder values (0) for fields that Go leaves as null/empty string.
**How to avoid:** Change `permission` to `null` and `capability` to `''` (empty string) to match Go behavior.
**Warning signs:** Frontend type checks fail on permission/capability fields.

### Pitfall 4: class-transformer @Expose() Not Active
**What goes wrong:** Comment DTOs use `@Expose()` decorators, but `ClassSerializerInterceptor` is not registered globally in the NestJS app. The decorators have no effect -- the service returns plain objects, not class instances.
**Why it happens:** The comment service builds response objects manually (plain JS objects), not by instantiating DTO classes and relying on class-transformer serialization.
**How to avoid:** This is actually fine for the current implementation -- the service manually constructs objects with the correct field names. But verification tests should confirm the actual response fields, not the DTO class definitions.
**Warning signs:** Tests that instantiate DTO classes and check @Expose() fields may give false positives.

### Pitfall 5: Article Import/Export/Batch Delete Return 501
**What goes wrong:** NestJS article controller returns 501 for import (#42), export (#41), and batch delete (#37), but Go has full implementations. The 12-RISK-MARKING.md marks these as NONE risk because they return "simple responses", but the frontend actually calls these endpoints and expects real data.
**Why it happens:** These endpoints were stubbed during Phase 3 and never fully implemented.
**How to avoid:** Verify whether the frontend actually uses these endpoints in production flows. If it does, these are functional gaps, not just response format differences. Mark as MEDIUM risk if frontend depends on them.
**Warning signs:** Frontend article management page shows errors when trying to import/export/batch delete.

### Pitfall 6: FeedListResponse Uses page_size While ArticleListResponse Uses pageSize
**What goes wrong:** Frontend `FeedListResponse` (article.ts line 69) uses `page_size` (snake_case), while `ArticleListResponse` (post-management.ts) uses `pageSize` (camelCase). Go `ArticleListResponse` uses `pageSize` (camelCase). The public article list endpoint may return the wrong key.
**Why it happens:** Go has two different response structures: public list uses `page_size`, admin list uses `pageSize`. NestJS may not distinguish between them.
**How to avoid:** Verify the public article list endpoint returns `page_size` and the admin list returns `pageSize`, matching Go behavior exactly.
**Warning signs:** Frontend pagination breaks on public article list page.

## Code Examples

### CCP-1 Schema Audit Result (VERIFIED)
```typescript
// Source: server/src/database/schemas/*.ts — grep audit completed
// ALL 28 tables with created_at/updated_at have .notNull() + .default(sql`(unixepoch())`)
// Result: CCP-1 is RESOLVED at schema level. No null dates possible.

// Tables WITHOUT created_at/updated_at (Phase 14 scope):
// - link_categories (no timestamps at all)
// - album_categories (no timestamps at all)
// - link_tag_pivot (has created_at only, no updated_at — pivot table, expected)
```

### Go ArticleResponse Field List (Authoritative Baseline)
```typescript
// Source: _go-backend-archive/pkg/domain/model/article.go lines 159-211
// All JSON tags use snake_case
{
  id: string,                    // Sqids public ID
  created_at: time.Time,         // RFC3339 string, never null
  updated_at: time.Time,         // RFC3339 string, never null
  title: string,
  content_md: string,            // omitempty
  content_html: string,          // omitempty
  cover_url: string,
  status: string,
  view_count: int,
  word_count: int,
  reading_time: int,
  ip_location: string,
  primary_color: string,
  is_primary_color_manual: bool,
  show_on_home: bool,
  post_tags: PostTagResponse[],
  post_categories: PostCategoryResponse[],
  home_sort: int,
  pin_sort: int,
  top_img_url: string,
  summaries: string[],
  abbrlink: string,
  copyright: bool,
  is_reprint: bool,
  copyright_author: string,
  copyright_author_href: string,
  copyright_url: string,
  keywords: string,
  comment_count: int,
  scheduled_at: *time.Time,      // omitempty, nullable
  review_status: string,         // omitempty
  owner_id: uint,                // omitempty
  owner_nickname: string,        // omitempty
  owner_avatar: string,          // omitempty
  owner_email: string,           // omitempty
  is_takedown: bool,             // omitempty
  takedown_reason: string,       // omitempty
  takedown_at: *time.Time,       // omitempty, nullable
  takedown_by: *uint,            // omitempty, nullable
  extra_config: *ArticleExtraConfig, // omitempty, nullable
  is_doc: bool,                  // omitempty
  doc_series_id: string,         // omitempty
  doc_sort: int,                 // omitempty (NOT in Go ArticleResponse, but in NestJS DTO)
  doc_series: *DocSeriesResponse // omitempty (NOT in Go ArticleResponse, but in NestJS DTO)
}
```

### Go Comment ListResponse (Authoritative Baseline)
```typescript
// Source: _go-backend-archive/pkg/handler/comment/dto/dto.go lines 126-133
{
  list: Response[],
  total: int64,               // root comment count (for pagination)
  total_with_children: int64, // all comments including descendants
  page: int,
  pageSize: int,              // camelCase in Go!
  has_more: bool              // omitempty
}
```

### Go File Pagination (Authoritative Baseline)
```typescript
// Source: _go-backend-archive/pkg/domain/model/file.go lines 184-197
{
  page: int,
  page_size: int,             // snake_case!
  next_token: string,         // omitempty
  is_cursor: bool
}
```

### NestJS File Pagination (Current Implementation -- MISMATCH)
```typescript
// Source: server/src/file/file.service.ts line 101
pagination: { page, pageSize, total }
// MISMATCHES:
// 1. pageSize (camelCase) vs page_size (snake_case)
// 2. Has 'total' field (Go Pagination does NOT have total)
// 3. Missing next_token field
// 4. Missing is_cursor field
```

### NestJS File toFileItem (Current Implementation -- ISSUES)
```typescript
// Source: server/src/file/file.service.ts lines 806-833
{
  id: string,                           // OK
  name: string,                         // OK
  type: number,                         // OK
  size: number,                         // OK
  created_at: Date,                     // ISSUE: raw Date, should be ISO string
  updated_at: Date,                     // ISSUE: raw Date, should be ISO string
  path: string,                         // OK (empty string)
  owned: boolean,                       // OK
  shared: boolean,                      // OK
  permission: number,                   // ISSUE: should be null (Go: interface{})
  capability: number,                   // ISSUE: should be string (Go: string)
  primary_entity_public_id: string|null,// OK
  ext: string|null,                     // OK (Go doesn't have this, but frontend uses it)
  metadata: object,                     // OK (empty object)
  url: string|null,                     // OK
  relative_path: string,                // OK (empty string)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual API testing | Automated vitest + supertest | Phase 11-12 | 292 existing tests provide baseline |
| Single-layer verification (NestJS only) | Three-layer verification (Go DTO + Frontend types + NestJS) | Phase 12 (D-260) | More thorough but requires reading Go source |
| Risk-based prioritization | All-endpoints verification (D-293) | Phase 13 context | More work but catches edge cases |

**Deprecated/outdated:**
- 12-RISK-MARKING.md marks #37 (batch delete), #40 (upload), #41 (export) as NONE risk, but NestJS returns 501 for batch delete, import, and export. These may need reclassification if frontend depends on them.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All 28 tables with created_at/updated_at have .notNull() + .default() constraints | CCP-1 Schema Audit | If any table lacks constraints, null dates could appear in responses |
| A2 | Article import/export/batch delete 501 responses are acceptable for Phase 13 | Common Pitfalls | If frontend depends on these, they are functional gaps not just format differences |
| A3 | class-transformer @Expose() has no effect on comment responses | Common Pitfalls | If ClassSerializerInterceptor is added later, field filtering could break responses |
| A4 | File module pagination mismatch (pageSize vs page_size) will break frontend | Common Pitfalls | Frontend may handle both formats; needs verification |
| A5 | FeedListResponse.page_size vs ArticleListResponse.pageSize distinction is intentional in Go | Common Pitfalls | If Go actually uses same key for both, NestJS should too |
| A6 | File module permission:0 and capability:0 are acceptable placeholders | Common Pitfalls | Frontend may break on type mismatch (number vs null/string) |

## Open Questions (RESOLVED)

1. **Article import/export/batch delete 501 status** — RESOLVED by Plan 01 Task 1: verify 501 response and document as functional gap. Frontend usage will be checked during execution.
   - What we know: NestJS returns 501 for these endpoints; Go has full implementations; 12-RISK-MARKING.md marks them as NONE risk
   - Resolution: Plan 01 Task 1 action verifies 501 status and documents as functional gap per RESEARCH.md Pitfall 5

2. **FeedListResponse page_size vs ArticleListResponse pageSize** — RESOLVED by Plan 01 Task 1: read Go article handler to confirm exact response structure.
   - What we know: Frontend types define FeedListResponse with `page_size` and ArticleListResponse without explicit pageSize/page_size
   - Resolution: Plan 01 Task 1 action reads Go article_handler.ListPublic/ListHome to confirm exact key names

3. **File module cursor-based pagination implementation** — RESOLVED by Plan 03 Task 1: add next_token/is_cursor fields to match Go contract.
   - What we know: Go uses cursor-based pagination with next_token/is_cursor; NestJS uses offset-based with total
   - Resolution: Plan 03 Task 1 adds next_token (empty string) and is_cursor (false) fields to pagination, matching Go Pagination struct

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner | ✓ | v22.14.0 | — |
| vitest | Test framework | ✓ | 4.1.10 | — |
| drizzle-kit | Schema migration (CCP-1 fix) | ✓ | 0.31.10 | — |
| better-sqlite3 | Test database | ✓ | (bundled) | — |
| NestJS Test utility | Integration tests | ✓ | v11 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 |
| Config file | server/vitest.config.ts |
| Quick run command | `npx vitest run server/test/phase13-verification/ --reporter=verbose` |
| Full suite command | `npx vitest run server/test/ --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERIFY-03 | Article endpoints field-by-field match Go | integration | `npx vitest run server/test/phase13-verification/article-verification.spec.ts` | ❌ Wave 0 |
| VERIFY-03 | Category endpoints field-by-field match Go | integration | `npx vitest run server/test/phase13-verification/category-verification.spec.ts` | ❌ Wave 0 |
| VERIFY-03 | Tag endpoints field-by-field match Go | integration | `npx vitest run server/test/phase13-verification/tag-verification.spec.ts` | ❌ Wave 0 |
| VERIFY-03 | Page endpoints field-by-field match Go | integration | `npx vitest run server/test/phase13-verification/page-verification.spec.ts` | ❌ Wave 0 |
| VERIFY-03 | File endpoints field-by-field match Go | integration | `npx vitest run server/test/phase13-verification/file-verification.spec.ts` | ❌ Wave 0 |
| VERIFY-03 | Comment endpoints field-by-field match Go | integration | `npx vitest run server/test/phase13-verification/comment-verification.spec.ts` | ❌ Wave 0 |
| VERIFY-03 | Search endpoint field-by-field match Go | integration | `npx vitest run server/test/phase13-verification/search-verification.spec.ts` | ❌ Wave 0 |
| API-COMPAT-08 | CCP-1 schema audit confirms NOT NULL constraints | manual + grep | `grep -r "createdAt.*notNull" server/src/database/schemas/` | ✓ (grep) |

### Sampling Rate
- **Per task commit:** `npx vitest run server/test/phase13-verification/ --reporter=verbose`
- **Per wave merge:** `npx vitest run server/test/ --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/test/phase13-verification/article-verification.spec.ts` — covers VERIFY-03 article
- [ ] `server/test/phase13-verification/category-verification.spec.ts` — covers VERIFY-03 category
- [ ] `server/test/phase13-verification/tag-verification.spec.ts` — covers VERIFY-03 tag
- [ ] `server/test/phase13-verification/page-verification.spec.ts` — covers VERIFY-03 page
- [ ] `server/test/phase13-verification/file-verification.spec.ts` — covers VERIFY-03 file
- [ ] `server/test/phase13-verification/comment-verification.spec.ts` — covers VERIFY-03 comment
- [ ] `server/test/phase13-verification/search-verification.spec.ts` — covers VERIFY-03 search

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT token verification in test helpers (generateAdminToken) |
| V3 Session Management | no | — |
| V4 Access Control | yes | Admin vs public endpoint access verification |
| V5 Input Validation | yes | class-validator DTOs on request bodies |
| V6 Cryptography | no | — |

### Known Threat Patterns for Content Verification

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin endpoint accessed without JWT | Spoofing | AuthGuard on admin routes; test with/without token |
| SQL injection via search query | Tampering | Drizzle parameterized queries; FTS5 safe query construction |
| File path traversal | Tampering | Path validation in file service; signed URL verification |

## Detailed Verification Findings

### CCP-1 Schema Audit Results (VERIFIED by grep)

**Tables WITH created_at/updated_at (both have .notNull() + .default()):**
1. articles ✓
2. article_history ✓ (created_at only, no updated_at — history records are immutable)
3. comments ✓
4. direct_links ✓
5. doc_series ✓
6. entities ✓
7. file_entities ✓
8. files ✓
9. link_tag_pivot ✓ (created_at only, no updated_at — pivot table)
10. links ✓
11. metadata ✓
12. notification_types ✓
13. notifications ✓ (created_at only)
14. pages ✓
15. post_categories ✓
16. post_tags ✓
17. settings ✓
18. storage_policies ✓
19. subscribers ✓
20. tags ✓
21. url_stats ✓
22. user_groups ✓
23. user_installed_themes ✓
24. user_notification_configs ✓
25. users ✓
26. visitor_stats ✓
27. visitor_logs ✓ (created_at only, no updated_at — log records are immutable)
28. albums ✓

**Tables WITHOUT created_at/updated_at (Phase 14 scope):**
1. link_categories — no timestamps at all
2. album_categories — no timestamps at all

**CCP-1 Conclusion:** All tables that have created_at/updated_at fields have .notNull() + .default() constraints. Null dates CANNOT exist in the database. The toISODateString(null) code path is unreachable for these fields. No schema fixes needed. [VERIFIED: grep audit of all 34 schema files]

### MEDIUM Risk Endpoint Verification Matrix

| # | Endpoint | Go DTO Source | Key Risk | NestJS Status |
|---|----------|---------------|----------|---------------|
| 22 | GET /api/public/articles | model/article.go ArticleResponse | created_at/updated_at nullability | RESOLVED by schema constraints |
| 23 | GET /api/post-categories | model/post_category.go PostCategoryResponse | date nullability | RESOLVED by schema constraints |
| 24 | GET /api/post-tags | model/post_tag.go PostTagResponse | date nullability | RESOLVED by schema constraints |
| 25-28 | POST/PUT categories & tags | model/post_category.go, post_tag.go | date nullability | RESOLVED by schema constraints |
| 31 | GET /api/public/articles/statistics | model/article.go ArticleStatistics | extra fields (8 total) | NestJS ArticleStatisticsDto has all 8 fields [VERIFIED] |
| 32 | GET /api/public/articles/random | model/article.go ArticleResponse | date nullability | RESOLVED by schema constraints |
| 34-35,38-39 | Article admin CRUD | model/article.go ArticleResponse | date nullability | RESOLVED by schema constraints |
| 42 | POST /api/articles/import | service/import_export_service.go ImportResult | field names: total_count, success_count, skipped_count, failed_count, errors, created_ids | NestJS returns 501 — functional gap |
| 47-50,53 | Page CRUD + public | model/page.go Page | date nullability | RESOLVED by schema constraints |
| 54 | GET /api/file | model/file.go FileListResponse, Pagination | page_size vs pageSize; missing next_token/is_cursor | MISMATCH — needs fix |
| 64 | GET /api/file/:id | model/file.go FileInfoResponse | storagePolicy field naming | NestJS uses storagePolicy (camelCase) matching Go — OK |
| 67 | GET /api/folder/tree/:id | model/file.go FolderTreeResponse | expires type | NestJS returns ISO string matching Go — OK |
| 78-81 | Public comments | dto/dto.go ListResponse | total_with_children, has_more | NestJS has both fields [VERIFIED] |
| 86 | GET /api/comments | dto/dto.go ListResponse | total_with_children, has_more | NestJS has both fields [VERIFIED] |
| 93 | POST /api/comments/import | dto/dto.go ImportResult | field names: total_count, success_count, skipped_count, failed_count, error_messages | NestJS ImportCommentsResultDto has both Go and frontend field names [VERIFIED] |

### Key Structural Mismatches Requiring Fixes

1. **File Pagination (MEDIUM):** NestJS returns `{ page, pageSize, total }` but Go/frontend expects `{ page, page_size, next_token, is_cursor }`. Fix: change `pageSize` to `page_size`, add `next_token` and `is_cursor` fields, remove `total` from pagination (it's in `props`).

2. **File toFileItem Date Serialization (LOW):** `created_at`/`updated_at` returned as raw Date objects instead of ISO strings. Fix: apply `toISODateString()` like other modules.

3. **File toFileItem permission/capability Types (LOW):** `permission: 0` and `capability: 0` should be `permission: null` and `capability: ''`. Fix: change placeholder values.

4. **Article Import/Export/Batch Delete (MEDIUM):** NestJS returns 501 for these endpoints while Go has full implementations. This is a functional gap, not a format difference. Decision needed: implement or defer.

## Sources

### Primary (HIGH confidence)
- _go-backend-archive/pkg/domain/model/article.go — ArticleResponse, ArticleStatistics, ArticleListResponse DTOs
- _go-backend-archive/pkg/domain/model/comment.go — Comment domain model
- _go-backend-archive/pkg/handler/comment/dto/dto.go — Comment Response, ListResponse, ImportResult DTOs
- _go-backend-archive/pkg/domain/model/file.go — FileItem, FileListResponse, Pagination, FolderTreeResponse, FileInfoResponse DTOs
- _go-backend-archive/pkg/domain/model/page.go — Page, CreatePageOptions, UpdatePageOptions DTOs
- _go-backend-archive/pkg/domain/model/search.go — SearchResult, SearchHit, SearchPagination DTOs
- _go-backend-archive/pkg/domain/model/upload.go — UploadSessionData, UploadSessionStatusResponse DTOs
- _go-backend-archive/pkg/service/article/import_export_service.go — ImportResult struct
- server/src/database/schemas/*.ts — All 34 Drizzle schema files (CCP-1 audit)
- server/src/file/file.service.ts — toFileItem, getFilesByPath, getFolderTree implementations
- server/src/file/upload.service.ts — createUploadSession implementation
- server/src/comment/comment.service.ts — total_with_children, has_more implementation
- server/src/comment/dto/comment-response.dto.ts — ListCommentResponseDto with total_with_children, has_more
- server/src/article/dto/article-response.dto.ts — ArticleResponseDto, ArticleStatisticsDto
- server/src/common/utils/time.util.ts — toISODateString implementation
- server/test/helpers/api-compat-helpers.ts — Test infrastructure

### Secondary (MEDIUM confidence)
- frontend/src/types/article.ts — Frontend Article, PostTag, PostCategory, FeedListResponse types
- frontend/src/types/article-statistics.ts — Frontend ArticleStatistics type
- frontend/src/types/file-manager.ts — Frontend FileItem, Pagination, FileListData, FolderTreeData types
- frontend/src/types/comment-management.ts — Frontend AdminComment, Frontend AdminComment, AdminCommentListResponse types
- frontend/src/types/page-management.ts — Frontend page types
- frontend/src/lib/api/comment.ts — Frontend CommentListResponse with total_with_children
- .planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md — Risk levels for all 188 endpoints
- .planning/phases/12-api-inventory-auth-verification/12-API-INVENTORY.md — Complete frontend API call inventory

### Tertiary (LOW confidence)
- None — all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already in use, no new packages
- Architecture: HIGH — test pattern well-established from 292 existing tests
- Pitfalls: HIGH — identified by reading actual source code (Go DTOs + NestJS implementation)
- CCP-1 resolution: HIGH — verified by grep audit of all 34 schema files

**Research date:** 2026-07-19
**Valid until:** 2026-08-19 (stable — no fast-moving dependencies)
