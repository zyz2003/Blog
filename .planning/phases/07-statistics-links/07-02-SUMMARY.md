---
phase: 07-statistics-links
plan: 02
subsystem: link
tags: [repository, dto, rate-limiter, sqids, drizzle]
dependency_graph:
  requires: [link.schema, link-category.schema, link-tag.schema, link-tag-pivot.schema, sqids.util, error-codes]
  provides: [LinkRepository, 17-link-DTOs, LinkApplyRateLimiter, EntityTypeLink]
  affects: [link.module, link.service, link.controller]
tech_stack:
  added: [drizzle-orm, class-validator, class-transformer]
  patterns: [repository-pattern, in-memory-rate-limiting, single-tag-per-link]
key_files:
  created:
    - server/src/link/link.repository.ts
    - server/src/link/link.repository.spec.ts
    - server/src/link/link-apply-rate-limiter.ts
    - server/src/link/link-apply-rate-limiter.spec.ts
    - server/src/link/dto/apply-link-request.dto.ts
    - server/src/link/dto/admin-create-link-request.dto.ts
    - server/src/link/dto/update-link-request.dto.ts
    - server/src/link/dto/review-link-request.dto.ts
    - server/src/link/dto/batch-delete-links-request.dto.ts
    - server/src/link/dto/batch-update-sort-request.dto.ts
    - server/src/link/dto/import-links-request.dto.ts
    - server/src/link/dto/link-response.dto.ts
    - server/src/link/dto/link-category-response.dto.ts
    - server/src/link/dto/link-tag-response.dto.ts
    - server/src/link/dto/link-list-response.dto.ts
    - server/src/link/dto/import-links-response.dto.ts
    - server/src/link/dto/export-links-response.dto.ts
    - server/src/link/dto/check-exists-response.dto.ts
    - server/src/link/dto/health-check-status.dto.ts
    - server/src/link/dto/create-category-request.dto.ts
    - server/src/link/dto/update-category-request.dto.ts
    - server/src/link/dto/create-tag-request.dto.ts
    - server/src/link/dto/update-tag-request.dto.ts
  modified:
    - server/src/common/utils/sqids.util.ts
decisions:
  - D-179: LinkResponseDto has single tag field (not array) matching Go backend
  - D-171: LinkApplyRateLimiter uses link:apply:{ip}:{date} key format with China timezone
  - D-175: EntityTypeLink=22 added to sqids.util.ts
metrics:
  duration: 24m
  completed: "2026-07-11"
  tasks: 3
  files: 24
  tests: 42
status: complete
---

# Phase 07 Plan 02: Link Data Layer & Utilities Summary

LinkRepository with 25+ Drizzle query methods, 17 link DTOs matching Go backend models, LinkApplyRateLimiter with IP-dimension rate limiting, and EntityTypeLink constant.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create LinkRepository with all Drizzle query methods | 7a39b58 | link.repository.ts, link.repository.spec.ts |
| 2a | Create all 17 link DTOs | de8d13b | 19 dto files |
| 2b | Create LinkApplyRateLimiter and add EntityTypeLink | a558804 | link-apply-rate-limiter.ts, link-apply-rate-limiter.spec.ts, sqids.util.ts |

## Key Results

- **LinkRepository**: 25+ query methods covering link/category/tag/pivot CRUD, all link queries filter soft-deleted records, findRandomApproved uses ORDER BY RANDOM(), batchUpdateSort uses CASE-based batch update, deleteCategoryIfUnused/deleteTagIfUnused check references before deleting, setLinkTag handles single-tag-per-link pattern
- **17 DTOs**: All request and response DTOs match Go backend model field names, types, and validation constraints exactly. LinkResponseDto has single tag field per D-179. ImportLinksRequestDto enforces max 1000 links. BatchDeleteLinksRequestDto enforces max 100 IDs.
- **LinkApplyRateLimiter**: In-memory Map with link:apply:{ip}:{date} key format per D-171, China timezone date boundaries, auto-cleanup at end of day, throws BadRequestException with Chinese message
- **EntityTypeLink**: Added as value 22 to sqids.util.ts per D-175

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

- LinkRepository: 36 tests passing
- LinkApplyRateLimiter: 6 tests passing
- Total: 42 tests passing

## Self-Check: PASSED

All 23 created files verified present. All 3 commits verified in git log. TypeScript compilation clean for all link files.
