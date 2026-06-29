# Phase 1: Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 1-Infrastructure
**Areas discussed:** 项目结构, Schema组织, Guard & Interceptor接线, 数据目录, 错误码映射, Sqids初始化, 缓存策略, 配置管理, 日志框架

---

## 项目结构

| Option | Description | Selected |
|--------|-------------|----------|
| 功能模块 | 每个功能域一个目录（article/article.module.ts），NestJS CLI 默认方式 | ✓ |
| 按层分离 | controllers/ + services/ + repositories/，和 Go 后端分层一致 | |
| 混合方式 | 核心用功能模块，共享用独立目录 | |

**User's choice:** 功能模块
**Notes:** 用户最初想照抄 Go 后端的分层结构，讨论后理解 NestJS Module 装饰器机制更适合功能模块方式

### 共享代码位置

| Option | Description | Selected |
|--------|-------------|----------|
| common/ + database/ | 共享放 common/，数据库放 database/ | ✓ |
| modules/ 子目录 | 所有业务模块放 modules/ 下 | |

**User's choice:** common/ + database/

### 模块目录创建范围

| Option | Description | Selected |
|--------|-------------|----------|
| 只建当前阶段的模块 | Phase 01 只建 auth/、settings/ 等 5-6 个 | |
| 一次生成全部模块目录 | 30 个模块目录一次性创建 | ✓ |

**User's choice:** 一次生成全部模块目录

---

## Schema 组织

| Option | Description | Selected |
|--------|-------------|----------|
| 一表一文件 | article.schema.ts + user.schema.ts，和 Go 的 ent/schema/ 一致 | ✓ |
| 按域分组 | content.schema.ts (article+category+tag)，import 少 | |

**User's choice:** 一表一文件

### Schema 文件位置

| Option | Description | Selected |
|--------|-------------|----------|
| database/schemas/ 集中 | 所有 schema 文件集中在一个目录 | ✓ |
| 跟模块放一起 | Schema 跟业务模块放一起 | |

**User's choice:** database/schemas/ 集中

### Schema 定义范围

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 01 全部定义 | 30 个表一次性定义，drizzle-kit push 一次性建库 | ✓ |
| 逐步定义 | 每个 Phase 只定义该阶段需要的表 | |

**User's choice:** Phase 01 全部定义

---

## Guard & Interceptor 接线

### 认证 Guard 映射

| Option | Description | Selected |
|--------|-------------|----------|
| 3 个 Guard 分别实现 | JwtAuthGuard + JwtAuthOptionalGuard + AdminGuard | ✓ |
| 1 个通用 AuthGuard | 配置模式切换，代码少但逻辑耦合 | |

**User's choice:** 3 个 Guard 分别实现

### Guard 注册方式

| Option | Description | Selected |
|--------|-------------|----------|
| 全局注册 + @Public() 跳过 | JwtAuthGuard 全局注册，公开路由用 @Public() | ✓ |
| 手动 @UseGuards | 每个路由手动加装饰器 | |

**User's choice:** 全局注册 + @Public() 跳过

### 响应格式包装

| Option | Description | Selected |
|--------|-------------|----------|
| 全局 Interceptor | APP_INTERCEPTOR 注册，自动包装 { code, data, message } | ✓ |
| 显式装饰器 | 每个 Controller 方法显式调用 | |

**User's choice:** 全局 Interceptor

---

## 数据目录

| Option | Description | Selected |
|--------|-------------|----------|
| data/ 统一存放 | data/anheyu.db + data/uploads/ + data/thumbnails/ | ✓ |
| data/ 下分子目录 | data/db/ + data/storage/ + data/cache/thumbnails/ | |

**User's choice:** data/ 统一存放

---

## 错误码映射

| Option | Description | Selected |
|--------|-------------|----------|
| 常量文件 + 中文消息 | error-codes.ts 常量文件，所有 Service/Controller 引用 | ✓ |
| NestJS 异常 + 转换层 | 用 HttpException，Interceptor 层转中文 | |

**User's choice:** 常量文件 + 中文消息

---

## Sqids 初始化

| Option | Description | Selected |
|--------|-------------|----------|
| 启动时从 DB 读取 seed | 从 settings 表读 id_seed，和 Go 后端一致 | ✓ |
| 环境变量配置 | Seed 放 .env 文件 | |

**User's choice:** 启动时从 DB 读取 seed

---

## 缓存策略

| Option | Description | Selected |
|--------|-------------|----------|
| Map + TTL 基础版 | 简单实现，定时清理过期条目 | ✓ |
| 用现成库 | keyv 或 node-cache，功能更强但引入依赖 | |

**User's choice:** Map + TTL 基础版

---

## 配置管理

| Option | Description | Selected |
|--------|-------------|----------|
| @nestjs/config | ConfigModule.forRoot()，官方方案 | ✓ |
| 直接用 dotenv | 更轻量但缺少验证和缓存 | |

**User's choice:** @nestjs/config

---

## 日志框架

| Option | Description | Selected |
|--------|-------------|----------|
| NestJS 内置 Logger | 自带彩色输出和上下文标识 | ✓ |
| winston/pino 专业库 | 支持文件输出、JSON 格式，Phase 01 不需要 | |

**User's choice:** NestJS 内置 Logger

---

## Claude's Discretion

- 数据库连接初始化方式（Drizzle + better-sqlite3 的注入方式）
- drizzle.config.ts 配置细节
- CORS 配置（参照 Go 后端的 cors.go）
- Repository 层抽象程度

## Deferred Ideas

None — discussion stayed within phase scope
