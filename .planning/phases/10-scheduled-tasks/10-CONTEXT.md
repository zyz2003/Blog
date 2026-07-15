# Phase 10: Scheduled Tasks - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

定时任务调度框架 + 8 个 cron 定时任务 + 按需派发后台任务 + 备份服务完整实现。百分百复刻 Go 后端的 task broker 系统，包括定时调度、按需派发、启动追补、备份管理 API。

**交付物：**

定时调度基础设施：
- ScheduleModule 注册和配置（@nestjs/schedule）
- 所有定时任务的注册、启动、优雅停止
- Panic 恢复装饰器 + 日志装饰器（与 Go 后端 wrappers.go 对应）

Cron 定时任务（7 个）：
- CleanupAbandonedUploadsJob — 每天凌晨 3:00 清理被遗弃的上传会话
- StatisticsAggregationJob — 每天凌晨 1:00 统计数据日聚合
- SyncViewCountsJob — 每天凌晨 2:00 将内存 Map 中的文章浏览量批量写入 DB
- LinkHealthCheckJob — 每天凌晨 3:00 友链健康检查
- ScheduledPublishJob — 每分钟检查定时发布文章
- ArticleHistoryCleanupJob — 每天凌晨 3:30 清理文章旧历史版本（每篇保留 10 个）
- ScheduledBackupJob — 每天凌晨 4:00 自动备份系统设置

按需派发任务（4 个，即发即弃 Promise 模式）：
- ThumbnailGenerationJob — 文件上传后触发缩略图生成
- CommentNotificationJob — 评论创建后触发邮件通知
- LinkCleanupJob — 友链删除后清理孤立分类/标签
- CleanupOrphanedItemsJob — 清理无引用的标签和分类

启动追补：
- CheckAndRunMissedAggregation — 启动时检查遗漏的统计聚合日期，自动追补

备份服务（完整实现）：
- BackupService: CreateBackup / ListBackups / RestoreBackup / DeleteBackup / CleanOldBackups
- 备份管理 API 端点（管理员）
- 备份文件存储在 data/backups/ 目录
- 最大备份保留数量 10 个

</domain>

<decisions>
## Implementation Decisions

### 调度框架选择
- **D-220:** 使用 @nestjs/schedule 作为定时任务框架（NestJS 官方调度模块），替代 Go 后端的 robfig/cron。安装 @nestjs/schedule。ScheduleModule.forRoot() 注册到 AppModule。与 Go 后端一样使用 cron 表达式定义调度时间
- **D-221:** 所有定时任务放在 server/src/schedule/ 目录下，组织为：schedule.module.ts、schedule.service.ts、jobs/ 子目录（每个 Job 一个文件）。与 Go 后端 internal/app/task/ 目录结构对应

### 按需派发模式
- **D-222:** 按需派发任务使用即发即弃 Promise 模式（fire-and-forget），与 D-160 访客记录模式一致。不使用 BullMQ 等外部队列库——单用户博客场景不需要。Go 后端用 goroutine+channel 的 worker pool，NestJS 用 unawaited Promise 实现语义等价
- **D-223:** 按需派发任务在 ScheduleService 中提供 dispatch 方法，各模块注入 ScheduleService 调用。每个 dispatch 方法创建 async 函数并 catch 错误（防止未捕获的 Promise rejection），与 Go 后端 NewPanicRecoveryWrapper 对应

### 浏览量同步策略
- **D-224:** 文章浏览量同步完全复刻 Go 后端 SyncViewCountsJob：每天凌晨 2:00 从内存 Map 批量读取所有文章浏览增量，一次性写入 DB。内存 Map key 格式：`article:view_count:{publicId}`（与 Go 后端 Redis key 格式 `anheyu:article:view_count:*` 对应）。同步后清空 Map 中已处理的条目
- **D-225:** 浏览量内存 Map 在 ArticleService 中维护（浏览文章时 +1），SyncViewCountsJob 注入 ArticleService 获取 Map 引用。批量更新使用 ArticleRepository.batchUpdateViewCounts 方法

