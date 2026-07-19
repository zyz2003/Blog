# ROADMAP: anheyu-app NestJS + SQLite Backend

## Project Goal

Rewrite the anheyu-app Go backend (Go + PostgreSQL + Redis) as NestJS + Drizzle + SQLite. The Next.js frontend must switch to the new backend with zero code changes -- API compatibility is the core constraint.

## Milestones

### M1: Core CMS Operational ✓

Phases 01-04 complete. Admin can log in, manage articles/pages/categories/tags, configure site settings. Visitors can browse public content.

### M2: Full Feature Parity ✓

Phases 05-09 complete. All P0, P1, P2 features operational. File uploads, comments, search, statistics, albums, RSS, notifications all working.

### M3: Production Ready ✓

Phases 10-11 complete. Scheduled tasks running, migration tool available, end-to-end testing passed. Ready for cutover from Go backend.

### M4: Frontend Integration Verified

Phases 12-15 complete. Every frontend API call verified against Go backend source code. All compatibility issues found and fixed. Frontend runs on new backend with zero modifications.

---

## Phase Overview

### Development (Complete)

| Phase | Name | Goal | Status | Last Updated |
|-------|------|------|--------|--------------|
| 01 | Infrastructure | NestJS scaffold, Drizzle, schemas, interceptor, guards, Sqids | Complete | 2026-06-28 |
| 02 | Auth & Settings | JWT auth, user management, site settings, captcha | Complete | 2026-06-29 |
| 03 | Article & Category & Tag | Article CRUD, categories, tags, public articles | Complete | 2026-07-03 |
| 04 | Page & Public API | Page CRUD, public aggregation, version info | Complete | 2026-07-04 |
| 05 | File Upload & Media | Upload, chunked upload, thumbnails, storage policies, direct links | Complete | 2026-07-05 |
| 06 | Comment & Search | Comments with nesting, FTS5 search | Complete | 2026-07-10 |
| 07 | Statistics & Links | Visitor tracking, analytics, friend links | Complete | 2026-07-11 |
| 08 | Album & Doc Series | Albums with categories, document series | Complete | 2026-07-12 |
| 09 | SEO & Music & Notifications | RSS, sitemap, music proxy, notifications, subscribers | Complete | 2026-07-14 |
| 10 | Scheduled Tasks | Cron jobs, backup, view sync, cleanup | Complete | 2026-07-16 |
| 11 | Migration & Integration | Migration tool, API compat tests (292 tests) | Complete | 2026-07-18 |

### Verification (Pending)

| Phase | Name | Goal | Priority | Dependencies |
|-------|------|------|----------|--------------|
| 12 | API Inventory & Auth & Settings Verification | 4/5 | In Progress|  |
| 13 | Content Verification | Verify article/category/tag/page/file/comment/search endpoints | P0 | Phase 12 |
| 14 | Features Verification | Verify statistics/links/album/doc-series/SEO/music/notifications/cron/backup | P1 | Phase 12 |
| 15 | Final Integration & Cutover | Full regression, browser E2E walkthrough, production cutover | P0 | Phases 12-14 |

---

### Phase 12: API Inventory & Auth & Settings Verification

**Goal:** Systematically collect all API calls made by the frontend; verify auth and settings endpoints work correctly with the frontend

**Verification Method:** Three-layer verification (D-260)

1. Scan frontend source code for all API calls → build complete endpoint inventory
2. For each endpoint, read Go handler source code → document expected request/response format
3. Browser walkthrough with NestJS backend → confirm functionality

**Plans:** 4/5 plans executed

Plans:

- [ ] PLAN.md
- [x] 12-01-PLAN.md — Build complete frontend API endpoint inventory (188 endpoints, Markdown table, cross-reference NestJS)
- [x] 12-02-PLAN.md — Auth verification (login field-by-field, token refresh dual-channel, captcha flow, 501 format)
- [x] 12-03-PLAN.md — Settings verification (unflatten, non-admin filtering, flat update format, site-config, 501 format)
- [x] 12-04-PLAN.md — Go comparison risk marking (per-endpoint risk levels, prioritized summary for Phases 13-15)

**Success Criteria:**

- Complete inventory of all frontend API calls (endpoint, method, params, response fields used)
- Auth login returns correct token structure and user info matching Go handler
- Token refresh works via both header and body channels
- Unimplemented auth endpoints return correct 501 format
- Captcha flow end-to-end verified (config → image → login)
- GET /api/public/site-config returns all public keys (290+) with correct nesting
- POST /api/settings/update accepts flat key-value pairs and persists correctly
- POST /api/settings/get-by-keys returns correct values for admin and non-admin
- Version endpoint returns correct format
- Go comparison risk marking complete for all 188 endpoints

---

### Phase 13: Content Verification

**Goal:** Verify all content-related endpoints match Go backend behavior — articles, categories, tags, pages, file upload, comments, search

