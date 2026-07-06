---
phase: 06-comment-search
date: 2026-07-05
---

# Phase 06 Context: Comment & Search

## Domain

Visitors can post and browse comments with nested replies; all users can full-text search articles.

## Requirements

- COMMENT-01: Comment CRUD with nested replies and moderation
- SEARCH-01: Full-text search via FTS5

## Decisions

### Comment Module

| Decision | Value | Rationale |
|----------|-------|-----------|
| Schema | `comments` table already exists in `database/schemas/comment.schema.ts` | From Phase 01 |
| Nested replies | `parentId` + `replyToId` | Matches Go backend |
| Status values | `status` integer: 1=published, 2=pending, 3=rejected | Go backend default=2 (pending) |
| Public routes | `/api/public/comments/*` | Matches Go backend |
| Admin routes | `/api/comments/*` with AdminGuard | Matches Go backend |
| JWT optional | `POST /api/public/comments` uses JwtAuthOptional | Allows anonymous comments |
| Image upload | Reuse UploadService with `comment_image` policy | Phase 05 already implemented |
| IP Location | Use NSUUU API for IP geolocation | Matches Go backend |
| Weather | `/api/public/weather/ip-location` shares IP location | Same handler as comments |

### Search Module

| Decision | Value | Rationale |
|----------|-------|-----------|
| Engine | SQLite FTS5 | Zero external dependencies (no Redis/MeiliSearch) |
| Index trigger | Auto-update on article CRUD | Via service layer hooks |
| Search fields | title, content, keywords | Matches Go backend |
| Weighting | Title=10, Content=1 | Matches Go backend |
| Results | Article hits with snippet | Matches Go backend |
| Public route | `/api/search` (no auth) | Matches Go backend |

### Deferred Ideas

- QQ Info lookup (external API dependency)
- Comment export/import (admin feature, low priority)
- MeiliSearch/Redis search backends (external dependencies)

## Canonical References

- `server/src/database/schemas/comment.schema.ts` — Comment schema
- `pkg/handler/comment/handler.go` — Go comment handler
- `pkg/handler/search/handler.go` — Go search handler
- `pkg/service/search/search_service.go` — Go search service
- `internal/infra/router/router.go` — Route registration

## API Endpoints

### Comment (Public)
- `GET /api/public/comments` — ListByPath
- `GET /api/public/comments/latest` — ListLatest
- `GET /api/public/comments/:id/children` — ListChildren
- `POST /api/public/comments` — Create (JWT optional)
- `POST /api/public/comments/upload` — UploadImage (JWT optional)
- `POST /api/public/comments/:id/like` — LikeComment
- `POST /api/public/comments/:id/unlike` — UnlikeComment

### Comment (Admin)
- `GET /api/comments` — AdminList
- `DELETE /api/comments` — Delete (batch)
- `PUT /api/comments/:id` — UpdateContent
- `PUT /api/comments/:id/info` — UpdateCommentInfo
- `PUT /api/comments/:id/status` — UpdateStatus
- `PUT /api/comments/:id/pin` — SetPin

### Search
- `GET /api/search?q=&page=&size=` — Search

### Weather
- `GET /api/public/weather/ip-location` — GetIPLocation
