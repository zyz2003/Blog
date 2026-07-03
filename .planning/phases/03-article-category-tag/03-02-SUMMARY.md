---
phase: 03-article-category-tag
plan: 02
status: complete
---

# Plan 03-02 Summary: Article Admin CRUD

## Completed Tasks

### Task 1: Create article DTOs and repository with junction table queries ✅
- `dto/create-article.dto.ts` — 25+ fields matching Go CreateArticleRequest
- `dto/update-article.dto.ts` — PartialType of CreateArticleDto, all fields optional
- `dto/article-response.dto.ts` — TypeScript interface matching Go ArticleResponse with 30+ fields
- `article.repository.ts` — Full repository with junction table queries, calculatePostStats, diffIDs

### Task 2: Implement ArticleService with toApiResponse and CRUD logic ✅
- `article.service.ts` — toApiResponse matching Go ToAPIResponse exactly, CRUD with Sqids ID decoding, category/tag count sync, validateAbbrlink

### Task 3: Install isomorphic-dompurify and implement HTML sanitization ✅
- `article.sanitize.ts` — sanitizeHtml() wrapping DOMPurify with ALLOWED_TAGS/ALLOWED_ATTR
- isomorphic-dompurify + @types/dompurify installed

### Task 4: Implement ArticleController and wire ArticleModule ✅
- `article.controller.ts` — @Controller('articles') with admin CRUD endpoints + 501 stubs
- `article.module.ts` — Wired with DatabaseModule, exports ArticleService

## Additional Changes
- `post-category.repository.ts` — Added incrementCount/decrementCount
- `post-tag.repository.ts` — Added incrementCount/decrementCount
- `error-codes.ts` — Added ARTICLE_NOT_FOUND, ABBRLINK_CONFLICT, ABBRLINK_INVALID, ARTICLE_CREATE_FAILED, ARTICLE_UPDATE_FAILED

## Commits
- `a92de5a` — feat(03-02): implement article admin CRUD with Go-compatible response shape

## Verification
- TypeScript compilation passes (npx tsc --noEmit)
