# ROADMAP: anheyu-app NestJS + SQLite Backend

## Project Goal

Rewrite the anheyu-app Go backend (Go + PostgreSQL + Redis) as NestJS + Drizzle + SQLite. The Next.js frontend must switch to the new backend with zero code changes -- API compatibility is the core constraint.

## Milestones

### M1: Core CMS Operational

Phases 01-04 complete. Admin can log in, manage articles/pages/categories/tags, configure site settings. Visitors can browse public content.

### M2: Full Feature Parity

Phases 05-09 complete. All P0, P1, P2 features operational. File uploads, comments, search, statistics, albums, RSS, notifications all working.

### M3: Production Ready

Phases 10-11 complete. Scheduled tasks running, migration tool available, end-to-end testing passed. Ready for cutover from Go backend.

---

## Phase Overview

| Phase | Name | Goal | Priority | Plans |
|-------|------|------|----------|-------|
| 01 | Infrastructure | 5/5 | Complete    | 2026-06-28 |
| 02 | Auth & Settings | 5/5 | Complete    | 2026-06-29 |
| 03 | Article & Category & Tag | 5/5 | Complete   | 2026-07-03 |
| 04 | Page & Public API | 4/4 | Complete    | 2026-07-04 |
| 05 | File Upload & Media | 5/5 | Complete    | 2026-07-05 |
| 06 | Comment & Search | 5/5 | Complete    | 2026-07-10 |
| 07 | Statistics & Links | 3/5 | In Progress|  |
| 08 | Album & Doc Series | Photo album CRUD with categories; document series CRUD for ordered article collections | P2 | TBD |
| 09 | SEO & Music & Notifications | RSS/Sitemap XML feeds; music playlist API; notification management; subscriber management | P2 | TBD |
| 10 | Scheduled Tasks | Cron jobs for history cleanup, temp data cleanup, statistics aggregation, view sync, thumbnail generation, link health check, scheduled publishing, and backup | P2 | TBD |
| 11 | Migration & Integration | PostgreSQL-to-SQLite migration tool; full end-to-end API compatibility testing against Go backend responses | Final | TBD |

---

### Phase 01: Infrastructure

**Goal:** NestJS scaffold with Drizzle+SQLite, response format interceptor, auth guards, Sqids encoder, and all database schemas defined

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, API-COMPAT-01, API-COMPAT-02, API-COMPAT-04, API-COMPAT-05

**Success Criteria:**

- `npm run dev` starts NestJS on port 8091
- All 30 Drizzle schema files exist and `drizzle-kit push` creates the SQLite database in `data/`
- SQLite WAL mode enabled, busy_timeout set to 5000ms
- Global response interceptor wraps all responses as `{ code, data, message }`
- Sqids encode/decode round-trips correctly with Go-compatible seed
- JWT guard and Admin guard are functional (even if no auth module yet)

**Plans:** 5/5 plans complete

Plans:

- [x] 01-01-PLAN.md — NestJS project scaffold, config, and 18 feature module placeholders
- [x] 01-02-PLAN.md — Common infrastructure: interceptor, filter, error codes, guards, decorators, Sqids, cache
- [x] 01-03-PLAN.md — Database infrastructure and first 12 Drizzle schema files
- [x] 01-04-PLAN.md — Remaining 18 schema files and barrel export
- [x] 01-05-PLAN.md — AppModule wiring, schema push, and integration tests

---

### Phase 02: Auth & Settings

**Goal:** Admin can log in via JWT, manage user profile, configure site settings; visitors can read public config

**Requirements:** AUTH-01, AUTH-02, AUTH-03, USER-01, SETTING-01, SETTING-02, API-COMPAT-03, API-COMPAT-06

**Success Criteria:**

- POST /api/auth/login returns JWT with Go-compatible token structure (HS256, UserID/UserGroupID payload)
- Existing Go-issued JWT tokens are accepted by NestJS guards
- Admin can read and update site settings via /api/settings
- Visitors can read public site config via /api/public/site-config
- Password hashing uses bcrypt
- Token refresh endpoint works

**Plans:** 5/5 plans complete

Plans:

