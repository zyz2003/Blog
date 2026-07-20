# Phase 14: Features Verification - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

验证所有辅助功能端点与 Go 后端行为一致——statistics、friend links、albums、doc series、SEO (RSS/sitemap/robots.txt)、music、notifications、scheduled tasks、backup。基于 Phase 12 产出的风险标记（12-RISK-MARKING.md），对 Phase 14 范围内的约 50 个端点做逐字段验证。

**交付物：**

1. **Link ID 类型验证与修复**：
   - Go LinkDTO.id 是 `int`（原始 DB ID），前端 LinkItem.id 是 `number`
   - NestJS 当前用 `generatePublicID()` 返回 Sqids 字符串——与 Go 不一致
   - LinkCategory.id 和 LinkTag.id 在 NestJS 保留原始 int——与 Go 一致
   - 需验证前端实际使用方式，决定 Link.id 是否需要改为 int

2. **Album 字段命名验证**：
   - Go Album 用 camelCase（imageUrl, bigImageUrl, downloadUrl, categoryId, viewCount 等）
   - NestJS toResponseDTO 也用 camelCase——一致
   - 但 created_at/updated_at/published_at 用 snake_case——Go 也用 snake_case——一致
   - Album.id 在 NestJS 是原始 DB int，Go 也是 uint——一致
   - 需逐字段验证确认无遗漏

3. **Statistics/Doc-series/Storage-policy/User-management 日期与结构验证**：
   - CCP-1 日期空值约束已在 Phase 13 审查所有表 schema，Phase 14 不需要重复审查
   - 但这些模块的响应结构（字段名、嵌套、类型）尚未逐字段验证
   - Statistics 趋势数据日期格式、analytics 结构、top-pages last_visited_at
   - Doc-series 日期字段、文章关联结构
   - Storage-policy ID 类型和日期
   - User management userGroupID 类型和 description nullability

4. **低风险模块结构确认**：
   - Music playlist 响应结构
   - Notification 设置结构
   - User avatar 上传响应
   - Backup CRUD 响应
   - RSS/Sitemap/robots.txt XML 格式
   - Schedule/Cron 任务执行验证

5. **Phase 14 验证测试套件**：
   - 新建 server/test/phase14-verification/ 目录
   - 复用现有 helpers（createTestApp, seedBaseData, generateAdminToken 等）
   - 全新测试用例，按模块分文件

**不在 Phase 14 范围：**
- 浏览器端到端走查（→ Phase 15）
- 5 个 auth 501 端点实现（→ Phase 15 业务决策）
- 2 个 OneDrive 501 端点（→ Phase 15 业务决策）
- test-email 501 端点（→ Phase 15 业务决策）
- 20 个 Theme/SSR-theme 端点（→ 未来阶段）
- config/export、config/import 端点实现（→ 未来阶段）
- proxy/download 端点实现（→ 未来阶段）
- Content 端点验证（已在 Phase 13 完成）

</domain>

<decisions>
## Implementation Decisions

### Link ID 类型
- **D-301:** Go LinkDTO.id 是 `int`（原始 DB ID），前端 LinkItem.id 类型是 `number`。NestJS 当前 `toLinkResponseDTO` 对 Link.id 使用 `generatePublicID()`（Sqids 字符串），与 Go 不一致。Phase 14 必须验证前端实际使用方式——如果前端用 `link.id` 做 key/比较/传参，类型不匹配会 break
- **D-302:** LinkCategory.id 和 LinkTag.id 在 NestJS 保留原始 int（`category.id`, `tag.id`），与 Go 一致。前端 LinkCategory.id 和 LinkTag.id 也是 `number`。无需修改
- **D-303:** Link.id 的修复方向取决于验证结果：如果前端期望 `number`，则 NestJS 需改为返回原始 DB int（与 Go 一致）；如果前端能接受 `string`，则保持 Sqids 但需确认所有使用场景

### Album 字段命名
- **D-304:** Go Album 用 camelCase JSON tags（imageUrl, bigImageUrl, downloadUrl, categoryId, viewCount, downloadCount, fileSize, aspectRatio, fileHash, displayOrder），NestJS toResponseDTO 也用 camelCase——一致。Phase 14 逐字段验证确认无遗漏
- **D-305:** Album 的 created_at/updated_at/published_at 在 Go 和 NestJS 都用 snake_case——一致
- **D-306:** Album.id 在 NestJS 是原始 DB int（`album.id`），Go 也是 `uint`——一致。Album 不使用 Sqids 编码

