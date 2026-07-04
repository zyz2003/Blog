# Phase 5: File Upload & Media - Discussion Log

**Date:** 2026-07-04
**Mode:** Default (interactive)

## Areas Discussed

### 1. 分块上传会话存储

**Question:** Go 后端用 Redis 存储分块上传会话，NestJS 去掉了 Redis，分块上传会话应该用什么存储？

**Options presented:**
- 内存 Map + TTL（推荐）
- SQLite 临时表
- 混合：内存 + SQLite 持久化

**User selection:** 内存 Map + TTL（"按照你的意思来执行"）

**Question:** 分块上传的物理分块文件应该存储在哪里？

**Options presented:**
- 临时目录（分块文件）（推荐）
- SQLite BLOB
- 直接偏移写入

**User selection:** 用户表示"剩下的全部你自己决定" — Claude 选择临时目录方案

**Notes:** 用户对 Phase 05 剩余灰区均交由 Claude 自行决定，直接生成 CONTEXT.md

### 2-4. 存储策略范围 / 缩略图生成策略 / 直链与短链设计

**User selection:** "自己决定，直接生成" — Claude 基于 Go 后端源码分析和项目约束自行决定所有实现方案

**Decisions made by Claude:**
- 存储策略：只实现 local 类型，云端存储返回 501/400
- 缩略图：同步生成（sharp），简化签名 URL（HMAC-SHA256），不做异步队列
- 直链：完整复刻 Go 后端 Sqids 编码 publicID + 模糊化文件名 + 短链下载

## Deferred Ideas

- 云端存储策略实现 — 后续阶段
- OneDrive OAuth — Phase 05 返回 501
- 异步缩略图队列 — 性能不足时引入
- 图片样式处理 — 后续阶段
- 文件版本管理 — 后续阶段
- CDN 预热/刷新 — 依赖云存储

---

*Phase: 5-File Upload & Media*
*Discussion completed: 2026-07-04*