- [x] 02-01-PLAN.md — SettingsService with in-memory cache, unflatten, public/private key filtering, and SettingsController
- [x] 02-02-PLAN.md — AuthService, TokenService, AuthController with Go-compatible JWT lifecycle
- [x] 02-03-PLAN.md — UserService, UserController with current user ops and admin user management
- [x] 02-04-PLAN.md — CaptchaService, CaptchaController, and @nestjs/throttler rate limiting
- [x] 02-05-PLAN.md — AppModule wiring, startup initialization, and integration tests

---

### Phase 03: Article & Category & Tag

**Goal:** Admin can CRUD articles with categories and tags; visitors can browse, filter, and paginate public articles

**Requirements:** ARTICLE-01, ARTICLE-02, ARTICLE-03, CATEGORY-01, TAG-01

**Success Criteria:**

- Admin can create, update, delete articles via /api/articles with Markdown content, cover image, SEO metadata
- Articles support draft/published/archived status
- Category CRUD works at /api/post-categories with sort ordering
- Tag CRUD works at /api/post-tags with article association
- Visitors can list public articles with pagination, category filter, and tag filter at /api/public/articles
- Visitors can view single public article at /api/public/articles/:id
- Article IDs encode/decode via Sqids matching Go backend

**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Junction table schemas + PostCategory/PostTag CRUD modules

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Article admin CRUD with Go-compatible response shape and count sync

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Public article endpoints (7 endpoints with pagination, filtering, prev/next)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-04-PLAN.md — Article history versioning with auto-creation and 5 history endpoints

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-05-PLAN.md — AppModule wiring, test suite, and integration verification

---

### Phase 04: Page & Public API

**Goal:** Admin can CRUD pages; visitors can view pages and access public aggregation endpoints and version info

**Requirements:** PAGE-01, PUBLIC-01, VERSION-01

**Success Criteria:**

