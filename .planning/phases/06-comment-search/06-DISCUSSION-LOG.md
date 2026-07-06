# Phase 06: Comment & Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 06-comment-search
**Areas discussed:** Comment content pipeline, Rate limiting & spam, FTS5 index & tokenizer, Comment notification push

---

## Comment Content Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| marked + dompurify | Lightweight Markdown→HTML with isomorphic-dompurify sanitization, consistent with Phase 03 | ✓ |
| markdown-it + dompurify | Same as article pipeline, unified library | |
| Custom renderer | Build custom Markdown renderer for comments | |

**User's choice:** 全部你决定，复刻重写为重点
**Notes:** Decided on `marked` for comments (lighter than markdown-it used for articles) + `isomorphic-dompurify` (already introduced in Phase 03 D-70). Image URL rewriting via renderHTMLURLs pattern from Go backend.

---

## Rate Limiting & Spam

| Option | Description | Selected |
|--------|-------------|----------|
| @nestjs/throttler + settings-based | Reuse Phase 02 throttler, read comment_limit_per_minute from settings, IP-based rate limiting via memory Map | ✓ |
| Fixed rate limit | Hardcoded rate limit values | |
| No rate limiting | Skip for personal blog | |

**User's choice:** 全部你决定，复刻重写为重点
**Notes:** Full replication of Go backend rate limiting: IP+minute dimension key in memory Map, comment_limit_per_minute from settings. Forbidden words detection from settings (comma-separated). AI detection deferred.

---

## FTS5 Index & Tokenizer

| Option | Description | Selected |
|--------|-------------|----------|
| FTS5 + unicode61 | SQLite built-in FTS5 with unicode61 tokenizer (tokens "0" for CJK), bm25 ranking with column weights | ✓ |
| FTS5 + jieba-wasm | FTS5 with jieba Chinese tokenizer via WASM | |
| Simple in-memory | Replicate Go's SimpleSearcher in TypeScript | |

**User's choice:** 全部你决定，复刻重写为重点
**Notes:** FTS5 is zero-dependency and built into SQLite. unicode61 with tokens "0" handles CJK characters adequately for personal blog. Column weights: title=10.0, content=1.0, keywords=5.0. Startup full rebuild + CRUD incremental updates. Accepts precision gap vs Go's unigram+bigram tokenizer.

---

## Comment Notification Push

| Option | Description | Selected |
|--------|-------------|----------|
| Pushoo framework only | Implement Pushoo push call points and settings reading, stub notifications for Phase 09 | ✓ |
| Full notification stack | Implement Pushoo + email + in-app notifications | |
| No notifications | Skip all notification in Phase 06 | |

**User's choice:** 全部你决定，复刻重写为重点
**Notes:** Pushoo instant push framework implemented in Phase 06 (reads pushoo_channel/pushoo_token from settings, silently skips if not configured). Email notification and in-app notification deferred to Phase 09 (NOTIF-01). Two push scenarios replicated from Go: 1) notify admin of new comment, 2) notify admin of reply to their comment.

---

## Claude's Discretion

- Markdown→HTML rendering configuration (marked extensions/plugins)
- FTS5 virtual table CREATE TABLE statement and trigger design
- SearchService snippet extraction implementation
- IP geolocation query error handling and caching
- Pushoo push service HTTP request implementation
- Comment image URL rewriting regex details
- Admin view conditional field return strategy

## Deferred Ideas

- QQ info lookup — external API dependency, non-core
- AI forbidden word detection — external AI API, high complexity
- Comment export/import — admin feature, low priority
- Email notification — depends on email infrastructure, Phase 09
- In-app notification — Phase 09 (NOTIF-01)
- FTS5 Chinese tokenizer optimization (jieba-wasm/ICU) — future enhancement
- SearchProvider extension mechanism — Pro feature
- Comment review email notification — future enhancement
