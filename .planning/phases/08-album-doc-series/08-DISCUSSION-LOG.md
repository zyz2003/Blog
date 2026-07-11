# Phase 08: Album & Doc Series - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 08-Album & Doc Series
**Areas discussed:** Album ID 编码方式, 相册批量导入与导出, DocSeries 文章关联方式, 相册浏览/下载统计

---

## Album ID 编码方式

| Option | Description | Selected |
|--------|-------------|----------|
| 整数 ID（复刻 Go） | 与 Go 后端完全一致，相册和分类的 :id 参数和响应 id 字段都用整数 | ✓ |
| Sqids 公共 ID | 相册和分类也用 Sqids 编码，与其他模块保持一致 | |
| 先查前端再决定 | 查看前端类型定义确认实际使用的 ID 格式 | |

**User's choice:** 整数 ID（复刻 Go）
**Notes:** Go 后端相册 handler 使用 strconv.ParseUint 直接解析整数 ID，分类同理。DocSeries 使用 Sqids（与 Go 一致）。

---

## 相册批量导入与导出

| Option | Description | Selected |
|--------|-------------|----------|
| 完整实现（复刻 Go） | 完整实现 BatchImport（URL 批量导入，含图片下载+去重+缩略图生成）+ Import/Export（JSON 导入导出） | ✓ |
| 部分实现 | 只实现 JSON Import/Export，BatchImport 留后续 | |

**User's choice:** 完整实现（复刻 Go）
**Notes:** 用户强调百分百复刻重写为目标，任务不要往后续阶段放，尽量当前阶段完成。

---

## DocSeries 文章关联方式

| Option | Description | Selected |
|--------|-------------|----------|
| article 表加字段（推荐） | 在 articles 表加 doc_series_id + doc_sort 字段，一对多关联，与 Go 后端 ent schema 一致 | ✓ |
| 中间表（多对多） | 创建 doc_series_articles 中间表，支持一篇文章属于多个系列 | |

**User's choice:** article 表加字段（推荐）
**Notes:** Go 后端 DocSeries.Edges 定义 edge.To("articles", Article.Type) 是一对多关系，article 表加字段语义一致。

---

## 相册浏览/下载统计

| Option | Description | Selected |
|--------|-------------|----------|
| 完整实现（复刻 Go） | PUT /api/public/stat/:id 端点更新 view_count/download_count，内存 Map 计数 + 直接写库 | ✓ |
| 内存计数+延迟写库 | 只做内存计数不写库，Phase 10 统一持久化 | |

**User's choice:** 完整实现（复刻 Go）
**Notes:** 完整复刻 Go 后端统计端点。内存 Map 计数 + 直接写库更新。Phase 10 定时任务可优化为批量持久化。

---

## Claude's Discretion

- AlbumRepository 的具体查询方法设计（Drizzle 查询构建方式）
- AlbumService 中 BatchImport 的图片下载实现（并发控制、超时、重试）
- AlbumService 中 Import/Export 的 JSON 解析和去重逻辑
- AlbumCategoryService 中分类删除时关联相册的处理策略
- DocSeriesRepository 的具体查询方法设计
- DocSeriesService 中文章关联/取消关联的 doc_count 同步逻辑
- 相册统计内存 Map 的具体实现（TTL 管理、清理策略）
- aspect_ratio 计算的具体实现（getSimplifiedAspectRatioString）
- 相册图片缩略图参数（thumb_param/big_param）的处理逻辑

## Deferred Ideas

None — discussion stayed within phase scope
