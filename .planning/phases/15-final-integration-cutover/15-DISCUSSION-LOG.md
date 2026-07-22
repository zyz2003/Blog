# Phase 15: Final Integration & Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 15-Final Integration & Cutover
**Areas discussed:** 501 端点决策, 浏览器 E2E 走查, 生产切换, 性能基准

---

## 501 端点决策

| Option | Description | Selected |
|--------|-------------|----------|
| 保持 501 | 个人博客不需要注册/激活/忘记密码等功能，保持 501 即可 | ✓ |
| 实现 auth 端点 | 实现 auth 5 个端点 + test-email，OneDrive 和 config/export/import 仍保持 501 | |
| 全部实现 | 实现所有 11 个端点，完全匹配 Go 后端 | |

**User's choice:** 保持 501
**Notes:** 个人博客场景下，注册/激活/忘记密码/OneDrive 用不到

### 501 前端处理验证

| Option | Description | Selected |
|--------|-------------|----------|
| 已验证，无需额外处理 | Phase 12 已验证 501 格式正确 | ✓ |
| 浏览器走查时验证前端处理 | 特意触发 501 端点确认前端优雅处理 | |

**User's choice:** 已验证，无需额外处理

---

## 浏览器 E2E 走查

### 走查范围

| Option | Description | Selected |
|--------|-------------|----------|
| 关键路径 | 只走查核心流程：首页浏览、文章详情、后台登录、文章 CRUD、设置修改 | ✓ |
| 全量走查 | 走查所有前端页面 | |
| 关键路径 + 模块抽样 | 关键路径 + 每个模块至少一个操作 | |

**User's choice:** 关键路径

### 错误捕获方式

| Option | Description | Selected |
|--------|-------------|----------|
| 手动记录 | 打开 DevTools Console 手动记录红色错误 | ✓ |
| Playwright 自动捕获 | 用 Playwright 脚本自动捕获 console.error | |

**User's choice:** 手动记录

### 回归测试范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全量回归 | Phase 13 + Phase 14 验证测试 + api-compat 测试（约 482 个） | ✓ |
| 仅验证测试 | 只运行 Phase 13 + Phase 14 验证测试 | |

**User's choice:** 全量回归

---

## 生产切换

### 切换策略

| Option | Description | Selected |
|--------|-------------|----------|
| 停机切换 | 停 Go → 迁移数据 → 启 NestJS | |
| 灰度切换 | 同时运行 Go 和 NestJS，逐步切流量 | |

**User's choice:** 本地环境，不存在切换问题，直接用 NestJS 后端
**Notes:** 用户说明这是本地开发环境，不是生产环境，后续直接用 NestJS 后端

### 部署文档

| Option | Description | Selected |
|--------|-------------|----------|
| 简单 README | 记录启动步骤、迁移命令、环境变量 | ✓ |
| 不需要 | 本地环境直接用 | |

**User's choice:** 简单 README

### 数据迁移

| Option | Description | Selected |
|--------|-------------|----------|
| 确认迁移工具可用 | Phase 11 的 migrate.ts 工具可用并记录用法 | ✓ |
| 空库启动 | 不需要迁移，从空数据库开始 | |

**User's choice:** 确认迁移工具可用

---

## 性能基准

### 测量方式

| Option | Description | Selected |
|--------|-------------|----------|
| 主观感受 | 走查时主观感受页面加载速度 | ✓ |
| DevTools 测量 | Chrome DevTools Performance 面板测量 | |
| 自动化性能测试 | Playwright 脚本自动测量 | |

**User's choice:** 主观感受

### 优化策略

| Option | Description | Selected |
|--------|-------------|----------|
| 按需优化 | 走查时发现明显慢再优化 | ✓ |
| 预先审查 | 走查前先做性能审查 | |

**User's choice:** 按需优化

---

## Claude's Discretion

- 关键路径走查的具体操作步骤清单
- DevTools Console 错误的记录格式和分类方式
- phase15-verification/ 测试用例的具体组织方式
- 部署 README 的具体内容和格式
- 回归测试的执行方式（一次性全部运行 vs 分批运行）
- 如果走查发现 console errors 的修复策略

## Deferred Ideas

- 501 端点功能实现 — 未来阶段按需实现
- 20 个 Theme/SSR-theme 端点 — 未来阶段
- 全量浏览器 E2E 走查 — 未来阶段按需进行
- Playwright 自动化 E2E 测试 — 未来阶段
- 自动化性能测试和基准 — 未来阶段
- 生产环境部署方案 — 未来阶段
