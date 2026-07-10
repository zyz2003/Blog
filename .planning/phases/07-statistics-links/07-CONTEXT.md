# Phase 07: Statistics & Links - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

访客统计与分析仪表板；友链 CRUD 与健康检查。百分百复刻 Go 后端的统计和友链功能，不留后续阶段。

**交付物：**

统计公开端点：
- GET /api/public/statistics/basic — 基础统计数据（今日/昨日/月/年访问量）
- POST /api/public/statistics/visit — 记录访客访问（前端主动上报）

统计管理端点：
- GET /api/statistics/analytics — 访客分析数据（设备/浏览器/OS/来源分组统计）
- GET /api/statistics/top-pages — 热门页面统计
- GET /api/statistics/trend — 访客趋势数据（日/周/月）
- GET /api/statistics/summary — 统计概览（基础统计+热门页面+分析+趋势）
- GET /api/statistics/visitor-logs — 访客访问日志

友链公开端点：
- POST /api/public/links — 申请友链（含速率限制）
- GET /api/public/links — 获取公开友链列表（APPROVED 状态）
- GET /api/public/links/random — 获取随机友链
- GET /api/public/links/applications — 获取所有友链申请列表
- GET /api/public/links/check-exists — 检查友链 URL 是否已存在
- GET /api/public/link-categories — 获取有已审核通过友链的分类列表

友链管理端点：
- POST /api/links — 管理员创建友链
- GET /api/links — 管理员友链列表（含筛选）
- DELETE /api/links/batch-delete — 批量删除友链
- PUT /api/links/:id — 更新友链
- DELETE /api/links/:id — 删除友链
- PUT /api/links/:id/review — 审核友链
- POST /api/links/import — 导入友链（JSON）
- GET /api/links/export — 导出友链（JSON）
- POST /api/links/health-check — 触发健康检查
- GET /api/links/health-check/status — 获取健康检查状态
- PUT /api/links/sort — 批量更新友链排序
- GET /api/links/categories — 管理员分类列表
- POST /api/links/categories — 创建分类
- PUT /api/links/categories/:id — 更新分类
- DELETE /api/links/categories/:id — 删除分类
- GET /api/links/tags — 管理员标签列表
- POST /api/links/tags — 创建标签
- PUT /api/links/tags/:id — 更新标签
- DELETE /api/links/tags/:id — 删除标签

</domain>

<decisions>
## Implementation Decisions

### 访客记录采集方式
- **D-160:** 访客记录使用前端主动上报模式（POST /api/public/statistics/visit），与 Go 后端一致。后端异步处理（不 await 写库操作），快速响应前端。NestJS 使用 Promise 异步写库，Controller 立即返回成功响应
- **D-161:** 访客去重使用内存 Map 替代 Go 后端的 Redis SETNX。key 格式：`stat:uv:{ip}:{date}`（独立访客去重）和 `stat:pv:{ip}:{url}:{date}`（独立页面浏览去重）。TTL 到当天结束自动过期。进程重启时去重状态丢失，但 Phase 10 定时聚合会修正统计

### 统计数据三层结构
- **D-162:** 完整复刻 Go 后端三层统计结构：1) visitor_stats（日聚合表，Schema 已定义）2) url_stats（页面统计表，Schema 已定义）3) visitor_logs（原始日志表，需新增 Schema）。三层数据各司其职：原始日志用于访客日志查询，页面统计用于热门页面，日聚合用于趋势和基础统计
- **D-163:** visitor_logs 表需新增 Schema 文件 visitor-log.schema.ts，完整复刻 Go 后端字段：id, created_at, ip_address, user_agent, city, region, country, url_path, referrer, duration, browser, os, device。所有字段在 RecordVisit 时由后端填充（IP 从请求获取，UA 解析获取 browser/os/device，GeoIP 获取 city/region/country）

### RecordVisit 完整流程
- **D-164:** RecordVisit 端点完整复刻 Go 后端流程：1) 解析请求体（url_path, duration, referrer 等）→ 2) 获取客户端 IP → 3) IP 地理位置查询（复用 Phase 06 的 GeoIPService/WeatherModule）→ 4) UA 解析（使用 ua-parser-js 提取 browser/os/device）→ 5) 内存去重检查（Map SETNX 等效）→ 6) 异步写入 visitor_logs + 更新 url_stats + 更新 visitor_stats。与 Go 后端完全一致
- **D-165:** UA 解析使用 ua-parser-js 库。安装 ua-parser-js + @types/ua-parser-js。解析结果存入 visitor_logs 的 browser/os/device 字段，同时用于 GetVisitorAnalytics 的设备/浏览器/OS 分组统计

