<!-- GSD:project-start source:PROJECT.md -->

## Project

**Blog**

用 NestJS + Drizzle + SQLite 重写原 Go 后端，替代原 Go + PostgreSQL + Redis 架构，实现零依赖本地运行。前端 Next.js 代码不做任何修改，新后端必须与原 Go 后端保持 API 兼容（相同路径 + 相同响应格式）。

**Core Value:** 前端零改动即可切换到新后端运行 — API 兼容是核心底线。

### Constraints

- **兼容性**: 新后端 API 必须与原 Go 后端完全兼容 — 前端不动
- **技术栈**: NestJS + Drizzle + SQLite — 不使用 Go/PostgreSQL/Redis
- **端口**: 8091 — 与原后端一致，前端 next.config.ts 无需修改
- **部署**: 本地开发优先，npm run dev 一键启动前后端
- **数据**: 需提供 PostgreSQL → SQLite 迁移工具

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Core Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | NestJS | v11.1.27 | 模块化、装饰器、依赖注入，与 Go handler/service/repo 分层最接近 |
| Runtime | Node.js | v22+ | 已安装，前端也用 |
| ORM | Drizzle ORM | v0.45.2 | 轻量、类型安全、SQL-like 语法，SQLite 最佳搭配 |
| Database | SQLite (better-sqlite3) | v12.11.1 | 零安装零配置，文件级存储，WAL 模式支持并发读 |
| Language | TypeScript | v5+ | 前后端统一语言，共享类型定义 |

## Supporting Libraries

| Purpose | Library | Version | Rationale |
|---------|---------|---------|-----------|
| JWT 认证 | @nestjs/jwt | v11.0.2 | NestJS 官方 JWT 模块 |
| 认证策略 | @nestjs/passport + passport-local | v11.0.5 | NestJS 官方认证集成 |
| 图片处理 | sharp | v0.35.2 | 缩略图生成，比原 Go 后端的 imagick 更快更轻 |
| ID 编码 | sqids | v0.3.0 | 与原 Go 后端的 Sqids 保持兼容 |
| 验证 | class-validator | v0.15.1 | NestJS 标准请求验证 |
| 转换 | class-transformer | v0.5.1 | NestJS 标准响应转换 |
| 数据库迁移 | drizzle-kit | v0.31.10 | Drizzle 官方迁移工具 |
| 文件上传 | multer (@nestjs/platform-express 内置) | — | Express 内置 multipart 处理 |
| 搜索 | SQLite FTS5 (内置) | — | 全文搜索，替代 PostgreSQL 的 tsvector |
| 缓存 | 内存缓存 (Map + TTL) | — | 替代 Redis，个人博客场景足够 |
| 静态文件 | @nestjs/serve-static | — | 提供上传文件/主题文件的静态访问 |

## What NOT to Use

| Library | Why Not |
|---------|---------|
| Prisma | 运行时重，有额外 engine 进程，SQLite 搭配不如 Drizzle |
| TypeORM | 装饰器风格但维护差、坑多、与 SQLite 配合问题多 |
| MikroORM | NestJS 支持但社区小，不如 Drizzle 轻量 |
| Redis / ioredis | 项目目标就是去掉 Redis 依赖 |
| PostgreSQL (pg) | 项目目标就是去掉 PostgreSQL 依赖 |
| MongoDB / Mongoose | 不适合博客 CMS 的关系型数据结构 |

## Confidence Levels

| Recommendation | Confidence | Reason |
|----------------|-----------|--------|
| NestJS v11 | HIGH | npm 验证版本，成熟框架 |
| Drizzle ORM v0.45 | HIGH | npm 验证版本，SQLite 支持完善 |
| better-sqlite3 v12 | HIGH | npm 验证版本，同步 API 适合 NestJS |
| sharp v0.35 | HIGH | npm 验证版本，久经考验的图片库 |
| sqids v0.3 | HIGH | npm 验证版本，与 Go 版 Sqids 兼容 |
| 内存缓存替代 Redis | MEDIUM | 个人博客场景足够，高并发场景需要重新评估 |

## SQLite 重要配置

- **必须启用 WAL 模式** — 允许并发读写
- **必须设置 busy_timeout** — 防止写锁超时
- **连接池不适用** — better-sqlite3 是同步单连接，但足够用于个人博客
- **PRAGMA journal_mode=WAL** 和 **PRAGMA busy_timeout=5000** 在启动时设置

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
