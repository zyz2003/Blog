---
phase: 06-comment-search
created: 2026-07-07
sampling_rate: per-task
---

# Phase 06: Comment & Search — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest v4.1.9 |
| Config file | server/vitest.config.ts |
| Quick run command | `cd server && npx vitest run --reporter=verbose` |
| Full suite command | `cd server && npx vitest run` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMMENT-01 | Comment CRUD operations | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Nested reply tree building | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Rate limiting per IP per minute | unit | `npx vitest run src/comment/comment-rate-limiter.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Forbidden word detection | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Admin comment detection | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Anonymous comment validation | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Like/unlike count operations | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Pin/unpin operations | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Comment Markdown rendering | unit | `npx vitest run src/comment/comment-markdown.spec.ts` | ❌ Wave 0 |
| COMMENT-01 | Comment response DTO format | unit | `npx vitest run src/comment/comment.service.spec.ts` | ❌ Wave 0 |
| SEARCH-01 | FTS5 index creation | unit | `npx vitest run src/search/search.service.spec.ts` | ❌ Wave 0 |
| SEARCH-01 | FTS5 search with bm25 ranking | unit | `npx vitest run src/search/search.service.spec.ts` | ❌ Wave 0 |
| SEARCH-01 | FTS5 incremental index update | unit | `npx vitest run src/search/search.service.spec.ts` | ❌ Wave 0 |
| SEARCH-01 | Search result DTO format | unit | `npx vitest run src/search/search.service.spec.ts` | ❌ Wave 0 |
| SEARCH-01 | Snippet extraction | unit | `npx vitest run src/search/search.service.spec.ts` | ❌ Wave 0 |

## Sampling Rate

- **Per task commit:** `cd server && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Wave 0 Gaps

- [ ] `server/src/comment/comment.service.spec.ts` — covers COMMENT-01 service logic
- [ ] `server/src/comment/comment-rate-limiter.spec.ts` — covers rate limiting
- [ ] `server/src/comment/comment-markdown.spec.ts` — covers Markdown rendering
- [ ] `server/src/search/search.service.spec.ts` — covers SEARCH-01 FTS5 operations
- [ ] Framework install: `npm install marked` — marked not yet in package.json
