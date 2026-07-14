---
phase: 09-seo-music-notifications
reviewed: 2026-07-14T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - server/src/rss/rss.service.ts
  - server/src/rss/rss.controller.ts
  - server/src/rss/rss.module.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 09: Code Review Report — RSS Module

**Reviewed:** 2026-07-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the RSS module implementation (rss.service.ts, rss.controller.ts, rss.module.ts) against the plan (09-01-PLAN.md) and the existing codebase patterns. Found 2 critical bugs and 4 warnings.

The most significant issue is that `RssService.generateFeed()` calls `ArticleService.listPublic()`, which returns `toApiResponse`-transformed objects with `content_html: null` (because `includeHTML=false`). This means `getArticleDescription()` never uses the HTML-stripping path (Priority 2) and always falls through to raw Markdown (Priority 3), producing different descriptions than the Go backend. The second critical issue is that the controller methods are synchronous `void` but call an `async` handler without `await`, creating unhandled promise rejection risk.

## Critical Issues

### CR-01: RSS descriptions use raw Markdown instead of stripped HTML — Go backend parity broken

**File:** `server/src/rss/rss.service.ts:66-69` (generateFeed) and `server/src/rss/rss.service.ts:150-156` (getArticleDescription)
**Issue:** `generateFeed()` calls `this.articleService.listPublic({ page: 1, pageSize: options.itemCount })` which internally calls `toApiResponse(a, true, false)` with `includeHTML=false`. This sets `content_html: null` on every article object. When `getArticleDescription()` runs, Priority 2 (`article.content_html`) is always null, so it falls through to Priority 3 (raw Markdown). The Go backend strips HTML from `contentHtml` for RSS descriptions, producing clean text. The NestJS implementation produces raw Markdown text like `## Heading\n\nSome **bold** text` instead, which is both incorrect and potentially confusing in RSS readers.

**Fix:** Either (a) call `articleService.listPublic()` with a variant that includes HTML, or (b) bypass `toApiResponse` and query the repository directly for raw DB rows that include `contentHtml`, or (c) add a new method to ArticleService that returns articles with HTML content for RSS use:

```typescript
// Option (c): Add to ArticleService
async listPublicForRSS(pageSize: number) {
  const result = await this.articleRepo.listPublic({ page: 1, pageSize });
  return {
    list: result.list, // raw DB rows with contentHtml
    total: result.total,
  };
}
```

Then in `RssService.generateFeed()`:
```typescript
const result = await this.articleService.listPublicForRSS(options.itemCount);
```

And update `buildRSSItem` to use DB column names (camelCase: `article.contentHtml`, `article.createdAt`, `article.copyrightAuthor`, `article.postCategories`, `article.postTags`).

### CR-02: Controller methods are synchronous void but call async handler — unhandled promise rejection risk

**File:** `server/src/rss/rss.controller.ts:19-20, 28-29, 37-38`
**Issue:** The three controller methods (`getRSSFeed`, `getFeedXml`, `getAtomXml`) have `void` return type and call `this.handleFeedRequest()` (which is `async`) without `await`. This creates a fire-and-forget pattern where:
1. The method returns `undefined` immediately
2. The async handler runs in the background
3. If any error occurs before the try-catch in `handleFeedRequest` is entered (e.g., a synchronous throw from `rssService.getBaseURL`), the resulting promise rejection is unhandled

Compare with `sitemap.controller.ts:19` which correctly uses `async getSitemap(@Res() res: Response): Promise<void>`.

**Fix:** Make the controller methods `async` and `await` the handler:

```typescript
@Get('rss.xml')
async getRSSFeed(@Req() req: Request, @Res() res: Response): Promise<void> {
  await this.handleFeedRequest(req, res, 'application/rss+xml; charset=utf-8');
}

@Get('feed.xml')
async getFeedXml(@Req() req: Request, @Res() res: Response): Promise<void> {
  await this.handleFeedRequest(req, res, 'application/rss+xml; charset=utf-8');
}

@Get('atom.xml')
async getAtomXml(@Req() req: Request, @Res() res: Response): Promise<void> {
  await this.handleFeedRequest(req, res, 'application/atom+xml; charset=utf-8');
}
```

## Warnings

### WR-01: Missing `<pubDate>` element in RSS channel

