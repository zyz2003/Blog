# Phase 3: Article & Category & Tag - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 3-Article & Category & Tag
**Areas discussed:** Article response shape, Public article listing, Article history scope, Category/Tag relationship

---

## Article Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full Go-compatible response | 30+ fields with nested categories/tags/owner, matching Go ToAPIResponse | ✓ |
| Minimal response | Only essential fields, extend later | |

**User's choice:** Claude's discretion (user said "全部按照你推荐的来")
**Notes:** Full Go-compatible response is the only viable option — API compatibility is the core constraint (D-04, D-05). The frontend depends on exact field names and structure.

---

## Public Article Listing

| Option | Description | Selected |
|--------|-------------|----------|
| Separate service methods per endpoint | 7 independent methods matching Go backend | ✓ |
| Unified query builder | Single method with options object | |

**User's choice:** Claude's discretion (user said "全部按照你推荐的")
**Notes:** Separate methods preferred because each endpoint returns a fundamentally different data shape (list vs detail vs archives vs statistics). A unified builder adds complexity without benefit.

---

## Article History Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include in Phase 03 | Schema exists, 5 endpoints are core article feature | ✓ |
| Defer to later phase | Reduce Phase 03 scope | |

**User's choice:** Claude's discretion (user said "全部按照你推荐的")
**Notes:** Article history is tightly coupled to article Create/Update lifecycle. The schema already exists. Deferring would mean re-opening the article module later, which is more disruptive.

---

## Category/Tag Relationship

| Option | Description | Selected |
|--------|-------------|----------|
| categoryId on articles + pivot table for tags | Matches Go's O2M (category) + M2M (tags) | ✓ |
| Two pivot tables | Symmetric M2M for both | |
| JSON array column | Store IDs as JSON | |

**User's choice:** Claude's discretion (user said "全部按照你推荐的")
**Notes:** Go backend uses edge.To("post_categories") which is O2M (one article → one category), and edge.To("post_tags") which is M2M. categoryId on articles + pivot table for tags matches Go's ent schema structure exactly.

---

## Claude's Discretion

All four gray areas were decided by Claude based on project constraints:
- Article response shape: driven by API compatibility requirement
- Public article listing: driven by code clarity and Go backend alignment
- Article history scope: driven by coupling with article CRUD lifecycle
- Category/Tag relationship: driven by Go ent schema structure analysis

## Deferred Ideas

- 文章图片上传 — Phase 05
- 文章主色调自动提取 — Phase 05
- 文章浏览量批量写入优化 — Phase 10
