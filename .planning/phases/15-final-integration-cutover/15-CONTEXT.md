# Phase 15: Final Integration & Cutover - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

最终集成验证与切换——全量回归测试 + 浏览器关键路径走查 + 部署文档。Phase 12-14 已通过自动化测试验证了所有 188 个端点的字段级兼容性，Phase 15 在此基础上做最后的端到端确认，确保前端在新后端上无错误运行。

**交付物：**

1. **全量回归测试**：
   - 运行 Phase 13 + Phase 14 验证测试（约 190 个）+ api-compat 测试（292 个）
   - 确保所有测试通过，无回归问题

2. **浏览器关键路径走查**：
   - 手动操作浏览器走查核心流程：首页浏览、文章详情、后台登录、文章 CRUD、设置修改
   - 打开 DevTools Console 记录红色错误，确保无 console errors
   - 主观感受页面加载速度，如果明显慢再针对性优化

3. **部署文档**：
   - 简单 README，记录 npm run dev 启动步骤、数据迁移命令、环境变量配置
   - 确认 Phase 11 迁移工具（migrate.ts）可用并记录用法

4. **Phase 15 验证测试套件**：
   - 新建 server/test/phase15-verification/ 目录
   - 全量回归测试（运行已有测试 + 新增跨模块集成测试）

**不在 Phase 15 范围：**
- 501 端点实现（auth register/activate/forgot-password/reset-password/check-email、test-email、OneDrive、config/export/import、proxy/download）——保持 501
- 20 个 Theme/SSR-theme 端点——未来阶段
- 性能优化——按需，走查时发现明显慢再处理
- 灰度/零停机切换——本地开发环境，直接用 NestJS 后端

</domain>

<decisions>
## Implementation Decisions

### 501 端点处理
- **D-320:** 所有 501 端点保持 501 状态，不实现功能。包括：auth 5 个端点（register/activate/forgot-password/reset-password/check-email）、test-email、OneDrive 2 个端点、config/export、config/import、proxy/download
- **D-321:** 501 端点的前端处理已在 Phase 12 验证（后端返回格式正确），Phase 15 不需要额外验证前端 501 处理逻辑

### 浏览器 E2E 走查
- **D-322:** 浏览器走查范围：关键路径——首页浏览、文章详情、后台登录、文章 CRUD、设置修改。不做全量走查（所有页面），也不做模块抽样
- **D-323:** 浏览器错误捕获方式：手动打开 DevTools Console 记录红色错误。不用 Playwright 自动化
- **D-324:** 性能评估方式：主观感受页面加载速度。如果明显慢再针对性优化，不做预先性能审查
- **D-325:** 性能优化策略：按需优化。走查时发现明显慢的页面才优化，不做提前优化

### 自动化回归测试
- **D-326:** 全量回归测试：运行 Phase 13 + Phase 14 验证测试（约 190 个）+ api-compat 测试（292 个），共约 482 个测试
- **D-327:** 新增跨模块集成测试放在 server/test/phase15-verification/ 目录

### 生产切换（本地环境）
- **D-328:** 本地开发环境，不存在从 Go 切换到 NestJS 的生产切换问题。直接用 NestJS 后端
- **D-329:** 部署文档写简单 README，记录：npm run dev 启动步骤、数据迁移命令（npm run migrate）、环境变量配置
- **D-330:** 数据迁移：确认 Phase 11 的 migrate.ts 工具可用并记录用法。不强制要求从 Go 迁移数据，可从空库启动

### Claude's Discretion
- 关键路径走查的具体操作步骤清单（每个页面点哪些按钮、检查哪些元素）
- DevTools Console 错误的记录格式和分类方式
- phase15-verification/ 测试用例的具体组织方式
- 部署 README 的具体内容和格式
- 回归测试的执行方式（一次性全部运行 vs 分批运行）
- 如果走查发现 console errors 的修复策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12-14 产出（Phase 15 的直接输入）
- `.planning/phases/12-api-inventory-auth-verification/12-API-INVENTORY.md` — 前端 API 调用完整清单（188 个端点）
- `.planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md` — 188 个端点的风险标记，Phase 12-14 已处理全部 HIGH/MEDIUM/LOW 风险
- `.planning/phases/13-content-verification/13-CONTEXT.md` — Content 验证上下文
- `.planning/phases/14-features-verification/14-CONTEXT.md` — Features 验证上下文

