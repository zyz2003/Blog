# Phase 12: API Inventory & Auth & Settings Verification - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

系统性地收集前端所有 API 调用，建立完整端点清单；验证 auth 和 settings 端点与 Go 后端兼容；对清单中每个端点做初步 Go 代码对照，标记潜在不一致风险。

**交付物：**

1. **前端 API 清单**（Markdown 表格）：
   - 扫描 frontend/src/lib/api/ 下 23 个文件，提取每个 apiClient 调用
   - 补漏扫描：grep 全前端找非 apiClient 的直接 fetch/axios 调用
   - 每个端点记录：方法、路径、前端文件、请求参数类型名、响应类型名、Go handler 参考路径
   - 按模块分组，后续 Phase 13-15 引用此清单确定验证范围

2. **Auth 端点验证**：
   - 登录流程端到端验证（captcha/config → captcha/image → login → token 刷新）
   - 逐字段对照 Go LoginResponse（userInfo 内部字段、roles、accessToken、refreshToken、expires）
   - Token 刷新双通道验证（Authorization header + body）
   - 未实现端点（register/activate/forgot-password/reset-password/check-email）验证返回 501 + 正确错误消息

3. **Settings 端点验证**：
   - GET /api/public/site-config 返回所有公开 key（290+）且嵌套结构正确
   - POST /api/settings/update 接受 flat key-value 对并正确持久化
   - POST /api/settings/get-by-keys 对 admin 和 non-admin 返回正确值
   - Version 端点返回正确格式

4. **初步 Go 对照风险标记**：
   - 对清单中每个端点读对应 Go handler 源码
   - 标记"响应格式可能不一致"的端点（字段名不同、嵌套结构不同、缺失字段）
   - 后续 Phase 13-15 重点关注这些标记

**不在 Phase 12 范围：**
- 浏览器端到端走查（留给 Phase 15）
- Content 端点验证（article/category/tag/page/file/comment/search → Phase 13）
- Features 端点验证（stats/links/album/doc-series/SEO/music/notifications/cron/backup → Phase 14）

</domain>

<decisions>
## Implementation Decisions

### API 清单收集方法
- **D-270:** 静态扫描 frontend/src/lib/api/ 下 23 个文件，提取每个 apiClient.get/post/put/delete 调用。完整、可重复、不依赖运行时
- **D-271:** 主清单 + 补漏扫描：先扫 api/ 目录建主清单，再 grep 全前端找非 apiClient 的直接 fetch/axios 调用补漏
- **D-272:** 清单输出为 Markdown 表格格式，按模块分组。每个端点记录：方法、路径、前端文件、请求参数类型名、响应类型名、Go handler 参考路径
- **D-273:** 清单粒度为摘要级——每个端点记录方法/路径/类型名/Go handler 路径，不提取具体字段列表。后续阶段逐个深入验证字段

### Auth 未实现流程验证
- **D-274:** 注册/激活/忘记密码/重置密码/检查邮箱这 5 个端点只验证 NestJS 返回 501 + 正确错误消息。**注意：Go 后端这些端点实际已实现**（router.go lines 416-421 有真实 handler），NestJS 返回 501 与 Go 行为不一致，属于兼容性缺口。Phase 12 验证范围仅限 501 格式正确性，功能实现留给后续阶段
- **D-275:** 不做前端 UI 走查验证 501 处理——只验证后端响应格式正确

### 验证码登录流程
- **D-276:** 端到端验证码流程验证：captcha/config → captcha/image → login，验证每个步骤的请求/响应格式正确
- **D-277:** Token 刷新验证双通道逻辑：前端同时在 body 和 Authorization header 发送 refresh token，NestJS 优先读 header 再回退 body，两种方式都要验证
- **D-278:** 登录响应逐字段对照 Go 后端 LoginResponse，特别关注 Go 的不一致性（如 userGroupID 是原始 DB ID 而非 public ID）

### 清单范围与深度
- **D-279:** Phase 12 做三件事：(1) 扫描全部前端 API 文件建完整清单，(2) 验证 auth + settings 端点，(3) 对每个端点做初步 Go 对照标记风险
- **D-280:** 初步 Go 对照粒度为风险标记——对清单中每个端点读对应 Go handler 源码，标记"响应格式可能不一致"的端点，后续阶段重点关注
- **D-281:** Phase 12 不做浏览器走查，浏览器端到端走查留给 Phase 15

