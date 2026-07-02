# Phase 3: Article & Category & Tag - Research

**Researched:** 2026-07-02
**Domain:** NestJS + Drizzle ORM article CMS with categories/tags
**Confidence:** HIGH

## Summary

Phase 3 implements the core article CMS functionality: CRUD for articles, categories, and tags, plus 7 public-facing article endpoints and 5 article history endpoints. The Go backend defines 30+ fields per article, M2M relationships for both categories and tags, and a complex `ToAPIResponse` method that is the authoritative reference for response shape compatibility.

The most critical finding is a **compatibility conflict in D-57**: the Go backend uses many-to-many relationships for both articles-to-categories and articles-to-tags (via `article_post_categories` and `article_post_tags` junction tables). D-57 simplifies categories to a single `categoryId` column on the articles table, which would break the `post_category_ids: [...]` array that the frontend sends. This must be resolved before planning proceeds.

The phase involves creating 4 NestJS modules (Article, ArticleHistory, PostCategory, PostTag), 1 new schema file (article-post-tag-pivot), 1 schema migration (adding categoryId to articles), and approximately 25 API endpoints. The Go backend's `service.go` (1877 lines) and `handler.go` (919 lines) are the authoritative references for every endpoint's behavior.

**Primary recommendation:** Follow the Go backend's M2M pattern for both categories and tags (two junction tables), and flag D-57's categoryId simplification as a compatibility risk that needs user confirmation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-45:** Article response model fully aligns with Go backend ArticleResponse structure (30+ fields including Sqids public ID, nested postCategories/postTags/owner, summaries JSON array, etc.)
- **D-46:** Create/Update DTO separation: CreateArticleDto has required fields (title, status) + optional; UpdateArticleDto all optional (PartialType). camelCase field names match Go JSON tags
- **D-47:** Article status enum: DRAFT, PUBLISHED, ARCHIVED. Public endpoints only return PUBLISHED + isTakedown=false
- **D-48:** Article detail response includes prevArticle and nextArticle (public endpoints only). Sorted by createdAt, same category priority
- **D-49:** Each public endpoint maps to independent Service method. 7 public endpoints return different data shapes
- **D-50:** Public article list pagination matches Go: page (default 1), pageSize (default 10), categoryId (optional Sqids ID), tagId (optional Sqids ID). Response format `{ list, pagination: { page, pageSize, total } }`
- **D-51:** ListHome returns showOnHome=true published articles, sorted by homeSort + pinSort
- **D-52:** ListArchives returns year-month grouped article summaries, format `{ archives: [{ year, month, count, articles: [{ id, title, createdAt }] }] }`
- **D-53:** GetArticleStatistics returns total articles, per-status counts, category counts, tag counts, etc.
- **D-54:** Article history included in Phase 03 scope. article_histories schema exists. 5 history endpoints
- **D-55:** Article history auto-created on Create (version=1) and Update (version increment). Snapshot fields: title, contentMd, contentHtml, coverUrl, summaries, wordCount, keywords
- **D-56:** CompareVersions returns field-level diff between two versions
- **D-57:** Articles-to-Categories uses categoryId column on articles table (one category per article) + article_post_tags junction table for tags (many tags per article). Need new article-post-tag-pivot.schema.ts
- **D-58:** PostCategories.count and PostTags.count auto-synced on article CRUD. Create: count+1, Delete: count-1, Update: diffIDs incremental calculation
- **D-59:** Category and Tag CRUD endpoints independent from Article module. PostCategoryModule and PostTagModule each with controller + service + repository
- **D-60:** ArticleModule contains ArticleController + ArticleService + ArticleRepository. Public endpoints also in ArticleController with @Public() decorator
- **D-61:** ArticleHistoryModule independent module with controller + service + repository. Routes under /api/articles/:id/history/*
- **D-62:** PostCategoryModule and PostTagModule independent. Public endpoints (GET) no auth, admin endpoints need JwtAuth + AdminAuth
- **D-63:** All article ID params use Sqids public ID. Controller decodes to DB ID before passing to Service
- **D-64:** Article abbrlink as URL slug. Public endpoints support abbrlink and Sqids ID dual query
- **D-65:** View count increments on public article detail. Memory counter + periodic batch write (Phase 10 refines). Phase 03: simple increment
- **D-66:** wordCount and readingTime auto-calculated on Create/Update from Markdown content
- **D-67:** Primary color supports manual + auto modes. isPrimaryColorManual=true uses manual value. Phase 03: manual + default only, auto extract deferred to Phase 05
- **D-68:** ExportArticles serializes to JSON format
- **D-69:** ImportArticles accepts JSON file, batch creates articles

### Claude's Discretion
- ArticleRepository specific query method design (Drizzle query building)
- ArticleService caching strategy details (which queries cached, TTL)
- DTO validation rule details (string length limits, enum validation)
- Article history diff algorithm specifics (field-level comparison)
- Junction table naming and index design
- Public endpoint pagination performance optimization

### Deferred Ideas (OUT OF SCOPE)
- Article image upload (/api/articles/upload) — deferred to Phase 05 file service
- Article primary color auto-extract — deferred to Phase 05 sharp library
- Article view count batch write optimization — Phase 03 simple increment, Phase 10 refines
- PRO features (paid articles, password protection, login-required) — Out of Scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARTICLE-01 | Article CRUD, public/private | D-45 to D-67 define article response shape, DTOs, status enum, ID handling, view count, word count, primary color, export/import |
| ARTICLE-02 | Article list pagination, category filter, tag filter | D-49 to D-53 define 7 public endpoints with different data shapes, pagination params, filtering |
| ARTICLE-03 | Public article browsing | D-48 to D-53 define public endpoints with prev/next, archives, statistics, random, by-url |
| CATEGORY-01 | Category CRUD, sorting | D-58 to D-59 define independent PostCategoryModule with count sync, D-57 defines relationship model |
| TAG-01 | Tag CRUD, article association | D-57 to D-59 define article_post_tags junction table, independent PostTagModule with count sync |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Article CRUD (admin) | API / Backend | — | All create/update/delete logic runs server-side with auth guards |
| Article public listing | API / Backend | — | Pagination, filtering, status filtering all server-side |
| Category/Tag management | API / Backend | — | Independent CRUD with count sync logic |
| Article history versioning | API / Backend | — | Version tracking, comparison, restore all server-side |
| ID encoding/decoding | API / Backend (Controller) | — | Sqids decode in Controller layer, pass DB IDs to Service |
| View count increment | API / Backend (Service) | Database / Storage | Simple DB increment in Phase 03, batch write in Phase 10 |
| Content rendering | API / Backend | — | Markdown to HTML conversion (Phase 03: store as-is; sanitization deferred) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 | ORM queries, relations, junction tables | Project standard (D-02), SQLite support, type-safe |
| better-sqlite3 | 12.11.1 | SQLite driver | Project standard (D-02), sync API fits NestJS |
| class-validator | 0.15.1 | DTO validation | Project standard, NestJS validation pipe |
| class-transformer | 0.5.1 | DTO transformation | Project standard, NestJS response serialization |
| sqids | 0.3.0 | Public ID encoding | Project standard (D-05), Go-compatible |
| date-fns-tz | 3.2.0 | China timezone formatting | Project standard, matches Go time format |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/common | 11.1.27 | Controller, Service, Module decorators | All module definitions |
| @nestjs/jwt | 11.0.2 | JWT token verification | Auth guards on admin endpoints |
| @nestjs/passport | 11.0.5 | Passport strategy integration | JwtAuthGuard |
| @nestjs/throttler | 6.5.0 | Rate limiting | Article creation/update rate limits |
| vitest | 4.1.9 | Unit/integration testing | All test files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| class-validator | Zod | Zod is more modern but NestJS validation pipe integrates natively with class-validator |
| Repository pattern | Direct Drizzle queries in Service | Repository pattern provides better testability and separation; project convention (D-09) |

**Installation:**
No new packages needed. All dependencies already installed from Phase 01/02.

**Version verification:**
```
drizzle-orm: 0.45.2 (npm verified)
better-sqlite3: 12.11.1 (npm verified)
class-validator: 0.15.1 (npm verified)
class-transformer: 0.5.1 (npm verified)
@nestjs/common: 11.1.27 (npm verified)
sqids: 0.3.0 (npm verified)
date-fns: 4.4.0 (npm verified)
date-fns-tz: 3.2.0 (npm verified)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| drizzle-orm | npm | ~3 months | 11M/wk | github.com/drizzle-team/drizzle-orm | OK | Approved |
| better-sqlite3 | npm | ~2 weeks | 7.3M/wk | github.com/WiseLibs/better-sqlite3 | SUS | Flagged — "too-new" signal but established project with 7M+ weekly downloads |
| class-validator | npm | ~4 months | 10M/wk | github.com/typestack/class-validator | OK | Approved |
| class-transformer | npm | ~4.5 years | 10.8M/wk | github.com/typestack/class-transformer | OK | Approved |
| @nestjs/common | npm | ~2 weeks | 9.9M/wk | github.com/nestjs/nest | SUS | Flagged — "too-new" signal but established framework with 10M+ weekly downloads |
| sqids | npm | ~3 years | 1.9M/wk | github.com/sqids/sqids-javascript | OK | Approved |
| date-fns | npm | ~1 month | 91M/wk | github.com/date-fns/date-fns | OK | Approved |
| date-fns-tz | npm | ~2 years | 10M/wk | github.com/marnusw/date-fns-tz | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** better-sqlite3, @nestjs/common — both are well-established projects with massive adoption; the "too-new" flag reflects recent publish dates, not actual risk. No checkpoint needed.

*All packages were already installed in Phase 01/02. No new packages introduced in Phase 03.*

## Architecture Patterns

### System Architecture Diagram

```
Frontend (Next.js)
    |
    v
[NestJS API :8091]
    |
    +-- /api/articles/*  (Admin, JwtAuth required)
    |       |
    |       +-- POST /               --> ArticleService.create()
    |       +-- PUT /:id             --> ArticleService.update()
    |       +-- DELETE /:id          --> ArticleService.delete() (soft)
    |       +-- GET /                --> ArticleService.list() (paginated)
    |       +-- GET /:id             --> ArticleService.get()
    |       +-- POST /primary-color  --> returns default color (Phase 05: auto extract)
    |       +-- POST /export         --> ArticleService.exportArticles()
    |       +-- POST /import         --> ArticleService.importArticles()
    |       +-- DELETE /batch        --> ArticleService.batchDelete()
    |       +-- POST /upload         --> 501 stub (Phase 05)
    |       |
    |       +-- /:id/history/*       (Admin, JwtAuth required)
    |               +-- GET /             --> ArticleHistoryService.listHistory()
    |               +-- GET /count        --> ArticleHistoryService.getCount()
    |               +-- GET /compare      --> ArticleHistoryService.compareVersions()
    |               +-- GET /:version     --> ArticleHistoryService.getVersion()
    |               +-- POST /:version/restore --> ArticleHistoryService.restoreVersion()
    |
    +-- /api/public/articles/*  (Public, @Public())
    |       +-- GET /            --> ArticleService.listPublic() (paginated, filtered)
    |       +-- GET /home        --> ArticleService.listHome()
    |       +-- GET /random      --> ArticleService.getRandom()
    |       +-- GET /archives    --> ArticleService.listArchives()
    |       +-- GET /statistics  --> ArticleService.getArticleStatistics()
    |       +-- GET /by-url      --> ArticleService.getByURL()
    |       +-- GET /:id         --> ArticleService.getPublic() (with prev/next)
    |
    +-- /api/post-categories  (Public GET + Admin POST/PUT/DELETE)
    |       +-- GET /            --> PostCategoryService.list()  [@Public()]
    |       +-- POST /           --> PostCategoryService.create()  [JwtAuth + AdminAuth]
    |       +-- PUT /:id         --> PostCategoryService.update()  [JwtAuth + AdminAuth]
    |       +-- DELETE /:id      --> PostCategoryService.delete()  [JwtAuth + AdminAuth]
    |
    +-- /api/post-tags  (Public GET + Admin POST/PUT/DELETE)
            +-- GET /            --> PostTagService.list()  [@Public() + JwtAuthOptional]
            +-- POST /           --> PostTagService.create()  [JwtAuth + AdminAuth]
            +-- PUT /:id         --> PostTagService.update()  [JwtAuth + AdminAuth]
            +-- DELETE /:id      --> PostTagService.delete()  [JwtAuth + AdminAuth]
    |
    v
[SQLite (better-sqlite3)]
    +-- articles (30+ columns, 5 indexes)
    +-- article_histories (snapshot fields, 3 indexes)
    +-- post_categories (name, slug, count, is_series, sort_order)
    +-- post_tags (name, slug, count)
    +-- article_post_tags (junction: article_id, post_tag_id) [NEW]
    +-- article_post_categories (junction: article_id, post_category_id) [NEW per Go compat]
```

### Recommended Project Structure
```
server/src/
├── article/
│   ├── article.module.ts          # Module registration
│   ├── article.controller.ts      # Admin + public endpoints
│   ├── article.service.ts         # Business logic, ToAPIResponse
│   ├── article.repository.ts      # Drizzle queries
│   └── dto/
│       ├── create-article.dto.ts  # CreateArticleDto
│       ├── update-article.dto.ts  # UpdateArticleDto (PartialType)
│       └── article-response.dto.ts # Response types
├── article-history/
│   ├── article-history.module.ts
│   ├── article-history.controller.ts
│   ├── article-history.service.ts
│   ├── article-history.repository.ts
│   └── dto/
│       └── restore-history.dto.ts
├── post-category/
│   ├── post-category.module.ts
│   ├── post-category.controller.ts
│   ├── post-category.service.ts
│   ├── post-category.repository.ts
│   └── dto/
│       ├── create-post-category.dto.ts
│       └── update-post-category.dto.ts
├── post-tag/
│   ├── post-tag.module.ts
│   ├── post-tag.controller.ts
│   ├── post-tag.service.ts
│   ├── post-tag.repository.ts
│   └── dto/
│       ├── create-post-tag.dto.ts
│       └── update-post-tag.dto.ts
└── database/
    └── schemas/
        ├── article-post-tag-pivot.schema.ts   # NEW: article_post_tags junction
        └── article-post-category-pivot.schema.ts # NEW: article_post_categories junction (if M2M)
```

### Pattern 1: Repository with Drizzle Query Building
**What:** Each module has a Repository class that encapsulates all Drizzle queries. Service calls Repository methods.
**When to use:** All data access in this phase.
**Example:**
```typescript
// Source: Phase 01/02 established pattern (auth.service.ts uses @Inject(DRIZZLE))
@Injectable()
export class ArticleRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findById(dbId: number) {
    const [article] = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.id, dbId), isNull(articles.deletedAt)));
    return article;
  }

  async listPublic(options: ListPublicArticlesOptions) {
    const conditions = [
      isNull(articles.deletedAt),
      eq(articles.status, 'PUBLISHED'),
      eq(articles.isTakedown, false),
    ];
    // Add category/tag filters via joins...
    return this.db.select().from(articles).where(and(...conditions))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize);
  }
}
```

### Pattern 2: Sqids ID Decoding in Controller
**What:** Controller decodes Sqids public ID from URL/body to database ID, passes integer to Service.
**When to use:** All endpoints that accept article/category/tag IDs.
**Example:**
```typescript
// Source: Go handler pattern (handler.go) + Phase 01 sqids.util.ts
@Get(':id')
async get(@Param('id') publicId: string) {
  const { dbID, entityType } = decodePublicID(publicId);
  if (entityType !== EntityType.Article) {
    throw new BadRequestException('无效的文章ID');
  }
  return this.articleService.get(dbID);
}
```

### Pattern 3: Count Sync with diffIDs
**What:** When article-category/tag associations change, compute which IDs were added/removed and update count fields accordingly.
**When to use:** Article create, update, delete.
**Example:**
```typescript
// Source: Go service.go diffIDs function
function diffIDs(oldIDs: number[], newIDs: number[]): { inc: number[]; dec: number[] } {
  const oldSet = new Set(oldIDs);
  const newSet = new Set(newIDs);
  const inc = newIDs.filter(id => !oldSet.has(id));
  const dec = oldIDs.filter(id => !newSet.has(id));
  return { inc, dec };
}
```

### Pattern 4: ToAPIResponse Field Mapping
**What:** Convert database row to API response shape, including Sqids encoding, nested objects, and field transformations.
**When to use:** Every endpoint that returns article data.
**Example:**
```typescript
// Source: Go service.go ToAPIResponse (lines 616-692)
toApiResponse(article: any, useAbbrlinkAsID: boolean, includeHTML: boolean) {
  const responseId = useAbbrlinkAsID && article.abbrlink ? article.abbrlink : generatePublicID(article.id, EntityType.Article);
  const effectiveTopImgUrl = article.topImgUrl || article.coverUrl;
  return {
    id: responseId,
    created_at: formatToChinaTime(article.createdAt),
    updated_at: formatToChinaTime(article.updatedAt),
    title: article.title,
    content_md: includeHTML ? undefined : article.contentMd,
    content_html: includeHTML ? article.contentHtml : undefined,
    cover_url: article.coverUrl,
    status: article.status,
    // ... 30+ more fields matching Go ArticleResponse exactly
    post_tags: article.postTags?.map(t => ({
      id: generatePublicID(t.id, EntityType.PostTag),
      created_at: formatToChinaTime(t.createdAt),
      updated_at: formatToChinaTime(t.updatedAt),
      name: t.name,
      slug: t.slug,
      count: t.count,
    })),
    post_categories: article.postCategories?.map(c => ({ /* same pattern */ })),
  };
}
```

### Anti-Patterns to Avoid
- **Don't return raw database IDs in API responses** — all IDs must be Sqids-encoded. Frontend expects public IDs.
- **Don't forget to filter deletedAt IS NULL** — articles use soft delete. All queries must include `isNull(articles.deletedAt)`.
- **Don't forget to filter isTakedown=false on public endpoints** — public endpoints must exclude taken-down articles.
- **Don't use JSON.stringify for summaries field** — Drizzle's `text('summaries', { mode: 'json' })` handles serialization automatically.
- **Don't use Go's SCHEDULED status** — Go has a SCHEDULED status for timed publishing, but D-47 locks the enum to DRAFT/PUBLISHED/ARCHIVED. Scheduled articles may need special handling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID encoding/decoding | Custom base62/hash | sqids.util.ts (generatePublicID/decodePublicID) | Already built, Go-compatible (D-05) |
| Time formatting | Manual date string manipulation | time.util.ts (formatToChinaTime) | Already built, matches Go format |
| JWT auth checking | Manual token parsing | JwtAuthGuard + @Public() decorator | Already built, global APP_GUARD pattern |
| Admin permission check | Custom role check | AdminGuard | Already built (D-12) |
| Response wrapping | Manual { code, data, message } | ResponseInterceptor (global) | Already registered, controller returns data directly |
| Many-to-many queries | Manual JOIN strings | Drizzle relations API or explicit joins | Type-safe, handles junction tables |
| Password hashing | Custom crypto | bcryptjs | Already used in Phase 02 (D-36) |

**Key insight:** Phase 01 and 02 built a solid foundation of reusable utilities. Phase 03 should leverage sqids.util.ts, time.util.ts, guards, decorators, and interceptors without rebuilding any of them.

## Runtime State Inventory

> Phase 03 is a greenfield implementation phase (new modules), not a rename/refactor/migration.

Not applicable — no runtime state to inventory. All new code with no existing data or registered services to migrate.

## Common Pitfalls

### Pitfall 1: D-57 Category Relationship vs Go Backend M2M
**What goes wrong:** D-57 specifies a single `categoryId` column on articles table, but Go backend uses M2M (`article_post_categories` junction table). Frontend sends `post_category_ids: [...]` (array), and Go `CreateArticleRequest.PostCategoryIDs` is `[]string`. A single categoryId column cannot accept an array.
**Why it happens:** The CONTEXT.md decision simplified the relationship model without considering the API contract.
**How to avoid:** Either (a) follow Go backend pattern with `article_post_categories` junction table for full API compatibility, or (b) confirm with user that single-category-per-article is acceptable and adapt the DTO to accept only one category ID.
**Warning signs:** Frontend sends `post_category_ids: ["cat1", "cat2"]` and NestJS expects single `categoryId`.

### Pitfall 2: Article Response Field Name Casing
**What goes wrong:** Database columns use snake_case (created_at, cover_url) but API responses must use snake_case JSON keys matching Go JSON tags. TypeScript objects typically use camelCase.
**Why it happens:** Drizzle returns snake_case column names by default. Go ArticleResponse uses `json:"created_at"` (snake_case).
**How to avoid:** In `toApiResponse`, explicitly map each field from snake_case DB names to snake_case JSON keys matching Go's JSON tags exactly. Do NOT rely on class-transformer naming strategies.
**Warning signs:** Frontend breaks because it expects `created_at` but receives `createdAt`.

### Pitfall 3: Null vs Undefined in JSON Serialization
**What goes wrong:** Go's nil serializes to JSON `null`, but TypeScript's undefined omits the key entirely. Frontend may depend on explicit `null` for optional fields.
**Why it happens:** Fundamental difference between Go and TypeScript JSON serialization.
**How to avoid:** In `toApiResponse`, explicitly set optional fields to `null` (not undefined) when they have no value. Use `| null` in response types, not `?`.
**Warning signs:** Frontend type checks fail because a field that should be `null` is missing from the response.

### Pitfall 4: Prev/Next Article Direction Mismatch
**What goes wrong:** Go backend swaps "prev" and "next" semantically: `finalPrevArticle = chronoNext` (creation time later = "previous" in reading order), `finalNextArticle = chronoPrev` (creation time earlier = "next" in reading order).
**Why it happens:** Reading order is newest-to-oldest, but chronological order is oldest-to-newest.
**How to avoid:** Copy Go's exact logic: prevArticle = next in chronological order (newer), nextArticle = prev in chronological order (older). Read Go lines 944-946 carefully.
**Warning signs:** Frontend navigation arrows go in wrong direction.

### Pitfall 5: View Count Race Condition
**What goes wrong:** Multiple concurrent requests to GetPublic could cause view count to increment incorrectly.
**Why it happens:** SQLite is single-writer; with better-sqlite3's synchronous API, this is actually safe at the DB level. But if implementing memory counter, concurrent increments need synchronization.
**How to avoid:** For Phase 03, use simple DB increment (`SET view_count = view_count + 1`). Memory counter optimization deferred to Phase 10.
**Warning signs:** View count drifts from expected values.

### Pitfall 6: Abbrlink Uniqueness Validation
**What goes wrong:** Creating an article with an abbrlink that conflicts with an existing one, or with a system-reserved path.
**Why it happens:** Go's `validateAbbrlink` checks 6 conditions: length limit, no slashes, allowed chars, reserved paths, page path conflict, and uniqueness.
**How to avoid:** Replicate all 6 checks from Go's `validateAbbrlink` function exactly, including the full `reservedPaths` list.
**Warning signs:** Articles created with `/admin` or `/api` as abbrlink break routing.

### Pitfall 7: Count Sync on Soft Delete
**What goes wrong:** When an article is soft-deleted, its categories/tags count should decrease. But the article record still exists in the DB.
**Why it happens:** Soft delete sets deletedAt but keeps the row. Count sync must happen at delete time, not on query.
**How to avoid:** In ArticleService.delete(), explicitly decrement category/tag counts before/after soft delete, matching Go's Delete handler which calls `repos.PostTag.UpdateCount(ctx, nil, tagIDs)`.
**Warning signs:** Category shows count=5 but only 3 visible articles.

## Code Examples

### Article Post-Tag Junction Table Schema
```typescript
// Source: Go ent/migrate/schema.go ArticlePostTagsColumns + link-tag-pivot.schema.ts pattern
import { sqliteTable, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { articles } from './article.schema';
import { postTags } from './post-tag.schema';

export const articlePostTags = sqliteTable('article_post_tags', {
  articleId: integer('article_id')
    .notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  postTagId: integer('post_tag_id')
    .notNull()
    .references(() => postTags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.articleId, table.postTagId] }),
]);
```

### Article-Category Junction Table Schema (if following Go M2M pattern)
```typescript
// Source: Go ent/migrate/schema.go ArticlePostCategoriesColumns
import { sqliteTable, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { articles } from './article.schema';
import { postCategories } from './post-category.schema';

export const articlePostCategories = sqliteTable('article_post_categories', {
  articleId: integer('article_id')
    .notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  postCategoryId: integer('post_category_id')
    .notNull()
    .references(() => postCategories.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.articleId, table.postCategoryId] }),
]);
```

### Calculate Post Stats (wordCount + readingTime)
```typescript
// Source: Go service.go calculatePostStats (lines 526-543)
function calculatePostStats(content: string): { wordCount: number; readingTime: number } {
  // Count Chinese characters
  let chineseCharCount = 0;
  for (const char of content) {
    if (/[一-鿿]/.test(char)) {
      chineseCharCount++;
    }
  }
  // Count English words (split by whitespace)
  const englishWordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const wordCount = chineseCharCount + englishWordCount;
  const wordsPerMinute = 200;
  let readingTime = wordCount > 0 ? Math.ceil(wordCount / wordsPerMinute) : 0;
  if (readingTime === 0 && wordCount > 0) {
    readingTime = 1;
  }
  return { wordCount, readingTime };
}
```

### DTO with Nested Validation
```typescript
// Source: Go model CreateArticleRequest + class-validator pattern
import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsInt } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status: string = 'DRAFT';

  @IsOptional()
  @IsString()
  content_md?: string;

  @IsOptional()
  @IsString()
  content_html?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  post_tag_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  post_category_ids?: string[];

  @IsOptional()
  @IsString()
  abbrlink?: string;

  // ... 20+ more optional fields matching Go CreateArticleRequest
}
```

### Article History Auto-Creation Pattern
```typescript
// Source: Go service.go createArticleHistory (lines 208-272)
async createArticleHistory(article: any, editorId: number, changeNote: string) {
  const latestVersion = await this.historyRepo.getLatestVersion(article.id);
  const newVersion = latestVersion + 1;

  await this.historyRepo.create({
    articleDbId: article.id,
    version: newVersion,
    title: article.title,
    contentMd: article.contentMd,
    contentHtml: article.contentHtml,
    coverUrl: article.coverUrl,
    summaries: article.summaries,
    wordCount: article.wordCount,
    keywords: article.keywords,
    editorId,
    editorNickname: await this.getEditorNickname(editorId),
    changeNote,
  });

  // Clean old versions (keep latest 10) — matches Go maxVersions=10
  await this.historyRepo.deleteOldVersions(article.id, 10);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drizzle relations() function | defineRelations() with r.many.through() | drizzle-orm 0.30+ | New API for defining relations; more explicit about junction tables |
| Manual JOIN queries | db.query relational API | drizzle-orm 0.29+ | Automatic nested fetching with `with` option |
| class-validator @IsEnum with string | @IsIn for stricter validation | class-validator 0.14+ | Better enum validation support |

**Deprecated/outdated:**
- `relations()` function (pre-0.30): replaced by `defineRelations()` in Drizzle ORM 0.45. Use the new API.
- `index().unique()`: removed in Drizzle 0.45, use `uniqueIndex()` instead (D-20).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Go backend uses M2M for article-categories (article_post_categories junction table exists) | Architecture Patterns | If wrong, D-57's single categoryId is correct and no junction table needed |
| A2 | Drizzle ORM defineRelations() API works with better-sqlite3 for relational queries | Standard Stack | If wrong, must use manual joins instead of db.query API |
| A3 | `calculatePostStats` Chinese character counting via 一-鿿 regex matches Go's unicode.Is(unicode.Han) | Code Examples | If wrong, word counts diverge from Go backend |
| A4 | Article SCHEDULED status is not needed in Phase 03 (D-47 locks to 3 statuses) | Common Pitfalls | If frontend sends SCHEDULED status, it will be rejected |
| A5 | Content HTML sanitization can be deferred (Go uses parserSvc.SanitizeHTML) | Common Pitfalls | If XSS risk exists, need to add DOMPurify or similar |
| A6 | ExportArticles returns JSON format (not ZIP as Go handler suggests) | Architecture | If frontend expects ZIP, import/export won't work |

**If this table is empty:** All claims in this research were verified or cited -- no user confirmation needed.

## Open Questions

1. **D-57 Category Relationship Conflict**
   - What we know: Go backend uses M2M (article_post_categories junction table). D-57 specifies single categoryId column. Frontend sends `post_category_ids: [...]` array.
   - What's unclear: Whether the user intended to simplify to one-category-per-article (breaking Go API compat) or whether D-57 should be revised to match Go M2M pattern.
   - Recommendation: Create article_post_categories junction table matching Go backend. Flag D-57 for user confirmation. The frontend clearly sends multiple category IDs.

2. **SCHEDULED Status Handling**
   - What we know: Go backend has DRAFT/PUBLISHED/ARCHIVED/SCHEDULED statuses. D-47 locks to DRAFT/PUBLISHED/ARCHIVED only.
   - What's unclear: How to handle frontend requests that set scheduledAt + status=SCHEDULED.
   - Recommendation: Accept SCHEDULED as valid status (add to enum), since the Go backend and frontend support it. The scheduled_at field already exists in the schema.

3. **Export Format (JSON vs ZIP)**
   - What we know: Go handler.go ExportArticles returns a ZIP file. D-68 says "serializes to JSON format."
   - What's unclear: Whether the frontend expects ZIP with embedded Markdown files, or plain JSON.
   - Recommendation: Implement ZIP export matching Go behavior (JSON data + Markdown files in ZIP), since frontend is unmodified.

4. **Content HTML Sanitization**
   - What we know: Go backend sanitizes HTML via parserSvc.SanitizeHTML before storing. NestJS Phase 03 has no sanitization library.
   - What's unclear: Whether to add DOMPurify/isomorphic-dompurify in Phase 03 or defer.
   - Recommendation: Add isomorphic-dompurify for HTML sanitization in Create/Update, matching Go's security posture. XSS risk is real.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Available | 22.14.0 | — |
| npm | Package management | Available | 10.9.2 | — |
| SQLite (better-sqlite3) | Database | Available | 12.11.1 | — |
| Vitest | Testing | Available | 4.1.9 | — |
| drizzle-kit | Migrations | Available | 0.31.10 | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:**
- isomorphic-dompurify (HTML sanitization) — not yet installed, needed for content_html sanitization. Install in Phase 03.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | server/vitest.config.ts |
| Quick run command | `cd server && npx vitest run --reporter=verbose` |
| Full suite command | `cd server && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARTICLE-01 | Article CRUD operations | unit + integration | `npx vitest run test/article` | No - Wave 0 |
| ARTICLE-02 | Article list pagination, filtering | unit | `npx vitest run test/article` | No - Wave 0 |
| ARTICLE-03 | Public article browsing | unit + integration | `npx vitest run test/article` | No - Wave 0 |
| CATEGORY-01 | Category CRUD, count sync | unit | `npx vitest run test/post-category` | No - Wave 0 |
| TAG-01 | Tag CRUD, article association | unit | `npx vitest run test/post-tag` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/test/article/article.service.spec.ts` — covers ARTICLE-01, ARTICLE-02, ARTICLE-03
- [ ] `server/test/article/article.controller.spec.ts` — covers endpoint routing and auth
- [ ] `server/test/post-category/post-category.service.spec.ts` — covers CATEGORY-01
- [ ] `server/test/post-tag/post-tag.service.spec.ts` — covers TAG-01
- [ ] `server/test/article-history/article-history.service.spec.ts` — covers history CRUD
- [ ] `server/test/helpers/` — shared test fixtures (mock DB, sample articles)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JwtAuthGuard + @Public() decorator (Phase 02) |
| V3 Session Management | yes | JWT tokens managed by TokenService (Phase 02) |
| V4 Access Control | yes | AdminGuard for admin-only endpoints |
| V5 Input Validation | yes | class-validator DTOs + validateAbbrlink |
| V6 Cryptography | no | — |

### Known Threat Patterns for NestJS + SQLite Article CMS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via article content_html | Tampering | HTML sanitization (isomorphic-dompurify) before storage |
| SQL injection via filter params | Tampering | Drizzle parameterized queries (automatic) |
| IDOR via article ID manipulation | Information Disclosure | Ownership check in update/delete (Go checks OwnerID) |
| Mass assignment via extra DTO fields | Tampering | Whitelist DTO fields with class-validator |
| Abbrlink path traversal | Tampering | validateAbbrlink checks for slashes, reserved paths |

## Sources

### Primary (HIGH confidence)
- Go backend source code (pkg/handler/article/handler.go, pkg/service/article/service.go, pkg/domain/model/article.go) — read and verified line-by-line
- Go backend ent schema (ent/schema/article.go, ent/schema/postcategory.go, ent/schema/posttag.go) — read and verified
- Go backend junction tables (ent/migrate/schema.go lines 985-1034) — confirmed M2M pattern
- Go backend article history handler (pkg/handler/article_history/handler.go) — read and verified
- Go backend router (internal/infra/router/router.go) — verified all route registrations
- Existing NestJS code (server/src/) — verified Phase 01/02 patterns

### Secondary (MEDIUM confidence)
- Drizzle ORM documentation (orm.drizzle.team/docs/relations) — fetched and verified defineRelations API
- Drizzle ORM select documentation (orm.drizzle.team/docs/select) — fetched and verified query API

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified in Phase 01/02
- Architecture: HIGH — Go backend source code is authoritative reference, read in full
- Pitfalls: HIGH — identified from direct comparison of Go source vs CONTEXT.md decisions
- D-57 compatibility: HIGH — verified Go uses M2M for categories, conflict with D-57 is confirmed

**Research date:** 2026-07-02
**Valid until:** 2026-08-02
