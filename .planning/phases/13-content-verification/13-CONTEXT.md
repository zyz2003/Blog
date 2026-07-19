# Phase 13: Content Verification - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

验证所有 content 相关端点与 Go 后端行为一致——articles、categories、tags、pages、file upload、comments、search。基于 Phase 12 产出的风险标记（12-RISK-MARKING.md），对 Phase 13 范围内的 50 个端点做逐字段验证。

**交付物：**

1. **CCP-1 日期空值约束验证与修复**：
   - 审查所有 30+ 张表的 Drizzle schema，确认 created_at/updated_at 都有 .notNull() + 默认值
   - 发现缺失约束则修复 schema 并 drizzle-kit push
   - 一次解决跨阶段问题，Phase 14 不需要再查

2. **全部端点逐字段验证**：
   - 对 Phase 13 范围内 50 个端点做逐字段验证（包括 NONE 风险端点）
   - 基准来源：Go DTO struct + 前端 TypeScript 类型定义双重对比
   - 每个端点验证：字段名、类型、嵌套结构、nullability、状态码

3. **Phase 13 验证测试套件**：
   - 新建 server/test/phase13-verification/ 目录
   - 复用现有 helpers（createTestApp, seedBaseData, generateAdminToken 等）
   - 全新测试用例，按模块分文件
   - 文件模块：MEDIUM + LOW 全验证，NONE 只确认现有测试通过

**不在 Phase 13 范围：**
- Features 端点验证（stats/links/album/doc-series/SEO/music/notifications/cron/backup → Phase 14）
- 浏览器端到端走查（→ Phase 15）
- 501 端点实现（auth register/activate/forgot-password/reset-password/check-email → Phase 15 业务决策）
- Theme Mall 20 个端点（→ 未来阶段）
- config/export、config/import、proxy/download 实现（→ 未来阶段）

</domain>

<decisions>
## Implementation Decisions

### CCP-1 日期空值修复策略
- **D-290:** CCP-1 解决策略为验证 DB NOT NULL 约束——审查所有 30+ 张表的 Drizzle schema，确认 created_at/updated_at 都有 .notNull() + 默认值。如果约束在，null 不会出现，不需要改 NestJS 代码
- **D-291:** CCP-1 约束检查范围覆盖所有表（一次解决），不限于 Phase 13 的 content 表。因为 CCP-1 是跨阶段问题，一次查完更干净
- **D-292:** 发现缺失约束时直接修复 schema 并 drizzle-kit push，不只是记录 bug

### 验证深度
- **D-293:** Phase 13 对所有端点做逐字段验证（包括 NONE 风险端点），不只是 MEDIUM/HIGH。最彻底的方式
- **D-294:** 逐字段验证的基准来源为 Go DTO struct + 前端 TypeScript 类型定义双重对比。Go DTO 是权威参考，前端类型是实际消费者
- **D-295:** MEDIUM 风险端点（18 个）优先验证，然后 LOW（8 个），最后 NONE（24 个）

### 测试方法
- **D-296:** 新建 server/test/phase13-verification/ 目录存放验证测试，与现有 server/test/api-compat/ 分离
- **D-297:** 复用现有 helpers（createTestApp, seedBaseData, generateAdminToken, assertSuccessResponse 等），但测试用例全新编写
- **D-298:** 测试按模块分文件：article-verification.spec.ts, category-verification.spec.ts, tag-verification.spec.ts, page-verification.spec.ts, file-verification.spec.ts, comment-verification.spec.ts, search-verification.spec.ts

### 文件模块验证范围
- **D-299:** 文件模块 24 个端点：MEDIUM（3 个）+ LOW（9 个）全部逐字段验证，NONE（12 个）只确认现有 api-compat 测试通过
- **D-300:** 跳过 #77 POST /api/files/share/create（frontend-only 定义，Go 也没有此端点）

### Claude's Discretion
- 逐字段验证的具体断言列表（每个端点验证哪些字段）
- Go DTO struct 的读取深度（handler DTO vs service DTO vs domain model）
- 前端类型定义的读取范围（types/ 目录 vs hooks/ 中的内联类型）
- phase13-verification/ 目录下每个测试文件的具体组织方式
- CCP-1 schema 修复的具体 .notNull() + 默认值写法
- drizzle-kit push 的执行方式和验证

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 产出（Phase 13 的直接输入）
- `.planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md` — 188 个端点的风险标记，Phase 13 优先级列表。MUST READ
- `.planning/phases/12-api-inventory-auth-verification/12-API-INVENTORY.md` — 前端 API 调用完整清单（方法、路径、前端文件、请求/响应类型名、Go handler 路径）

