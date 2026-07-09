---
phase: 06-comment-search
plan: 03
status: complete
started: "2026-07-09"
completed: "2026-07-09"
key-files:
  created:
    - server/src/comment/comment.service.ts
    - server/src/comment/comment.service.spec.ts
  modified: []
tasks:
  total: 3
  completed: 3
deviations: []
self-check: PASSED
---

# Plan 06-03: CommentService Business Logic

## Summary

Implemented the core CommentService with all business logic matching Go backend `pkg/service/comment/service.go`:

### Task 1: Write-path and utilities
- **Create flow**: Rate limit → decode parentId/replyToId via Sqids → validate parent exists and belongs to same targetPath → validate replyTo exists and not anonymous → render Markdown via renderCommentMarkdown → compute emailMd5 via MD5 → lookup IP location → check forbidden words (sets status=2/Pending if detected) → detect admin comment (claims + userGroupId=1 + email match → isAdmin=true, status=1) → validate anonymous comment email → create record → fire Pushoo notification
- **toResponseDTO**: Generates public ID, re-renders Markdown, applies showUA/showRegion settings, includes admin-only fields (email, ip_address, content, status) when isAdminView=true, renders image URLs
- **lookupIPLocation**: Delegates to GeoIPService when available (Wave 4), falls back to direct HTTP call to NSUUU API
- **renderHTMLURLs**: Replaces `anzhiyu://file/` URIs with signed download URLs

### Task 2: Read-path
- **ListByPath**: Loads up to 500 comments, builds tree in memory, sorts roots (pinned first by pinnedAt desc, then createdAt desc), paginates roots, returns 3 chainHeads with full chains per D-119
- **ListLatest**: Flat paginated list of published comments with parent/replyTo info per D-121
- **ListChildren**: Preview mode (page=1, pageSize<=3) with 3 chainHeads + chains; normal pagination otherwise per D-120

### Task 3: Admin operations
- **LikeComment/UnlikeComment**: Increment/decrement likeCount (min 0) per D-133
- **SetPin**: Sets/clears pinnedAt per D-134
- **UpdateStatus**: Changes status field (1=Published, 2=Pending, 3=Rejected)
- **UpdateContent**: Updates content and re-renders contentHtml via renderCommentMarkdown per D-137
- **UpdateCommentInfo**: Updates nickname, email, emailMd5, website without modifying content
- **Delete**: Soft-deletes by setting deletedAt per D-136
- **UploadImage**: Delegates to UploadService with comment_image policy per D-141

## Test Results

22/22 tests passing:
- Create: 10 tests (decode IDs, Markdown rendering, forbidden words, admin detection, admin email guard, anonymous validation, Pushoo notification, toResponseDTO, lookupIPLocation, renderHTMLURLs)
- ListByPath: 1 test (tree building, sorting, pagination, chainHeads)
- ListLatest: 1 test (flat list with parent/replyTo)
- ListChildren: 1 test (preview mode and normal pagination)
- Admin operations: 9 tests (Like, Unlike, SetPin×2, UpdateStatus, UpdateContent, UpdateCommentInfo, Delete, UploadImage)

## Deviations

None — all implementations match Go backend behavior per plan specifications.
