# anheyu-app

## What This Is

用 NestJS + Drizzle + SQLite 重写 anheyu-app 的 Go 后端，替代原 Go + PostgreSQL + Redis 架构，实现零依赖本地运行。前端 Next.js 代码不做任何修改，新后端必须与原 Go 后端保持 API 兼容（相同路径 + 相同响应格式）。

## Core Value

前端零改动即可切换到新后端运行 — API 兼容是核心底线。

## Requirements

### Validated

- [x] NestJS 后端框架搭建，项目结构与原 Go 后端分层对应 — Phase 01
- [x] Drizzle ORM + SQLite 数据层，替代 PostgreSQL + Redis — Phase 01
- [x] 用户认证 API 兼容：管理员登录、JWT、权限控制 — Phase 02
- [x] 核心 API 兼容：文章/页面 CRUD、分类、标签、Markdown 编辑 — Phase 03-04
- [x] 媒体管理 API 兼容：图片上传、缩略图生成、文件管理 — Phase 05
- [x] 访客分析 API 兼容：访客统计、趋势、来源、设备分析 — Phase 07
- [x] 相册与文档系列 API 兼容：相册 CRUD + 分类 + 批量导入导出 + CreateOrRestore 去重；文档系列 CRUD + 文章关联 — Phase 08
- [x] 后端监听端口 8091（与原 Go 后端一致） — Phase 01

### Active

- [ ] 友链管理 API 兼容：友链 CRUD、分类、标签、申请、审核、健康检查 — Phase 07 implemented, pending frontend validation
- [ ] 数据迁移工具：从原 PostgreSQL 导入数据到 SQLite

### Out of Scope

- PRO 功能（付费文章、密码保护、登录可见、即刻说说） — 后续阶段
- 多用户协作 — 后续阶段
- 支付集成（微信支付、支付宝等） — 后续阶段
- OAuth/SSO 登录 — 后续阶段
- AI 播客生成、AI 写作辅助 — 后续阶段
- 前端代码修改 — 坚持不改，API 兼容即可

## Context

- 原项目：https://github.com/anzhiyu-c/anheyu-app
- 原后端：Go v1.24.4 + Ent ORM + PostgreSQL 17 + Redis
- 前端：Next.js 16 + React 19 + TypeScript（已克隆到 anheyu-app/frontend）
- 前端通过 next.config.ts 的 rewrites 将 /api/* 代理到后端 localhost:8091
- 当前开发环境：Node.js v22.14.0，无 Go/Docker/PostgreSQL/Redis

## Constraints

- **兼容性**: 新后端 API 必须与原 Go 后端完全兼容 — 前端不动
- **技术栈**: NestJS + Drizzle + SQLite — 不使用 Go/PostgreSQL/Redis
- **端口**: 8091 — 与原后端一致，前端 next.config.ts 无需修改
- **部署**: 本地开发优先，npm run dev 一键启动前后端
- **数据**: 需提供 PostgreSQL → SQLite 迁移工具

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS 框架 | 结构化程度高，装饰器+模块化，与 Go 后端的 handler/service/repo 分层最接近 | — Pending |
| Drizzle ORM | 轻量、类型安全、与 SQLite 搭配最好，无额外运行时 | — Pending |
| SQLite 数据库 | 零安装零配置，文件级存储，适合个人博客场景 | — Pending |
| 前端不动 | 降低风险和工作量，只要 API 兼容就行 | — Pending |
| 端口 8091 | 保持与原后端一致，前端配置零改动 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-12 after Phase 08 completion*