### Claude's Discretion
- 静态扫描的具体实现方式（grep/AST 解析/手动提取）
- 补漏扫描的 grep 模式设计
- Markdown 表格的具体列定义和排序
- 风险标记的分级标准（高/中/低风险）
- Auth 验证测试的具体断言列表
- Settings 验证的具体测试用例
- 初步 Go 对照时每个端点读多少 Go 源码（handler only vs handler + service + DTO）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 前端 API 调用定义（清单扫描源）
- `frontend/src/lib/api/auth.ts` — 前端 auth API 调用定义（login, register, checkEmail, refreshToken, forgotPassword, resetPassword, activateUser, getCaptchaConfig, generateImageCaptcha）
- `frontend/src/lib/api/client.ts` — 前端 apiClient（Axios 实例）+ TokenManager（token 获取/刷新/清除）
- `frontend/src/lib/api/settings.ts` — 前端 settings API 调用定义
- `frontend/src/lib/api/site-config.ts` — 前端 site-config API 调用定义
- `frontend/src/lib/api/config.ts` — 前端 config/backup API 调用定义
- `frontend/src/lib/api/article.ts` — 前端 article 公开 API
- `frontend/src/lib/api/post-management.ts` — 前端 article 管理 API
- `frontend/src/lib/api/page-management.ts` — 前端 page 管理 API
- `frontend/src/lib/api/file-manager.ts` — 前端 file upload/management API
- `frontend/src/lib/api/comment.ts` — 前端 comment 公开 API
- `frontend/src/lib/api/comment-management.ts` — 前端 comment 管理 API
- `frontend/src/lib/api/friends.ts` — 前端 friend links API
- `frontend/src/lib/api/album.ts` — 前端 album 管理 API
- `frontend/src/lib/api/album-public.ts` — 前端 album 公开 API
- `frontend/src/lib/api/doc-series.ts` — 前端 doc series API
- `frontend/src/lib/api/music.ts` — 前端 music API
- `frontend/src/lib/api/storage-policy.ts` — 前端 storage policy API
- `frontend/src/lib/api/user-management.ts` — 前端 user 管理 API
- `frontend/src/lib/api/user-center.ts` — 前端 user center API
- `frontend/src/lib/api/changelog.ts` — 前端 changelog API
- `frontend/src/lib/api/theme-mall.ts` — 前端 theme mall API
- `frontend/src/lib/api/index.ts` — 前端 API barrel export
- `frontend/src/types/auth.ts` — 前端 auth 类型定义（LoginRequest, LoginResponseData, RefreshTokenResponseData 等）
- `frontend/src/types/index.ts` — 前端通用类型定义（ApiResponse 等）

### 前端 Query Hooks（补漏扫描源）
- `frontend/src/hooks/queries/` — 13 个 React Query hook 文件，可能包含额外的 API 调用
- `frontend/src/hooks/use-settings.ts` — settings hook
- `frontend/src/hooks/use-music-api.ts` — music API hook

### NestJS Auth 实现（验证目标）
- `server/src/auth/auth.controller.ts` — AuthController：login, refreshToken, register, activate, forgotPassword, resetPassword, checkEmail
- `server/src/auth/auth.service.ts` — AuthService：login 逻辑、LoginResponse 构建
- `server/src/auth/token.service.ts` — TokenService：generateSessionTokens, refreshAccessToken
- `server/src/auth/dto/login-request.dto.ts` — LoginRequestDto
- `server/src/auth/dto/login-response.dto.ts` — LoginResponse, LoginUserInfo
- `server/src/auth/dto/refresh-token-request.dto.ts` — RefreshTokenRequestDto
- `server/src/auth/jwt.strategy.ts` — JWT 验证策略
- `server/src/captcha/captcha.service.ts` — CaptchaService：verify, getConfig, generateImage

### NestJS Settings 实现（验证目标）
- `server/src/settings/settings.controller.ts` — SettingsController
- `server/src/settings/settings.service.ts` — SettingsService
- `server/src/public/public.controller.ts` — PublicController（site-config, version）

### Go 后端 Auth 对照（权威参考）
- `_go-backend-archive/pkg/handler/auth/` — Go auth handler（login, register, activate, forgot-password, reset-password, check-email, refresh-token）
- `_go-backend-archive/pkg/handler/captcha/` — Go captcha handler
- `_go-backend-archive/pkg/service/auth/` — Go auth service
- `_go-backend-archive/internal/infra/router/router.go` — Go 全部路由注册

### Go 后端 Settings 对照（权威参考）
- `_go-backend-archive/pkg/handler/config/` — Go config/settings handler
- `_go-backend-archive/pkg/service/config/` — Go config service
- `_go-backend-archive/pkg/domain/model/` — Go domain model（响应 DTO 定义）

### 现有测试基础设施
- `server/test/` — 292 个 API 兼容性测试（vitest + supertest + NestJS Test 模式）
- `server/test/helpers/` — 测试辅助函数（app 创建、数据 seeding、token 生成）

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-264）
- `.planning/REQUIREMENTS.md` — 完整验收标准（VERIFY-01, VERIFY-02）
- `.planning/ROADMAP.md` — Phase 12-15 验证阶段定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **frontend/src/lib/api/ 23 个文件** — 前端所有 API 调用的集中定义，是清单扫描的主要源。每个文件导出一个对象（如 authApi, settingsApi），包含方法→端点映射
- **frontend/src/types/ 类型定义** — 前端 TypeScript 类型定义，包含每个 API 的请求/响应类型，可提取字段名和结构
- **server/test/ 292 个 API 兼容性测试** — 已建立完整的测试模式（vitest + supertest + NestJS Test + Sqids seed + JWT 签名 + 测试数据 seeding），Phase 12 验证测试可复用此模式
- **TokenManager** (frontend/src/lib/api/client.ts) — 前端 token 管理器，与 Zustand store 集成，支持 localStorage 回退
- **CaptchaService** (server/src/captcha/captcha.service.ts) — 验证码服务，支持 image captcha
- **SettingsService** (server/src/settings/settings.service.ts) — 设置服务，支持 flat key-value 更新