### 统计聚合与启动追补
- **D-226:** 统计聚合完全复刻 Go 后端 StatisticsAggregationJob：每天凌晨 1:00 聚合前一天的 visitor_logs 数据到 visitor_stats 表。使用中国时区 UTC+8 确定昨天日期（与 Go 后端 utils.NowInChina 一致）。10 分钟超时
- **D-227:** 完整复刻 Go 后端 CheckAndRunMissedAggregation：应用启动时在后台检查最后聚合日期，追补所有遗漏的日期。如果从未聚合过，从第一条 visitor_log 的日期开始追补。追补过程在后台异步执行（不阻塞启动），30 分钟超时，带 panic 恢复。需要 StatisticsService 提供 GetLastAggregatedDate / GetFirstLogDate / AggregateDaily 方法

### 友链健康检查定时任务
- **D-228:** 友链健康检查定时任务完全复刻 Go 后端 LinkHealthCheckJob：每天凌晨 3:00 对所有 APPROVED 友链发 HTTP GET 请求（10 秒超时），2xx/3xx 状态码为健康。不健康的 APPROVED 友链标记为 INVALID，恢复健康的 INVALID 友链标记回 APPROVED。并发限制 10 个（信号量模式）。10 分钟超时
- **D-229:** 健康检查同时作为定时任务和手动触发（Phase 07 已实现手动触发 POST /api/links/health-check），两种入口复用同一核心逻辑

### 定时发布文章
- **D-230:** 定时发布完全复刻 Go 后端 ScheduledPublishJob：每分钟检查是否有 publish_at <= now 且 status 为 draft/scheduled 的文章，逐个发布。发布后清除相关缓存（文章详情缓存 + RSS 缓存 + 首页缓存）。需要 ArticleRepository 提供 FindScheduledArticlesToPublish / PublishScheduledArticle 方法

### 文章历史版本清理
- **D-231:** 完全复刻 Go 后端 ArticleHistoryCleanupJob：每天凌晨 3:30 清理文章旧历史版本，每篇文章最多保留 10 个历史版本。需要 ArticleHistoryService 提供 CleanupAllOldVersions 方法（如果 Phase 03 未实现 ArticleHistoryService，此 Job 调用 ArticleRepository 直接查询删除）

### 上传会话清理
- **D-232:** 完全复刻 Go 后端 CleanupAbandonedUploadsJob：每天凌晨 3:00 清理被遗弃的上传会话。调用 UploadService.CleanupAbandonedUploads 方法（Phase 05 已实现此方法）

### 备份服务
- **D-233:** 完整复刻 Go 后端 BackupService：CreateBackup（从 DB 导出系统设置为 JSON 文件）、ListBackups（列出所有备份）、RestoreBackup（从备份文件恢复系统设置，恢复前自动创建当前配置备份）、DeleteBackup（删除指定备份）、CleanOldBackups（保留最近 N 个备份）。备份目录 data/backups/，文件名格式 settings_backup_YYYYMMDD_HHMMSS.json，最大保留 10 个备份
- **D-234:** 备份管理 API 端点（管理员，JWTAuth + AdminAuth）：
  - GET /api/backups — 列出所有备份
  - POST /api/backups — 手动创建备份
  - POST /api/backups/:filename/restore — 从备份恢复
  - DELETE /api/backups/:filename — 删除备份
- **D-235:** 备份服务使用 SettingsService 的导出/导入功能（与 Go 后端 ImportExportService 对应）。NestJS 已有 SettingsService，需新增 exportAll/importAll 方法。备份文件校验防止路径穿越（与 Go 后端 validateBackupFilename 一致）

