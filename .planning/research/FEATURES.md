# Features Research

**Researched:** 2026-06-28
**Domain:** Blog CMS Backend Features (Go → NestJS + SQLite migration)
**Source:** anheyu-app Go backend codebase analysis

## Executive Summary

The anheyu-app backend is a comprehensive blog CMS with **multi-user support**, **advanced media management**, **visitor analytics**, and **theme customization**. It goes beyond basic blog functionality with features like collaborative article creation, scheduled publishing, version history, and multiple cloud storage integrations.

**Primary recommendation:** Replicate all table-stakes features in Phase 1-3; defer PRO features (paid content, OAuth, AI features) to later phases as aligned with PROJECT.md scope.

---

## Table Stakes (Must Have)

These are non-negotiable features that any blog CMS backend must have. Users will leave if these are missing.

### Core Content Management

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Article CRUD** | Medium | Create, read, update, delete articles with Markdown/HTML content, cover images, SEO metadata |
| **Article Status Workflow** | Medium | DRAFT → PUBLISHED → ARCHIVED, plus SCHEDULED for timed publishing |
| **Categories & Tags** | Low | Multi-category and multi-tag support per article |
| **Page Management** | Low | Static pages (About, Friends, etc.) with path-based routing |
| **Document Series** | Medium | Ordered article collections for documentation/tutorial series |
| **Article History** | High | Version history with compare/restore capabilities |
| **Search** | Medium | Full-text search across articles (title, content, keywords) |

### User & Authentication

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Email/Password Auth** | Medium | Registration, login, password reset flow |
| **JWT Token System** | Medium | Access token + refresh token with expiry |
| **User Roles/Groups** | Low | Admin vs. regular user permissions |
| **User Profile Management** | Low | Avatar, nickname, website, email management |
| **Multi-user Support** | Medium | Multiple authors with ownership tracking |

### Media & File Management

| Feature | Complexity | Description |
|---------|------------|-------------|
| **File Upload** | High | Chunked upload with session management, progress tracking |
| **File Manager** | High | Folder tree structure, rename, move, copy, delete operations |
| **Multiple Storage Providers** | High | Local, Aliyun OSS, Tencent COS, Qiniu Kodo, AWS S3, OneDrive |
| **Direct Link Generation** | Medium | Shareable download links with expiry |
| **Thumbnail Generation** | High | Auto-generated thumbnails for images, async processing |
| **Image Style Processing** | Medium | On-the-fly image transformations (resize, crop, format) |

### Comment System

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Nested Comments** | Medium | Threaded replies with parent-child relationships |
| **Comment Moderation** | Low | Admin approval workflow (pending → published) |
| **Comment Images** | Medium | Image upload within comments |
| **Like System** | Low | Upvote/like tracking per comment |
| **Pinned Comments** | Low | Admin can pin comments to top |
| **IP Location Display** | Low | Geolocation from IP address |
| **QQ Info Integration** | Low | Fetch QQ avatar/nickname for Chinese users |

### Visitor Analytics

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Page View Tracking** | Medium | Automatic visit logging with user agent, IP, referrer |
| **Basic Statistics** | Low | Today/yesterday/month/year view counts |
| **Visitor Analytics** | High | Unique visitors, trends, device/browser breakdown |
| **Top Pages** | Low | Most viewed pages ranking |
| **Visitor Logs** | Medium | Detailed access logs with filtering |

### Site Configuration

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Settings Management** | Medium | Key-value configuration with admin UI |
| **Site Config API** | Low | Public configuration for frontend consumption |
| **Config Backup/Restore** | Medium | Export/import configuration as JSON |
| **Email Testing** | Low | SMTP configuration validation |

### SEO & Discovery

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Sitemap Generation** | Medium | XML sitemap for search engines |
| **RSS/Atom Feeds** | Medium | RSS 2.0, Atom 1.0, generic feed endpoints |
| **Robots.txt** | Low | Search engine crawling rules |
| **Archive by Date** | Low | Year/month-based article grouping |