### 日期与结构验证
- **D-307:** CCP-1 日期空值约束已在 Phase 13 审查所有 30+ 张表的 Drizzle schema，确认 created_at/updated_at 都有 .notNull() + 默认值。Phase 14 不需要重复审查，但需验证这些模块的响应中日期字段确实非 null
- **D-308:** Statistics 模块关键验证点：summary 结构、trend 日期格式（Go time.Time vs NestJS string）、analytics 嵌套结构（top_countries, top_cities, top_browsers, top_os, top_devices, top_referers）、top-pages 的 last_visited_at（Go 用 *time.Time，可为 null）
- **D-309:** Doc-series 模块使用 Sqids 编码（generatePublicID with EntityType.DocSeries），Go 也用 Sqids——需验证编码一致
- **D-310:** Storage-policy 模块 ID 类型需验证：Go StoragePolicyResponse.id 是 string（Sqids），NestJS 需确认
- **D-311:** User management 模块 userGroupID 类型：Go 用 uint（number），NestJS 需确认返回 number 而非 Sqids string。UserGroup.description：Go 用 string（零值 ""），NestJS 可能返回 null

### 低风险模块
- **D-312:** Music playlist 响应结构：Go 用 `gin.H{ songs: [], total: int }`，NestJS 需验证字段名和结构
- **D-313:** Notification 设置、User avatar 上传、Backup CRUD 响应——LOW 风险，确认结构即可
- **D-314:** RSS/Sitemap/robots.txt 是 XML 响应，不走 { code, data, message } 包装。验证 XML 格式正确性和内容
- **D-315:** Schedule/Cron 任务验证：确认 8 个 job 类型都能触发执行，无启动 log spam（D-264）

### 测试方法
- **D-316:** 新建 server/test/phase14-verification/ 目录存放验证测试，与 Phase 13 的 phase13-verification/ 分离
- **D-317:** 复用现有 helpers（createTestApp, seedBaseData, generateAdminToken, assertSuccessResponse 等），但测试用例全新编写
- **D-318:** 测试按模块分文件：link-verification.spec.ts, album-verification.spec.ts, doc-series-verification.spec.ts, statistics-verification.spec.ts, storage-policy-verification.spec.ts, user-management-verification.spec.ts, music-verification.spec.ts, notification-verification.spec.ts, backup-verification.spec.ts, seo-verification.spec.ts, schedule-verification.spec.ts

### 验证深度
- **D-319:** Phase 14 对所有端点做逐字段验证（包括 NONE 风险端点），与 Phase 13 策略一致
- **D-320:** 逐字段验证的基准来源为 Go DTO struct + 前端 TypeScript 类型定义双重对比（D-294 延续）
- **D-321:** MEDIUM 风险端点优先验证，然后 LOW，最后 NONE

### Claude's Discretion
- 逐字段验证的具体断言列表（每个端点验证哪些字段）
- Go DTO struct 的读取深度（handler DTO vs service DTO vs domain model）
- 前端类型定义的读取范围（types/ 目录 vs hooks/ 中的内联类型）
- phase14-verification/ 目录下每个测试文件的具体组织方式
- Link.id 修复的具体实现方式（如果需要改）
- Statistics 趋势数据日期格式的具体断言
- RSS/Sitemap XML 格式验证的具体方法
- Schedule/Cron 任务验证的具体方式（可能需要等待定时触发或手动触发）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 产出（Phase 14 的直接输入）
- `.planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md` — 188 个端点的风险标记，Phase 14 优先级列表。MUST READ
- `.planning/phases/12-api-inventory-auth-verification/12-API-INVENTORY.md` — 前端 API 调用完整清单（方法、路径、前端文件、请求/响应类型名、Go handler 路径）

