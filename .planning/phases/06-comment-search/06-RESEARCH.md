# Phase 06: Comment & Search - Research

**Researched:** 2026-07-07
**Domain:** NestJS comment system with nested replies + SQLite FTS5 full-text search
**Confidence:** HIGH

## Summary

Phase 06 implements two major subsystems: (1) a complete comment system with nested/threaded replies, moderation workflow, like/pin operations, image upload, rate limiting, forbidden word detection, and Pushoo notification integration; and (2) a full-text search engine using SQLite FTS5 that indexes article title/content/keywords with weighted bm25 ranking. Both subsystems must precisely replicate the Go backend's API behavior, response formats, and business logic.

The comment system is the most complex feature in this phase, requiring careful replication of the Go backend's in-memory tree-building algorithm for ListByPath (which loads up to 500 comments per path, builds a descendants map, sorts root comments by pinnedAt/createdAt, paginates roots, and returns the first 3 chain heads with their full conversation chains). The search system is comparatively simpler, replacing Go's three-tier search engine (Plugin > Redis > Simple) with a single FTS5 implementation using contentless virtual tables and bm25 weighted ranking.

**Primary recommendation:** Use `marked` v18 (built-in TypeScript types, no @types/marked needed) for comment Markdown-to-HTML rendering, SQLite FTS5 with `content=''` contentless mode and `unicode61` tokenizer for search, and in-memory Map for rate limiting (replacing Go's Redis Increment pattern).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-115: Use existing `comments` table Schema (comment.schema.ts) — no Schema modifications needed
- D-116: Comment IDs use Sqids encoding (EntityTypeComment=11) for all public endpoints
- D-117: Comment status enum: 1=Published, 2=Pending, 3=Rejected; new comments default status=2 unless admin
- D-118: Nested replies use parentId + replyToId dual-field model matching Go backend
- D-119: ListByPath replicates Go's in-memory tree-building algorithm exactly (500 limit, chainHeads preview=3)
- D-120: ListChildren gets all descendants of a comment with pagination
- D-121: ListLatest returns flat list of newest published comments site-wide
- D-122: Comment Markdown→HTML uses `marked` library (lighter than markdown-it for comments)
- D-123: Comment image URL rewriting replicates Go's renderHTMLURLs (anzhiyu://file/ → signed URL + style suffix)
- D-124: Comment HTML sanitization uses isomorphic-dompurify (already installed from Phase 03)
- D-125: Content stores Markdown原文 in `content`, rendered+sanitized HTML in `contentHtml`
- D-126: Comment Create flow: rate limit → decode IDs → validate parent/replyTo → Markdown→HTML → emailMd5 → IP location → forbidden words → admin check → anonymous check → create → notify
- D-127: Admin comment: JWT claims exist + userGroupId=1 + email matches admin email → isAdminComment=true, status=Published
- D-128: Anonymous comment: isAnonymous=true → verify email matches settings comment_anonymous_email
- D-129: Non-admin using admin email → ErrAdminEmailUsedByGuest error
- D-130: Rate limiting: in-memory Map with key `comment:rate_limit:{ip}:{minute}`, matches Go Redis Increment
- D-131: Forbidden words: comma-separated from settings, detected → status=Pending (not blocked)
- D-132: AI forbidden word detection deferred to later phase
- D-133: LikeComment/UnlikeComment: +1/-1 on likeCount (min 0), return updated count
- D-134: SetPin: isPinned=true → pinnedAt=now; isPinned=false → pinnedAt=NULL
- D-135: AdminList supports filters: page, pageSize, nickname, email, targetPath, ipAddress, content, status
- D-136: Batch delete uses soft delete (deletedAt), IDs are Sqids-encoded
- D-137: UpdateContent re-renders HTML; UpdateCommentInfo updates nickname/email/website
- D-138: Response DTO matches Go's dto.Response exactly (id, created_at, pinned_at, nickname, email_md5, qq_number, avatar_url, website, content_html, is_admin_comment, is_anonymous, ip_location, user_agent, target_path, target_title, parent_id, reply_to_id, reply_to_nick, like_count, total_children, children[])
- D-139: ListByPath response: { list, total, total_with_children, page, pageSize, has_more }
- D-140: ListLatest response: total = total_with_children (flat list), children=[]
- D-141: Comment image upload reuses Phase 05 UploadService with comment_image policy flag
- D-142: Comment image upload uses JwtAuthOptionalGuard (allows visitors)
- D-143: IP geolocation uses NSUUU API (https://api.nsuuu.com/api/ip-location)
- D-144: Weather IP location endpoint returns IP location + default_rectangle for LAN IPs
- D-145: FTS5 replaces Go's three search engines; contentless mode with data in articles table
- D-146: FTS5 tokenizer: unicode61 with tokens "0" for basic CJK support
- D-147: FTS5 index columns: title(10.0), content(1.0), keywords(5.0) with bm25 ranking
- D-148: Search result format matches Go's SearchResult/SearchHit exactly
- D-149: GET /api/search is @Public(), params: q, page(default 1), size(default 10)
- D-150: FTS5 index rebuilt on startup (full rebuild from articles table)
- D-151: Article CRUD triggers FTS5 incremental updates via SearchService hooks
- D-152: Search snippet: strip HTML tags from contentHtml, truncate to 150 chars + "..."
- D-153: Pushoo notification: implement calling point and framework, read pushoo.channel/pushoo.url from settings
- D-154: Email notification deferred to Phase 09
- D-155: Pushoo two scenarios: notify admin on new comment; notify admin when their comment is replied to
- D-156: QQ info lookup deferred (qq_number field reserved as optional)
- D-157: CommentModule: CommentController (public + admin), CommentService, CommentRepository
- D-158: SearchModule: SearchController, SearchService (search + FTS5 index management)
- D-159: WeatherModule: WeatherController for GET /api/public/weather/ip-location

### Claude's Discretion
- CommentRepository Drizzle query method design
- CommentService marked configuration (extensions, plugins)
- FTS5 virtual table CREATE TABLE statement and trigger design
- SearchService snippet extraction implementation
- IP geolocation error handling and caching strategy
- Pushoo HTTP request implementation details
- Comment image URL rewriting regex details
- Admin view conditional field return strategy

### Deferred Ideas (OUT OF SCOPE)
- QQ info lookup (GET /api/public/comments/qq-info)
- AI forbidden word detection (comment_ai_detect_enable)
- Comment export/import (ExportComments/ImportComments)
- Email notification (broker.DispatchCommentNotification)
- In-app notification (Phase 09 NOTIF-01)
- FTS5 Chinese tokenization optimization (jieba-wasm/ICU)
- SearchProvider extension mechanism
- Comment review email notification
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMMENT-01 | Comment CRUD, moderation, nested replies | Full Go backend service.go analyzed (lines 1-1601); DTO structures mapped; in-memory tree algorithm documented; rate limiting, forbidden words, anonymous validation, admin detection all traced to Go source |
| SEARCH-01 | Full-text search via FTS5 | Go SimpleSearcher analyzed; FTS5 contentless table design documented; bm25 weighted ranking with title(10)/content(1)/keywords(5) confirmed; unicode61 tokenizer for CJK; snippet extraction from Go articleToSearchHit |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Comment CRUD + tree building | API / Backend | — | Business logic for nested replies, moderation, rate limiting belongs in service layer |
| Comment Markdown rendering | API / Backend | — | Server-side rendering ensures consistent HTML output matching Go backend |
| Comment rate limiting | API / Backend | — | In-memory Map tracks IP+minute counts; replaces Go's Redis Increment |
| Comment image upload | API / Backend | CDN / Static | UploadService handles storage; ServeStaticModule serves files |
| FTS5 index management | Database / Storage | API / Backend | FTS5 virtual table lives in SQLite; SearchService orchestrates index lifecycle |
| Search query execution | API / Backend | Database / Storage | SearchService queries FTS5 via Drizzle raw SQL |
| IP geolocation lookup | API / Backend | — | HTTP call to NSUUU API; result cached in comment record |
| Pushoo notification | API / Backend | — | Fire-and-forget HTTP call to Pushoo API after comment creation |
| Weather IP location | API / Backend | — | Same GeoIP service as comment IP location |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | v18.0.5 | Comment Markdown→HTML rendering | Lightweight, fast, built-in TypeScript types, configurable extensions [VERIFIED: npm registry] |
| isomorphic-dompurify | v3.18.0 | Comment HTML sanitization | Already installed from Phase 03; same sanitization for comments per D-124 [VERIFIED: npm registry] |
| better-sqlite3 | v12.11.1 | FTS5 full-text search | FTS5 confirmed enabled in compile_options; raw SQL for FTS5 operations [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sqids | v0.3.0 | Comment ID encoding (EntityTypeComment=11) | All public-facing comment IDs [VERIFIED: npm registry] |
| class-validator | v0.15.1 | DTO validation for CreateComment, AdminList, etc. | Request body/query validation [VERIFIED: npm registry] |
| class-transformer | v0.5.1 | DTO response transformation | Response serialization [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| marked | markdown-it | markdown-it already used for articles but heavier; marked is lighter and sufficient for comments per D-122 |
| @types/marked | (none needed) | marked v18 has built-in TypeScript types; @types/marked is deprecated |
| FTS5 | MeiliSearch/Redis Search | FTS5 is zero-dependency and built into SQLite; matches project goal of removing Redis/external services |

**Installation:**
```bash
npm install marked
# No @types/marked needed — marked v18 has built-in types
```

**Version verification:**
```bash
npm view marked version       # 18.0.5 (2026-06-04)
npm view isomorphic-dompurify version  # 3.18.0 (already installed)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| marked | npm | 11 yrs | 49M/wk | github.com/markedjs/marked | OK | Approved |
| @types/marked | npm | — | 1.6M/wk | none | SUS | REMOVED — deprecated, marked v18 has built-in types |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** @types/marked — removed because deprecated; marked v18 ships its own TypeScript definitions

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │           NestJS App                │
                    └──────────┬──────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
   ┌──────▼──────┐    ┌───────▼───────┐    ┌──────▼──────┐
   │CommentModule│    │ SearchModule  │    │WeatherModule│
   └──────┬──────┘    └───────┬───────┘    └──────┬──────┘
          │                    │                    │
   ┌──────┼──────────┐        │                    │
   │      │          │        │                    │
   ▼      ▼          ▼        ▼                    ▼
Public  Admin    Comment   Search              GeoIP
Comment Comment  Service   Service            Service
Ctrl    Ctrl     │         │                   │
                 │         │                   │
        ┌────────┼────────┐│                   │
        │        │        ││                   │
        ▼        ▼        ▼▼                   ▼
   Comment    Rate     Markdown   FTS5       NSUUU
   Repository Limiter  Renderer   Index      API
        │        │     (marked)   │         (HTTP)
        │        │        │       │
        ▼        ▼        ▼       ▼
   ┌─────────────────────────────────────┐
   │         SQLite Database             │
   │  ┌──────────┐  ┌────────────────┐  │
   │  │ comments │  │  articles_fts  │  │
   │  │  table   │  │  (FTS5 virtual)│  │
   │  └──────────┘  └────────────────┘  │
   └─────────────────────────────────────┘
        │
        ▼
   ┌──────────┐     ┌──────────┐
   │ Upload   │     │ Pushoo   │
   │ Service  │     │ Service  │
   │ (Phase05)│     │ (HTTP)   │
   └──────────┘     └──────────┘
```

### Recommended Project Structure
```
server/src/
├── comment/
│   ├── comment.module.ts          # Module registration
│   ├── comment.controller.ts      # Public endpoints (/api/public/comments/*)
│   ├── comment-admin.controller.ts # Admin endpoints (/api/comments/*)
│   ├── comment.service.ts         # Business logic (create, listByPath, listChildren, etc.)
│   ├── comment.repository.ts      # Drizzle queries for comments table
│   ├── comment-rate-limiter.ts    # In-memory rate limiting (Map + minute key)
│   ├── comment-markdown.ts        # marked configuration + HTML rendering
│   └── dto/
│       ├── create-comment.dto.ts
│       ├── admin-list-comment.dto.ts
│       ├── delete-comment.dto.ts
│       ├── update-status-comment.dto.ts
│       ├── set-pin-comment.dto.ts
│       ├── update-content-comment.dto.ts
│       ├── update-comment-info.dto.ts
│       └── comment-response.dto.ts
├── search/
│   ├── search.module.ts           # Module registration
│   ├── search.controller.ts       # GET /api/search
│   └── search.service.ts          # FTS5 index management + search queries
├── weather/
│   ├── weather.module.ts          # Module registration
│   ├── weather.controller.ts      # GET /api/public/weather/ip-location
│   └── geoip.service.ts           # NSUUU API client for IP location
```

### Pattern 1: Split Controller for Public/Admin Endpoints
**What:** Separate controllers for public (`/api/public/comments`) and admin (`/api/comments`) endpoints, matching the Go backend's route group separation.
**When to use:** When a module has both public and admin endpoints with different auth requirements.
**Example:**
```typescript
// comment.controller.ts — public endpoints
@Controller('public/comments')
@Public()
export class CommentController {
  @Get() listByPath(...) {}          // GET /api/public/comments
  @Get('latest') listLatest(...) {}  // GET /api/public/comments/latest
  @Get(':id/children') listChildren(...) {} // GET /api/public/comments/:id/children
  @Post() @UseGuards(JwtAuthOptionalGuard) create(...) {} // POST with optional JWT
  @Post('upload') @UseGuards(JwtAuthOptionalGuard) uploadImage(...) {}
  @Post(':id/like') like(...) {}
  @Post(':id/unlike') unlike(...) {}
}

// comment-admin.controller.ts — admin endpoints
@Controller('comments')
@UseGuards(AdminGuard)
export class CommentAdminController {
  @Get() adminList(...) {}
  @Delete() delete(...) {}
  @Put(':id') updateContent(...) {}
  @Put(':id/info') updateCommentInfo(...) {}
  @Put(':id/status') updateStatus(...) {}
  @Put(':id/pin') setPin(...) {}
}
```

### Pattern 2: In-Memory Rate Limiting (Replacing Redis Increment)
**What:** Use a Map with composite key `comment:rate_limit:{ip}:{minute}` to track comment counts per IP per minute, matching Go's Redis Increment pattern.
**When to use:** Rate limiting without Redis dependency.
**Example:**
```typescript
// comment-rate-limiter.ts
@Injectable()
export class CommentRateLimiter {
  private rateLimitMap = new Map<string, number>();

  checkLimit(ip: string, limitPerMinute: number): void {
    const minute = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '');
    const key = `comment:rate_limit:${ip}:${minute}`;
    const count = (this.rateLimitMap.get(key) || 0) + 1;
    this.rateLimitMap.set(key, count);
    if (count === 1) {
      // Set cleanup after 70 seconds (matching Go's 70s expiry)
      setTimeout(() => this.rateLimitMap.delete(key), 70_000);
    }
    if (count > limitPerMinute) {
      throw new BadRequestException('您的评论太频繁了，请稍后再试');
    }
  }
}
```

### Pattern 3: FTS5 Contentless Table with bm25 Ranking
**What:** Create a contentless FTS5 virtual table that only stores the search index (not document content), using bm25() with column weights for relevance ranking.
**When to use:** Full-text search where the source data already exists in a regular table.
**Example:**
```sql
-- Create contentless FTS5 table (data lives in articles table)
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title,
  content,
  keywords,
  content='',                    -- contentless mode
  tokenize='unicode61 tokens 0'  -- basic CJK character-level tokenization
);

-- Insert index entry
INSERT INTO articles_fts(rowid, title, content, keywords)
VALUES (articleDbId, articleTitle, strippedContent, articleKeywords);

-- Search with weighted bm25 ranking
SELECT rowid, bm25(articles_fts, 10.0, 1.0, 5.0) AS rank
FROM articles_fts
WHERE articles_fts MATCH ?
ORDER BY rank
LIMIT ? OFFSET ?;

-- Delete index entry
DELETE FROM articles_fts WHERE rowid = ?;
```

### Anti-Patterns to Avoid
- **Building comment tree in SQL:** The Go backend loads all comments for a path into memory and builds the tree in application code. Do not attempt recursive CTEs or SQL-based tree building — the in-memory algorithm is the authoritative pattern.
- **Using @types/marked:** It is deprecated. marked v18 ships built-in TypeScript types at `./lib/marked.d.ts`.
- **Using Redis for rate limiting:** Project goal is zero external dependencies. Use in-memory Map with setTimeout cleanup.
- **Storing FTS5 content redundantly:** Use `content=''` contentless mode. Article data already lives in the articles table; FTS5 only needs the index.
- **Implementing bigram tokenization in FTS5:** Standard FTS5 unicode61 cannot do bigram. Accept character-level CJK tokenization for now; defer jieba-wasm to later.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown→HTML parsing | Custom regex-based parser | `marked` library | Handles edge cases, spec compliance, XSS vectors, extensions |
| HTML sanitization | Custom tag stripper | `isomorphic-dompurify` | Battle-tested XSS prevention, configurable allowlists |
| ID encoding/decoding | Custom hash function | `sqids` util (existing) | Must match Go backend exactly; already implemented with GoRNGSource |
| Rate limiting | Custom token bucket | In-memory Map with minute keys | Matches Go's Redis Increment pattern; sufficient for single-user blog |
| Full-text search | Custom inverted index | SQLite FTS5 | Built-in, zero-dependency, bm25 ranking, unicode61 tokenizer |

**Key insight:** The comment system's complexity lies not in individual operations but in the precise replication of Go's business logic flow (rate limit → validate → render → detect → check → create → notify). Each step must match Go's behavior exactly for API compatibility.

## Common Pitfalls

### Pitfall 1: ListByPath Tree Building Order
**What goes wrong:** Building the tree incorrectly by assuming parentId always points to a root comment, or misidentifying chainHeads.
**Why it happens:** The Go algorithm traces ancestors upward to find root comments, then identifies chainHeads as comments whose replyToId equals the root ID (or is null). Skipping the ancestor trace breaks nested threads deeper than 2 levels.
**How to avoid:** Follow Go's algorithm exactly: (1) build commentMap, (2) identify rootComments (IsTopLevel), (3) for each non-root comment, trace ancestors to find root, add to descendantsMap[rootID], (4) sort roots by pinnedAt desc then createdAt desc, (5) paginate roots, (6) for each root, find chainHeads where replyToId=rootID or replyToId=null, take first 3, collect their full chains recursively.
**Warning signs:** Comments appearing under wrong parent; missing nested replies; chainHeads not showing the right preview comments.

### Pitfall 2: Sqids EntityType Mismatch on Comment IDs
**What goes wrong:** Decoding a comment public ID without verifying entityType=11 (EntityTypeComment), leading to decoding a file or article ID as a comment ID.
**Why it happens:** Sqids encodes [dbID, entityType] pairs. If the entityType check is skipped, a file ID could be decoded and used to query the comments table.
**How to avoid:** Always verify `entityType === EntityType.Comment` after decoding. The Go backend does this in Delete, UpdateStatus, SetPin, UpdateContent, UpdateCommentInfo (see handler.go lines 1184-1188).
**Warning signs:** Wrong records returned; foreign key violations; silent data corruption.

### Pitfall 3: FTS5 rowid Must Match articles.id
**What goes wrong:** Using auto-generated rowids in FTS5 table that don't correspond to articles table IDs.
**Why it happens:** FTS5 contentless mode uses rowid to link back to the source table. If rowids don't match, search results can't be joined back to articles.
**How to avoid:** Always explicitly specify `rowid` when inserting into articles_fts: `INSERT INTO articles_fts(rowid, title, content, keywords) VALUES (article.id, ...)`. The rowid in FTS5 must equal the id in the articles table.
**Warning signs:** Search results returning wrong articles; missing articles in results; JOIN failures.

### Pitfall 4: Comment Content Stripping for FTS5
**What goes wrong:** Indexing raw HTML in FTS5, causing HTML tags to pollute search results.
**Why it happens:** Article contentHtml contains HTML tags. If indexed directly, searching for "div" or "class" would match every article.
**How to avoid:** Strip HTML tags before inserting into FTS5. Use a regex like `contentHtml.replace(/<[^>]*>/g, ' ').trim()` to get plain text for indexing. The Go backend does this in SimpleSearcher.articleToSearchHit (line 158: `reHTMLTags.ReplaceAllString`).
**Warning signs:** Search returning irrelevant results for HTML tag names; snippet containing raw HTML.

### Pitfall 5: Rate Limiter Memory Leak
**What goes wrong:** Rate limit Map entries never cleaned up, growing indefinitely.
**Why it happens:** Forgetting to set TTL/cleanup timeout when adding new entries.
**How to avoid:** When setting the first entry for a minute key, schedule a `setTimeout(() => map.delete(key), 70_000)` to clean up after 70 seconds (matching Go's 70s Redis expiry). Do NOT use setInterval to scan the entire map — that's wasteful.
**Warning signs:** Process memory growing steadily; Map.size increasing without bound.

### Pitfall 6: Admin Email Check Race Condition
**What goes wrong:** A non-admin user submits a comment with the admin's email, and the check passes because the admin list query hasn't completed yet.
**Why it happens:** The admin email check queries the users table to find admins with groupID=1. If this query fails, the check is skipped (Go logs a warning but continues).
**How to avoid:** Follow Go's behavior exactly: if the admin list query fails, log a warning and skip the check (do NOT block comment creation). This matches Go service.go line 347: `log.Printf("warning: ...")` followed by continuing the loop.
**Warning signs:** Comments being rejected when they should be allowed; or admin email being used by guests.

### Pitfall 7: Comment Response DTO Field Omission
**What goes wrong:** Returning admin-only fields (email, ipAddress, content, status) in public comment responses, leaking sensitive data.
**Why it happens:** Using the same response object for both public and admin views without conditional field exclusion.
**How to avoid:** The Go backend uses `isAdminView` parameter in toResponseDTO. When isAdminView=false, email/ipAddress/content/status are nil/omitted. When true, they are populated. NestJS should use the same pattern — either conditional object construction or class-transformer @Exclude/@Expose groups.
**Warning signs:** Email addresses visible in public API responses; IP addresses exposed to visitors.

## Code Examples

### Comment Markdown Rendering with marked
```typescript
// Source: marked.js.org/using_pro (official docs)
import { marked } from 'marked';

// Configure marked for comment rendering
marked.use({
  gfm: true,        // GitHub Flavored Markdown
  breaks: true,     // Convert \n to <br> (common in comments)
  pedantic: false,
});

function renderCommentMarkdown(content: string): string {
  return marked.parse(content) as string;
}
```

### FTS5 Table Creation and Search Query
```typescript
// Source: SQLite FTS5 documentation + better-sqlite3 verified support

// Create contentless FTS5 table (run once at startup)
const createFts5Table = `
  CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
    title,
    content,
    keywords,
    content='',
    tokenize='unicode61 tokens 0'
  );
`;

// Insert article into FTS5 index
function indexArticle(db: any, article: { id: number; title: string; contentHtml: string; keywords: string | null }) {
  const plainContent = article.contentHtml.replace(/<[^>]*>/g, ' ').trim();
  db.run(
    `INSERT INTO articles_fts(rowid, title, content, keywords) VALUES (?, ?, ?, ?)`,
    [article.id, article.title, plainContent, article.keywords || '']
  );
}

// Search with weighted bm25 ranking
function searchArticles(db: any, query: string, page: number, size: number) {
  const offset = (page - 1) * size;
  const results = db.all(
    `SELECT rowid as id, bm25(articles_fts, 10.0, 1.0, 5.0) AS rank
     FROM articles_fts
     WHERE articles_fts MATCH ?
     ORDER BY rank
     LIMIT ? OFFSET ?`,
    [query, size, offset]
  );
  return results;
}

// Delete article from FTS5 index
function deleteArticleIndex(db: any, articleId: number) {
  db.run(`DELETE FROM articles_fts WHERE rowid = ?`, [articleId]);
}
```

### Comment In-Memory Tree Building (ListByPath)
```typescript
// Source: Go pkg/service/comment/service.go ListByPath (lines 610-782)

interface CommentNode {
  id: number;
  parentId: number | null;
  replyToId: number | null;
  pinnedAt: Date | null;
  createdAt: Date;
  isTopLevel(): boolean;
  // ... other fields
}

function buildCommentTree(allComments: CommentNode[]) {
  const commentMap = new Map<number, CommentNode>();
  const rootComments: CommentNode[] = [];
  const descendantsMap = new Map<number, CommentNode[]>();

  // 1. Build comment map and identify roots
  for (const c of allComments) {
    commentMap.set(c.id, c);
    if (c.parentId === null) {
      rootComments.push(c);
    }
  }

  // 2. Trace ancestors to find root for each non-root comment
  for (const c of allComments) {
    if (c.parentId !== null) {
      let ancestor = c;
      const visited = new Set<number>();
      while (ancestor.parentId !== null) {
        if (visited.has(ancestor.id)) break; // cycle detection
        visited.add(ancestor.id);
        const parent = commentMap.get(ancestor.parentId);
        if (!parent) { ancestor = null as any; break; }
        ancestor = parent;
      }
      if (ancestor && ancestor.parentId === null) {
        const list = descendantsMap.get(ancestor.id) || [];
        list.push(c);
        descendantsMap.set(ancestor.id, list);
      }
    }
  }

  // 3. Sort roots: pinned first (by pinnedAt desc), then by createdAt desc
  rootComments.sort((a, b) => {
    const aPinned = a.pinnedAt !== null;
    const bPinned = b.pinnedAt !== null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) return b.pinnedAt!.getTime() - a.pinnedAt!.getTime();
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return { rootComments, descendantsMap, commentMap };
}
```

### Snippet Extraction (matching Go articleToSearchHit)
```typescript
// Source: Go pkg/service/search/simple_searcher.go lines 158-165

function extractSnippet(contentHtml: string, maxLength = 150): string {
  // Strip HTML tags (same as Go's reHTMLTags.ReplaceAllString)
  const plainText = contentHtml.replace(/<[^>]*>/g, ' ').trim();
  const runes = [...plainText]; // Proper Unicode handling
  if (runes.length > maxLength) {
    return runes.slice(0, maxLength).join('') + '...';
  }
  return plainText;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Go Redis Increment for rate limiting | In-memory Map with setTimeout cleanup | Phase 06 design | Zero external dependencies; sufficient for single-user blog |
| Go three-tier search (Plugin > Redis > Simple) | SQLite FTS5 only | Phase 06 design | Simpler architecture; FTS5 built into SQLite; no Redis needed |
| Go markdown-it for article rendering | marked for comment rendering | Phase 06 design | Lighter weight for comments; separate config from article rendering |
| @types/marked (external types) | marked v18 built-in types | marked v18 release | No separate types package needed; @types/marked deprecated |

**Deprecated/outdated:**
- @types/marked: Deprecated as of 2023-10-03; marked v18 ships its own TypeScript definitions at `./lib/marked.d.ts`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FTS5 unicode61 tokenizer with `tokens "0"` provides adequate CJK character-level tokenization for personal blog search | Standard Stack / Pattern 3 | Chinese search may return fewer results than Go's unigram+bigram; acceptable for personal blog per D-146 |
| A2 | NSUUU API endpoint `https://api.nsuuu.com/api/ip-location` is stable and accessible from the NestJS server | Architecture Patterns | IP location would default to "未知"; weather endpoint would return default_rectangle |
| A3 | Pushoo API format remains compatible with Go backend's implementation (channel + URL from settings) | Architecture Patterns | Push notifications would silently fail; non-blocking per D-153 |
| A4 | In-memory rate limiting with Map is sufficient for single-user blog (no concurrent process concerns) | Pattern 2 | If multiple Node.js processes run, rate limits would be per-process; not a concern for single-process SQLite setup |
| A5 | marked with `{ gfm: true, breaks: true }` produces equivalent output to Go's parserSvc.ToHTML for comment content | Standard Stack | HTML rendering differences could cause frontend display issues; need to verify against Go parser output |

## Open Questions

1. **Go parserSvc.ToHTML exact behavior for comments**
   - What we know: Go uses a parser service that handles Markdown, emoji, and internal URI rewriting. NestJS will use marked + dompurify + separate URI rewriting.
   - What's unclear: Whether Go's parser applies additional transformations (emoji shortcodes, autolinks) that marked doesn't handle by default.
   - Recommendation: Implement marked with GFM + breaks first, then test against Go backend output for specific comment content. Add marked extensions if needed.

2. **FTS5 MATCH query syntax for multi-word searches**
   - What we know: FTS5 uses implicit AND for multiple tokens by default. Go's SimpleSearcher uses simple `strings.Contains` which is also AND-like.
   - What's unclear: Whether the frontend sends multi-word queries and expects OR behavior.
   - Recommendation: Use FTS5 default (implicit AND) which matches Go SimpleSearcher behavior. If frontend needs OR, can use `OR` operator in FTS5 query.

3. **Comment image URL rewriting: anzhiyu://file/ protocol**
   - What we know: Go's renderHTMLURLs replaces `src="anzhiyu://file/{publicID}"` with signed download URLs. NestJS has parseAnzhiyuURI in path-resolver.ts but no equivalent renderHTMLURLs.
   - What's unclear: Whether the NestJS file service has a method equivalent to Go's `GetDownloadURLForFileWithExpiration`.
   - Recommendation: Implement renderHTMLURLs as a dedicated function in CommentService that uses FileService to resolve internal URIs to signed URLs. Check FileService API for download URL generation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v22+ | — |
| better-sqlite3 | Database + FTS5 | ✓ | v12.11.1 | — |
| FTS5 compile option | Full-text search | ✓ | ENABLE_FTS5 | — |
| isomorphic-dompurify | HTML sanitization | ✓ | v3.18.0 | — |
| marked | Markdown rendering | ✗ | — | Install via npm |
| sqids | ID encoding | ✓ | v0.3.0 | — |
| vitest | Testing | ✓ | v4.1.9 | — |
| NSUUU API | IP geolocation | ? | — | Default to "未知" on failure |
| Pushoo API | Notifications | ? | — | Silent skip if unconfigured |

**Missing dependencies with no fallback:**
- marked: Must install before implementation (`npm install marked`)

**Missing dependencies with fallback:**
- NSUUU API: If unreachable, ipLocation defaults to "未知"; non-blocking
- Pushoo API: If unconfigured (pushoo.channel empty), silently skip notification; non-blocking per D-153

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest v4.1.9 |
| Config file | server/vitest.config.ts |
| Quick run command | `cd server && npx vitest run --reporter=verbose` |
| Full suite command | `cd server && npx vitest run` |

### Phase Requirements → Test Map
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

### Sampling Rate
- **Per task commit:** `cd server && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/comment/comment.service.spec.ts` — covers COMMENT-01 service logic
- [ ] `server/src/comment/comment-rate-limiter.spec.ts` — covers rate limiting
- [ ] `server/src/comment/comment-markdown.spec.ts` — covers Markdown rendering
- [ ] `server/src/search/search.service.spec.ts` — covers SEARCH-01 FTS5 operations
- [ ] Framework install: `npm install marked` — marked not yet in package.json

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JwtAuthOptionalGuard for comment create; AdminGuard for admin operations |
| V3 Session Management | yes | JWT token validation via existing guards |
| V4 Access Control | yes | Admin-only endpoints protected by AdminGuard; public endpoints use @Public() |
| V5 Input Validation | yes | class-validator DTOs for all request bodies/queries; content length limits (max 1000) |
| V6 Cryptography | yes | MD5 for emailMd5 (matches Go); HMAC for signed image URLs (existing from Phase 05) |

### Known Threat Patterns for NestJS + Comment System

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via comment HTML | Tampering | isomorphic-dompurify sanitization with strict ALLOWED_TAGS/ALLOWED_ATTR |
| Rate limiting bypass (IP spoofing) | Spoofing | X-Forwarded-For handling; configurable limit per minute |
| SQL injection via search query | Tampering | FTS5 MATCH parameterized queries via Drizzle/better-sqlite3 prepared statements |
| Spam comments | Tampering | Rate limiting + forbidden word detection + status=Pending for flagged comments |
| IDOR via Sqids decoding | Elevation of Privilege | EntityType verification after Sqids decode; AdminGuard on admin endpoints |
| Admin email impersonation | Spoofing | Explicit check: non-admin using admin email returns ErrAdminEmailUsedByGuest |
| Comment content overflow | Denial of Service | Content length limit (max 1000 chars); path comment limit (max 500 per path) |
| FTS5 index corruption | Tampering | Full rebuild on startup ensures consistency; incremental updates use DELETE+INSERT |

## Sources

### Primary (HIGH confidence)
- Go backend `pkg/service/comment/service.go` — Complete comment service logic (Create, ListByPath, ListChildren, ListLatest, toResponseDTO, renderHTMLURLs, LikeComment, UnlikeComment, SetPin, UpdateStatus, UpdateContent, UpdateCommentInfo, GetIPLocation) [CITED: local source]
- Go backend `pkg/handler/comment/dto/dto.go` — All DTO structures (CreateRequest, AdminListRequest, DeleteRequest, Response, ListResponse, etc.) [CITED: local source]
- Go backend `pkg/handler/comment/handler.go` — All endpoint handlers and parameter handling [CITED: local source]
- Go backend `pkg/service/search/search_service.go` — Search service logic (Search, IndexArticle, DeleteArticle, normalizeSearchHits) [CITED: local source]
- Go backend `pkg/service/search/simple_searcher.go` — SimpleSearcher implementation (Search, articleToSearchHit, snippet extraction) [CITED: local source]
- Go backend `pkg/domain/model/search.go` — SearchResult, SearchPagination, SearchHit, Searcher interface [CITED: local source]
- Go backend `internal/infra/router/router.go` — Route registration for comments/search/weather endpoints [CITED: local source]
- Existing NestJS code: sqids.util.ts (EntityType.Comment=11 confirmed), error-codes.ts (ADMIN_EMAIL_USED_BY_GUEST exists), comment.schema.ts (complete schema), article.sanitize.ts (DOMPurify pattern) [CITED: local source]

### Secondary (MEDIUM confidence)
- marked.js.org/using_pro — marked v18 TypeScript API, configuration, extensions [CITED: marked.js.org]
- npm registry — marked v18.0.5 (49M/wk downloads, 11 years old, built-in types) [VERIFIED: npm registry]
- better-sqlite3 FTS5 support — confirmed ENABLE_FTS5 in compile_options via runtime check [VERIFIED: runtime check]

### Tertiary (LOW confidence)
- SQLite FTS5 documentation (sqlite.org/fts5.html) — contentless tables, unicode61 tokenizer, bm25() function [ASSUMED] — fetch failed but behavior verified via runtime testing
- NSUUU API stability and format — assumed compatible based on Go backend code [ASSUMED]
- Pushoo API format — assumed compatible based on Go backend pushoo_service.go [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — marked verified on npm, FTS5 verified in runtime, isomorphic-dompurify already installed
- Architecture: HIGH — Go backend source code fully analyzed; all endpoints, DTOs, and business logic traced
- Pitfalls: HIGH — derived from direct analysis of Go backend code and known FTS5/SQLite behaviors

**Research date:** 2026-07-07
**Valid until:** 2026-08-07
