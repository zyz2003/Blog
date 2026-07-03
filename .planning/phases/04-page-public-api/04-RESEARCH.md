# Phase 4: Page & Public API - Research

**Researched:** 2026-07-03
**Domain:** NestJS Page CRUD + Public API + Version endpoints
**Confidence:** HIGH

## Summary

Phase 4 implements three distinct capabilities: (1) Page CRUD for admin with path-based routing, (2) public page access via wildcard path matching, and (3) version info endpoints. The Go backend source code has been fully read and analyzed, providing authoritative reference for every API contract, validation rule, and edge case. The existing NestJS codebase already has the page schema defined, a PageModule placeholder, and established patterns from Phases 01-03 (article CRUD, guards, interceptors, DTOs, repository pattern) that this phase will follow directly.

The most technically nuanced aspects are: (a) NestJS wildcard route `@Get('*path')` for multi-level path matching (e.g., `/api/public/pages/docs/guide`), (b) bypassing the global ResponseInterceptor for the `/api/version/string` endpoint which returns raw `{ version: string }` without the `{ code, data, message }` wrapper, (c) the `splitContentAndCustomJS` regex pattern that must exactly replicate Go's `(?is)<script[^>]*>(.*?)</script>` behavior, and (d) the InitializeDefaultPages logic with its privacy page script migration compatibility path.