### 前端 API 调用定义（逐字段验证基准之一）
- `frontend/src/lib/api/friends.ts` — 前端 friend links API
- `frontend/src/lib/api/album.ts` — 前端 album 管理 API
- `frontend/src/lib/api/album-public.ts` — 前端 album 公开 API
- `frontend/src/lib/api/doc-series.ts` — 前端 doc series API
- `frontend/src/lib/api/music.ts` — 前端 music API
- `frontend/src/lib/api/storage-policy.ts` — 前端 storage policy API
- `frontend/src/lib/api/user-management.ts` — 前端 user 管理 API
- `frontend/src/lib/api/user-center.ts` — 前端 user center API
- `frontend/src/lib/api/config.ts` — 前端 config/backup API
- `frontend/src/types/friends.ts` — 前端 friend links 类型定义（LinkItem, LinkCategory, LinkTag 等）
- `frontend/src/types/` — 前端 TypeScript 类型定义（逐字段验证基准）

### 前端 Query Hooks（可能包含额外 API 调用或类型定义）
- `frontend/src/hooks/queries/use-friends.ts` — friend links hooks
- `frontend/src/hooks/queries/use-album.ts` — album hooks
- `frontend/src/hooks/queries/use-doc-series.ts` — doc series hooks
- `frontend/src/hooks/queries/use-dashboard.ts` — statistics dashboard hooks
- `frontend/src/hooks/queries/use-storage-policy.ts` — storage policy hooks
- `frontend/src/hooks/queries/use-user-management.ts` — user management hooks
- `frontend/src/hooks/use-music-api.ts` — music API hook
- `frontend/src/hooks/use-settings.ts` — settings hook（notification settings）

### Go 后端 Features 模块对照（逐字段验证权威基准）
- `_go-backend-archive/pkg/handler/link/` — Go link handler（CRUD、分类、标签、申请、审核、健康检查、导入导出）
- `_go-backend-archive/pkg/handler/album/` — Go album handler
- `_go-backend-archive/pkg/handler/album_category/` — Go album category handler
- `_go-backend-archive/pkg/handler/doc_series/` — Go doc series handler
- `_go-backend-archive/pkg/handler/statistics/` — Go statistics handler
- `_go-backend-archive/pkg/handler/rss/` — Go RSS handler
- `_go-backend-archive/pkg/handler/sitemap/` — Go sitemap handler
- `_go-backend-archive/pkg/handler/music/` — Go music handler
- `_go-backend-archive/pkg/handler/notification/` — Go notification handler（含 dto.go）
- `_go-backend-archive/pkg/handler/subscriber/` — Go subscriber handler
- `_go-backend-archive/pkg/handler/setting/` — Go settings/backup handler
- `_go-backend-archive/pkg/handler/storage_policy/` — Go storage policy handler
- `_go-backend-archive/pkg/handler/user/` — Go user handler
- `_go-backend-archive/pkg/domain/model/link.go` — Go LinkDTO, LinkCategoryDTO, LinkTagDTO 定义（id: int）
- `_go-backend-archive/pkg/domain/model/album.go` — Go Album struct 定义（camelCase JSON tags）
- `_go-backend-archive/pkg/domain/model/` — Go domain model（响应 DTO 定义——逐字段验证的核心基准）
- `_go-backend-archive/internal/infra/router/router.go` — Go 全部路由注册

### NestJS Features 模块实现（验证目标）
- `server/src/link/link.controller.ts` — LinkController
- `server/src/link/link.service.ts` — LinkService（toLinkResponseDTO 方法——Link.id 用 generatePublicID）
- `server/src/link/dto/` — Link DTOs（link-response.dto.ts id: number, link-category-response.dto.ts id: number, link-tag-response.dto.ts id: number）
- `server/src/album/album.controller.ts` — AlbumController
- `server/src/album/album-category.controller.ts` — AlbumCategoryController
- `server/src/album/public-album.controller.ts` — PublicAlbumController
- `server/src/album/album.service.ts` — AlbumService（toResponseDTO 方法——camelCase 字段）
- `server/src/album/dto/` — Album DTOs
- `server/src/doc-series/doc-series.controller.ts` — DocSeriesController
- `server/src/doc-series/doc-series.service.ts` — DocSeriesService
- `server/src/doc-series/doc-series.repository.ts` — DocSeriesRepository（使用 generatePublicID with EntityType.DocSeries）
- `server/src/doc-series/dto/` — DocSeries DTOs
- `server/src/statistics/statistics.controller.ts` — StatisticsController
- `server/src/statistics/statistics.service.ts` — StatisticsService
- `server/src/statistics/dto/` — Statistics DTOs
- `server/src/rss/rss.controller.ts` — RssController
- `server/src/rss/rss.service.ts` — RssService
- `server/src/sitemap/` — Sitemap module（如果存在）
- `server/src/music/music.controller.ts` — MusicController
- `server/src/music/music.service.ts` — MusicService
- `server/src/notification/notification.controller.ts` — NotificationController
- `server/src/notification/notification.service.ts` — NotificationService
- `server/src/notification/dto/` — Notification DTOs
- `server/src/backup/backup.controller.ts` — BackupController
- `server/src/backup/backup.service.ts` — BackupService
- `server/src/backup/dto/` — Backup DTOs
- `server/src/schedule/schedule.service.ts` — ScheduleService
- `server/src/schedule/jobs/` — Cron job implementations