**Success Criteria:**

- Article CRUD works from frontend admin panel
- Public article list renders correctly with pagination, filters, sorting
- Article detail page loads with correct content, prev/next, related articles
- Category and tag management works in admin panel
- Page CRUD works from admin panel
- Single file upload works from frontend
- Chunked upload works for large files
- Thumbnails generate and display correctly
- File manager folder tree works
- Direct links work
- Visitors can post comments from frontend
- Nested replies display correctly
- Comment moderation (approve/reject) works in admin
- Full-text search returns relevant results
- All response fields match Go backend (field names, types, nesting)

---

### Phase 14: Features Verification

**Goal:** Verify all auxiliary feature endpoints — statistics, friend links, albums, doc series, SEO, music, notifications, scheduled tasks, backup

**Success Criteria:**

- Visitor tracking records visits correctly
- Admin statistics dashboard displays data
- Friend link CRUD works
- Friend link apply/review workflow works
- Public friend links display correctly
- Album CRUD with categories works
- Album batch import/export works
- Public albums display correctly
- Document series CRUD works
- Series article ordering works
- RSS feed valid and accessible
- Sitemap XML valid and accessible
- robots.txt correct
- Music playlist loads
- Notification management works
- Subscriber subscribe/unsubscribe works
- All cron jobs trigger and execute correctly
- Backup creates and restores correctly
- No startup log spam (D-264)

---

### Phase 15: Final Integration & Cutover

**Goal:** Full regression test and production cutover

**Success Criteria:**

- All frontend pages work without errors
- All admin panel functions work
- No console errors in browser
- Performance acceptable (page load < 3s)
- Production-ready deployment documented

---

## Requirement Traceability

| Requirement ID | Phase | Verification Phase | Description |
|---------------|-------|--------------------|-------------|
| INFRA-01 | 01 | — | NestJS project scaffold on port 8091 |
| INFRA-02 | 01 | — | Drizzle ORM + SQLite connection |
| INFRA-03 | 01 | — | SQLite WAL mode + busy_timeout |
| INFRA-04 | 01 | — | Global response format interceptor |
| INFRA-05 | 01 | — | Sqids ID encode/decode with Go-compatible seed |
| INFRA-06 | 01 | — | Drizzle schema definitions for all 30 tables |
| AUTH-01 | 02 | 12 | Admin login with JWT |
| AUTH-02 | 02 | 12 | JWT token refresh |
| AUTH-03 | 02 | 12 | JWT compatible with Go backend tokens |
| USER-01 | 02 | 12 | User profile management |
| SETTING-01 | 02 | 12 | Site settings read/update |
| SETTING-02 | 02 | 12 | Public site config query |
| ARTICLE-01 | 03 | 13 | Article CRUD with draft/published/archived |
| ARTICLE-02 | 03 | 13 | Article list with pagination and filters |
| ARTICLE-03 | 03 | 13 | Public article browsing |
| CATEGORY-01 | 03 | 13 | Category CRUD with sorting |
| TAG-01 | 03 | 13 | Tag CRUD with article association |
| PAGE-01 | 04 | 13 | Page CRUD with public/private |
| PUBLIC-01 | 04 | 12 | Public aggregation endpoints |
| VERSION-01 | 04 | 12 | Version info API |
| FILE-01 | 05 | 13 | Single file upload |
| FILE-02 | 05 | 13 | Chunked upload with session management |
| THUMB-01 | 05 | 13 | Thumbnail generation |
| STORAGE-01 | 05 | 13 | Storage policy CRUD (local) |
| LINK-DIRECT-01 | 05 | 13 | Direct link CRUD and short-link access |
| COMMENT-01 | 06 | 13 | Comment CRUD with nested replies and moderation |
| SEARCH-01 | 06 | 13 | Full-text search via FTS5 |
| STATS-01 | 07 | 14 | Visitor tracking and logging |
| STATS-02 | 07 | 14 | Statistics analytics (trends, devices, sources) |
| LINK-FRIEND-01 | 07 | 14 | Friend link CRUD with health check |
| ALBUM-01 | 08 | 14 | Album CRUD with categories |
| DOCSERIES-01 | 08 | 14 | Document series CRUD |
| RSS-01 | 09 | 14 | RSS/Atom feed generation |
| SITEMAP-01 | 09 | 14 | Sitemap XML generation |
| MUSIC-01 | 09 | 14 | Music playlist data API |
| NOTIF-01 | 09 | 14 | Notification management |
| SUBSCRIBER-01 | 09 | 14 | Subscriber subscribe/unsubscribe |
| CRON-01 | 10 | 14 | Scheduled tasks (8 job types) |
| MIGRATION-01 | 11 | — | SQLite to SQLite migration tool |
| INTEGRATION-01 | 11 | 15 | End-to-end API compatibility testing |

---

*Last updated: 2026-07-19*
