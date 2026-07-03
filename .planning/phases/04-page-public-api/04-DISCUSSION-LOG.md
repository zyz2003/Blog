# Phase 4: Page & Public API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 4-Page & Public API
**Areas discussed:** Page ID 与 Sqids, Page 公开路由与可见性, Public 聚合端点范围, Version 端点实现方式

---

## Page ID 与 Sqids

| Option | Description | Selected |
|--------|-------------|----------|
| 保持与 Go 一致（原始 ID） | Go 后端 Page 用原始数字 ID，前端也用数字 ID 调用 /api/pages/:id | |
| 统一使用 Sqids | 为 Page 也加上 Sqids 编码，与 Article/Category/Tag 保持一致 | |
| 管理端原始 ID + 公开端路径路由 | 管理端 /api/pages/:id 用原始 ID，公开端点 /api/public/pages/*path 用路径路由 | ✓ |

**User's choice:** 管理端原始 ID + 公开端路径路由，与 Go 后端完全一致。后续考虑统一 Sqids 编码。
**Notes:** 用户明确表示先按照 Go 后端逻辑一致，后续提供推荐标签。

### Page 列表响应格式

| Option | Description | Selected |
|--------|-------------|----------|
| Go 格式 { pages, total, page, size } | Go 后端 List 返回此格式，页面 ID 是数字 | |
| 与文章一致 { list, pagination } | Phase 03 文章列表格式 | |
| 精确复制 Go 格式 | 完全复制 Go 后端的 Page.List 响应格式 | ✓ |

**User's choice:** 精确复制 Go 格式

### InitializeDefaultPages

| Option | Description | Selected |
|--------|-------------|----------|
| 复制 Go 默认页面内容 | 完整复制隐私政策、Cookie 政策、版权声明 | |
| 简化默认页面 | 只创建标题+路径+占位符 | |
| 跳过初始化功能 | 不实现，留给 Phase 11 迁移工具 | |

**User's choice:** 用户表示"全部按照你的想法，但一定要以复刻重构 Go 后端为重中之重，不用担心麻烦不麻烦"，确认完整复刻。

---

## Page 公开路由与可见性

**User's choice:** 全部以精确复刻 Go 后端为标准
**Notes:** 用户确认所有灰色地带都按"精确复刻 Go 后端"标准执行，无需逐项讨论。

---

## Public 聚合端点范围

**User's choice:** 全部以精确复刻 Go 后端为标准
**Notes:** PUBLIC-01 需求指的是确保各 public 端点正常工作，不创建新的合并端点。

---

## Version 端点实现方式

**User's choice:** 全部以精确复刻 Go 后端为标准
**Notes:** GoVersion 字段替换为 node_version。BuildInfo 结构和 GetVersionString 行为完整复刻。

---

## Claude's Discretion

- PageRepository 的具体查询方法设计（Drizzle 查询构建方式）
- PageService 中路径规范化正则的具体实现细节
- splitContentAndCustomJS 正则的精确复制
- Version 信息注入的具体机制
- DTO 验证规则的具体细节

## Deferred Ideas

- Page ID 统一使用 Sqids 编码 — 后续考虑是否统一，需要评估前端改动影响
- 页面评论功能 — 依赖 Phase 06 Comment 模块