### Drizzle Schema（Phase 13 已审查，Phase 14 参考用）
- `server/src/database/schemas/` — 所有 30+ 张表的 Drizzle schema 定义

### 现有测试基础设施
- `server/test/phase13-verification/` — Phase 13 验证测试（7 个文件，模式参考）
- `server/test/api-compat/` — 292 个 API 兼容性测试（逐模块分文件）
- `server/test/helpers/` — 测试辅助函数（createTestApp, seedBaseData, generateAdminToken, assertSuccessResponse 等）

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-321）
- `.planning/REQUIREMENTS.md` — 完整验收标准（VERIFY-04）
- `.planning/ROADMAP.md` — Phase 14 定义和成功标准
- `.planning/phases/13-content-verification/13-CONTEXT.md` — Phase 13 上下文（CCP-1 解决策略、验证方法）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **server/test/helpers/** — 完整的测试辅助函数库：createTestApp、seedBaseData、generateAdminToken、assertSuccessResponse、Sqids seed 初始化。Phase 14 验证测试直接复用
- **server/test/phase13-verification/ 7 个文件** — Phase 13 验证测试模式参考。每个文件的结构：beforeAll 初始化 → describe 分组 → it 测试用例 → supertest 请求 → 断言
- **12-RISK-MARKING.md** — Phase 12 产出的风险标记，包含每个端点的风险级别、Go 行为描述、NestJS 行为描述。Phase 14 直接使用此文件确定验证优先级
- **12-API-INVENTORY.md** — 前端 API 调用完整清单，包含每个端点的前端文件路径和类型名

### Established Patterns
- API 兼容性测试模式：beforeAll 初始化 NestJS 应用 + Sqids seed + JWT secret + 测试数据 → supertest 发请求 → 断言响应格式
- 测试数据 seeding：直接用 db.insert() + onConflictDoUpdate() 插入基础数据
- Admin token 生成：jwt.sign({ user_id: publicID, user_group_id: publicID, permissions, iss }, secret, { algorithm: 'HS256', expiresIn: '15m' })
- 响应格式断言：expect(res.body).toHaveProperty('code', 200)、expect(res.body.data).toHaveProperty('id') 等
- POST 端点默认返回 code:200（D-244），只有 5 个端点返回 201（link create, link category/tag create, link import, album category create）
- 全局前缀排除：RSS/sitemap/robots.txt、needcache/download/:public_id（D-246, D-249）
- Go 后端 Album model 使用 camelCase JSON tags，其他 model 使用 snake_case（Go 不一致性）
- Go 后端 LinkDTO/LinkCategoryDTO/LinkTagDTO 使用 id: int（原始 DB ID），不使用 Sqids 编码
- NestJS Link.id 使用 generatePublicID()（Sqids 字符串），与 Go 不一致——Phase 14 关键验证点
- NestJS LinkCategory.id 和 LinkTag.id 保留原始 int，与 Go 一致
- NestJS Album.id 保留原始 DB int，与 Go 一致
- NestJS DocSeries.id 使用 generatePublicID()（Sqids 字符串），Go 也使用 Sqids——需验证编码一致

### Integration Points
- 前端通过 next.config.ts rewrites 将 /api/* 代理到 localhost:8091
- NestJS AuthGuard 在非 @Public 端点上验证 JWT
- NestJS ResponseInterceptor 统一包装 { code, data, message }
- RSS/Sitemap/robots.txt 走全局前缀排除，不经过 ResponseInterceptor
- ScheduleService 是 @Global() 模块，可被任何模块注入
- MusicService 使用 MemoryCache 缓存 playlist（5 分钟 TTL）
- BackupService 使用本地时间戳生成文件名

</code_context>

<specifics>
## Specific Ideas

- Phase 14 范围内端点按模块分布：
  - Links: 25 个端点（#94-118），15 个 MEDIUM（ID 类型问题），10 个 NONE
  - Album: 15 个端点（#119-133），7 个 MEDIUM（camelCase 字段），8 个 NONE
  - Doc-series: 5 个端点（#134-138），4 个 MEDIUM（日期），1 个 NONE
  - Statistics: 6 个端点（#159-164），4 个 MEDIUM（结构/日期），2 个 NONE
  - Storage-policy: 7 个端点（#140-146），2 个 MEDIUM（日期/ID），5 个 NONE
  - User management: 7 个端点（#147-153），3 个 MEDIUM（日期/类型），4 个 NONE
  - User center: 5 个端点（#154-158），2 个 LOW（结构），3 个 NONE
  - Music: 1 个端点（#139），1 个 LOW
  - Backup: 5 个端点（#17-21），2 个 LOW（日期），3 个 NONE
  - RSS/Sitemap/robots.txt: 约 4 个端点
  - Notification/Subscriber: 约 8 个端点
  - Schedule/Cron: 8 个 job 类型

- MEDIUM 风险端点（Phase 14 范围内约 37 个）关键风险：
  - #94-96, #98, #100-102, #104-106: Link/LinkCategory/LinkTag ID 类型（int vs Sqids string）
  - #108, #109: Link import/export 响应结构
  - #110, #111: Link health-check 响应结构和 ID 类型
  - #113, #116-118: Public links ID 类型
  - #119, #131: Album camelCase 字段命名
  - #124-126: AlbumCategory 字段命名
  - #128, #129: Album import 结果结构
  - #134-136, #138: Doc-series 日期 nullability
  - #140, #141: Storage-policy 日期和 ID 类型
  - #147, #148: User management 日期和 userGroupID 类型
  - #153: UserGroup description nullability
  - #159, #162-164: Statistics 日期和结构

- LOW 风险端点（Phase 14 范围内约 5 个）：
  - #139: Music playlist 结构
  - #156: User avatar 上传响应
  - #157: Notification settings 结构
  - #17, #18: Backup 日期

- NONE 风险端点（Phase 14 范围内约 30+ 个）：Links delete/review/sort、Album add/update/delete/export/stat、Doc-series delete、Storage-policy create/update/delete、User update/delete/reset-password/status、User profile/password/notification、Statistics basic/visit

- Go 后端 LinkDTO 关键字段：id(int), name, url, rss_url(omitempty), logo, description, status, siteshot(omitempty), email(omitempty), type(omitempty), original_url(omitempty), update_reason(omitempty), sort_order(int), skip_health_check(bool), category(*LinkCategoryDTO), tag(*LinkTagDTO)
- Go 后端 Album 关键字段：id(uint), created_at(time.Time), updated_at(time.Time), imageUrl, bigImageUrl, downloadUrl, thumbParam, bigParam, tags, viewCount(int), downloadCount(int), width(int), height(int), fileSize(int64), format, aspectRatio, fileHash, displayOrder(int), categoryId(*uint), title, description, location, published_at(*time.Time)
- Go 后端 Statistics summary/trend/analytics/top-pages 结构需从 handler 代码提取
- 前端 FriendsTableView 使用 `String(l.id)` 做 key，`selectedIds.has(l.id)` 做比较——如果 id 从 number 变成 string，has() 比较可能 break

</specifics>

<deferred>
## Deferred Ideas

- 浏览器端到端走查 — 留给 Phase 15 Final Integration & Cutover
- 5 个 auth 501 端点实现（register/activate/forgot-password/reset-password/check-email）— Phase 15 业务决策
- test-email 501 端点 — Phase 15 业务决策
- 2 个 OneDrive 501 端点 — Phase 15 业务决策
- 20 个 Theme/SSR-theme 端点 — 未来阶段
- config/export、config/import 端点实现 — 未来阶段
- proxy/download 端点实现 — 未来阶段

</deferred>

---

*Phase: 14-Features Verification*
*Context gathered: 2026-07-20*