### 统计聚合策略
- **D-166:** Phase 07 实现实时增量更新：每次 RecordVisit 时对 visitor_stats 和 url_stats 表执行 +1 更新（uniqueVisitors/totalViews/pageViews/bounceCount）。Phase 10 实现定时全量聚合修正（从 visitor_logs 重新计算统计表），确保长期运行后数据准确。进程重启时内存去重状态丢失，定时聚合会修正
- **D-167:** 统计查询使用混合模式：复杂聚合查询（趋势、设备/浏览器/OS 分组统计、来源分析）使用 Drizzle 的 sql 模板标签写原始 SQL；简单查询（基础统计、热门页面）使用 Drizzle 查询构建器。原因：Drizzle 的 groupBy/聚合函数对复杂统计查询支持不够直观，原始 SQL 更清晰且与 Go 后端 SQL 逻辑对应更直接

### 统计查询端点
- **D-168:** 完整复刻 Go 后端 6 个统计端点：GetBasicStatistics（今日/昨日/月/年基础数据）、GetVisitorAnalytics（设备/浏览器/OS/来源分析）、GetTopPages（热门页面）、GetVisitorTrend（趋势数据）、GetStatisticsSummary（概览 = basic_stats + top_pages + analytics + trend_data）、GetVisitorLogs（访客日志分页）。每个端点的响应格式精确复制 Go 后端
- **D-169:** StatisticsModule 单模块组织：包含 StatisticsController（公开端点 + 管理员端点）、StatisticsService、StatisticsRepository。公开端点用 @Public()，管理员端点用 AdminGuard。与 Phase 03-06 的模块组织模式一致

### 友链审核工作流
- **D-170:** 友链状态枚举完整复刻 Go 后端：PENDING（待审核）、APPROVED（已通过）、REJECTED（已拒绝）、UPDATED（已更新需重新审核）。申请友链默认 PENDING，管理员审核后 APPROVED/REJECTED。友链更新时 status 变为 UPDATED（需重新审核）。ReviewLink 端点接收 status + reason
- **D-171:** 友链申请速率限制使用内存 Map，复刻 Go 后端 LinkApplyRateLimit：记录 IP 维度的申请频率，限制同一 IP 每天最多申请 N 次（N 从 settings 读取，默认 1）。key 格式 `link:apply:{ip}:{date}`，TTL 到当天结束

### 友链健康检查
- **D-172:** 友链健康检查完整复刻 Go 后端异步模式：POST /api/links/health-check 触发异步健康检查（对每个非 skip_health_check 的友链发 HTTP HEAD 请求），GET /api/links/health-check/status 查询检查进度。NestJS 用 Promise 异步执行，内存 Map 存储检查状态（running/completed/failed + 进度百分比 + 检查结果）。检查结果更新友链的 siteshot 字段（如果截图 API 可用则更新截图）

### 友链导入导出与边缘功能
- **D-173:** 完整实现友链导入/导出：POST /api/links/import 导入 JSON 友链数据（解析 JSON、创建友链+分类+标签、处理重复），GET /api/links/export 导出为 JSON。与 Go 后端完全一致
- **D-174:** 完整实现所有边缘端点：GET /api/public/links/random（随机友链，从 APPROVED 友链中随机选取 N 条）、GET /api/public/links/check-exists（检查 URL 是否已有 APPROVED 友链）、GET /api/public/links/applications（所有友链申请列表，公开接口）、PUT /api/links/sort（批量更新友链 sortOrder）。每个端点精确复制 Go 后端行为

### 友链 ID 编码
- **D-175:** 友链 ID 使用 Sqids 编码，需新增 EntityTypeLink 常量。所有公开端点的 :id 参数和响应中的 id 字段都是 Sqids 编码的公共 ID。管理员端点 /api/links/:id 同样使用 Sqids 编码。与 Go 后端一致

### 友链申请通知与截图
- **D-176:** 友链申请后通过 Pushoo 推送通知管理员，复用 Phase 06 的 Pushoo 推送框架。从 settings 读取 pushoo_channel/pushoo_token 配置，未配置则静默跳过。邮件通知留 Phase 09 通知模块实现
- **D-177:** 友链网站截图（siteshot）使用外部截图 API，从 settings 读取 API key 和服务地址。申请/创建友链时异步获取截图，获取失败则 siteshot 为空不阻止创建。如果未配置截图 API 则跳过截图获取