### 装饰器与错误恢复
- **D-236:** 实现 Go 后端 wrappers.go 的两个装饰器的 NestJS 等价物：1) PanicRecoveryWrapper — try-catch 包裹每个 Job，捕获异常并记录日志，不导致应用崩溃；2) LoggingWrapper — 记录每个 Job 的开始时间、结束时间、执行耗时，生成唯一 executionId。两个装饰器作为 ScheduleModule 的拦截器或在 ScheduleService 中统一实现

### Claude's Discretion
- ScheduleService 的具体实现（如何统一管理所有 Job 的注册和执行）
- 按需派发 dispatch 方法的具体签名和错误处理
- 浏览量内存 Map 在 ArticleService 中的具体数据结构和增量更新方式
- ArticleRepository.batchUpdateViewCounts 的 SQL 实现
- StatisticsService.AggregateDaily 的聚合 SQL（从 visitor_logs 计算 visitor_stats）
- 备份文件元数据的存储方式（Go 后端用 .meta.json 伴生文件）
- 备份 API 的 DTO 设计和错误码定义
- 各 Job 的日志格式和错误码
- CheckAndRunMissedAggregation 的时区处理（中国时区 UTC+8）
- LinkHealthCheckJob 与 Phase 07 手动健康检查的代码复用方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端定时任务核心源码
- `internal/app/task/broker.go` — Broker: 定时任务注册（7 个 cron job）、按需派发（4 个 dispatch 方法）、worker pool、启动追补 CheckAndRunMissedAggregation
- `internal/app/task/scheduler.go` — Scheduler: 早期版本的调度器（只含清理任务），参考 cron 配置模式
- `internal/app/task/jobs.go` — Job 接口定义（Run + Name 方法）
- `internal/app/task/wrappers.go` — NewPanicRecoveryWrapper + NewLoggingWrapper 装饰器

### Go 后端各 Job 实现
- `internal/app/task/job_cleanup.go` — CleanupAbandonedUploadsJob: 清理被遗弃的上传会话
- `internal/app/task/job_statistics_aggregation.go` — StatisticsAggregationJob: 统计数据日聚合 + StatisticsCleanupJob
- `internal/app/task/job_sync_views.go` — SyncViewCountsJob: Redis 浏览量批量同步到 DB（含 key 扫描 + 解码 public ID + 批量更新）
- `internal/app/task/job_link_health_check.go` — LinkHealthCheckJob: 友链健康检查（并发 HTTP GET + 信号量 + 批量状态更新）
- `internal/app/task/job_scheduled_publish.go` — ScheduledPublishJob: 定时发布文章（每分钟检查 + 缓存清除）
- `internal/app/task/job_article_history_cleanup.go` — ArticleHistoryCleanupJob: 清理旧历史版本（每篇保留 10 个）
- `internal/app/task/job_scheduled_backup.go` — ScheduledBackupJob: 自动备份系统设置（含重试 3 次）
- `internal/app/task/job_thumbnail.go` — ThumbnailGenerationJob: 按需缩略图生成
- `internal/app/task/job_comment_notification.go` — CommentNotificationJob: 按需评论通知邮件
- `internal/app/task/job_link_cleanup.go` — LinkCleanupJob: 按需清理孤立友链分类/标签
- `internal/app/task/job_cleanup_items.go` — CleanupOrphanedItemsJob: 按需清理孤立标签/分类

### Go 后端备份服务源码
- `pkg/service/config/backup_service.go` — BackupService 接口 + backupService 实现：CreateBackup、ListBackups、RestoreBackup、DeleteBackup、CleanOldBackups、SetMaxBackupCount、validateBackupFilename、saveMetadata/loadMetadata

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，备份管理端点（如果存在）