### Link Management (Friend Links)

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Link Applications** | Medium | Public form to request friend link exchange |
| **Link Categories** | Low | Categorize friend links |
| **Link Health Check** | High | Automated periodic checking of link availability |
| **Random Links** | Low | Display random subset of links |

### Theme System

| Feature | Complexity | Description |
|---------|------------|-------------|
| **Theme Installation** | High | Download from URL, upload ZIP, validate structure |
| **Theme Switching** | Low | Activate/deactivate themes |
| **Theme Configuration** | High | Per-theme settings schema with user customization |
| **Theme Marketplace** | Medium | Curated list of available themes |
| **SSR Theme Support** | High | Server-side rendering for Next.js themes |

---

## Differentiators (Competitive Advantage)

These features set anheyu-app apart from basic blog CMS platforms.

### Advanced Content Features

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Multi-user Collaborative Articles** | High | Multiple authors can contribute to same article with review workflow |
| **Article Review Workflow** | High | PENDING → APPROVED/REJECTED with reviewer comments |
| **Custom Publication Date** | Low | Backdate or future-date articles beyond scheduled publishing |
| **Primary Color Extraction** | Medium | Auto-extract dominant color from cover/top images |
| **Reading Time & Word Count** | Low | Auto-calculated reading metrics |
| **Article Take-down** | Low | Admin can remove from public view while keeping in backend |
| **Membership Exclusion** | Low | Mark articles as paid-only even for members |

### Media Advanced Features

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Chunked Upload with Resume** | High | Large file upload with progress and retry capability |
| **Universal Signed Download** | Medium | Secure, time-limited download URLs for private files |
| **Folder View Configuration** | Medium | Custom view settings per folder (grid/list, sort order) |
| **Folder Size Calculation** | Medium | Recursive size computation for directories |
| **Folder Tree API** | Low | Full hierarchical structure for UI navigation |
| **File Version History** | Medium | Track multiple versions of same file |
| **Metadata Extraction** | High | EXIF, IPTC, Photoshop info from images |

### Comment Advanced Features

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Comment Export/Import** | Medium | Backup and migrate comment data |
| **Anonymous Comments** | Low | Allow comments without revealing email |
| **Weather IP Location** | Low | Return default coordinates for weather widget |
| **User Agent Parsing** | Low | Display device/browser info in admin |

### Analytics Advanced Features

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Trend Analysis** | Medium | Daily/weekly/monthly visitor trends |
| **Device/Browser Breakdown** | Medium | Analytics by user agent category |
| **Referrer Tracking** | Low | Track traffic sources |
| **Geographic Distribution** | Medium | Visitor locations by region |

### Notification System

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **User Notification Settings** | Medium | Per-user notification preferences |
| **Notification Types** | Low | Configurable notification categories |
| **Email Notifications** | Medium | Comment replies, article publishing alerts |

### Subscription System

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Email Subscription** | Medium | Users can subscribe to blog updates |
| **Verification Code** | Medium | SMS/email verification for subscriptions |
| **Unsubscribe by Token** | Low | One-click unsubscribe with persistent token |

### Captcha & Security

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Multiple Captcha Types** | High | Image captcha, Turnstile, Geetest support |
| **Rate Limiting** | Medium | Per-IP rate limits on sensitive endpoints |
| **Password Hash** | Low | bcrypt-based secure password storage |

### Music Player

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Playlist Management** | Medium | Curated music playlist with metadata |
| **Cover Color Extraction** | Medium | Dominant color from album art |
| **Song Resource Fetching** | Low | Get audio URLs for playback |

### Album/Gallery

| Feature | Complexity | Why It's Differentiating |
|---------|------------|-------------------------|
| **Album Management** | Medium | Photo albums with categories |
| **Batch Import** | Medium | Import multiple images at once |
| **Album Statistics** | Low | View count tracking per album |
| **Public Album API** | Low | Frontend gallery integration |

---

## Anti-features (Deliberately NOT Building)

These are explicitly out of scope per PROJECT.md or should be avoided.