### 友链分类/标签响应格式
- **D-178:** 友链分类响应精确复制 Go 后端 DTO：分类包含 id/name/description/style + 关联友链列表。公开端点只返回 APPROVED 状态的友链，管理员端点返回所有状态友链
- **D-179:** 友链标签响应精确复制 Go 后端 DTO：标签包含 id/name/color + 关联友链数量。标签与友链的多对多关系通过 link_tag_pivot 表实现（Phase 01 已定义 Schema）

### LinkModule 组织
- **D-180:** LinkModule 单模块组织：包含 LinkController（公开端点 + 管理员端点）、LinkService、LinkRepository。友链分类和标签的 CRUD 也在同一个 Controller 中（/links/categories、/links/tags）。与 Go 后端单 Handler 组织一致。公开端点用 @Public() + JwtAuthOptionalGuard，管理员端点用 AdminGuard

### Claude's Discretion
- StatisticsRepository 的具体查询方法设计（Drizzle 查询构建方式）
- StatisticsService 中内存去重 Map 的具体实现（TTL 管理、清理策略）
- visitor_logs 表的索引设计（查询优化）
- LinkRepository 的具体查询方法设计（Drizzle 查询构建方式）
- LinkService 中健康检查的 HTTP HEAD 请求实现（超时、重试、并发控制）
- 友链导入 JSON 的解析和去重逻辑
- 外部截图 API 的具体调用实现
- 统计查询中原始 SQL 的具体语句（趋势、分组、聚合）
- 友链申请的 Pushoo 推送消息格式
- ua-parser-js 的初始化和配置

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端统计源码（API 兼容性的权威参考）
- `pkg/handler/statistics/statistics_handler.go` — StatisticsHandler：GetBasicStatistics、RecordVisit、GetVisitorAnalytics、GetTopPages、GetVisitorTrend、GetStatisticsSummary、GetVisitorLogs
- `pkg/service/statistics/visitor_stat_service.go` — VisitorStatService：RecordVisit（含异步处理、去重、聚合逻辑）、GetBasicStatistics、GetVisitorAnalytics、GetTopPages、GetVisitorTrend、GetStatisticsSummary、GetVisitorLogs
- `pkg/domain/repository/visitor_stat_repo.go` — VisitorStatRepo：数据库查询接口
- `pkg/domain/model/visitor_stat.go` — VisitorStatistics、VisitorLogRequest、VisitorAnalytics、VisitorTrendData、URLStatistics 等数据模型
- `ent/schema/visitor_stat.go` — VisitorStat 表 Schema 定义（日聚合表）
- `ent/schema/url_stat.go` — URLStat 表 Schema 定义（页面统计表）