### 前端 API 调用定义（逐字段验证基准之一）
- `frontend/src/lib/api/article.ts` — 前端 article 公开 API
- `frontend/src/lib/api/post-management.ts` — 前端 article 管理 API
- `frontend/src/lib/api/page-management.ts` — 前端 page 管理 API
- `frontend/src/lib/api/file-manager.ts` — 前端 file upload/management API
- `frontend/src/lib/api/comment.ts` — 前端 comment 公开 API
- `frontend/src/lib/api/comment-management.ts` — 前端 comment 管理 API
- `frontend/src/types/` — 前端 TypeScript 类型定义（逐字段验证基准）

### 前端 Query Hooks（可能包含额外 API 调用或类型定义）
- `frontend/src/hooks/queries/use-articles.ts` — article hooks
- `frontend/src/hooks/queries/use-post-management.ts` — article 管理 hooks
- `frontend/src/hooks/queries/use-page-management.ts` — page 管理 hooks
- `frontend/src/hooks/queries/use-comments.ts` — comment hooks
- `frontend/src/hooks/queries/use-comment-management.ts` — comment 管理 hooks

### Go 后端 Content 模块对照（逐字段验证权威基准）
- `_go-backend-archive/pkg/handler/article/` — Go article handler（CRUD、列表、详情、导入导出、历史版本）
- `_go-backend-archive/pkg/handler/category/` — Go category handler
- `_go-backend-archive/pkg/handler/tag/` — Go tag handler
- `_go-backend-archive/pkg/handler/page/` — Go page handler
- `_go-backend-archive/pkg/handler/file/` — Go file handler（上传、分块、文件夹、直链）
- `_go-backend-archive/pkg/handler/comment/` — Go comment handler（CRUD、审核、嵌套回复、导入导出）
- `_go-backend-archive/pkg/handler/search/` — Go search handler
- `_go-backend-archive/pkg/domain/model/` — Go domain model（响应 DTO 定义——逐字段验证的核心基准）
- `_go-backend-archive/internal/infra/router/router.go` — Go 全部路由注册

### NestJS Content 模块实现（验证目标）
- `server/src/article/article.controller.ts` — ArticleController
- `server/src/article/public-article.controller.ts` — PublicArticleController
- `server/src/article/article.service.ts` — ArticleService
- `server/src/article/article.repository.ts` — ArticleRepository
- `server/src/article/dto/` — Article DTOs
- `server/src/category/` — Category module
- `server/src/tag/` — Tag module
- `server/src/page/page.controller.ts` — PageController
- `server/src/page/public-page.controller.ts` — PublicPageController
- `server/src/page/page.service.ts` — PageService
- `server/src/page/dto/` — Page DTOs
- `server/src/file/file.controller.ts` — FileController
- `server/src/file/folder.controller.ts` — FolderController
- `server/src/file/file.service.ts` — FileService
- `server/src/file/upload.service.ts` — UploadService
- `server/src/file/dto/` — File DTOs
- `server/src/comment/comment.controller.ts` — CommentController（公开）
- `server/src/comment/comment-admin.controller.ts` — CommentAdminController
- `server/src/comment/comment.service.ts` — CommentService
- `server/src/comment/dto/` — Comment DTOs
- `server/src/search/search.controller.ts` — SearchController
- `server/src/search/search.service.ts` — SearchService
- `server/src/search/dto/` — Search DTOs

### Drizzle Schema（CCP-1 约束审查目标）
- `server/src/database/schemas/` — 所有 30+ 张表的 Drizzle schema 定义

