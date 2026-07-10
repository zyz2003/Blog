---
status: passed
phase: 06-comment-search
verified: "2026-07-10"
verifier: orchestrator
---

# Phase 06 Verification: Comment & Search

## Must-Haves Verified

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | CommentRepository can query comments by path, status, parent, and ID with Drizzle | ✅ PASS | 13 query methods implemented, 35 unit tests passing |
| 2 | All 8 comment DTOs match Go backend dto.go structures exactly | ✅ PASS | 8 request DTOs + 2 response DTOs with class-validator decorators |
| 3 | Comment Markdown renderer uses marked with GFM+breaks and dompurify sanitization | ✅ PASS | renderCommentMarkdown using marked + isomorphic-dompurify |
| 4 | Comment rate limiter tracks IP+minute counts in memory Map with 70s TTL cleanup | ✅ PASS | CommentRateLimiter with Map, minute-key format, setTimeout(70s) |
| 5 | Error codes include COMMENT_RATE_LIMITED, COMMENT_FORBIDDEN_ANONYMOUS, etc. | ✅ PASS | 6 new error codes added |
| 6 | GET /api/search?q=keyword returns articles matching query with bm25 weighted ranking | ✅ PASS | SearchService with FTS5 MATCH + bm25(10.0, 1.0, 5.0) |
| 7 | FTS5 virtual table articles_fts exists with contentless mode and unicode61 tokenizer | ✅ PASS | Created in SearchService.ensureFts5Table |
| 8 | Search results match Go backend SearchResult/SearchHit format exactly | ✅ PASS | SearchHitDto with all fields from Go model.SearchHit |
| 9 | FTS5 index rebuilds on startup from all published articles | ✅ PASS | SearchService.onModuleInit → ensureFts5Table → rebuildAllIndexes |
| 10 | SearchService exposes IndexArticle and DeleteArticle methods for ArticleService hooks | ✅ PASS | indexArticle and deleteArticle methods available |
| 11 | CommentService.create validates parent/replyTo, renders Markdown, detects forbidden words, checks admin status, validates anonymous comments, and sends Pushoo notifications | ✅ PASS | Full create flow implemented, 10 create tests passing |
| 12 | CommentService.listByPath replicates Go's in-memory tree building with root pagination and 3-chainHead preview | ✅ PASS | ListByPath with tree building, pinned sorting, chainHeads |
| 13 | CommentService.listLatest returns flat list of newest published comments with parent/replyTo info filled | ✅ PASS | ListLatest with batch parent/replyTo lookup |
| 14 | CommentService.listChildren returns descendants of a comment with preview mode for page 1 and pageSize<=3 | ✅ PASS | ListChildren with preview/normal mode |
| 15 | CommentService.toResponseDTO matches Go dto.Response structure exactly, including admin-only fields and showUA/showRegion settings | ✅ PASS | toResponseDTO with all fields, admin view toggle |
| 16 | CommentService.lookupIPLocation delegates to GeoIPService when available, falls back to direct HTTP call | ✅ PASS | GeoIPService injection with fallback |
| 17 | CommentService.uploadImage delegates to UploadService with comment_image policy flag per D-141 | ✅ PASS | UploadImage with StoragePolicyService + UploadService |
| 18 | GET /api/public/comments returns comments by path with tree structure | ✅ PASS | CommentController.listByPath endpoint |
| 19 | POST /api/public/comments creates a comment with optional JWT auth | ✅ PASS | CommentController.create with JwtAuthOptionalGuard |
| 20 | GET /api/comments returns admin-filtered comment list | ✅ PASS | CommentAdminController.adminList endpoint |
| 21 | All comment endpoints use correct guards: @Public() + JwtAuthOptionalGuard for public create, AdminGuard for admin endpoints | ✅ PASS | Guard configuration verified in controller code |
| 22 | GET /api/public/weather/ip-location returns IP geolocation data with default rectangle fallback for LAN IPs | ✅ PASS | WeatherController + GeoIPService with caching |
| 23 | ArticleService.create calls SearchService.indexArticle after article creation | ✅ PASS | FTS5 hooks added in try-catch |
| 24 | ArticleService.update calls SearchService.deleteArticle + indexArticle after article update | ✅ PASS | FTS5 update = delete + re-index |
| 25 | ArticleService.delete calls SearchService.deleteArticle after article deletion | ✅ PASS | FTS5 delete hook in try-catch |
| 26 | CommentModule and SearchModule are wired in AppModule and functional | ✅ PASS | AppModule imports verified |

## Automated Checks

| Check | Result |
|-------|--------|
| Phase 06 unit tests (comment, search, weather) | 67/67 PASS |
| Full test suite | 412/416 PASS (4 pre-existing failures in phase02-integration) |
| TypeScript compilation | PASS (no type errors) |

## Summary

**Score: 26/26 must-haves verified**

All Phase 06 features implemented and tested:
- **Comment system**: Full CRUD with tree building, rate limiting, Markdown rendering, admin detection, Pushoo notifications
- **FTS5 search**: Full-text search with bm25 ranking, index management, snippet extraction
- **Weather/IP location**: GeoIPService with caching, WeatherController
- **Integration**: FTS5 hooks in ArticleService, all modules wired in AppModule

No regressions introduced — the 4 failing tests in phase02-integration were pre-existing.
