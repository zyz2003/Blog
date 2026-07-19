# Phase 12: API Inventory & Auth & Settings Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 12-API Inventory & Auth & Settings Verification
**Areas discussed:** API 清单方法, Auth 未实现流程, 验证码登录流程, 清单范围与深度

---

## API 清单方法

### 清单收集方式

| Option | Description | Selected |
|--------|-------------|----------|
| 静态扫描 | 扫描 frontend/src/lib/api/ 下 23 个文件，提取每个 apiClient 调用。完整、可重复、不依赖运行时 | ✓ |
| 运行时代理记录 | 启动前端+后端，用 DevTools/代理记录实际请求。只记录真实调用但可能漏掉不常用功能 | |
| 两者结合 | 先静态扫描建完整清单，再运行时走查补漏。最完整但工作量最大 | |

**User's choice:** 静态扫描
**Notes:** 用户选择静态扫描作为主要方法

### 清单输出格式

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown 表格 | 每个端点一行：方法、路径、前端文件、请求参数类型、响应类型引用。紧凑、易于搜索 | ✓ |
| JSON 文件 | 结构化 JSON 数组，机器可读但人类可读性差 | |
| 多文件 Markdown | 按模块分组的 Markdown 文件，更详细但冗余多 | |

**User's choice:** Markdown 表格

### 扫描范围

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 api/ 目录 | 只扫描 frontend/src/lib/api/ 下 23 个文件 | |
| 全前端扫描 | 扫描 api/ + hooks/queries/ + components/ + pages/，捕获所有直接 fetch/axios 调用 | |
| 主清单 + 补漏扫描 | 先扫 api/ 目录建主清单，再 grep 全前端找非 apiClient 的直接调用补漏 | ✓ |

**User's choice:** 主清单 + 补漏扫描

### 清单详情粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 摘要级 | 每个端点记录：方法、路径、前端文件、请求参数类型名、响应类型名、Go handler 参考路径 | ✓ |
| 字段级 | 除摘要外还提取 TypeScript 类型定义的具体字段列表 | |
| 验证状态级 | 每个端点记录实现状态和测试状态 | |

**User's choice:** 摘要级

---

## Auth 未实现流程

### 验证程度

| Option | Description | Selected |
|--------|-------------|----------|
| 验证 501 响应 | 只验证 NestJS 返回 501 + 正确错误消息，前端能正常显示"功能未开放" | ✓ |
| 501 + 前端 UI 走查 | 除验证 501 外，还在浏览器中走查前端 UI 对 501 的处理 | |
| 跳过验证 | 跳过这些未实现端点的验证 | |

**User's choice:** 验证 501 响应

### Go 后端状态

| Option | Description | Selected |
|--------|-------------|----------|
| Go 也未实现 | Go 后端这些端点也是禁用的，NestJS 返回 501 与 Go 行为一致 | ✓ |
| 需要逐个对照 Go 代码 | Go 后端某些端点实际已实现，需要确认哪些是真正未实现的 | |

**User's choice:** Go 也未实现

---

## 验证码登录流程

### 验证码流程验证

| Option | Description | Selected |
|--------|-------------|----------|
| 端到端验证码流程 | 验证 captcha/config → captcha/image → login 每个步骤的请求/响应格式 | ✓ |
| 只验证码端点 | 只验证 captcha/config 和 captcha/image 两个端点返回正确格式 | |
| 跳过验证码测登录 | 登录时在测试模式下跳过验证码验证 | |

**User's choice:** 端到端验证码流程

### Token 刷新验证

| Option | Description | Selected |
|--------|-------------|----------|
| 验证双通道逻辑 | 前端同时在 body 和 Authorization header 发送 refresh token，两种方式都验证 | ✓ |
| 只验证 body 方式 | 只验证 body 方式传 refresh token | |
| 只验证 header 方式 | 只验证 header 方式传 refresh token | |

**User's choice:** 验证双通道逻辑

### 登录响应字段验证粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 逐字段对照 Go | 对比 Go 后端 LoginResponse 的每个字段，特别关注不一致性 | ✓ |
| 只验证前端使用的字段 | 不管 Go 后端返回了什么前端不用的字段 | |
| 粗粒度验证 | 只验证响应格式和核心字段存在 | |

**User's choice:** 逐字段对照 Go

---

## 清单范围与深度

### Phase 12 范围

| Option | Description | Selected |
|--------|-------------|----------|
| 清单 + Auth 验证 | Phase 12 只做清单 + auth 验证，其他端点验证留给后续阶段 | |
| 清单 + Auth + 初步 Go 对照 | Phase 12 做清单 + auth 验证 + 对每个端点做初步 Go 对照标记风险 | ✓ |
| 只做清单 | Phase 12 只做清单，auth 验证也推到后续阶段 | |

**User's choice:** 清单 + Auth + 初步 Go 对照

### Go 对照粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 风险标记 | 对每个端点读 Go handler 源码，标记"响应格式可能不一致"的端点 | ✓ |
| 完整字段记录 | 对每个端点详细记录 Go 的完整响应结构 | |
| 只记录路径 | 只记录 Go handler 文件路径，不提取具体字段 | |

**User's choice:** 风险标记

### 浏览器走查范围

| Option | Description | Selected |
|--------|-------------|----------|
| 只走查登录页 | Phase 12 只做登录页面的浏览器走查 | |
| 不做浏览器走查 | Phase 12 不做浏览器走查，全部留给后续阶段 | ✓ |
| 登录页 + 快速浏览 | 走查登录页 + 简单浏览其他页面看是否有明显错误 | |

**User's choice:** 不做浏览器走查

---

## Claude's Discretion

- 静态扫描的具体实现方式（grep/AST 解析/手动提取）
- 补漏扫描的 grep 模式设计
- Markdown 表格的具体列定义和排序
- 风险标记的分级标准（高/中/低风险）
- Auth 验证测试的具体断言列表
- Settings 验证的具体测试用例
- 初步 Go 对照时每个端点读多少 Go 源码（handler only vs handler + service + DTO）

## Deferred Ideas

- 浏览器端到端走查 — 留给 Phase 15
- Content 端点逐字段验证 — 留给 Phase 13
- Features 端点逐字段验证 — 留给 Phase 14
- 前端 UI 对 501 响应的优雅处理验证 — 留给 Phase 15
- config/export 和 config/import 端点实现 — 新功能，不属于验证阶段
- proxy/download 端点实现 — 新功能，不属于验证阶段