- Admin can create, update, delete pages via /api/pages with path-based routing
- Pages support public/private visibility
- Visitors can list public pages at /api/public/pages and view single page at /api/public/pages/:id
- /api/public/* aggregation endpoints return combined site data (config, stats, recent articles)
- GET /api/version returns backend version info matching Go response format
- Public endpoints work without authentication; optional JWT identifies admin visitors

**Plans:** 4/4 plans complete

Plans:

**Wave 1** (parallel)

- [x] 04-01-PLAN.md — PageRepository and PageService with path validation, script splitting, and InitializeDefaultPages
- [x] 04-02-PLAN.md — VersionController and VersionModule with @Res() bypass for /string endpoint

**Wave 2** *(blocked on 04-01)*

- [x] 04-03-PLAN.md — PageController (admin CRUD), PublicPageController (path wildcard), DTOs, and PageModule wiring

**Wave 3** *(blocked on 04-01, 04-02, 04-03)*

- [x] 04-04-PLAN.md — AppModule wiring, unit tests, and integration verification

---

### Phase 05: File Upload & Media

**Goal:** Admin can upload files (single + chunked), manage storage policies, generate thumbnails, and manage direct links

**Requirements:** FILE-01, FILE-02, THUMB-01, STORAGE-01, LINK-DIRECT-01

**Success Criteria:**

- Single file upload works at PUT /api/file/upload with multer
- Chunked upload session lifecycle works (create session, upload chunks, finalize)
- Thumbnails auto-generated for uploaded images using sharp
- Storage policy CRUD at /api/policies supports local storage (remote providers deferred)
- Direct link CRUD at /api/direct-links with short-link access at /api/f/:id
- Uploaded files accessible via static file serving
- File manager folder tree structure operational

**Plans:** 5/5 plans complete

Plans:

**Wave 1** (parallel)

- [x] 05-01-PLAN.md — StoragePolicyModule: CRUD + default policy initialization + flag validation
- [x] 05-02-PLAN.md — UploadService: session lifecycle, chunk handling, merge, URI parser

**Wave 2** *(blocked on Wave 1)*

- [x] 05-03-PLAN.md — FileService + FileController + FolderController: file operations, queries, downloads, folder tree

**Wave 3** *(blocked on Wave 2)*

- [x] 05-04-PLAN.md — ThumbnailModule + DirectLinkModule: generation, signing, serving, short-link download

**Wave 4** *(blocked on Wave 3)*

- [x] 05-05-PLAN.md — AppModule wiring, article upload stub completion, static file serving, integration tests

---

### Phase 06: Comment & Search

**Goal:** Visitors can post and browse comments with nested replies; all users can full-text search articles via FTS5

**Requirements:** COMMENT-01, SEARCH-01

**Success Criteria:**

- Visitors can post comments at /api/public/comments; admin can CRUD at /api/comments
- Nested/threaded comments with parent-child relationships work
- Comment moderation workflow (pending/published) for admin
- Admin can pin and like comments
- Full-text search at /api/search returns articles matching query across title, content, keywords
- FTS5 index auto-updates on article create/update/delete
- Search results match Go backend relevance ordering

**Plans:** 5/5 plans complete

**Wave 1** (parallel)

- [x] 06-01-PLAN.md — CommentRepository, 8 DTOs, Markdown renderer, rate limiter, error codes
- [x] 06-02-PLAN.md — SearchModule: FTS5 index management, bm25 search, SearchController

**Wave 2** *(blocked on 06-01)*

- [x] 06-03-PLAN.md — CommentService: Create, ListByPath, ListLatest, ListChildren, toResponseDTO, admin operations

**Wave 3** *(blocked on 06-03)*

- [x] 06-04-PLAN.md — CommentController + CommentAdminController + CommentModule wiring

**Wave 4** *(blocked on 06-01, 06-02, 06-03, 06-04)*

- [x] 06-05-PLAN.md — WeatherModule, ArticleService FTS5 hooks, AppModule wiring

---

### Phase 07: Statistics & Links

**Goal:** Visitor tracking and analytics dashboard; friend link CRUD with health check

**Requirements:** STATS-01, STATS-02, LINK-FRIEND-01

**Success Criteria:**

- Visitor logs recorded via POST /api/public/statistics/visit (frontend active reporting per D-160)
- Admin can view trend statistics (daily/weekly/monthly) at /api/statistics
- Device/browser/OS breakdown analytics available
- Visitors can view public statistics at /api/public/statistics
- Friend link CRUD at /api/links with categories at /api/link-categories
- Public friend links visible at /api/public/links
- Link health check task runs on schedule (background)

**Plans:** 3/5 plans executed

**Wave 1** (parallel)

- [x] 07-01-PLAN.md — StatisticsRepository + 11 DTOs + UA parser + visitor dedup + all Phase 07 error codes
- [x] 07-02-PLAN.md — LinkRepository + 17 DTOs + LinkApplyRateLimiter + EntityTypeLink

**Wave 2** *(blocked on 07-01)*

- [x] 07-03-PLAN.md — StatisticsService (7 methods) + StatisticsController (7 endpoints) + StatisticsModule wiring

**Wave 3** *(blocked on 07-02)*

- [ ] 07-04-PLAN.md — LinkService (22+ methods) + LinkController (25 endpoints) + LinkModule wiring

**Wave 4** *(blocked on 07-03, 07-04)*

- [ ] 07-05-PLAN.md — AppModule wiring, schema push verification, integration tests

---

### Phase 08: Album & Doc Series

**Goal:** Photo album CRUD with categories; document series CRUD for ordered article collections

**Requirements:** ALBUM-01, DOCSERIES-01

**Success Criteria:**

- Album CRUD at /api/albums with cover images, descriptions, and photo lists
- Album category CRUD at /api/album-categories
- Visitors can browse public albums at /api/public/albums
- Document series CRUD at /api/doc-series with ordered article membership
- Visitors can browse public doc series at /api/public/doc-series
- Album view count tracking works

**Plans:** TBD

---

### Phase 09: SEO & Music & Notifications

**Goal:** RSS/Sitemap XML feeds; music playlist API; notification management; subscriber management

**Requirements:** RSS-01, SITEMAP-01, MUSIC-01, NOTIF-01, SUBSCRIBER-01

**Success Criteria:**

- RSS feed available at /rss.xml, /feed.xml, /atom.xml with valid RSS 2.0 XML
- Sitemap XML available at /sitemap.xml; robots.txt at /robots.txt
- Music playlist data accessible at /api/public/music
- Notification type management and user notification settings work at /api/user/notification-*
- Visitors can subscribe at /api/public/subscribe and unsubscribe via token
- All XML endpoints return valid, well-formed XML with correct content types

**Plans:** TBD

---

### Phase 10: Scheduled Tasks

**Goal:** Cron jobs for history cleanup, temp data cleanup, statistics aggregation, view sync, thumbnail generation, link health check, scheduled publishing, and backup

**Requirements:** CRON-01

**Success Criteria:**

- Article history cleanup job runs on schedule, removing entries older than configured retention
- Temporary data (upload sessions, expired tokens) cleaned on schedule
- Statistics aggregation job computes daily/weekly/monthly rollups
- View count sync job persists in-memory counts to database
- Thumbnail generation job processes queued image transformations
- Link health check job verifies friend link availability and updates status
- Scheduled publishing job publishes articles with future publish_at dates
- Backup job exports configuration as JSON on schedule
- All jobs use @nestjs/schedule with configurable intervals

**Plans:** TBD

---

### Phase 11: Migration & Integration

**Goal:** PostgreSQL-to-SQLite migration tool; full end-to-end API compatibility testing against Go backend responses

**Requirements:** MIGRATION-01, INTEGRATION-01

**Success Criteria:**

- Migration CLI tool reads from PostgreSQL connection and writes to SQLite data directory
- All 30 tables migrate with data integrity preserved
- ID seed values preserved so Sqids encoding produces identical public IDs
- JWT secret preserved so existing tokens work after migration
- Settings, file paths, and binary data all transfer correctly
- End-to-end API compatibility test suite passes for all P0 endpoints
- Frontend connects to new backend and all P0 features work without modification
- `npm run dev` starts both frontend and backend successfully

**Plans:** TBD

---

## Requirement Traceability

| Requirement ID | Phase | Description |
|---------------|-------|-------------|
| INFRA-01 | 01 | NestJS project scaffold on port 8091 |
| INFRA-02 | 01 | Drizzle ORM + SQLite connection |
| INFRA-03 | 01 | SQLite WAL mode + busy_timeout |
| INFRA-04 | 01 | Global response format interceptor |
| INFRA-05 | 01 | Sqids ID encode/decode with Go-compatible seed |
| INFRA-06 | 01 | Drizzle schema definitions for all 30 tables |
| AUTH-01 | 02 | Admin login with JWT |
| AUTH-02 | 02 | JWT token refresh |
| AUTH-03 | 02 | JWT compatible with Go backend tokens |
| USER-01 | 02 | User profile management |
| SETTING-01 | 02 | Site settings read/update |
| SETTING-02 | 02 | Public site config query |
| ARTICLE-01 | 03 | Article CRUD with draft/published/archived |
| ARTICLE-02 | 03 | Article list with pagination and filters |
| ARTICLE-03 | 03 | Public article browsing |
| CATEGORY-01 | 03 | Category CRUD with sorting |
| TAG-01 | 03 | Tag CRUD with article association |
| PAGE-01 | 04 | Page CRUD with public/private |
| PUBLIC-01 | 04 | Public aggregation endpoints |
| VERSION-01 | 04 | Version info API |
| FILE-01 | 05 | Single file upload |
| FILE-02 | 05 | Chunked upload with session management |
| THUMB-01 | 05 | Thumbnail generation |
| STORAGE-01 | 05 | Storage policy CRUD (local) |
| LINK-DIRECT-01 | 05 | Direct link CRUD and short-link access |
| COMMENT-01 | 06 | Comment CRUD with nested replies and moderation |
| SEARCH-01 | 06 | Full-text search via FTS5 |
| STATS-01 | 07 | Visitor tracking and logging |
| STATS-02 | 07 | Statistics analytics (trends, devices, sources) |
| LINK-FRIEND-01 | 07 | Friend link CRUD with health check |
| ALBUM-01 | 08 | Album CRUD with categories |
| DOCSERIES-01 | 08 | Document series CRUD |
| RSS-01 | 09 | RSS/Atom feed generation |
| SITEMAP-01 | 09 | Sitemap XML generation |
| MUSIC-01 | 09 | Music playlist data API |
| NOTIF-01 | 09 | Notification management |
| SUBSCRIBER-01 | 09 | Subscriber subscribe/unsubscribe |
| CRON-01 | 10 | Scheduled tasks (8 job types) |
| MIGRATION-01 | 11 | PostgreSQL to SQLite migration tool |
| INTEGRATION-01 | 11 | End-to-end API compatibility testing |

---

*Last updated: 2026-06-28*