### Established Patterns
- 前端 API 调用模式：apiClient.get/post/put/delete，路径以 /api/ 开头，响应类型为 ApiResponse<T>
- 前端 token 刷新模式：refreshToken 同时在 body 和 Authorization header 发送
- 前端验证码流程：先获取 config，再获取 image captcha，登录时提交 captcha_id + captcha_answer
- API 兼容性测试模式：beforeAll 初始化 NestJS 应用 + Sqids seed + JWT secret + 测试数据 → supertest 发请求 → 断言响应格式
- Go 后端 LoginResponse 不一致性：userGroupID 是原始 DB ID（number），而其他 ID 字段是 public ID（Sqids 编码字符串）
- POST 端点默认返回 code:200（D-244），只有 5 个端点返回 201
- 全局前缀排除：RSS/sitemap/robots.txt、needcache/download/:public_id（D-246, D-249）

### Integration Points
- 前端通过 next.config.ts rewrites 将 /api/* 代理到 localhost:8091
- 前端 auth-storage（Zustand + localStorage）存储 accessToken、refreshToken、expires
- 前端 TokenManager 在 apiClient 请求拦截器中自动附加 Authorization header
- 前端 apiClient 响应拦截器处理 401 → 自动刷新 token → 重试请求
- NestJS AuthGuard 在非 @Public 端点上验证 JWT
- NestJS SettingsService 从 DB 读取设置值，331 个默认值在启动时 seed

</code_context>

<specifics>
## Specific Ideas

- 前端 API 文件列表（23 个）：admin.ts, album-public.ts, album.ts, article.ts, auth.ts, changelog.ts, client.ts, comment-management.ts, comment.ts, config.ts, doc-series.ts, file-manager.ts, friends.ts, index.ts, music.ts, page-management.ts, post-management.ts, settings.ts, site-config.ts, storage-policy.ts, theme-mall.ts, user-center.ts, user-management.ts
- 前端 Query Hooks（13 个）：use-album.ts, use-articles.ts, use-comment-management.ts, use-comments.ts, use-dashboard.ts, use-doc-series.ts, use-friends.ts, use-page-management.ts, use-post-management.ts, use-storage-policy.ts, use-theme-mall.ts, use-user-management.ts
- 前端其他可能包含 API 调用的文件：providers/visit-statistics-tracker.tsx, hooks/use-music-api.ts, hooks/use-settings.ts, lib/proxy-backend.ts
- Auth 端点清单（前端调用）：POST /api/auth/login, POST /api/auth/register, GET /api/auth/check-email, POST /api/auth/refresh-token, POST /api/auth/forgot-password, POST /api/auth/reset-password, POST /api/auth/activate, GET /api/public/captcha/config, GET /api/public/captcha/image
- Settings 端点清单（前端调用）：GET /api/public/site-config, POST /api/settings/update, POST /api/settings/get-by-keys, GET /api/version
- Go 后端 LoginResponse 关键不一致性：userGroupID 是原始 DB ID（number），而 userInfo.id 和 userInfo.userGroup.id 是 public ID（Sqids 编码字符串）。前端 auth.ts 类型定义中 LoginResponseData 需要对照确认
- 已知未实现端点（D-250, D-251）：config/export, config/import, proxy/download — 清单中应标记这些为"未实现"
- 前端 theme-mall.ts 包含 SSR 主题相关 API（installSSRTheme, uninstallSSRTheme, stopSSRTheme）— 这些可能不在 NestJS 实现范围内

</specifics>

<deferred>
## Deferred Ideas

- 浏览器端到端走查 — 留给 Phase 15 Final Integration & Cutover
- Content 端点逐字段验证（article/category/tag/page/file/comment/search）— 留给 Phase 13
- Features 端点逐字段验证（stats/links/album/doc-series/SEO/music/notifications/cron/backup）— 留给 Phase 14
- 前端 UI 对 501 响应的优雅处理验证 — 超出 API 兼容性验证范围，属于前端行为验证留给 Phase 15
- config/export 和 config/import 端点实现 — 新功能，不属于验证阶段
- proxy/download 端点实现 — 新功能，不属于验证阶段

</deferred>

---

*Phase: 12-API Inventory & Auth & Settings Verification*
*Context gathered: 2026-07-19*