### 现有验证测试（全量回归目标）
- `server/test/phase13-verification/` — Phase 13 Content 验证测试（7 个文件）
- `server/test/phase14-verification/` — Phase 14 Features 验证测试（12 个文件，含 regression.spec.ts）
- `server/test/api-compat/` — API 兼容性测试（29 个文件，292 个测试）
- `server/test/helpers/` — 测试辅助函数

### 迁移工具
- `scripts/migrate.ts` — Phase 11 实现的 Go SQLite → NestJS SQLite 迁移工具
- `server/package.json` — migrate 和 migrate:dry-run 命令定义

### 前端配置（启动方式参考）
- `frontend/next.config.ts` — 前端 rewrites 配置（/api/* 代理到 localhost:8091）
- `frontend/package.json` — 前端启动命令

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-330）
- `.planning/REQUIREMENTS.md` — 完整验收标准（VERIFY-05）
- `.planning/ROADMAP.md` — Phase 15 定义和成功标准
- `.planning/PROJECT.md` — 项目约束和核心价值

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **server/test/phase13-verification/ 7 个文件 + phase14-verification/ 12 个文件** — Phase 13-14 验证测试，Phase 15 全量回归直接运行这些测试
- **server/test/api-compat/ 29 个文件** — 292 个 API 兼容性测试，Phase 15 全量回归直接运行
- **server/test/helpers/** — 测试辅助函数库（createTestApp, seedBaseData, generateAdminToken, assertSuccessResponse 等），Phase 15 新增测试复用
- **scripts/migrate.ts** — Go→NestJS 迁移工具，Phase 15 需确认可用并记录用法

### Established Patterns
- API 兼容性测试模式：beforeAll 初始化 NestJS 应用 + Sqids seed + JWT secret + 测试数据 → supertest 发请求 → 断言响应格式
- 全量回归模式：Phase 14 regression.spec.ts 横跨所有模块做基本断言，Phase 15 可参考此模式
- 前端通过 next.config.ts rewrites 将 /api/* 代理到 localhost:8091
- NestJS 监听端口 8091（与 Go 后端一致）
- 后端启动：cd server && npm run dev
- 前端启动：cd frontend && npm run dev

### Integration Points
- 前端 next.config.ts rewrites → localhost:8091（后端端口）
- 浏览器走查需要同时启动前端和后端
- 迁移工具 migrate.ts 从 Go SQLite 数据库文件读取数据写入 NestJS SQLite 数据库文件

</code_context>

<specifics>
## Specific Ideas

- 关键路径走查的具体页面和操作：
  - 首页：访问 /，确认文章列表正常加载
  - 文章详情：点击一篇文章，确认内容、分类、标签、评论正常显示
  - 后台登录：访问 /admin，输入用户名密码登录，确认登录成功
  - 文章 CRUD：在后台创建/编辑/删除一篇文章，确认操作成功
  - 设置修改：在后台修改一个站点设置，确认保存成功

- 全量回归测试预计数量：Phase 13 约 50 个 + Phase 14 约 190 个 + api-compat 292 个 ≈ 530+ 个测试

- 部署 README 需包含的内容：
  1. 前置条件（Node.js v22+）
  2. 安装依赖（npm install）
  3. 启动后端（cd server && npm run dev）
  4. 启动前端（cd frontend && npm run dev）
  5. 数据迁移（npm run migrate，可选）
  6. 环境变量（如 JWT_SECRET 等，如有）

- 501 端点完整清单（保持 501，不实现）：
  - POST /api/auth/register
  - POST /api/auth/activate
  - POST /api/auth/forgot-password
  - POST /api/auth/reset-password
  - GET /api/auth/check-email
  - POST /api/settings/test-email
  - POST /api/files/onedrive/upload
  - POST /api/files/onedrive/download
  - POST /api/config/export
  - POST /api/config/import
  - GET /api/proxy/download

</specifics>

<deferred>
## Deferred Ideas

- 501 端点功能实现（auth 5 个 + test-email + OneDrive 2 个 + config/export/import + proxy/download）— 未来阶段按需实现
- 20 个 Theme/SSR-theme 端点 — 未来阶段
- 全量浏览器 E2E 走查（所有页面）— 未来阶段按需进行
- Playwright 自动化 E2E 测试 — 未来阶段
- 自动化性能测试和基准 — 未来阶段
- 生产环境部署方案（Docker、CI/CD 等）— 未来阶段

</deferred>

---

*Phase: 15-Final Integration & Cutover*
*Context gathered: 2026-07-22*
