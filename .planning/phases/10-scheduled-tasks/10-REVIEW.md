# Phase 10 Plan Quality Review

**Reviewer:** Claude (automated deep review)
**Date:** 2026-07-15
**Plans reviewed:** 10-01, 10-02, 10-03
**Status:** ✅ 所有问题已修正

---

## 总体评价：✅ 修正后可执行

计划整体结构合理、波次划分正确、API 路由与 Go 后端完全对齐。经过与 Go 后端源码和现有 NestJS 代码的逐行对比，发现 5 个重要问题和 7 个次要问题，**全部已在计划中修正**。

---

## 🔴 重要问题（必须修正）

### P1: 统计聚合架构与现有实现冲突

**计划假设：** StatisticsAggregationJob 每天凌晨 1:00 从 visitor_logs 批量聚合到 visitor_stats（Go 后端模式）。

**实际现状：** NestJS 的 `StatisticsRepository.upsertVisitorStats()` 已经在每次 `recordVisit()` 时实时 upsert visitor_stats（D-167 设计决策）。不存在"先写 log 再批量聚合"的模式——stats 是实时更新的。

**影响：**
- `aggregateDaily()` 方法如果按计划实现，会与实时 upsert 产生数据冲突（重复计数）
- `getLastAggregatedDate()` / `getFirstLogDate()` 的语义在实时模式下不明确
- 启动追补 `CheckAndRunMissedAggregation` 的前提是"stats 可能遗漏"，但实时 upsert 模式下不会遗漏

**修正方案：**
1. `StatisticsAggregationJob` 应改为 **校验/修正任务**：每天凌晨 1:00 重新从 visitor_logs 计算当天的 stats，与现有 visitor_stats 行对比，修正不一致的数据（而非从零聚合）
2. `aggregateDaily(date)` 实现为：`DELETE visitor_stats WHERE date = {date}` → `INSERT INTO visitor_stats SELECT COUNT(*), COUNT(DISTINCT visitor_id), ... FROM visitor_logs WHERE date = {date}`（先删后插，确保数据准确）
3. `CheckAndRunMissedAggregation` 改为：检查哪些日期的 visitor_stats 行不存在（可能因为服务停机期间有 log 但没 upsert），对这些日期执行 aggregateDaily
4. `getLastAggregatedDate()` → `getLastStatDate()`：返回 visitor_stats 表中最大的 date
5. `getFirstLogDate()` 保持不变：返回 visitor_logs 表中最早的 created_at

### P2: 浏览量同步模式与现有实现冲突

**计划假设：** ArticleService 维护 `viewCountMap`，每次浏览 +1 到 Map，SyncViewCountsJob 每天凌晨 2:00 批量写入 DB。

**实际现状：** `ArticleRepository.incrementViewCount(dbId)` 已经在 `getPublic()` 中直接 DB increment（D-65 Phase 03 设计决策）。

**影响：**
- 如果改为 Map 模式，需要修改 `getPublic()` 的现有逻辑
- Map 模式下，服务崩溃会丢失未同步的浏览量（Go 后端用 Redis 也有同样问题，但 Redis 持久化比内存 Map 更可靠）
- 现有 D-65 决策是"Phase 03 简单 increment"，Phase 10 应升级为批量模式

**修正方案：**
1. 保留计划中的 Map 模式（与 Go 后端对齐）
2. 在 `getPublic()` 中将 `articleRepo.incrementViewCount(article.id)` 替换为 Map increment
3. 在计划中明确标注这是 **D-65 的升级**，不是新增功能
4. SyncViewCountsJob 的 `batchUpdateViewCounts` 使用 `UPDATE articles SET view_count = view_count + {increment} WHERE id = {dbId}`（增量更新，不是绝对值覆盖）

### P3: LinkHealthCheckJob 与现有实现重复

**计划假设：** LinkHealthCheckJob 是新的定时任务，需要调用 `LinkService.runScheduledHealthCheck()`。

**实际现状：** `LinkService` 已经有完整的健康检查实现：
- `healthCheck()` — 手动触发入口（API 端点）
- `runHealthCheckAsync()` — 异步执行，含 10 并发限制、10s 超时、2xx/3xx 判定
- `checkSingleLink()` — 单链接检查
- `healthCheckStatus` — 状态追踪

**影响：**
- 计划中 Task 7 说"extract the core logic into a shared private method"，但核心逻辑已经是 `runHealthCheckAsync()` 这个 private 方法
- 不需要新增 `runScheduledHealthCheck()` 方法——直接调用 `healthCheck()` 即可（它内部调用 `runHealthCheckAsync()`）
- 但 `healthCheck()` 有 `is_running` 检查会抛异常——定时任务调用时需要绕过这个检查

**修正方案：**
1. 不新增 `runScheduledHealthCheck()` 方法
2. 将 `runHealthCheckAsync()` 改为 public（或新增一个 `forceHealthCheck()` 方法跳过 is_running 检查）
3. LinkHealthCheckJob 直接调用 `linkService.forceHealthCheck()` 或 `linkService.runHealthCheckAsync()`
4. 手动触发 API 端点继续调用 `healthCheck()`（保留 is_running 检查）