**File:** `server/src/rss/rss.service.ts:176-182`
**Issue:** The `generateXML()` method outputs `<lastBuildDate>` in the `<channel>` element but does not output `<pubDate>`, even though the `RSSFeed` interface has a `pubDate` field and `generateFeed()` populates it. RSS 2.0 spec recommends `<pubDate>` in the channel element. The Go backend likely includes this element. The `pubDate` field is computed but silently dropped during XML generation.

**Fix:** Add the `<pubDate>` element after `<language>`:

```typescript
parts.push(`    <language>${feed.language}</language>`);
parts.push(`    <pubDate>${feed.pubDate}</pubDate>`);
parts.push(`    <lastBuildDate>${feed.lastBuildDate}</lastBuildDate>`);
```

### WR-02: Unused imports in rss.service.ts

**File:** `server/src/rss/rss.service.ts:5-6`
**Issue:** `generatePublicID` and `EntityType` are imported from `sqids.util` but never used in the service. `ErrorCodes` is imported from `error-codes.ts` but never used. These are dead imports that add unnecessary coupling.

**Fix:** Remove the unused imports:

```typescript
// Remove line 5:
// import { generatePublicID, EntityType } from '../common/utils/sqids.util';
// Remove line 6:
// import { ErrorCodes } from '../common/constants/error-codes';
```

Note: If CR-01 is fixed by switching to raw DB rows, `generatePublicID` and `EntityType` may become needed for building article links. Re-evaluate after CR-01 fix.

### WR-03: atom:link self-reference hardcoded to /rss.xml regardless of actual request path

**File:**File:** `server/src/rss/rss.service.ts:182`
**Issue:** The `atom:link` self-reference is always `href="{feed.link}/rss.xml"`, even when the request is for `/feed.xml` or `/atom.xml`. Per Atom spec, the `rel="self"` link should identify the feed's canonical URL. When a client requests `/atom.xml`, the self-reference pointing to `/rss.xml` is misleading. This may match Go backend behavior (the plan specifies this format), but it's technically incorrect.

**Fix:** If Go backend does the same, document this as intentional parity. If Go backend varies the self-reference by path, pass the request path to `generateXML` and use it:

```typescript
// In generateXML, accept optional selfPath parameter:
generateXML(feed: RSSFeed, selfPath: string = 'rss.xml'): string {
  // ...
  parts.push(`    <atom:link href="${this.xmlEscape(feed.link)}/${selfPath}" rel="self" type="application/rss+xml"/>`);
  // ...
}
```

### WR-04: `feed.language` output without xmlEscape in generateXML

**File:** `server/src/rss/rss.service.ts:180`
**Issue:** `feed.language` is output directly without `xmlEscape()`, while all other text content fields (`title`, `link`, `description`, etc.) are escaped. Currently `language` is hardcoded to `'zh-CN'` which is safe, but this is inconsistent and would become a vulnerability if the language value ever came from user-controlled input (e.g., settings).

**Fix:** Apply `xmlEscape()` consistently:

```typescript
parts.push(`    <language>${this.xmlEscape(feed.language)}</language>`);
```

## Info

### IN-01: truncateUTF8 does not add ellipsis indicator

**File:** `server/src/rss/rss.service.ts:271-275`
**Issue:** When `truncateUTF8` truncates text, it does not append an ellipsis ("...") or any indicator that the text was cut. RSS readers and users cannot distinguish a truncated description from a complete one that happens to be exactly 200 characters.

**Fix:** Consider appending an ellipsis when truncating:

```typescript
private truncateUTF8(text: string, maxLen: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLen) return text;
  return chars.slice(0, maxLen - 1).join('') + '...';
}
```

### IN-02: RSS_GENERATE_GENERATE_FAILED error code defined but never used

**File:** `server/src/common/constants/error-codes.ts:154`
**Issue:** The error code `RSS_GENERATE_GENERATE_FAILED` was added to `error-codes.ts` as part of this plan, but it is never referenced in `rss.service.ts` or `rss.controller.ts`. The controller's error handler sends a plain text string `'RSS feed generation failed'` instead of using the structured error code pattern used elsewhere in the codebase.

**Fix:** Either use the error code in the controller's error handler, or remove it from `error-codes.ts` if the plain text error response is intentional (matching Go backend behavior):

```typescript
// Option A: Use the error code
catch (error) {
  this.logger.error('RSS feed generation failed', error);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(500).send(ErrorCodes.RSS_GENERATE_GENERATE_FAILED);
}
```

---

_Reviewed: 2026-07-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
