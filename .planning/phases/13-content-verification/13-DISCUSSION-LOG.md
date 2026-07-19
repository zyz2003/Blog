# Phase 13: Content Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 13-Content Verification
**Areas discussed:** 日期空值修复策略, 验证深度级别, 测试方法, 文件模块验证范围

---

## 日期空值修复策略 (CCP-1)

| Option | Description | Selected |
|--------|-------------|----------|
| 验证 DB NOT NULL 约束 | 确认 DB schema 中所有 created_at/updated_at 都有 NOT NULL + DEFAULT。如果约束在，null 问题不存在 | ✓ |
| NestJS 返回零值时间字符串 | toISODateString(null) 返回 "0001-01-01T00:00:00.000Z" 而不是 null | |
| 两者都做 | 先验证 DB 约束，同时加防御代码 | |
| 只验证不修复 | 只验证约束存在，不做任何代码改动 | |

**User's choice:** 验证 DB NOT NULL 约束
**Notes:** 用户选择最简洁的方案——如果 DB 约束在，null 不会出现，不需要改代码

### 约束检查深度

| Option | Description | Selected |
|--------|-------------|----------|
| Schema 审查 + 修复 | 读 Drizzle schema，确认约束，发现缺失则修复 + drizzle-kit push | ✓ |
| 只审查不修复 | 只读 schema 确认，发现缺失记录为 bug | |
| Schema 审查 + 测试验证 | 审查 + 写测试验证插入后日期不为 null | |

**User's choice:** Schema 审查 + 修复

### 约束检查范围

| Option | Description | Selected |
|--------|-------------|----------|
| 只查 Phase 13 范围内的表 | articles, categories, tags, pages, comments, files 等 | |
| 查所有表（一次解决） | 30+ 张表全查，CCP-1 是跨阶段问题 | ✓ |

**User's choice:** 查所有表（一次解决）

---

## 验证深度级别

| Option | Description | Selected |
|--------|-------------|----------|
| MEDIUM+ 逐字段验证 | MEDIUM/HIGH 端点逐字段，LOW/NONE 只确认现有测试通过 | |
| 全部端点逐字段验证 | 所有端点都做逐字段对比，最彻底 | ✓ |
| 只运行现有测试 | 只验证 292 个现有测试通过 | |

**User's choice:** 全部端点逐字段验证

### 逐字段验证基准来源

| Option | Description | Selected |
|--------|-------------|----------|
| Go DTO struct 为基准 | 读 Go handler + DTO struct，提取 JSON tag、类型、嵌套结构 | |
| 前端类型定义为基准 | 读前端 TypeScript 类型定义，提取期望字段名和类型 | |
| 两者都对比 | Go DTO + 前端类型双重基准 | ✓ |

**User's choice:** 两者都对比

---

## 测试方法

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展现有测试文件 | 在 api-compat 文件中添加更详细断言 | |
| 新建 phase13 验证目录 | server/test/phase13-verification/，与现有测试分离 | ✓ |
| 现有文件内新增 describe 块 | 在 api-compat 文件中添加 describe('field-by-field') | |

**User's choice:** 新建 phase13 验证目录

### 与现有测试的关系

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 helpers，全新测试 | 复用 createTestApp/seedBaseData/generateAdminToken，全新测试用例 | ✓ |
| 完全独立 | 包括自己的 helpers | |
| 基于现有测试扩展 | 在现有测试基础上添加断言 | |

**User's choice:** 复用 helpers，全新测试

---

## 文件模块验证范围

| Option | Description | Selected |
|--------|-------------|----------|
| MEDIUM + LOW 全验证 | 3 MEDIUM + 9 LOW 全部逐字段验证，12 NONE 只确认现有测试通过 | ✓ |
| 只验证 MEDIUM | 3 个 MEDIUM 端点逐字段，LOW/NONE 只确认现有测试 | |
| 全部 24 个端点 | 包括 NONE 风险的也逐字段验证 | |

**User's choice:** MEDIUM + LOW 全验证

---

## Claude's Discretion

- 逐字段验证的具体断言列表（每个端点验证哪些字段）
- Go DTO struct 的读取深度（handler DTO vs service DTO vs domain model）
- 前端类型定义的读取范围（types/ 目录 vs hooks/ 中的内联类型）
- phase13-verification/ 目录下每个测试文件的具体组织方式
- CCP-1 schema 修复的具体 .notNull() + 默认值写法
- drizzle-kit push 的执行方式和验证

## Deferred Ideas

- 浏览器端到端走查 — Phase 15
- Features 端点验证 — Phase 14
- 5 个 auth 501 端点实现 — Phase 15 业务决策
- 20 个 Theme/SSR-theme 端点 — 未来阶段
- Album camelCase 字段命名验证 — Phase 14
- Link ID 类型验证 — Phase 14
