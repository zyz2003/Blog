---
phase: 03-article-category-tag
plan: 01
subsystem: database, post-category, post-tag
tags: [schema, crud, junction-table, sqids, soft-delete]
dependency_graph:
  requires: [phase-01-infrastructure, phase-02-auth-settings]
  provides: [article_post_categories, article_post_tags, PostCategoryModule, PostTagModule]
  affects: [app.module.ts, error-codes.ts, schemas/index.ts]
tech_stack:
  added: []
  patterns: [repository-pattern, sqids-id-encoding, snake_case-response, soft-delete-filter]
key_files:
  created:
    - server/src/database/schemas/article-post-category-pivot.schema.ts
    - server/src/database/schemas/article-post-tag-pivot.schema.ts
    - server/src/post-category/post-category.module.ts
    - server/src/post-category/post-category.controller.ts
    - server/src/post-category/post-category.service.ts
    - server/src/post-category/post-category.repository.ts
    - server/src/post-category/dto/create-post-category.dto.ts
    - server/src/post-category/dto/update-post-category.dto.ts
    - server/src/post-tag/post-tag.module.ts
    - server/src/post-tag/post-tag.controller.ts
    - server/src/post-tag/post-tag.service.ts
    - server/src/post-tag/post-tag.repository.ts
    - server/src/post-tag/dto/create-post-tag.dto.ts
    - server/src/post-tag/dto/update-post-tag.dto.ts
  modified:
    - server/src/database/schemas/index.ts
    - server/src/common/constants/error-codes.ts
    - server/src/app.module.ts
decisions:
  - D-57: Both article-category and article-tag use M2M junction tables (matching Go backend)
  - D-59: PostCategoryModule and PostTagModule are independent with own controller+service+repository
  - D-63: Sqids ID decode in controller, pass dbId to service
  - Manual UpdateDto instead of PartialType to avoid @nestjs/mapped-types dependency
metrics:
  duration: 4123s
  completed: "2026-07-03"
  tasks: 3
  files: 17
status: complete
---

# Phase 3 Plan 1: Junction Table Schemas and PostCategory/PostTag CRUD Modules Summary

Junction table schemas for article-category and article-tag M2M relationships, plus independent PostCategory and PostTag CRUD modules with Sqids-encoded IDs and snake_case responses matching Go backend.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create junction table schemas and update barrel export | 035c0a3 | article-post-category-pivot.schema.ts, article-post-tag-pivot.schema.ts, index.ts |
| 2 | Implement PostCategory and PostTag CRUD modules | 3e242c5 | post-category/*, post-tag/*, error-codes.ts, app.module.ts |
| 3 | Schema push and verify junction tables exist in SQLite | (verification) | SQLite database |

## What Was Built

### Junction Table Schemas
- `article_post_categories` table: composite PK (article_id, post_category_id) with FK cascade deletes
- `article_post_tags` table: composite PK (article_id, post_tag_id) with FK cascade deletes
- Both follow the link-tag-pivot.schema.ts pattern with `primaryKey()` callback

### PostCategoryModule
- **GET /api/post-categories** — public list, returns array with Sqids-encoded IDs
- **POST /api/post-categories** — admin only, creates category with name uniqueness check
- **PUT /api/post-categories/:id** — admin only, updates by Sqids-decoded dbId
- **DELETE /api/post-categories/:id** — admin only, soft-deletes by setting deletedAt
- Response fields: id, created_at, updated_at, name, slug, description, count, is_series, sort_order

### PostTagModule
- **GET /api/post-tags** — public list (per Go JWTAuthOptional, using @Public())
- **POST /api/post-tags** — admin only, creates tag with name uniqueness check
- **PUT /api/post-tags/:id** — admin only, updates by Sqids-decoded dbId
- **DELETE /api/post-tags/:id** — admin only, soft-deletes by setting deletedAt
- Response fields: id, created_at, updated_at, name, slug, count

### Error Codes Added
- CATEGORY_NOT_FOUND, CATEGORY_NAME_EXISTS, TAG_NOT_FOUND, TAG_NAME_EXISTS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced PartialType with manual UpdateDto**
- **Found during:** Task 2
- **Issue:** @nestjs/mapped-types not installed, PartialType import fails
- **Fix:** Manually defined UpdatePostCategoryDto and UpdatePostTagDto with optional fields, matching existing project pattern (user/dto/update-profile.dto.ts)
- **Files modified:** update-post-category.dto.ts, update-post-tag.dto.ts
- **Commit:** 3e242c5

## Verification Results

- TypeScript compilation: PASS (zero errors)
- drizzle-kit push: PASS (changes applied)
- article_post_categories table: EXISTS with correct columns, composite PK, FK cascade
- article_post_tags table: EXISTS with correct columns, composite PK, FK cascade
- Sqids encoding: IDs encoded via generatePublicID with EntityType.PostCategory/PostTag
- Snake_case JSON: All response keys match Go PostCategoryResponse/PostTagResponse
- Soft delete: All queries filter isNull(deletedAt)
- Duplicate name: Returns 409 CONFLICT with appropriate error code

## Known Stubs

None — all functionality is fully wired.

## Threat Flags

No new threat surface beyond what the plan's threat_model covers. All admin endpoints use AdminGuard, public endpoints use @Public(), and input validation uses class-validator DTOs.

## Self-Check: PASSED

All 14 created files verified present. Both task commits (035c0a3, 3e242c5) verified in git log.
