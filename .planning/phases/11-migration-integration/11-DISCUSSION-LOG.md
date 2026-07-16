# Phase 11: Migration & Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 11-Migration & Integration
**Areas discussed:** Migration source scope, Compat test approach, API compat test depth, Migration validation

---

## Migration Source Scope

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite→SQLite only | Go 后端已默认用 SQLite（conf.ini 里 Type=sqlite），只做同结构复制 | ✓ |
| SQLite + PostgreSQL both | 同时支持 SQLite→SQLite 和 PostgreSQL→SQLite，需要 pg 客户端库和类型映射 | |
| All three (SQLite + PG + MySQL) | 支持三种源，复杂度最高 | |

**User's choice:** SQLite→SQLite only
**Notes:** Go 后端 conf.ini 默认 Type=sqlite，大多数用户也是 SQLite

| Option | Description | Selected |
|--------|-------------|----------|
| Node.js CLI script | scripts/migrate.ts，用 better-sqlite3 读写两端 | ✓ |
| NestJS app-based migration | 通过 Service 层读写，启动慢、依赖多 | |
| SQL dump + import | 生成 .sql 文件再导入，无法做数据转换 | |

**User's choice:** Node.js CLI script
**Notes:** 简单直接，无需额外依赖

| Option | Description | Selected |
|--------|-------------|----------|
| FK dependency order | 按外键依赖顺序迁移，确保约束不失败 | ✓ |
| Disable FK checks, any order | 禁用外键检查，简单但可能掩盖数据问题 | |
| Migrate then validate FKs | 先迁移再验证，两步走 | |

**User's choice:** FK dependency order
**Notes:** 确保外键约束不会失败

---

## Compat Test Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Source-code reference | 只跑 NestJS，用 Go 源码验证响应格式匹配 | ✓ |
| Dual-backend comparison | 同时跑两个后端对比响应，需要 Go 环境 | |
| Source-code + optional dual | 源码测试必须，双后端对比可选 | |

**User's choice:** Source-code reference
**Notes:** 不需要 Go 运行环境，现有 phase08-api-compat.spec.ts 就是这个模式

| Option | Description | Selected |
|--------|-------------|----------|
| vitest + supertest | 沿用现有模式，与 phase08-api-compat.spec.ts 一致 | ✓ |
| Standalone supertest scripts | 不用 NestJS Test 模块，更简单但不能用依赖注入 | |
| Postman/Newman collection | 可视化但与项目工具链不统一 | |

**User's choice:** vitest + supertest
**Notes:** 沿用现有测试基础设施

| Option | Description | Selected |
|--------|-------------|----------|
| Response shape only | 验证格式、字段名和类型、状态码、错误码 | ✓ |
| Shape + data values | 还验证具体数据值，更严格但更脆弱 | |
| Status code + format only | 最粗粒度，可能漏掉字段名问题 | |

**User's choice:** Response shape only
**Notes:** 不验证具体数据值，因为测试数据每次不同

---

## API Compat Test Depth

| Option | Description | Selected |
|--------|-------------|----------|
| P0 core only | 约 30-40 个端点 | |
| P0 + P1 | 约 50-60 个端点 | |
| All endpoints | 全部 ~65+ 个端点，验证最完整 | ✓ |

**User's choice:** All endpoints
**Notes:** Phase 01-10 已实现全部 API，应该全部验证

| Option | Description | Selected |
|--------|-------------|----------|
| Per-module files | 按功能模块分组，独立可运行 | ✓ |
| Single monolithic file | 一个文件，1000+ 行难维护 | |
| Per-priority files | 按优先级分组 | |

**User's choice:** Per-module files
**Notes:** 与现有 phase08 模式一致

---

## Migration Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Row count + spot check | 行数一致 + 关键字段抽样（id_seed、JWT_SECRET） | ✓ |
| Full field-by-field comparison | 逐行逐列比较，最严格但慢 | |
| Row count only | 最快但可能漏掉数据损坏 | |

**User's choice:** Row count + spot check
**Notes:** 简单有效，能发现大部分问题

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-backup before migrate | 迁移前备份目标 .db，失败时恢复 | ✓ |
| No rollback (manual recovery) | 不做备份，风险高 | |
| Transaction-based rollback | SQLite 事务回滚，30+ 张表可能内存压力大 | |

**User's choice:** Auto-backup before migrate
**Notes:** 与 Go 后端备份模式一致

| Option | Description | Selected |
|--------|-------------|----------|
| Copy id_seed + JWT_SECRET | 只复制最关键的两个值 | ✓ |
| Copy all settings table data | 复制全部配置，更完整 | |

**User's choice:** Copy id_seed + JWT_SECRET
**Notes:** 这两个值决定了 Sqids 编码和 JWT 兼容性

---

## Claude's Discretion

- 迁移 CLI 的具体命令行参数设计
- FK 依赖顺序的具体拓扑排序实现
- 抽样检查的具体字段列表
- 迁移 CLI 的日志格式和进度报告
- 每个 API 兼容性测试文件中的具体断言列表
- 测试数据 seeding 策略
- 33 张表的具体 FK 依赖图

## Deferred Ideas

- PostgreSQL→SQLite 迁移支持 — 将来可扩展
- MySQL→SQLite 迁移支持 — 需求更少
- 增量迁移（只迁移新增数据） — 属于新能力
- 双后端对比测试 — 可选增强
- 迁移工具 Web UI — CLI 足够
- 自动化 cutover 脚本 — 超出当前范围