### 现有 NestJS 代码（Phase 01-09 产出）
- `server/src/app.module.ts` — AppModule 需注册 ScheduleModule + BackupModule
- `server/src/article/article.service.ts` — ArticleService（浏览量内存 Map + RSS 缓存失效调用）
- `server/src/article/article.repository.ts` — ArticleRepository（需新增 batchUpdateViewCounts / FindScheduledArticlesToPublish / PublishScheduledArticle）
- `server/src/file/upload.service.ts` — UploadService（已有 CleanupAbandonedUploads 方法）
- `server/src/thumbnail/thumbnail.service.ts` — ThumbnailService（缩略图生成，按需派发可复用）
- `server/src/link/link.service.ts` — LinkService（健康检查核心逻辑可复用）
- `server/src/statistics/statistics.service.ts` — StatisticsService（需新增 AggregateDaily / GetLastAggregatedDate / GetFirstLogDate）
- `server/src/settings/settings.service.ts` — SettingsService（需新增 exportAll / importAll 方法，用于备份服务）
- `server/src/notification/notification.service.ts` — NotificationService（评论通知可复用）
- `server/src/common/cache/memory-cache.util.ts` — MemoryCache 工具（内存 Map 缓存模式）
- `server/src/common/guards/` — JwtAuthGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器
- `server/src/common/constants/error-codes.ts` — 错误码常量文件
- `server/src/email/email.service.ts` — EmailService（评论通知邮件可复用）

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-220）
- `.planning/REQUIREMENTS.md` — 完整验收标准（CRON-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **UploadService.CleanupAbandonedUploads** (server/src/file/upload.service.ts): Phase 05 已实现清理被遗弃上传会话的方法，CleanupAbandonedUploadsJob 直接调用
- **ThumbnailService** (server/src/thumbnail/thumbnail.service.ts): 缩略图生成服务，ThumbnailGenerationJob 直接调用
- **LinkService 健康检查逻辑** (server/src/link/link.service.ts): Phase 07 已实现手动健康检查，定时任务可复用核心逻辑
- **StatisticsService** (server/src/statistics/statistics.service.ts): 统计服务，需扩展 AggregateDaily 方法
- **SettingsService** (server/src/settings/settings.service.ts): 设置服务，需扩展 exportAll/importAll 方法用于备份
- **EmailService** (server/src/email/email.service.ts): 邮件服务，CommentNotificationJob 可复用
- **MemoryCache** (server/src/common/cache/memory-cache.util.ts): 内存 Map 缓存工具，浏览量 Map 可参考此模式
- **ArticleService** (server/src/article/article.service.ts): 文章服务，浏览量内存 Map 在此维护
- **NotificationService** (server/src/notification/notification.service.ts): 通知服务，评论通知逻辑可复用
- **Guards + Decorators**: JwtAuthGuard、AdminGuard、@Public() 已实现，备份 API 端点可使用

### Established Patterns
- Go 后端使用 robfig/cron v3 库，支持秒级 cron 表达式（6 位）。NestJS @nestjs/schedule 使用标准 5 位 cron 表达式（分时日月周），ScheduledPublishJob 需要调整为每分钟执行（`* * * * *`）
- Go 后端 Broker 有两种任务执行模式：1) cron 定时调度（RegisterCronJobs）2) 按需派发到 worker pool（Dispatch）。NestJS 分别用 @nestjs/schedule 和 fire-and-forget Promise 对应
- Go 后端每个 Job 都有 Name() 方法用于日志标识。NestJS 用类名或装饰器元数据标识
- Go 后端 DelayIfStillRunning 确保同一 Job 不会并发执行。NestJS @nestjs/schedule 默认行为相同
- Go 后端启动追补在 goroutine 中异步执行（不阻塞启动），带 30 分钟超时和 panic 恢复。NestJS 用 unawaited Promise + try-catch 实现等价语义
- Go 后端备份服务用 ImportExportService 导出/导入配置。NestJS 用 SettingsService.exportAll/importAll 对应
- Go 后端浏览量 Redis key 格式 `anheyu:article:view_count:{publicId}`，值是整数增量。NestJS 用内存 Map `article:view_count:{publicId}` 替代
- Go 后端统计聚合使用中国时区（UTC+8），NestJS 需同样处理时区