### P4: UploadService.cleanupAbandonedUploads() 不存在

**计划假设：** CleanupAbandonedUploadsJob 调用 `UploadService.cleanupAbandonedUploads()`（Phase 05 已实现）。

**实际现状：** UploadService 只有：
- `cleanupExpiredSessions()` — 每 60 秒清理内存 Map 中的过期 session
- `cleanupExpiredTempDirs()` — 启动时清理磁盘临时目录

没有 `cleanupAbandonedUploads()` 方法。Go 后端的 `CleanupAbandonedUploadsJob` 清理的是数据库中"已创建但未完成上传"的 file_entity 记录（uploadSessionId IS NOT NULL 且创建时间超过 24 小时）。

**修正方案：**
1. 在 UploadService 中新增 `cleanupAbandonedUploads(): Promise<number>` 方法
2. 实现逻辑：查询 file_entity 表中 `upload_session_id IS NOT NULL AND created_at < now() - 24h` 的记录，删除这些记录及其关联的磁盘文件
3. 这与现有的 `cleanupExpiredSessions()`（清理内存 Map）和 `cleanupExpiredTempDirs()`（清理磁盘目录）是不同层面的清理

### P5: CommentNotificationJob 的通知方式与现有实现不匹配

**计划假设：** CommentNotificationJob 通过 EmailService.sendCommentNotification() 发送邮件通知。

**实际现状：** CommentService 已经有：
- `fireCommentReplyNotification()` — 通过 NotificationService 发送站内通知
- `firePushooNotification()` — 通过 Pushoo 发送推送通知

Go 后端的 `CommentNotificationJob` 确实是通过 `emailSvc.SendCommentNotification()` 发送邮件。但 NestJS 现有实现没有邮件通知路径。

**修正方案：**
1. 保留计划中的 `EmailService.sendCommentNotification()` 实现（与 Go 后端对齐）
2. CommentNotificationJob 应同时触发：
   - 站内通知（已有 `fireCommentReplyNotification()`）
   - 邮件通知（新增 `EmailService.sendCommentNotification()`）
3. 在 CommentService.create() 中，将现有的内联通知调用改为通过 ScheduleService.dispatch() 异步派发

---

## 🟡 次要问题（建议修正）

### S1: ArticleHistoryService.cleanupAllOldVersions() 需要新增

**现状：** `ArticleHistoryRepository.deleteOldVersions(articleDbId, keepCount)` 已存在，但只处理单篇文章。需要新增 `cleanupAllOldVersions()` 遍历所有文章调用 `deleteOldVersions()`。

**建议：** 在 ArticleHistoryService 中新增：
```typescript
async cleanupAllOldVersions(): Promise<number> {
  // SELECT DISTINCT article_id FROM article_histories
  // For each article_id: call this.historyRepo.deleteOldVersions(id, 10)
  // Return total deleted count
}
```

### S2: ScheduledPublishJob 缓存清除逻辑不完整

**计划只提到：** `rssService.invalidateCache()`

**Go 后端实际清除的缓存 key：**
- `article:html:{publicId}` — 文章详情缓存
- `article:html:{abbrlink}` — abbrlink 缓存
- `rss:feed:latest` — RSS 缓存
- `home:articles:cache` — 首页文章缓存
- `home:featured:cache` — 首页推荐缓存
- `sidebar:recent:cache` — 侧边栏最近文章缓存

**建议：** NestJS 使用 MemoryCache，需要清除对应的缓存 key。在计划中明确列出所有需要清除的缓存 key。

### S3: SyncViewCountsJob 的 key 解码逻辑

**计划描述：** "Decode publicId to dbId via decodePublicID(publicId)"

**Go 后端实际逻辑：**
1. Scan Redis 匹配 `anheyu:article:view_count:*`
2. `GetAndDeleteMany` 原子获取并删除
3. Trim prefix 得到 publicId
4. `DecodePublicID(publicId)` 得到 dbId

**NestJS 对应：**
1. `articleService.getViewCountMap()` 获取 Map
2. Map 的 key 格式是 `article:view_count:{publicId}`
3. Trim prefix 得到 publicId
4. `decodePublicID(publicId)` 得到 dbId 和 entityType
5. 验证 entityType === EntityType.Article
6. 清除已处理的 key：`articleService.clearViewCountKeys([...map.keys()])`

**建议：** 在计划中补充 entityType 验证步骤。

### S4: 时间工具函数分散

**现状：** China timezone 工具分散在：
- `common/utils/time.util.ts` — `formatToChinaTime()`, `toISODateString()`
- `statistics.repository.ts` — `getChinaDayBounds()` (local function)
- `statistics.service.ts` — `startOfDayInChina()`, `endOfDayInChina()` (local functions)

**建议：** 将所有 China timezone 工具统一到 `common/utils/time.util.ts`，包括：
- `getChinaNow(): Date`
- `getChinaYesterday(): Date`
- `getChinaDayBounds(date: Date): [number, number]`
- `startOfDayInChina(date: Date): Date`

