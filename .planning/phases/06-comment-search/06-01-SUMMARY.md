---
phase: 06-comment-search
plan: 01
subsystem: comment
tags: [repository, dto, markdown, rate-limiter, error-codes]
dependency_graph:
  requires: [comment.schema, database.module, article.sanitize, drizzle-orm, marked, class-validator, class-transformer]
  provides: [CommentRepository, CreateCommentDto, AdminListCommentDto, DeleteCommentDto, UpdateStatusCommentDto, SetPinCommentDto, UpdateContentCommentDto, UpdateCommentInfoDto, CommentResponseDto, ListCommentResponseDto, renderCommentMarkdown, CommentRateLimiter, ErrorCodes extensions]
  affects: [comment.service, comment.controller]
tech_stack:
  added: [marked@18.0.5]
  patterns: [drizzle-query-builder, in-memory-rate-limiting, marked-gfm-breaks, dompurify-sanitization]
key_files:
  created:
    - server/src/comment/comment.repository.ts
    - server/src/comment/comment.repository.spec.ts
    - server/src/comment/dto/create-comment.dto.ts
    - server/src/comment/dto/admin-list-comment.dto.ts
    - server/src/comment/dto/delete-comment.dto.ts
    - server/src/comment/dto/update-status-comment.dto.ts
    - server/src/comment/dto/set-pin-comment.dto.ts
    - server/src/comment/dto/update-content-comment.dto.ts
    - server/src/comment/dto/update-comment-info.dto.ts
    - server/src/comment/dto/comment-response.dto.ts
    - server/src/comment/comment-markdown.ts
    - server/src/comment/comment-markdown.spec.ts
    - server/src/comment/comment-rate-limiter.ts
    - server/src/comment/comment-rate-limiter.spec.ts
  modified:
    - server/src/common/constants/error-codes.ts
    - server/package.json
decisions:
  - D-122: marked with GFM+breaks for comment Markdown rendering
  - D-124: isomorphic-dompurify sanitization for comment HTML output
  - D-130: In-memory Map rate limiting with minute-key format and 70s cleanup
  - D-133: Safe like count increment/decrement with GREATEST for min 0
  - D-134: setPin uses Date for pinnedAt=true, null for pinnedAt=false
metrics:
  duration: 1195s
  completed_date: "2026-07-08"
  tasks: 2
  files_created: 14
  files_modified: 2
  tests: 35
status: complete
---

# Phase 06 Plan 01: Comment Data Layer & Utilities Summary

CommentRepository with 13 Drizzle query methods, 8+2 DTO classes matching Go backend, Markdown renderer using marked+dompurify, in-memory rate limiter with 70s TTL cleanup, and 6 new error code entries.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create CommentRepository with all Drizzle query methods | 1c20866 | comment.repository.ts, comment.repository.spec.ts |
| 2 | Create all 8 comment DTOs, comment-markdown renderer, comment-rate-limiter, and extend error codes | 92ba11e | dto/*.ts (8 files), comment-markdown.ts, comment-rate-limiter.ts, error-codes.ts |

## Key Artifacts

### CommentRepository (13 methods)
- `findAllPublishedByPath(targetPath)` - status=1, deletedAt null, limit 500
- `findAllPublishedPaginated(page, pageSize)` - paginated published comments
- `findById(dbId)` - single comment by DB ID
- `findManyByIDs(dbIds)` - batch query by DB IDs
- `create(params)` - insert comment with all fields
- `adminList(filters)` - 6 filter params with pagination
- `softDelete(dbIds)` - set deletedAt=now
- `updateStatus(dbId, status)` - update status field
- `updateContent(dbId, content, contentHtml)` - update content + HTML
- `updateCommentInfo(dbId, data)` - update nickname/email/website
- `setPin(dbId, isPinned)` - set/clear pinnedAt
- `incrementLikeCount(dbId)` - +1 likeCount
- `decrementLikeCount(dbId)` - -1 likeCount (min 0 via GREATEST)

### DTOs (8 request + 2 response)
- CreateCommentDto: target_path, target_title, parent_id, reply_to_id, nickname, email, website, content, is_anonymous
- AdminListCommentDto: page, pageSize, nickname, email, target_path, ip_address, content, status
- DeleteCommentDto: ids (string array)
- UpdateStatusCommentDto: status (1/2/3)
- SetPinCommentDto: pinned (boolean)
- UpdateContentCommentDto: content (1-1000)
- UpdateCommentInfoDto: content, nickname, email, website (all optional)
- CommentResponseDto: all Go Response fields including admin-only (email, ip_address, content, status)
- ListCommentResponseDto: list, total, total_with_children, page, pageSize, has_more

### Utilities
- `renderCommentMarkdown(content)`: marked with GFM+breaks, then sanitizeHtml via isomorphic-dompurify
- `CommentRateLimiter.checkLimit(ip, limitPerMinute)`: Map with key `comment:rate_limit:{ip}:{minute}`, 70s setTimeout cleanup

### Error Codes (6 new)
- COMMENT_RATE_LIMITED, COMMENT_PARENT_NOT_FOUND, COMMENT_REPLY_TARGET_NOT_FOUND, COMMENT_ANONYMOUS_NO_REPLY, COMMENT_ANONYMOUS_EMAIL_MISMATCH, COMMENT_NOT_FOUND

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

- 35 tests passing across 3 test files
- comment.repository.spec.ts: 17 tests (all 12+ query methods)
- comment-markdown.spec.ts: 11 tests (GFM, breaks, XSS sanitization, code, lists)
- comment-rate-limiter.spec.ts: 7 tests (limit enforcement, IP isolation, minute keys, 70s cleanup, Chinese messages)

## Self-Check: PASSED

- [x] server/src/comment/comment.repository.ts exists
- [x] server/src/comment/dto/create-comment.dto.ts exists
- [x] server/src/comment/dto/admin-list-comment.dto.ts exists
- [x] server/src/comment/dto/delete-comment.dto.ts exists
- [x] server/src/comment/dto/update-status-comment.dto.ts exists
- [x] server/src/comment/dto/set-pin-comment.dto.ts exists
- [x] server/src/comment/dto/update-content-comment.dto.ts exists
- [x] server/src/comment/dto/update-comment-info.dto.ts exists
- [x] server/src/comment/dto/comment-response.dto.ts exists
- [x] server/src/comment/comment-markdown.ts exists
- [x] server/src/comment/comment-rate-limiter.ts exists
- [x] server/src/common/constants/error-codes.ts modified
- [x] Commit 1c20866 exists
- [x] Commit 92ba11e exists
