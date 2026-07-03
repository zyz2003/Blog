---
phase: 03-article-category-tag
plan: 03
status: complete
subsystem: article-public-api
tags: [public-endpoints, pagination, filtering, archives, statistics]
requires: [03-02]
provides: [public-article-list, public-article-detail, article-archives, article-statistics, random-article, home-articles, article-by-url]
affects: [article.module, article.service, article.repository, article-response.dto, post-category.module, post-tag.module]
tech_stack:
  added: []
  patterns: [PublicArticleController separation, Go-compatible prev/next swap, extractSlugFromURL]
key_files:
  created:
    - server/src/article/public-article.controller.ts
  modified:
    - server/src/article/article.repository.ts
    - server/src/article/article.service.ts
    - server/src/article/article.module.ts
    - server/src/article/dto/article-response.dto.ts
    - server/src/post-category/post-category.module.ts
    - server/src/post-tag/post-tag.module.ts
decisions:
  - D-48: prev/next swap per Go convention (prev=newer, next=older)
  - D-49: 7 independent public service methods
  - D-51: ListHome returns all home-visible articles without pagination
  - D-65: Simple DB increment for view count in Phase 03
  - Separate PublicArticleController at /api/public/articles instead of mixing into ArticleController
metrics:
  duration: 3623s
  completed: 2026-07-03
  tasks: 2
  files: 7
---

# Phase 03 Plan 03: Public Article Endpoints Summary

7 public article endpoints with pagination, filtering, and Go-compatible response shapes

## Completed Tasks

### Task 1: Add public article queries to ArticleRepository ✅
- `listPublic` — paginated with category/tag/year/month filters, ordered by pinSort ASC + createdAt DESC
- `listHome` — all home-visible articles (showOnHome=true), ordered by pinSort + homeSort + createdAt
- `getRandom` — single random published article via ORDER BY RANDOM() LIMIT 1
- `listArchives` — year-month grouped archive summary using strftime with +8 hours timezone
- `getArticleStatistics` — aggregate stats: totalPosts, totalWords, avgWords, totalViews, categoryStats, tagStats, topViewedPosts, publishTrend
- `findByAbbrlinkOrId` — dual lookup by abbrlink first, then Sqids public ID decode
- `findPrevNextArticles` — chronological neighbors (chronoNewer/chronoOlder) for prev/next navigation
- `incrementViewCount` — atomic SQL increment via `SET view_count = view_count + 1`
- `enrichWithRelations` — helper to attach categories, tags, owner to article rows
- All public queries filter: status=PUBLISHED AND isTakedown=false AND deletedAt IS NULL

### Task 2: Implement public article service methods and controller endpoints ✅
- `PublicArticleController` at @Controller('public/articles') with @Public() class-level decorator
- `ArticleService.listPublic` — paginated list with { list, total, page, page_size }
- `ArticleService.listHome` — array of home-visible ArticleResponseDto (no pagination)
- `ArticleService.getRandom` — single ArticleResponseDto, 404 if no published articles
- `ArticleService.listArchives` — { list: [{ year, month, count }] }
- `ArticleService.getArticleStatistics` — full ArticleStatisticsDto matching Go structure
- `ArticleService.getByURL` — extractSlugFromURL + getPublic (matches Go handler.go lines 378-407)
- `ArticleService.getPublic` — ArticleDetailResponseDto with prev/next swap per Go convention
- `ArticleService.toSimpleApiResponse` — matches Go toSimpleAPIResponse (lines 695-722)
- `ArticleService.extractSlugFromURL` — supports /posts/abc123 and full URL formats
- DTOs added: SimpleArticleResponseDto, ArticleDetailResponseDto, ArchiveSummaryResponseDto, ArticleStatisticsDto + sub-types
- PostCategoryModule/PostTagModule now export their repositories for ArticleService dependency injection

## Commits
- `83c6472` — feat(03-03): add public article query methods to ArticleRepository
- `0baeaee` — feat(03-03): implement public article service methods and controller endpoints
- `dc7fddd` — chore: add .codegraph/ to .gitignore

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed require() to proper import in findByAbbrlinkOrId**
- **Found during:** Task 2 implementation
- **Issue:** Initial implementation used `require('../common/utils/sqids.util')` inside findByAbbrlinkOrId which is not idiomatic NestJS and won't work with module bundlers
- **Fix:** Moved decodePublicID and EntityType imports to top of article.repository.ts
- **Files modified:** server/src/article/article.repository.ts
- **Commit:** 0baeaee

**2. [Rule 2 - Missing] Added BadRequestException to PublicArticleController.getByURL**
- **Found during:** Task 2 implementation
- **Issue:** Initial getByURL returned plain object `{ code: 400, message: ..., data: null }` instead of using NestJS exception pattern which the global ResponseInterceptor expects
- **Fix:** Changed to throw BadRequestException for consistent error handling
- **Files modified:** server/src/article/public-article.controller.ts
- **Commit:** 0baeaee

**3. [Rule 2 - Missing] Exported PostCategoryRepository and PostTagRepository from their modules**
- **Found during:** Task 2 implementation
- **Issue:** ArticleService depends on PostCategoryRepository and PostTagRepository directly but the modules only exported the Services, not the Repositories
- **Fix:** Added PostCategoryRepository and PostTagRepository to their respective module exports arrays
- **Files modified:** server/src/post-category/post-category.module.ts, server/src/post-tag/post-tag.module.ts
- **Commit:** 0baeaee

**4. [Rule 2 - Missing] Added PostCategoryModule and PostTagModule imports to ArticleModule**
- **Found during:** Task 2 implementation
- **Issue:** ArticleModule only imported DatabaseModule but ArticleService needs PostCategoryRepository and PostTagRepository from other modules
- **Fix:** Added PostCategoryModule and PostTagModule to ArticleModule imports
- **Files modified:** server/src/article/article.module.ts
- **Commit:** 0baeaee

## Known Stubs

- `related_articles` in getPublic response always returns empty array — Go uses FindRelatedArticles with more complex logic; deferred to a future phase
- `comment_count` in toApiResponse is hardcoded to 0 — Phase 06 will add comment integration

## Self-Check: PASSED

All created and modified files verified present on disk. All commit hashes verified in git log. TypeScript compilation passes.
