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
- [x] SEO/音乐/通知 API 兼容：RSS feed、Sitemap、音乐代理、邮件服务、通知系统、订阅管理 — Phase 09
- [x] 后端监听端口 8091（与原 Go 后端一致） — Phase 01
- [x] 友链管理 API 兼容：友链 CRUD、分类、标签、申请、审核、健康检查 — Phase 07
- [x] 数据迁移工具：从原 Go SQLite 导入数据到 NestJS SQLite — Phase 11 (MIGRATION-01)
- [x] 端到端 API 兼容性测试：292 个测试覆盖所有已实现端点 — Phase 11 (INTEGRATION-01)
- [x] 默认配置种子：启动时自动补全 Go definition.go 中的 331 个默认设置 — Post-11 fix
- [x] ScheduleService 修复：时间戳转换修正 + 30天回溯上限 — Post-11 fix
- [x] AI 工具层与对话历史存储：框架无关的 ToolDef 类型 + article-tools（search_articles/get_article）+ Drizzle chat schema + ChatHistoryService CRUD — Phase 17 (AI-03, AI-04)
- [x] 流式聊天端点与前端组件：ChatService (streamText + tools) + POST /api/ai/chat SSE 流式 + ChatWidget 浮动按钮 + ChatWindow useChat 流式渲染 + ToolResultCard 文章卡片 + 16 单元测试全部通过 + 5 代码审查修复（conversationId UUID→Sqids, onFinish 错误日志, decodePublicID 校验, ModuleRef mock, 重复工具名检测） — Phase 18 (AI-05, AI-05F)

### Active

- [ ] 前端集成验证：逐接口验证所有前端 API 调用与 Go 后端兼容 — Phases 12-15
- [ ] 前端接口清单收集：扫描前端代码提取所有 API 调用 — Phase 12

### Out of Scope

- PRO 功能（付费文章、密码保护、登录可见、即刻说说） — 后续阶段
- 多用户协作 — 后续阶段
- 支付集成（微信支付、支付宝等） — 后续阶段
- OAuth/SSO 登录 — 后续阶段
- AI 播客生成、AI 写作辅助 — 后续阶段
- 前端代码修改 — 坚持不改，API 兼容即可

### Future Work（已确认的后续实现项，Phase 15 收尾时记录）

- **501 端点功能实现（11 个）** — 当前返回 501 NOT_IMPLEMENTED，前端已优雅处理。包括：auth 5 个（register/activate/forgot-password/reset-password/check-email）、test-email、OneDrive 2 个（upload/download）、config/export + config/import、proxy/download。按需实现，详见 [DEPLOYMENT.md](DEPLOYMENT.md) Section 7
- **主题/SSR-theme 端点（20 个）** — NestJS 后端暂无 theme controller，前端 Theme Mall 功能依赖这些端点。未来阶段实现
- **全量浏览器 E2E 走查** — Phase 15 仅走了 5 个关键路径，所有页面的全量走查未来按需进行
- **Playwright 自动化 E2E 测试** — 当前走查为手动，未来可引入 Playwright 自动化
- **自动化性能测试和基准** — Phase 15 仅做主观性能感受，未做预优化；未来按需进行
- **生产环境部署方案（Docker、CI/CD 等）** — 当前为本地开发环境，未来按需

## Context

- 原项目：https://github.com/anzhiyu-c/anheyu-app
- 原后端：Go v1.24.4 + Ent ORM + PostgreSQL 17 + Redis（已归档至 _go-backend-archive/）
- 前端：Next.js 16 + React 19 + TypeScript（已克隆到 anheyu-app/frontend）
- 前端通过 next.config.ts 的 rewrites 将 /api/* 代理到后端 localhost:8091
- 当前开发环境：Node.js v22.14.0，无 Go/Docker/PostgreSQL/Redis
- Go 后端无法启动（缺 PostgreSQL + Redis），验证采用三层验证法：前端 API 扫描 + Go 代码对照 + 浏览器走查

## Constraints

- **兼容性**: 新后端 API 必须与原 Go 后端完全兼容 — 前端不动
- **技术栈**: NestJS + Drizzle + SQLite — 不使用 Go/PostgreSQL/Redis
- **端口**: 8091 — 与原后端一致，前端 next.config.ts 无需修改
- **部署**: 本地开发优先，npm run dev 一键启动前后端
- **数据**: 需提供 PostgreSQL → SQLite 迁移工具
- **验证方法**: 三层验证法（前端 API 扫描 + Go 源码对照 + 浏览器走查），不启动 Go 后端

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS 框架 | 结构化程度高，装饰器+模块化，与 Go 后端的 handler/service/repo 分层最接近 | ✓ Implemented |
| Drizzle ORM | 轻量、类型安全、与 SQLite 搭配最好，无额外运行时 | ✓ Implemented |
| SQLite 数据库 | 零安装零配置，文件级存储，适合个人博客场景 | ✓ Implemented |
| 前端不动 | 降低风险和工作量，只要 API 兼容就行 | ✓ In progress |
| 端口 8091 | 保持与原后端一致，前端配置零改动 | ✓ Implemented |
| 三层验证法 | Go 后端无法启动，用前端 API 扫描 + Go 源码对照 + 浏览器走查替代实时对比 | Pending Phase 12 |
| 前端驱动验证 | 前端实际调用的接口才是需要验证的，不是后端实现了什么 | Pending Phase 12 |
| 4阶段验证 | 验证性质不同于开发，拆太细增加管理开销；4阶段覆盖：基础+内容+功能+收尾 | Pending Phase 12 |

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
*Last updated: 2026-07-28 — Phase 18 complete with code review fixes: conversationId UUID→Sqids, onFinish error logging, decodePublicID validation. 109 AI tests passing.*