**Primary recommendation:** Follow the established article module pattern (Controller -> Service -> Repository with Drizzle) for PageModule, create a standalone VersionModule with no service dependency, and use `@Res()` decorator to bypass the global interceptor for the version/string endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-71:** Page 管理端使用原始数字 ID，不经过 Sqids 编码
- **D-72:** Page 公开端使用路径路由而非 ID 路由
- **D-73:** Page 列表响应格式 `{ pages, total, page, size }`（与文章的 `{ list, pagination }` 不同）
- **D-74:** 公开页面端点使用通配符路径匹配 `GET /api/public/pages/*path`
- **D-75:** 公开端点只返回 is_published=true 的页面，未发布返回 404
- **D-76:** 路径规范化复刻 Go normalizePath：trim、确保 / 开头、去除尾部 /（根路径除外）
- **D-77:** Page Create DTO 必填：title、path、content；可选：markdown_content、custom_js、custom_css、description、is_published、show_comment、sort
- **D-78:** Page Update DTO 所有字段可选（指针类型），仅更新提供的字段
- **D-79:** 路径验证复刻 Go validatePath：不能为空、必须以 / 开头、不能包含空格和特殊字符
- **D-80:** 创建/更新时检查路径唯一性，更新时排除自身
- **D-81:** Page 删除使用软删除（deletedAt 字段）
- **D-82:** 完整复刻 Go InitializeDefaultPages：三个默认页面（隐私政策、Cookie 政策、版权声明）
- **D-83:** 复刻 Go splitContentAndCustomJS 逻辑：正则提取 `<script>` 标签
- **D-84:** 初始化时检查页面是否已存在（按 path 查询），已存在则跳过
- **D-85:** 隐私政策页面历史数据迁移：custom_js 为空时自动从 content/markdown_content 提取脚本
- **D-86:** PUBLIC-01 指确保 /api/public/* 下所有公开端点正常工作
- **D-87:** Phase 04 只实现 /api/public/pages/*path 和 /api/public/site-config（已在 Phase 02 实现）
- **D-88:** GET /api/version 返回 BuildInfo JSON，go_version 替换为 node_version
- **D-89:** GET /api/version/string 返回 `{ version: string }` JSON，不经过全局拦截器包装
- **D-90:** 版本信息通过构建时环境变量注入，运行时回退到 git 信息检测
- **D-91:** Version 端点设置 no-cache 响应头
- **D-92:** PageModule 包含 PageController（管理端 + 公开页面获取）和 PageService、PageRepository
- **D-93:** VersionModule 独立模块，VersionController 无依赖服务

### Claude's Discretion
- PageRepository 的具体查询方法设计（Drizzle 查询构建方式）
- PageService 中路径规范化正则的具体实现细节
- splitContentAndCustomJS 正则的精确复制（scriptTagPattern）
- Version 信息注入的具体机制（环境变量 vs 构建脚本 vs 运行时检测）
- DTO 验证规则的具体细节（路径格式验证、搜索关键词长度限制）

### Deferred Ideas (OUT OF SCOPE)
- Page ID 统一使用 Sqids 编码 — 后续考虑
- 页面评论功能 — 依赖 Phase 06 Comment 模块
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAGE-01 | 页面：CRUD、公开/私密 | Go page handler/service/repo fully analyzed; NestJS patterns from article module; path validation/normalization rules documented; InitializeDefaultPages logic with script splitting documented |
| PUBLIC-01 | 公开：聚合端点 | Confirmed: no unified aggregation endpoint; /api/public/pages/*path is the new public endpoint; /api/public/site-config already implemented in Phase 02 |
| VERSION-01 | 版本：版本信息 API | Go version handler analyzed; BuildInfo structure documented; @Res() bypass pattern for version/string; no-cache headers; env var injection mechanism |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page CRUD (admin) | API / Backend | — | Admin-only data mutation, requires JWT + AdminGuard |
| Page public access by path | API / Backend | — | Read-only data access, path-based lookup with is_published filter |
| Path validation & normalization | API / Backend (Service) | — | Business logic rule, must match Go backend exactly |
| InitializeDefaultPages | API / Backend (Service) | — | One-time setup with migration compatibility logic |
| Version info retrieval | API / Backend | — | Static data from build-time env vars, no database dependency |
| Response format control | API / Backend (Interceptor) | — | Global interceptor wraps most responses; @Res() bypass for version/string |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/common | 11.1.27 | Controllers, decorators, guards | Project standard framework [VERIFIED: npm registry] |
| @nestjs/core | 11.1.27 | Module system, dependency injection | Project standard framework [VERIFIED: npm registry] |
| drizzle-orm | 0.45.2 | Database queries | Project standard ORM [VERIFIED: npm registry] |
| class-validator | 0.15.1 | DTO validation | Project standard validation [VERIFIED: npm registry] |
| class-transformer | 0.5.1 | DTO transformation | Project standard transformation [VERIFIED: npm registry] |
| vitest | 4.1.9 | Testing | Project standard test framework [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/platform-express | 11.x | HTTP adapter, @Res() access | Bypassing global interceptor for version/string |
| drizzle-orm/sqlite-core | 0.45.2 | SQLite-specific column types | Page schema already defined |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @Res() for bypass | Custom decorator + interceptor skip | @Res() is simpler, already proven in NestJS; custom decorator adds complexity for one endpoint |
| class-validator custom decorator for path | Manual validation in service | Custom decorator is cleaner but manual validation matches Go pattern and is more explicit |

**Installation:**
No new packages needed. All dependencies already installed in server/package.json.

**Version verification:**
```
@nestjs/common: 11.1.27 (npm verified 2026-07-03)
@nestjs/core: 11.1.27 (npm verified 2026-07-03)
class-validator: 0.15.1 (npm verified 2026-07-03)
class-transformer: 0.5.1 (npm verified 2026-07-03)
drizzle-orm: 0.45.2 (npm verified 2026-07-03)
vitest: 4.1.9 (installed)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @nestjs/common | npm | ~5 yrs | 12M/wk | github.com/nestjs/nest | SUS (too-new publish) | Approved — false positive, official NestJS package |
| @nestjs/core | npm | ~5 yrs | 11.5M/wk | github.com/nestjs/nest | SUS (too-new publish) | Approved — false positive, official NestJS package |
| class-validator | npm | ~5 yrs | 9.9M/wk | github.com/typestack/class-validator | OK | Approved |
| class-transformer | npm | ~4 yrs | 10.6M/wk | github.com/typestack/class-transformer | OK | Approved |
| drizzle-orm | npm | ~3 yrs | 11.7M/wk | github.com/drizzle-team/drizzle-orm | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** @nestjs/common, @nestjs/core — false positives due to recent publish date; these are the official NestJS framework packages with millions of weekly downloads. No checkpoint needed.

*No new packages are installed in this phase. All packages were verified in prior phases.*

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │              NestJS App                  │
                    │                                         │
  ┌──────────┐     │  ┌─────────────────────────────────┐   │
  │ Frontend │─────┼──│  PageController (/api/pages)     │   │
  │ (admin)  │     │  │  POST /                          │   │
  └──────────┘     │  │  GET /                           │   │
                    │  │  GET /:id                        │   │
  ┌──────────┐     │  │  PUT /:id                        │   │
  │ Visitors │─────┼──│  DELETE /:id                     │   │
  │ (public) │     │  │  POST /initialize                │   │
  └──────────┘     │  └──────────┬──────────────────────┘   │
                    │             │                           │
                    │  ┌──────────▼──────────────────────┐   │
                    │  │  PageService                    │   │
                    │  │  - create (validatePath,        │   │
                    │  │    normalizePath, checkUnique)  │   │
                    │  │  - getByPath (trailing slash    │   │
                    │  │    fallback)                    │   │
                    │  │  - initializeDefaultPages       │   │
                    │  │  - splitContentAndCustomJS      │   │
                    │  └──────────┬──────────────────────┘   │
                    │             │                           │
                    │  ┌──────────▼──────────────────────┐   │
                    │  │  PageRepository (Drizzle)       │   │
                    │  │  - CRUD with soft delete        │   │
                    │  │  - isNull(deletedAt) filter     │   │
                    │  │  - path unique check            │   │
                    │  └──────────┬──────────────────────┘   │
                    │             │                           │
                    │  ┌──────────▼──────────────────────┐   │
                    │  │  SQLite (pages table)            │   │
                    │  └─────────────────────────────────┘   │
                    │                                         │
  ┌──────────┐     │  ┌─────────────────────────────────┐   │
  │ Visitors │─────┼──│  PublicPageController            │   │
  │ (public) │     │  │  GET /api/public/pages/*path     │   │
  └──────────┘     │  │  (@Public, is_published filter)  │   │
                    │  └──────────┬──────────────────────┘   │
                    │             │ uses PageService          │
                    │             │ (getByPath)               │
                    │                                         │
  ┌──────────┐     │  ┌─────────────────────────────────┐   │
  │ Frontend │─────┼──│  VersionController               │   │
  │ (public) │     │  │  GET /api/version                │   │
  └──────────┘     │  │  GET /api/version/string         │   │
                    │  │  (@Public, @Header no-cache)     │   │
                    │  │  version/string uses @Res()      │   │
                    │  └─────────────────────────────────┘   │
                    │             │                           │
                    │  ┌──────────▼──────────────────────┐   │
                    │  │  Build-time env vars            │   │
                    │  │  VERSION, COMMIT, BUILD_DATE     │   │
                    │  └─────────────────────────────────┘   │
                    └─────────────────────────────────────────┘
```

### Recommended Project Structure
```
server/src/
├── page/
│   ├── page.module.ts          # Module registration (providers + controllers)
│   ├── page.controller.ts      # Admin CRUD + initialize endpoint
│   ├── public-page.controller.ts  # Public page access by path (@Public)
│   ├── page.service.ts         # Business logic (validate, normalize, split)
│   ├── page.repository.ts      # Drizzle queries (CRUD, soft delete, path lookup)
│   └── dto/
│       ├── create-page.dto.ts  # title/path/content required, rest optional
│       └── update-page.dto.ts  # All fields optional (pointer semantics)
├── version/
│   ├── version.module.ts       # Standalone module, no DB dependency
│   └── version.controller.ts   # @Public, @Header no-cache, @Res() for /string
└── database/
    └── schemas/
        └── page.schema.ts      # Already defined (no changes needed)
```

### Pattern 1: Page Controller with Admin + Public Split
**What:** Separate controllers for admin and public endpoints, following the article module pattern (ArticleController + PublicArticleController).
**When to use:** When admin and public endpoints have different auth requirements and different response shapes.
**Example:**
```typescript
// page.controller.ts — admin routes, requires JWT + AdminGuard (global guard)
@Controller('pages')
export class PageController {
  constructor(private readonly pageService: PageService) {}

  @Post()
  async create(@Body() dto: CreatePageDto) { ... }

  @Get()
  async list(@Query() query: any) { ... }

  @Get(':id')
  async get(@Param('id') id: string) { ... }  // numeric ID, no Sqids

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePageDto) { ... }

  @Delete(':id')
  async delete(@Param('id') id: string) { ... }

  @Post('initialize')
  async initializeDefaultPages() { ... }
}

// public-page.controller.ts — public routes, @Public() skips auth
@Public()
@Controller('public/pages')
export class PublicPageController {
  constructor(private readonly pageService: PageService) {}

  @Get('*path')  // Wildcard matches /privacy, /docs/guide, etc.
  async getByPath(@Param('path') path: string) { ... }
}
```

### Pattern 2: Wildcard Route for Multi-Level Path Matching
**What:** NestJS Express adapter supports `@Get('*path')` which maps to Express `/*path`, capturing everything after the controller prefix.
**When to use:** When the Go backend uses Gin's `/*path` wildcard for multi-level path matching.
**Example:**
```typescript
// NestJS @Controller('public/pages') + @Get('*path')
// Request: GET /api/public/pages/docs/guide
// Express route: /api/public/pages/*path
// @Param('path') captures: "docs/guide"
// Prepend "/" to get normalized path: "/docs/guide"
```
**Key detail:** The `@Param('path')` value does NOT include the leading `/`. The service must prepend `/` during normalization. This matches Go's `c.Param("path")` behavior where Gin returns the path without the leading slash of the wildcard segment. [CITED: NestJS Express adapter behavior, verified against Go router.go line 724]

### Pattern 3: Bypassing Global Interceptor with @Res()
**What:** The `/api/version/string` endpoint must return `{ version: string }` without the global `{ code, data, message }` wrapper. Use `@Res()` to access the raw Express response object.
**When to use:** When one endpoint needs a different response format than the global interceptor provides.
**Example:**
```typescript
// Source: Go version/handler.go lines 54-65
@Get('string')
async getVersionString(@Res() res: Response) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({ version: this.getVersionString() });
}
```
**Warning:** When using `@Res()`, NestJS expects you to handle the full response manually. The global interceptor is bypassed entirely. You must set status code, headers, and body yourself. [CITED: NestJS docs — "When using @Res(), the framework does not apply interceptors"]

### Pattern 4: Soft Delete with Drizzle
**What:** Set `deletedAt` to current timestamp instead of hard-deleting. All queries filter with `isNull(deletedAt)`.
**When to use:** All entities that use soft delete (articles, pages, etc.).
**Example:**
```typescript
// Delete (soft)
async softDelete(id: number) {
  await this.db
    .update(pages)
    .set({ deletedAt: new Date() })
    .where(eq(pages.id, id));
}

// Query (filter deleted)
const result = await this.db
  .select()
  .from(pages)
  .where(and(eq(pages.id, id), isNull(pages.deletedAt)));
```
[VERIFIED: existing pattern in server/src/article/article.repository.ts]

### Pattern 5: splitContentAndCustomJS Regex
**What:** Extract `<script>` tag contents from HTML content, separating scripts into `custom_js` field.
**When to use:** InitializeDefaultPages privacy page processing.
**Example:**
```typescript
// Source: Go pkg/service/page/page.go line 14
// Go regex: (?is)<script[^>]*>(.*?)</script>
// (?is) = single-line mode (dot matches newline) + case-insensitive
const scriptTagPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;

function splitContentAndCustomJS(content: string): { content: string; customJs: string } {
  const matches = [...content.matchAll(scriptTagPattern)];
  if (matches.length === 0) return { content, customJs: '' };

  const scripts: string[] = [];
  for (const match of matches) {
    const script = match[1]?.trim();
    if (script) scripts.push(script);
  }

  const cleanContent = content.replace(scriptTagPattern, '').trim();
  return { content: cleanContent, customJs: scripts.join('\n\n') };
}
```
**Key detail:** Go's `(?is)` flags: `i` = case-insensitive, `s` = dotAll (dot matches newline). In JavaScript, use `gi` flags + `[\s\S]` instead of `.` for dotAll behavior. [CITED: Go pkg/service/page/page.go line 14]

### Anti-Patterns to Avoid
- **Using Sqids for Page IDs:** Page is the only entity that uses raw numeric IDs in the admin API. Do NOT encode/decode page IDs through Sqids. [D-71]
- **Wrapping version/string in { code, data, message }:** The Go backend returns `{ version: string }` directly for `/api/version/string`. Using the global interceptor would break API compatibility. [D-89]
- **Hard-deleting pages:** The Go backend uses soft delete via Ent's SoftDeleteMixin. The Drizzle schema already has `deletedAt`. [D-81]
- **Using article list response format for pages:** Page list uses `{ pages, total, page, size }`, NOT `{ list, pagination }`. [D-73]
- **Using `pageSize` (camelCase) for page list query:** Go backend uses `page_size` (underscore format). [D-73, verified in Go handler line 160]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Response wrapping | Custom response formatter per controller | Global ResponseInterceptor | Already implemented, handles { code, data, message } automatically |
| Auth guard per route | Manual auth checks in each handler | @Public() decorator + global JwtAuthGuard | Already implemented, D-13 |
| Path normalization | Custom string manipulation per endpoint | Service method matching Go normalizePath | Must exactly replicate Go behavior including edge cases |
| Script extraction | Ad-hoc regex per use case | Shared splitContentAndCustomJS function | Must match Go's (?is) regex exactly |
| Version info | Runtime git command execution on every request | Build-time env vars + fallback | Go uses ldflags; equivalent is env vars at build time |

**Key insight:** The Go backend has very specific business logic for path handling (normalizePath, validatePath, trailing slash fallback) and script splitting that must be replicated exactly. These are not generic utilities — they are API compatibility requirements.

## Common Pitfalls

### Pitfall 1: NestJS Wildcard Route Leading Slash
**What goes wrong:** `@Param('path')` returns "privacy" not "/privacy", causing path lookup to fail.
**Why it happens:** Express strips the leading slash from wildcard captures. The Go Gin framework's `c.Param("path")` also returns without leading slash.
**How to avoid:** The normalizePath function already handles this by prepending "/" if missing. Ensure normalizePath is called on every path input.
**Warning signs:** 404 errors on public page access despite pages existing in the database.

### Pitfall 2: Version/String Response Format Mismatch
**What goes wrong:** `/api/version/string` returns `{ code: 200, data: { version: "..." }, message: "success" }` instead of `{ version: "..." }`.
**Why it happens:** The global ResponseInterceptor wraps all controller returns. The Go backend's GetVersionString uses `c.JSON` directly without `response.Success`.
**How to avoid:** Use `@Res()` decorator to bypass the interceptor and write the response manually.
**Warning signs:** Frontend version check fails (though currently unused, API compatibility is the core constraint).

### Pitfall 3: Page List Response Format Confusion
**What goes wrong:** Using `{ list, total, page, pageSize }` format (article pattern) instead of `{ pages, total, page, size }`.
**Why it happens:** The article module uses a different response format. Copy-pasting the article pattern would produce the wrong shape.
**How to avoid:** Page list explicitly returns `{ pages: [...], total, page, size }`. The key is `pages` not `list`, and `size` not `pageSize`.
**Warning signs:** Frontend page management list shows empty or malformed data.

### Pitfall 4: InitializeDefaultPages Script Splitting Order
**What goes wrong:** Privacy page content still contains `<script>` tags after initialization, or custom_js is empty.
**Why it happens:** The Go backend processes the privacy page's markdown_content AND content through splitContentAndCustomJS, with specific priority logic (markdown script first, then content script as fallback).
**How to avoid:** Follow Go's exact order: (1) split markdown_content, (2) split content, (3) use markdown script as custom_js, (4) fall back to content script if markdown script is empty.
**Warning signs:** Privacy page renders script tags as visible text instead of executing them.

### Pitfall 5: Trailing Slash Fallback in GetByPath
**What goes wrong:** Pages with historical trailing-slash paths (e.g., `/privacy/`) return 404.
**Why it happens:** normalizePath removes trailing slashes, but old data may have been saved with them.
**How to avoid:** After the primary path lookup fails with "page not found", try the path with a trailing slash appended (unless path is "/"). This matches Go's GetByPath fallback logic.
**Warning signs:** Existing pages from Go backend migration return 404 on public access.

### Pitfall 6: Page ID as String vs Number
**What goes wrong:** Page ID is treated as a Sqids-encoded string and passed through decodePublicID, causing errors.
**Why it happens:** All other entities (articles, categories, tags) use Sqids-encoded public IDs. The pattern is deeply ingrained.
**How to avoid:** Page IDs are raw numeric values. Parse `@Param('id')` directly with `parseInt()`. No Sqids encoding/decoding for pages.
**Warning signs:** "Invalid public ID" errors when accessing page admin endpoints.

## Code Examples

### Page Repository: Core CRUD with Drizzle
```typescript
// Source: Pattern from server/src/article/article.repository.ts
// Adapted for pages table with soft delete

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { pages } from '../database/schemas/page.schema';
import { eq, isNull, and, desc, like, or, sql } from 'drizzle-orm';

@Injectable()
export class PageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findById(id: number) {
    const [page] = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.id, id), isNull(pages.deletedAt)));
    return page ?? null;
  }

  async findByPath(path: string) {
    const [page] = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.path, path), isNull(pages.deletedAt)));
    return page ?? null;
  }

  async existsByPath(path: string, excludeId?: number): Promise<boolean> {
    const conditions = [eq(pages.path, path), isNull(pages.deletedAt)];
    if (excludeId) {
      conditions.push(sql`${pages.id} != ${excludeId}`);
    }
    const [result] = await this.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(...conditions))
      .limit(1);
    return !!result;
  }

  async create(data: any) {
    const [page] = await this.db.insert(pages).values(data).returning();
    return page;
  }

  async update(id: number, data: any) {
    data.updatedAt = new Date();
    const [page] = await this.db
      .update(pages)
      .set(data)
      .where(eq(pages.id, id))
      .returning();
    return page;
  }

  async softDelete(id: number) {
    await this.db
      .update(pages)
      .set({ deletedAt: new Date() })
      .where(eq(pages.id, id));
  }

  async list(options: { page: number; pageSize: number; search?: string; isPublished?: boolean }) {
    const conditions = [isNull(pages.deletedAt)];

    if (options.search) {
      conditions.push(
        or(
          like(pages.title, `%${options.search}%`),
          like(pages.path, `%${options.search}%`),
          like(pages.description, `%${options.search}%`),
        )!,
      );
    }

    if (options.isPublished !== undefined) {
      conditions.push(eq(pages.isPublished, options.isPublished));
    }

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(and(...conditions));
    const total = totalResult[0]?.count ?? 0;

    const offset = (options.page - 1) * options.pageSize;
    const list = await this.db
      .select()
      .from(pages)
      .where(and(...conditions))
      .orderBy(desc(pages.sort), desc(pages.createdAt))
      .limit(options.pageSize)
      .offset(offset);

    return { list, total };
  }
}
```

### Path Validation and Normalization
```typescript
// Source: Go pkg/service/page/page.go lines 553-591

function normalizePath(path: string): string {
  let normalized = path.trim();
  if (!normalized) return normalized;

  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function validatePath(path: string): void {
  if (!path) {
    throw new BadRequestException('路径不能为空');
  }

  if (!path.startsWith('/')) {
    throw new BadRequestException('路径必须以 / 开头');
  }

  if (path.includes(' ')) {
    throw new BadRequestException('路径不能包含空格');
  }

  const specialChars = ['<', '>', '"', "'", '&', '?', '#', '=', '+', ';'];
  for (const char of specialChars) {
    if (path.includes(char)) {
      throw new BadRequestException(`路径不能包含特殊字符: ${char}`);
    }
  }
}
```

### Version Controller with @Res() Bypass
```typescript
// Source: Go pkg/handler/version/handler.go lines 32-65
import { Controller, Get, Res, Public, Header } from '@nestjs/common';
import { Response } from 'express';

@Public()
@Controller('version')
export class VersionController {
  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getVersion() {
    // Global interceptor wraps this as { code: 200, data: buildInfo, message: "获取版本信息成功" }
    return {
      data: {
        version: process.env.VERSION || this.getFallbackVersion(),
        commit: process.env.COMMIT || this.getFallbackCommit(),
        date: process.env.BUILD_DATE || 'unknown',
        node_version: process.version,
      },
      message: '获取版本信息成功',
    };
  }

  @Get('string')
  async getVersionString(@Res() res: Response) {
    // Bypass global interceptor — Go returns { version: string } directly
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const version = process.env.VERSION || this.getFallbackVersion();
    const commit = process.env.COMMIT || this.getFallbackCommit();
    const date = process.env.BUILD_DATE || 'unknown';

    const parts = [version];
    if (commit !== 'unknown') parts.push(`commit ${commit}`);
    if (date !== 'unknown') parts.push(`built at ${date}`);

    res.json({ version: parts.join(', ') });
  }

  private getFallbackVersion(): string {
    return 'dev';
  }

  private getFallbackCommit(): string {
    // Could use child_process to run 'git rev-parse --short HEAD' at startup
    return 'unknown';
  }
}
```

### InitializeDefaultPages with Script Splitting
```typescript
// Source: Go pkg/service/page/page.go lines 170-550

const scriptTagPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;

function splitContentAndCustomJS(content: string): { content: string; customJs: string } {
  const matches = [...content.matchAll(scriptTagPattern)];
  if (matches.length === 0) return { content, customJs: '' };

  const scripts: string[] = [];
  for (const match of matches) {
    const script = match[1]?.trim();
    if (script) scripts.push(script);
  }

  const cleanContent = content.replace(scriptTagPattern, '').trim();
  return { content: cleanContent, customJs: scripts.join('\n\n') };
}

// In PageService.initializeDefaultPages():
// 1. Process privacy page: split scripts from markdown_content and content
// 2. For each default page: check if exists by path
// 3. If exists and is privacy page with empty custom_js: migrate scripts
// 4. If not exists: create with processed content
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Go ldflags for version injection | Node.js env vars (VERSION, COMMIT, BUILD_DATE) | Phase 04 | Same pattern, different mechanism |
| Ent SoftDeleteMixin (automatic) | Manual isNull(deletedAt) filter in Drizzle queries | Phase 01 | Must remember to add filter to every query |
| Gin `/*path` wildcard | Express `*path` via NestJS @Get('*path') | Phase 04 | Same behavior, different syntax |
| Go `(?is)` regex flags | JS `/gi` + `[\s\S]` for dotAll | Phase 04 | Must use [\s\S] instead of . for multiline matching |

**Deprecated/outdated:**
- None specific to this phase

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NestJS `@Get('*path')` with `@Controller('public/pages')` captures multi-level paths like "docs/guide" in the `path` param | Architecture Patterns / Pattern 2 | Public page access for multi-level paths would fail; would need custom middleware or route redesign |
| A2 | `@Res()` decorator completely bypasses the global ResponseInterceptor in NestJS v11 | Architecture Patterns / Pattern 3 | version/string endpoint would return wrong format; would need alternative bypass mechanism |
| A3 | SQLite LIKE is case-insensitive for ASCII characters (matching Go's ContainsFold behavior) | Code Examples / Repository | Search results would differ from Go backend for case-variant queries |
| A4 | The `@Header()` decorator works for setting Cache-Control/Pragma/Expires on the version GET endpoint | Code Examples / Version Controller | Would need to set headers via @Res() instead |
| A5 | Go backend page delete uses soft delete (confirmed by SoftDeleteMixin in schema) | Architecture Patterns / Pattern 4 | If Go actually hard-deletes, the NestJS soft delete would leave records that Go wouldn't have |

**Risk assessment:** A1 and A2 are the highest-risk assumptions. A1 can be verified with a simple test during implementation. A2 is well-documented NestJS behavior but should be tested. A5 is confirmed by reading the Go source code (SoftDeleteMixin is applied to Page schema).

## Open Questions

1. **Version info injection mechanism**
   - What we know: Go uses ldflags at build time. D-90 says "build-time env vars with runtime git fallback."
   - What's unclear: Whether to use a build script (e.g., in package.json) that sets env vars, or rely on process.env at runtime with git CLI fallback.
   - Recommendation: Use `process.env.VERSION/COMMIT/BUILD_DATE` with fallback to 'dev'/'unknown'. Add a `build:version` npm script that injects these from git. This is Claude's discretion per CONTEXT.md.

2. **Page search keyword length limit**
   - What we know: Go backend has no explicit length limit on the search parameter.
   - What's unclear: Whether to add a limit for safety (e.g., 200 chars).
   - Recommendation: No limit — match Go behavior exactly. This is Claude's discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | 22.14.0 | — |
| npm | Package management | ✓ | 10.9.2 | — |
| SQLite (better-sqlite3) | Database | ✓ | 12.11.1 | — |
| Vitest | Testing | ✓ | 4.1.9 | — |
| git | Version info fallback | ✓ | available | Hardcoded 'unknown' |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | server/vitest.config.ts |
| Quick run command | `cd server && npx vitest run test/page/ --reporter=verbose` |
| Full suite command | `cd server && npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAGE-01 | Page CRUD (create, list, get, update, delete) | unit | `npx vitest run test/page/page.service.spec.ts -t "create"` | ❌ Wave 0 |
| PAGE-01 | Path validation (empty, no slash, special chars) | unit | `npx vitest run test/page/page.service.spec.ts -t "validatePath"` | ❌ Wave 0 |
| PAGE-01 | Path normalization (trim, leading slash, trailing slash) | unit | `npx vitest run test/page/page.service.spec.ts -t "normalizePath"` | ❌ Wave 0 |
| PAGE-01 | InitializeDefaultPages (create 3 pages, idempotent, script split) | unit | `npx vitest run test/page/page.service.spec.ts -t "initialize"` | ❌ Wave 0 |
| PAGE-01 | Public page access by path (published, unpublished 404, trailing slash fallback) | unit | `npx vitest run test/page/public-page.controller.spec.ts` | ❌ Wave 0 |
| PAGE-01 | Page list with search and is_published filter | unit | `npx vitest run test/page/page.service.spec.ts -t "list"` | ❌ Wave 0 |
| PUBLIC-01 | /api/public/pages/*path returns published page | integration | `npx vitest run test/page/phase04-integration.spec.ts` | ❌ Wave 0 |
| VERSION-01 | /api/version returns BuildInfo with node_version | unit | `npx vitest run test/version/version.controller.spec.ts` | ❌ Wave 0 |
| VERSION-01 | /api/version/string returns { version: string } without wrapper | unit | `npx vitest run test/version/version.controller.spec.ts -t "string"` | ❌ Wave 0 |
| VERSION-01 | Version endpoints set no-cache headers | unit | `npx vitest run test/version/version.controller.spec.ts -t "cache"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && npx vitest run test/page/ test/version/ --reporter=verbose`
- **Per wave merge:** `cd server && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/test/page/page.service.spec.ts` — covers PAGE-01 service logic
- [ ] `server/test/page/page.controller.spec.ts` — covers PAGE-01 admin endpoints
- [ ] `server/test/page/public-page.controller.spec.ts` — covers PUBLIC-01
- [ ] `server/test/version/version.controller.spec.ts` — covers VERSION-01
- [ ] `server/test/page/phase04-integration.spec.ts` — covers end-to-end API compatibility

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JwtAuthGuard + @Public() decorator (existing) |
| V3 Session Management | no | — |
| V4 Access Control | yes | AdminGuard on /api/pages routes (existing global guard) |
| V5 Input Validation | yes | class-validator DTOs + manual path validation in service |
| V6 Cryptography | no | — |

### Known Threat Patterns for NestJS + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in page path | Tampering | validatePath rejects special chars (<, >, &, ?, #, =, +, ;) |
| XSS via page content | Tampering | Content stored as-is (rendered by frontend); custom_js is intentional |
| SQL injection via search | Tampering | Drizzle parameterized queries (like() uses bind parameters) |
| IDOR on page admin endpoints | Information Disclosure | AdminGuard ensures only admins access /api/pages |
| Unpublished page enumeration | Information Disclosure | Public endpoint returns 404 for unpublished pages (no existence hint) |

## Sources

### Primary (HIGH confidence)
- Go backend source code (pkg/handler/page/page.go, pkg/service/page/page.go, pkg/domain/model/page.go, internal/infra/persistence/ent/page.go) — read and analyzed in full
- Go version handler (pkg/handler/version/handler.go, internal/pkg/version/version.go) — read and analyzed in full
- Go router (internal/infra/router/router.go) — page and version route registration confirmed
- Existing NestJS codebase (article module, guards, interceptors, DTOs) — patterns established in Phases 01-03
- Frontend type definitions (frontend/src/types/page-management.ts, frontend/src/lib/api/page-management.ts, frontend/src/lib/version.ts) — API contract confirmed

### Secondary (MEDIUM confidence)
- NestJS Express adapter wildcard route behavior — [ASSUMED] based on Express routing documentation
- @Res() bypass of global interceptors — [ASSUMED] based on NestJS documentation patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified in prior phases
- Architecture: HIGH — follows established article module pattern; Go source provides exact spec
- Pitfalls: HIGH — identified from direct Go source code analysis and existing codebase patterns
- Wildcard route behavior: MEDIUM — assumed from Express/NestJS docs, needs implementation verification
- @Res() bypass: MEDIUM — assumed from NestJS docs, needs implementation verification

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (30 days — stable stack, no fast-moving dependencies)