### Integration Points
- ScheduleModule 需注册到 AppModule
- BackupModule + BackupController + BackupService 需注册到 AppModule
- ArticleService 需维护浏览量内存 Map，供 SyncViewCountsJob 读取
- ArticleRepository 需新增 batchUpdateViewCounts / FindScheduledArticlesToPublish / PublishScheduledArticle 方法
- StatisticsService 需新增 AggregateDaily / GetLastAggregatedDate / GetFirstLogDate 方法
- SettingsService 需新增 exportAll / importAll 方法
- LinkService 健康检查逻辑需抽离为可复用方法（定时任务和手动触发共用）
- ScheduleService 需提供 dispatch 方法供各模块调用（缩略图、通知、清理等）
- 备份 API 端点需要 AdminGuard 保护
- ScheduledPublishJob 发布文章后需调用 RssService.invalidateCache() 清除 RSS 缓存

</code_context>

<specifics>
## Specific Ideas

- Go 后端定时任务调度时间表：1:00 AM 统计聚合 → 2:00 AM 浏览量同步 → 3:00 AM 上传清理+友链健康检查 → 3:30 AM 历史版本清理 → 4:00 AM 自动备份 → 每分钟定时发布
- Go 后端 SyncViewCountsJob 流程：1) Scan Redis 匹配 `anheyu:article:view_count:*` → 2) GetAndDeleteMany 原子获取并删除 → 3) 解码 public ID 为数据库 ID → 4) 批量 UpdateViewCounts
- Go 后端 LinkHealthCheckJob 流程：1) 获取所有 APPROVED 友链 + INVALID 友链 → 2) 并发 HTTP GET 检查（10 个并发，10 秒超时，最多 5 次重定向） → 3) 2xx/3xx 为健康 → 4) 不健康的 APPROVED→INVALID，恢复的 INVALID→APPROVED → 5) 批量更新状态
- Go 后端 ScheduledPublishJob 流程：1) FindScheduledArticlesToPublish（publish_at <= now） → 2) 逐个 PublishScheduledArticle → 3) 清除文章详情缓存 + RSS 缓存 + 首页缓存 + 侧边栏缓存
- Go 后端 ScheduledBackupJob 流程：1) 调用 BackupService.CreateBackup("定时自动备份", isAuto=true) → 2) 失败重试 3 次（间隔递增 10s/20s/30s） → 3) 自动清理旧备份（保留最近 10 个）
- Go 后端 CheckAndRunMissedAggregation 流程：1) 获取最后聚合日期 → 2) 如果从未聚合，从第一条 visitor_log 日期开始 → 3) 从起始日到昨天，逐日执行 AggregateDaily → 4) 失败则停止追补，等下次启动
- Go 后端备份文件名格式：settings_backup_YYYYMMDD_HHMMSS.json，元数据文件 settings_backup_YYYYMMDD_HHMMSS.meta.json
- Go 后端备份恢复时先创建当前配置备份（"恢复前自动备份"），然后导入备份文件
- Go 后端 CleanupOrphanedItemsJob 清理无引用的 post_tags 和 post_categories
- Go 后端 LinkCleanupJob 清理无引用的 link_categories（保护默认分类 ID）和 link_tags
- NestJS @nestjs/schedule 使用 5 位 cron 表达式（分 时 日 月 周），Go 后端 robfig/cron 使用 6 位（秒 分 时 日 月 周）。ScheduledPublishJob 从 `0 * * * * *` 调整为 `* * * * *`

</specifics>

<deferred>
## Deferred Ideas

- 备份管理前端 UI — 后端 API 完整实现，前端 UI 属于前端改动范畴，本项目不改前端
- 统计数据清理定时任务（StatisticsCleanupJob）— Go 后端只定义了空壳，无实际清理逻辑，暂不实现
- 备份加密 — Go 后端无加密，属于增强功能
- 定时任务管理 UI（启动/停止/查看日志）— Go 后端无此功能，属于新能力

</deferred>

---

*Phase: 10-Scheduled Tasks*
*Context gathered: 2026-07-15*
