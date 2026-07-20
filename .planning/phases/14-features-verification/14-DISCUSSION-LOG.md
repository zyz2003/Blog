# Phase 14: Features Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 14-Features Verification
**Areas discussed:** Link ID type, Album camelCase fields, Statistics & date fields, Low-risk module coverage

---

## Link ID type (int vs Sqids)

| Option | Description | Selected |
|--------|-------------|----------|
| Link ID type (int vs Sqids) | Go LinkDTO uses id:int (raw DB ID), NestJS may use Sqids string. Frontend may expect int. 15+ link endpoints affected (#94-118). Could break frontend if type mismatch. | ✓ |

**User's choice:** Selected for discussion
**Notes:** Codebase investigation revealed:
- Go LinkDTO.id is `int` (raw DB ID), not Sqids-encoded
- NestJS `toLinkResponseDTO` uses `generatePublicID(link.id, EntityType.Link)` — returns Sqids string
- NestJS LinkCategory.id and LinkTag.id keep raw int — consistent with Go
- Frontend `LinkItem.id` type is `number`, `LinkCategory.id` is `number`, `LinkTag.id` is `number`
- Frontend uses `String(l.id)` for keys and `selectedIds.has(l.id)` for comparisons
- Decision captured as D-301/D-302/D-303: verify frontend usage, fix Link.id if needed

---

## Album camelCase fields

| Option | Description | Selected |
|--------|-------------|----------|
| Album camelCase fields | Go Album model uses camelCase JSON tags (imageUrl, bigImageUrl), while most Go models use snake_case. NestJS may normalize to snake_case. 7 album endpoints affected. | ✓ |

**User's choice:** Selected for discussion
**Notes:** Codebase investigation revealed:
- Go Album struct uses camelCase JSON tags (imageUrl, bigImageUrl, downloadUrl, categoryId, viewCount, etc.)
- NestJS `toResponseDTO` also uses camelCase for these fields — consistent
- Album created_at/updated_at/published_at use snake_case in both Go and NestJS — consistent
- Album.id in NestJS is raw DB int, Go is uint — consistent, no Sqids
- Decision captured as D-304/D-305/D-306: field naming is consistent, verify field-by-field

---

## Statistics & date fields

| Option | Description | Selected |
|--------|-------------|----------|
| Statistics & date fields | Statistics, Doc-series, Storage-policy, User management all have date nullability or structure differences. CCP-1 resolved in Phase 13 but these modules not verified. | ✓ |

**User's choice:** Selected for discussion
**Notes:**
- CCP-1 date nullability resolved in Phase 13 (all tables have NOT NULL constraints)
- Phase 14 needs to verify these modules' response structures, not re-audit schema
- Statistics: summary structure, trend date format, analytics nesting, top-pages last_visited_at
- Doc-series: uses Sqids (generatePublicID with EntityType.DocSeries), Go also uses Sqids
- Storage-policy: ID type needs verification
- User management: userGroupID type (Go uint/number), UserGroup.description nullability
- Decision captured as D-307 through D-311

---

## Low-risk module coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Low-risk module coverage | Music, Notification, User avatar, Backup, RSS/Sitemap, Schedule/Cron — all LOW/NONE risk. Verify structure or just confirm existing tests pass? | ✓ |

**User's choice:** Selected for discussion
**Notes:**
- Music playlist: Go uses gin.H{ songs, total }, NestJS needs structure verification
- RSS/Sitemap/robots.txt: XML responses, not { code, data, message } wrapper
- Schedule/Cron: 8 job types, verify execution, no startup log spam (D-264)
- Decision captured as D-312 through D-315: confirm structures, verify XML format, verify cron execution

---

## Claude's Discretion

- 逐字段验证的具体断言列表（每个端点验证哪些字段）
- Go DTO struct 的读取深度
- 前端类型定义的读取范围
- phase14-verification/ 目录下每个测试文件的具体组织方式
- Link.id 修复的具体实现方式（如果需要改）
- Statistics 趋势数据日期格式的具体断言
- RSS/Sitemap XML 格式验证的具体方法
- Schedule/Cron 任务验证的具体方式

## Deferred Ideas

- 浏览器端到端走查 — Phase 15
- 5 个 auth 501 端点实现 — Phase 15 业务决策
- 2 个 OneDrive 501 端点 — Phase 15 业务决策
- test-email 501 端点 — Phase 15 业务决策
- 20 个 Theme/SSR-theme 端点 — 未来阶段
- config/export、config/import 端点实现 — 未来阶段
- proxy/download 端点实现 — 未来阶段