| Feature | Reason to Exclude | Alternative Approach |
|---------|------------------|---------------------|
| **PRO Paid Content** | Out of scope per PROJECT.md | Defer to Phase 2+ |
| **Password-protected Articles** | Out of scope per PROJECT.md | Defer to Phase 2+ |
| **OAuth/SSO Login** | Out of scope per PROJECT.md | Email/password only for Phase 1 |
| **Multi-user Collaboration** | Out of scope per PROJECT.md | Single admin user initially |
| **AI Podcast Generation** | Out of scope per PROJECT.md | Defer to AI features phase |
| **AI Writing Assistance** | Out of scope per PROJECT.md | Defer to AI features phase |
| **WeChat Integration** | Low priority, China-specific | Defer or skip |
| **Multiple Redis-backed Features** | Architecture change (SQLite only) | Use in-memory or SQLite-based alternatives |
| **PostgreSQL-specific Features** | Moving to SQLite | Adapt to SQLite equivalents |
| **Go-specific Concurrency Patterns** | Different runtime (Node.js) | Use Node.js async patterns |

---

## Feature Dependencies

### Dependency Graph

```
Authentication (JWT, User Management)
├── Article Management (requires auth for CRUD)
├── File Management (requires auth for upload/modify)
├── Comment Management (requires auth for admin features)
├── Theme Management (requires auth for install/switch)
└── Settings Management (requires auth for modify)

File Management
├── Article Images (articles depend on file upload)
├── Comment Images (comments depend on file upload)
├── Avatar Upload (user profile depends on file upload)
├── Thumbnail Generation (async job after upload)
└── Storage Providers (pluggable backend for files)

Article Management
├── Categories & Tags (articles reference these)
├── Document Series (articles can belong to series)
├── Article History (versioning on update)
└── Search (indexes article content)

Comment System
├── User Auth (optional login for commenters)
├── File Upload (comment images)
└── Notification (reply alerts)

Visitor Analytics
├── Article/Page Views (tracks access to content)
└── Settings (analytics configuration)

Theme System
├── File Management (theme upload/install)
├── Settings (theme configuration storage)
└── SSR (requires Next.js integration)

Scheduled Tasks (Cron Jobs)
├── Scheduled Publishing (articles with future publish date)
├── Thumbnail Generation (async processing queue)
├── Link Health Check (periodic verification)
├── Statistics Aggregation (daily rollups)
└── Backup (config backup automation)
```

### Critical Path for Phase 1

1. **Authentication Foundation** → User model, JWT, middleware
2. **Basic Article CRUD** → Articles, categories, tags
3. **File Upload (Local)** → Single provider, no chunking initially
4. **Comment System** → Basic create/list, no nested replies initially
5. **Settings Management** → Key-value config storage

### Phase 2+ Dependencies

- **Multi-storage** requires file management foundation
- **Article history** requires stable article CRUD
- **Advanced analytics** requires visitor logging foundation
- **Theme marketplace** requires theme install/switch foundation
- **Notification system** requires user model and email service

---

## Complexity Summary

| Complexity Level | Feature Count | Examples |
|-----------------|---------------|----------|
| **High** | 8 | Chunked upload, file manager, multi-storage, thumbnail gen, article history, visitor analytics, theme install, SSR themes |
| **Medium** | 15 | Article CRUD, search, multi-user, collaborative articles, review workflow, direct links, nested comments, analytics trends, config backup, link applications, music playlist, albums, notification settings, subscriptions, captcha |
| **Low** | 20+ | Categories/tags, pages, basic comments, likes, pins, settings, sitemap, RSS, friend links, basic stats, user profile, JWT auth, rate limiting, email test, archives, link categories, weather IP, user agent parsing |

---

## Research Confidence

- **Standard features:** HIGH — verified against Go codebase handlers and schemas
- **Complexity estimates:** MEDIUM — based on code structure analysis, not implementation experience
- **Dependency mapping:** HIGH — derived from actual handler dependencies and service layers

**Valid until:** 2026-09-28 (90 days — feature set stable, no major changes expected)