### S5: ScheduleModule 的 @Global() 可能导致循环依赖

**计划设计：** ScheduleModule 标记为 `@Global()`，ScheduleService 注入到 ArticleService、CommentService、LinkService 等。

**风险：** ScheduleModule 需要导入 ArticleModule（for ArticleService），而 ArticleService 又注入 ScheduleService → 循环依赖。

**建议：**
1. 使用 `forwardRef()` 解决循环依赖
2. 或者将 dispatch 方法提取为独立的 `ScheduleDispatcher` 接口，通过事件系统解耦
3. 最简方案：ScheduleService 不导入任何 feature module，而是通过 `ModuleRef.get()` 懒加载获取服务

### S6: 备份文件名时间戳格式

**计划描述：** `settings_backup_YYYYMMDD_HHMMSS.json`

**Go 后端实际：** `time.Now().Format("20060102_150405")` — 使用本地时间（非 UTC）

**建议：** 明确使用本地时间生成时间戳，与 Go 后端一致。NestJS 中用 `new Date()` 即可（JavaScript Date 默认本地时间）。

### S7: ScheduledBackupJob 的超时与重试交互

**Go 后端：** 5 分钟总超时包裹整个重试循环。如果第 2 次重试等待 20 秒后开始，但 5 分钟超时已到，则整个 Job 终止。

**计划描述：** 重试 3 次，退避 10s/20s/30s，5 分钟超时。但没有说明超时是包裹整个重试循环还是单次尝试。

**建议：** 明确超时包裹整个重试循环（与 Go 后端一致），在代码中用 `Promise.race([retryLoop(), timeout(300000)])`。

---

## ✅ 计划正确的部分

| 方面 | 评价 |
|------|------|
| 波次划分 | ✅ 3 波次依赖关系正确 |
| API 路由兼容性 | ✅ 5 个备份端点与 Go 后端完全对齐 |
| DTO 设计 | ✅ 与 Go handler 的 request/response 结构一致 |
| 文件名验证 | ✅ validateBackupFilename 防路径穿越逻辑完整 |
| 备份恢复前自动备份 | ✅ 与 Go 后端 RestoreBackup 逻辑一致 |
| Cron 表达式转换 | ✅ 6 位→5 位转换正确 |
| PanicRecovery + Logging 包装器 | ✅ 与 Go wrappers.go 语义等价 |
| fire-and-forget dispatch 模式 | ✅ 与 Go goroutine worker pool 语义等价 |
| 启动追补逻辑 | ✅ 与 Go CheckAndRunMissedAggregation 一致（需配合 P1 修正） |
| 备份元数据 .meta.json | ✅ 与 Go saveMetadata/loadMetadata 一致 |
| 错误码设计 | ✅ 覆盖所有备份操作场景 |

---

## 修正优先级

| 优先级 | 问题 | 修正状态 | 修正位置 |
|--------|------|---------|---------|
| P1 | 统计聚合架构冲突 | ✅ 已修正 | 10-01 Task 5: aggregateDaily 改为 reconciliation 模式 (DELETE + re-INSERT) |
| P2 | 浏览量同步模式变更 | ✅ 已修正 | 10-01 Task 3: 明确标注 D-65 升级，增量更新语义 |
| P3 | LinkHealthCheck 复用现有实现 | ✅ 已修正 | 10-01 Task 6+7: forceHealthCheck() + runHealthCheckAsync() public |
| P4 | cleanupAbandonedUploads 不存在 | ✅ 已修正 | 10-01 Task 7: 新增方法，清理 DB 中的遗弃 file_entity 记录 |
| P5 | 评论通知方式不匹配 | ✅ 已修正 | 10-02 Task 1: 双通知路径 (email + in-app) |
| S1 | cleanupAllOldVersions | ✅ 已修正 | 10-01 Task 7: 遍历所有文章调用 deleteOldVersions |
| S2 | 缓存清除不完整 | ✅ 已修正 | 10-01 Task 6: 列出所有 6 个缓存 key |
| S3 | SyncViewCounts entityType 验证 | ✅ 已修正 | 10-01 Task 6: 添加 entityType 验证步骤 |
| S4 | 时间工具分散 | ✅ 已修正 | 10-01 Task 7: 统一到 time.util.ts |
| S5 | 循环依赖 | ✅ 已修正 | 10-02 Task 3: 使用 forwardRef() |
| S6 | 备份时间戳本地时间 | ℹ️ 已明确 | 10-03 Task 1: new Date() 默认本地时间 |
| S7 | 备份超时与重试交互 | ✅ 已修正 | 10-03 Task 4: 超时包裹整个重试循环 |

---

## 建议

1. ✅ P1-P5 已全部修正，可以开始执行
2. P1 的 reconciliation 模式（DELETE + re-INSERT）确保了与实时 upsert 的兼容性
3. 执行时注意 forwardRef() 的循环依赖处理
4. 建议在执行 10-01 Task 7 时，先运行 `npm run dev` 确认时间工具迁移不影响现有功能