### Go 后端友链源码（API 兼容性的权威参考）
- `pkg/handler/link/handler.go` — LinkHandler：ApplyLink、CheckLinkExists、ListPublicLinks、GetRandomLinks、ListAllApplications、AdminCreateLink、ListLinks、AdminUpdateLink、AdminDeleteLink、AdminBatchDeleteLinks、ReviewLink、ImportLinks、ExportLinks、CheckLinksHealth、GetHealthCheckStatus、BatchUpdateLinkSort、CreateCategory、ListCategories、UpdateCategory、DeleteCategory、ListPublicCategories、CreateTag、ListAllTags、UpdateTag、DeleteTag
- `pkg/service/link/service.go` — LinkService：友链业务逻辑（申请、审核、健康检查、导入导出、排序）
- `pkg/domain/model/link.go` — Link、ApplyLinkRequest、AdminCreateLinkRequest、ListLinksRequest、UpdateLinkRequest、ReviewLinkRequest、BatchDeleteLinksRequest、LinkCategoryDTO、LinkTagDTO 等数据模型
- `ent/schema/link.go` — Link 表 Schema 定义
- `ent/schema/link_category.go` — LinkCategory 表 Schema 定义
- `ent/schema/link_tag.go` — LinkTag 表 Schema 定义

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，统计/友链端点的路径和中间件组合：
  - statisticsPublic: GET /api/public/statistics/basic, POST /api/public/statistics/visit
  - statisticsAdmin: GET /api/statistics/analytics, GET /api/statistics/top-pages, GET /api/statistics/trend, GET /api/statistics/summary, GET /api/statistics/visitor-logs
  - linksPublic: POST/GET /api/public/links, GET /api/public/links/random, GET /api/public/links/applications, GET /api/public/links/check-exists
  - linkCategoriesPublic: GET /api/public/link-categories
  - linksAdmin: POST/GET/PUT/DELETE /api/links/*, POST /api/links/health-check, GET /api/links/health-check/status, PUT /api/links/sort, CRUD /api/links/categories, CRUD /api/links/tags

### 现有 NestJS 代码（Phase 01-06 产出）
- `server/src/statistics/statistics.module.ts` — StatisticsModule 空占位
- `server/src/link/link.module.ts` — LinkModule 空占位
- `server/src/database/schemas/url-stat.schema.ts` — url_stats 表 Schema（完整字段 + 3 个索引）
- `server/src/database/schemas/visitor-stat.schema.ts` — visitor_stats 表 Schema（需确认是否已定义，如未定义需新增）
- `server/src/database/schemas/link.schema.ts` — links 表 Schema（完整字段 + categoryId FK）
- `server/src/database/schemas/link-category.schema.ts` — link_categories 表 Schema
- `server/src/database/schemas/link-tag.schema.ts` — link_tags 表 Schema
- `server/src/database/schemas/link-tag-pivot.schema.ts` — link_tag_pivot 表 Schema（多对多关联）
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/decorators/current-user.decorator.ts` — @CurrentUser() 装饰器
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器（需新增 EntityTypeLink 常量）
- `server/src/common/constants/error-codes.ts` — 错误码常量文件（需扩展统计/友链相关错误码）
- `server/src/settings/settings.service.ts` — SettingsService（内存缓存 + 动态配置读取）
- `server/src/weather/weather.service.ts` — WeatherService/GeoIPService（IP 地理位置查询，Phase 06 已实现）
- `server/src/comment/comment.service.ts` — CommentService（Pushoo 推送框架，Phase 06 已实现）

### 前端类型定义
- `frontend/src/types/friend-link.ts` — 友链相关类型定义（确认请求/响应格式）
- `frontend/src/lib/api/friend-link.ts` — 友链管理 API 调用
- `frontend/src/app/admin/friends/` — 友链管理前端页面（确认 API 调用格式）

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-159）
- `.planning/REQUIREMENTS.md` — 完整验收标准（STATS-01, STATS-02, LINK-FRIEND-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **url_stats Schema** (server/src/database/schemas/url-stat.schema.ts): 完整字段已定义（urlPath, pageTitle, totalViews, uniqueViews, bounceCount, avgDuration, lastVisitedAt + 3 个索引），可直接使用
- **links Schema** (server/src/database/schemas/link.schema.ts): 完整字段已定义（name, url, rssUrl, logo, description, status, siteshot, email, type, originalUrl, updateReason, sortOrder, skipHealthCheck, categoryId + deletedAt 软删除），可直接使用
- **link_categories Schema** (server/src/database/schemas/link-category.schema.ts): 完整字段已定义（name, description, style），可直接使用
- **link_tags Schema** (server/src/database/schemas/link-tag.schema.ts): 完整字段已定义（name, color），可直接使用
- **link_tag_pivot Schema** (server/src/database/schemas/link-tag-pivot.schema.ts): 多对多关联表已定义（linkId, linkTagId + createdAt），可直接使用
- **StatisticsModule** (server/src/statistics/statistics.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **LinkModule** (server/src/link/link.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **Guards**: JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现，可直接用于路由保护
- **@Public() decorator**: 公开路由跳过认证
- **@CurrentUser() decorator**: 从 request 中提取用户信息
- **ResponseInterceptor**: 全局 { code, data, message } 包装
- **Sqids Encoder** (server/src/common/utils/sqids.ts): 需新增 EntityTypeLink 常量
- **SettingsService**: 内存缓存 + 动态配置读取，用于读取统计配置和友链配置
- **GeoIPService/WeatherService** (server/src/weather/): IP 地理位置查询已实现（Phase 06），统计模块可直接注入使用
- **Pushoo 推送框架** (server/src/comment/): Phase 06 已实现 Pushoo 推送调用点，友链申请可复用
- **Error Codes**: 已有错误码常量文件，需扩展统计/友链相关错误码

### Established Patterns
- Go 后端统计使用前端主动上报模式（POST /public/statistics/visit），不是中间件自动采集
- Go 后端统计有三层数据：visitor_stats（日聚合）+ url_stats（页面统计）+ visitor_logs（原始日志）
- Go 后端 RecordVisit 异步处理：先快速响应，后台异步持久化到三层表
- Go 后端访客去重用 Redis SETNX（IP+日期、IP+URL+日期），NestJS 用内存 Map 替代
- Go 后端友链有 4 种状态：PENDING/APPROVED/REJECTED/UPDATED，申请需管理员审核
- Go 后端友链健康检查是异步任务：触发后后台执行 HTTP HEAD 请求，可查询进度
- Go 后端友链申请有速率限制（LinkApplyRateLimit 中间件）
- Go 后端友链支持导入/导出 JSON 格式
- Go 后端友链分类包含关联友链列表，标签包含关联友链数量
- Go 后端友链与标签是多对多关系（link_tag_pivot 表）
- Go 后端统计查询涉及复杂 SQL（日/周/月趋势、设备/浏览器/OS 分组统计、来源分析）

### Integration Points
- StatisticsModule 需要注册到 AppModule
- LinkModule 需要注册到 AppModule
- StatisticsService 需要注入 WeatherModule 的 GeoIPService（IP 地理位置查询）
- LinkService 需要注入 Pushoo 推送服务（友链申请通知）
- visitor_logs 表需要新增 Schema 文件并注册到 database/schemas/index.ts
- Sqids 编解码器需要新增 EntityTypeLink 常量
- Error codes 需要扩展统计/友链相关错误码
- visitor_stats 表 Schema 需确认是否已定义（如未定义需新增）
- Phase 10 定时任务需要实现统计全量聚合修正

</code_context>

<specifics>
## Specific Ideas

- Go 后端 RecordVisit 的请求体（VisitorLogRequest）包含：url_path、duration、referrer 等字段。NestJS 需精确复制此 DTO
- Go 后端 GetBasicStatistics 返回 VisitorStatistics 结构：今日/昨日/本月/本年的 uniqueVisitors、totalViews、pageViews、bounceCount。NestJS 需精确复制此响应格式
- Go 后端 GetVisitorAnalytics 返回按设备/浏览器/OS/来源分组的统计数据，每组包含 name + count + percentage。NestJS 需精确复制此分组统计逻辑
- Go 后端 GetVisitorTrend 返回指定时间范围的日趋势数据（每天一条），包含 date + uniqueVisitors + totalViews + pageViews。支持日/周/月维度
- Go 后端 GetStatisticsSummary 是聚合端点，同时返回 basic_stats + top_pages + analytics + trend_data
- Go 后端 GetVisitorLogs 返回分页的访客日志列表，支持 start_date/end_date 筛选，默认最近 7 天。响应格式 { list, total, page, page_size }
- Go 后端友链申请（ApplyLink）包含完整流程：验证 → 创建 PENDING 记录 → Pushoo 通知管理员 → 返回"申请已提交，等待审核"
- Go 后端友链健康检查对每个非 skip_health_check 的友链发 HTTP HEAD 请求，检查 HTTP 状态码。检查结果更新友链记录
- Go 后端友链导入支持 JSON 格式，包含友链+分类+标签的完整数据。导入时处理重复（按 URL 去重）
- Go 后端友链导出将所有友链+分类+标签导出为 JSON 格式
- Go 后端 ListPublicLinks 返回按分类分组的已审核友链列表，每个分类包含分类信息 + 友链列表
- Go 后端 GetRandomLinks 从 APPROVED 友链中随机选取指定数量的友链
- Go 后端友链分类的 style 字段默认值为 "card"，支持 card/list 等样式
- Go 后端友链标签的 color 字段默认值为 "#666666"
- ua-parser-js 是 Node.js 最成熟的 UA 解析库，支持浏览器/OS/设备/CPU 等维度的解析

</specifics>

<deferred>
## Deferred Ideas

- 统计全量聚合定时任务 — Phase 10 实现（CRON-01），Phase 07 只做实时增量更新
- 友链健康检查定时任务 — Phase 10 实现（CRON-01），Phase 07 只实现手动触发
- 友链邮件通知 — Phase 09 通知模块实现（NOTIF-01），Phase 07 只实现 Pushoo 推送
- 统计数据缓存优化 — 后续阶段按需优化，当前每次查询直接读库
- 友链申请验证码/CAPTCHA — Go 后端无此功能，属于新能力

</deferred>

---

*Phase: 07-Statistics & Links*
*Context gathered: 2026-07-10*