### 现有测试基础设施
- `server/test/api-compat/` — 292 个 API 兼容性测试（逐模块分文件）
- `server/test/helpers/` — 测试辅助函数（createTestApp, seedBaseData, generateAdminToken, assertSuccessResponse 等）
- `server/test/article/` — Article 单元测试
- `server/test/page/` — Page 单元测试
- `server/test/post-category/` — Category 单元测试
- `server/test/post-tag/` — Tag 单元测试

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-300）
- `.planning/REQUIREMENTS.md` — 完整验收标准（VERIFY-03）
- `.planning/ROADMAP.md` — Phase 13 定义和成功标准

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **server/test/helpers/** — 完整的测试辅助函数库：createTestApp（NestJS 应用初始化）、seedBaseData（测试数据 seeding）、generateAdminToken（JWT 签名）、assertSuccessResponse（响应格式断言）、Sqids seed 初始化。Phase 13 验证测试直接复用
- **server/test/api-compat/ 29 个文件** — 现有 API 兼容性测试模式参考。每个文件的结构：beforeAll 初始化 → describe 分组 → it 测试用例 → supertest 请求 → 断言
- **12-RISK-MARKING.md** — Phase 12 产出的风险标记，包含每个端点的风险级别、Go 行为描述、NestJS 行为描述。Phase 13 直接使用此文件确定验证优先级
- **12-API-INVENTORY.md** — 前端 API 调用完整清单，包含每个端点的前端文件路径和类型名

### Established Patterns
- API 兼容性测试模式：beforeAll 初始化 NestJS 应用 + Sqids seed + JWT secret + 测试数据 → supertest 发请求 → 断言响应格式
- 测试数据 seeding：直接用 db.insert() + onConflictDoUpdate() 插入基础数据
- Admin token 生成：jwt.sign({ user_id: publicID, user_group_id: publicID, permissions, iss }, secret, { algorithm: 'HS256', expiresIn: '15m' })
- 响应格式断言：expect(res.body).toHaveProperty('code', 200)、expect(res.body.data).toHaveProperty('id') 等
- Go 后端 LoginResponse 不一致性：userGroupID 是原始 DB ID（number），而其他 ID 字段是 public ID（Sqids 编码字符串）
- POST 端点默认返回 code:200（D-244），只有 5 个端点返回 201
- 全局前缀排除：RSS/sitemap/robots.txt、needcache/download/:public_id（D-246, D-249）
- Go 后端 time.Time 零值为 "0001-01-01T00:00:00Z"，NestJS toISODateString(null) 返回 null（CCP-1）
- Go 后端 Article model 使用 snake_case JSON tags，Album model 使用 camelCase JSON tags（Go 不一致性）

### Integration Points
- 前端通过 next.config.ts rewrites 将 /api/* 代理到 localhost:8091
- NestJS AuthGuard 在非 @Public 端点上验证 JWT
- NestJS ResponseInterceptor 统一包装 { code, data, message }
- Drizzle schema 定义所有表的字段约束（CCP-1 审查目标）
- 现有 api-compat 测试与 Phase 13 验证测试共享 helpers 但逻辑分离

</code_context>

<specifics>
## Specific Ideas

- Phase 13 范围内端点按模块分布：Article Public 12 个、Article Admin 13 个、Page 7 个、File 24 个、Comment Public 8 个、Comment Admin 8 个、Search 1 个（共约 50 个，去掉 N/A 的 #77）
- MEDIUM 风险端点（Phase 13 范围内 18 个）关键风险：
  - #22, #34, #35, #38, #39: ArticleResponse created_at/updated_at nullability
  - #23-28: PostCategory/PostTag date nullability
  - #31: ArticleStatistics extra fields (total_posts, total_words, avg_words, total_views, category_stats, tag_stats, top_viewed_posts, publish_trend)
  - #32: Article random date nullability
  - #42: Article import ImportResult field names
  - #47-50, #53: Page date nullability
  - #54: File pagination field naming (page_size vs pageSize)
  - #64: FileInfoResponse.storagePolicy field naming
  - #67: FolderTreeResponse.expires type
  - #78-81, #86: Comment ListResponse extra fields (total_with_children, has_more)
  - #93: Comment import ImportResult field names
- LOW 风险端点（Phase 13 范围内 8 个）：Article history (#43-45)、File upload/finalize/view/session (#55, #58, #60, #61)、File detail/links/preview (#65, #71, #72, #73, #75)、QQ info (#85)
- NONE 风险端点（Phase 13 范围内 24 个）：Delete category/tag、Archives、Delete/batch article、Article upload/export、History count、Delete/initialize page、File chunk/delete/create/rename、File download/size/move/copy、Thumbnail regenerate、Comment like/unlike/upload、Comment admin CRUD
- Go 后端 ArticleStatistics 包含 8 个字段：total_posts, total_words, avg_words, total_views, category_stats, tag_stats, top_viewed_posts, publish_trend。前端可能只使用部分字段
- Go 后端 Comment ListResponse 包含 total_with_children 和 has_more 字段，NestJS 可能缺失
- Go 后端 File pagination 使用 page_size（snake_case），NestJS 可能使用 pageSize（camelCase）
- Go 后端 FolderTreeResponse.expires 是 time.Time 类型，NestJS 可能是 string | null

</specifics>

<deferred>
## Deferred Ideas

- 浏览器端到端走查 — 留给 Phase 15 Final Integration & Cutover
- Features 端点逐字段验证（stats/links/album/doc-series/SEO/music/notifications/cron/backup）— 留给 Phase 14
- 5 个 auth 501 端点实现（register/activate/forgot-password/reset-password/check-email）— Phase 15 业务决策
- test-email 501 端点 — Phase 15 业务决策
- 2 个 OneDrive 501 端点 — Phase 15 业务决策
- 20 个 Theme/SSR-theme 端点 — 未来阶段
- config/export、config/import 端点实现 — 未来阶段
- proxy/download 端点实现 — 未来阶段
- Album camelCase 字段命名验证 — Phase 14（但 CCP-1 约束审查一次覆盖所有表）
- Link/LinkCategory/LinkTag ID 类型验证 — Phase 14

</deferred>

---

*Phase: 13-Content Verification*
*Context gathered: 2026-07-19*
