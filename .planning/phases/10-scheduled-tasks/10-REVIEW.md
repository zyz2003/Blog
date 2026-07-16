---
phase: 10-scheduled-tasks
reviewed: 2026-07-16T20:30:00Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - server/src/schedule/schedule.module.ts
  - server/src/schedule/schedule.service.ts
  - server/src/schedule/jobs/cleanup-abandoned-uploads.job.ts
  - server/src/schedule/jobs/statistics-aggregation.job.ts
  - server/src/schedule/jobs/sync-view-counts.job.ts
  - server/src/schedule/jobs/link-health-check.job.ts
  - server/src/schedule/jobs/scheduled-publish.job.ts
  - server/src/schedule/jobs/article-history-cleanup.job.ts
  - server/src/schedule/jobs/scheduled-backup.job.ts
  - server/src/schedule/jobs/thumbnail-generation.job.ts
  - server/src/schedule/jobs/comment-notification.job.ts
  - server/src/schedule/jobs/link-cleanup.job.ts
  - server/src/schedule/jobs/cleanup-orphaned-items.job.ts
  - server/src/schedule/jobs/index.ts
  - server/src/backup/backup.service.ts
  - server/src/backup/backup.controller.ts
  - server/src/backup/backup.module.ts
  - server/src/backup/dto/create-backup-request.dto.ts
  - server/src/backup/dto/restore-backup-request.dto.ts
  - server/src/backup/dto/delete-backup-request.dto.ts
  - server/src/backup/dto/clean-backups-request.dto.ts
  - server/src/article/article.service.ts
  - server/src/article/article.repository.ts
  - server/src/statistics/statistics.service.ts
  - server/src/statistics/statistics.repository.ts
  - server/src/link/link.service.ts
  - server/src/file/upload.service.ts
  - server/src/common/utils/time.util.ts
  - server/src/common/constants/error-codes.ts
  - server/src/email/email.service.ts
  - server/src/article-history/article-history.service.ts
  - server/src/settings/settings.service.ts
findings:
  critical: 3
  warning: 8
  info: 4
  total: 15
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-16T20:30:00Z
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Deep review of Phase 10 (Scheduled Tasks) comparing every NestJS implementation file against its Go backend counterpart. Three critical bugs were found: a destructive DELETE query in LinkCleanupJob that would delete ALL categories instead of just unused ones, a missing `created_at = scheduled_at` update in PublishScheduledArticle that breaks article display timestamps, and an incorrect status filter in findScheduledArticlesToPublish that includes DRAFT articles when Go only queries SCHEDULED. Eight warnings cover missing DelayIfStillRunning parity, timezone handling errors, missing BatchUpdateStatus optimization, and several Go-backend parity gaps. Four info items cover code quality observations.

## Critical Issues

### CR-01: LinkCleanupJob DELETE query deletes ALL categories instead of only unused ones

**File:** `server/src/schedule/jobs/link-cleanup.job.ts:59-61`
**Issue:** The DELETE query uses `notInArray(linkCategories.id, [...excludeIds, ...idsToDelete])` which means "delete all categories whose ID is NOT in this combined list." This deletes every category that is not in `excludeIds` and not in `idsToDelete` -- including categories that ARE in use by links. The correct behavior is to delete only the categories in `idsToDelete`.

The Go backend uses `linkCategoryRepo.DeleteAllUnusedExcluding(ctx, excludeIDs)` which correctly deletes only unused categories. The NestJS code first correctly identifies unused categories, then incorrectly deletes everything else.

**Go backend behavior:** `DeleteAllUnusedExcluding` deletes only categories that have no links referencing them AND are not in the exclude list.

**Fix:**
```typescript
// BEFORE (broken):
await this.db
  .delete(linkCategories)
  .where(notInArray(linkCategories.id, excludeIds.length > 0 ? [...excludeIds, ...idsToDelete] : idsToDelete));

// AFTER (correct):
if (idsToDelete.length > 0) {
  await this.db
    .delete(linkCategories)
    .where(inArray(linkCategories.id, idsToDelete));
}
```

Also add the missing `inArray` import from drizzle-orm.

### CR-02: PublishScheduledArticle does not set created_at to scheduled_at

**File:** `server/src/article/article.repository.ts:771-780`
**Issue:** The Go backend's `PublishScheduledArticle` sets `created_at = scheduled_at` so the article's display timestamp matches the user's intended publish time. The NestJS implementation only sets `status = 'PUBLISHED'` and clears `scheduledAt`, but does NOT update `createdAt`. This means published scheduled articles will show their original creation time instead of the scheduled time, breaking the user's intent and Go API compatibility.

**Go backend behavior (article_repo.go lines 1093-1110):**
```go
updater := r.db.Article.UpdateOneID(articleID).
    SetStatus(article.StatusPUBLISHED).
    ClearScheduledAt()
if articleEntity.ScheduledAt != nil {
    updater.SetCreatedAt(*articleEntity.ScheduledAt)
}
```

**Fix:**
```typescript
async publishArticle(dbId: number): Promise<void> {
  // First get the article to read scheduledAt
  const [article] = await this.db
    .select()
    .from(articles)
    .where(eq(articles.id, dbId));

  const updateData: any = {
    status: 'PUBLISHED',
    scheduledAt: null,
    updatedAt: new Date(),
  };

  // Set createdAt to scheduledAt so display time matches user intent
  // Matches Go: updater.SetCreatedAt(*articleEntity.ScheduledAt)
  if (article?.scheduledAt) {
    updateData.createdAt = article.scheduledAt;
  }

  await this.db
    .update(articles)
    .set(updateData)
    .where(eq(articles.id, dbId));
}
```

### CR-03: findScheduledArticlesToPublish includes DRAFT status, Go only queries SCHEDULED

**File:** `server/src/article/article.repository.ts:753-765`
**Issue:** The NestJS query uses `inArray(articles.status, ['DRAFT', 'SCHEDULED'])` to find articles to publish. The Go backend only queries `article.StatusEQ(article.StatusSCHEDULED)`. Including DRAFT articles means articles that were saved as drafts with a scheduled_at date (perhaps accidentally) would be auto-published, which is incorrect behavior. A DRAFT article with a scheduled_at should NOT be auto-published -- only SCHEDULED articles should be.

**Go backend behavior (article_repo.go lines 1077-1083):**
```go
Where(
    article.StatusEQ(article.StatusSCHEDULED),
    article.DeletedAtIsNil(),
    article.ScheduledAtLTE(now),
    article.ScheduledAtNotNil(),
)
```

**Fix:**
```typescript
async findScheduledArticlesToPublish(): Promise<any[]> {
  return this.db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, 'SCHEDULED'),  // Only SCHEDULED, not DRAFT
        isNotNull(articles.scheduledAt),
        lte(articles.scheduledAt, new Date()),
        isNull(articles.deletedAt),
      ),
    );
}
```

## Warnings

### WR-01: getChinaNow() creates Date at wrong UTC moment -- affects all China-time calculations

**File:** `server/src/common/utils/time.util.ts:38-42`
**Issue:** `getChinaNow()` does `new Date(utcNow.getTime() + chinaOffset)` which creates a Date object representing a moment 8 hours in the future (in UTC terms). JavaScript Date objects are always UTC internally; you cannot change their timezone. This means `getChinaNow()` returns a Date that is 8 hours ahead of the actual current time. While `startOfDayInChina()` and `endOfDayInChina()` partially compensate by constructing new Date strings with `+08:00`, the raw `getChinaNow()` value is wrong if used directly.

The Go backend's `NowInChina()` correctly returns `time.Now().In(ChinaTimezone)` which is the same moment in time, just viewed in a different timezone.

**Impact:** Any code that uses `getChinaNow()` for comparison or arithmetic (e.g., `getChinaYesterday()`) may produce incorrect results depending on the current UTC time. The `getChinaYesterday()` function compounds this by subtracting 24h from the already-offset Date.

**Fix:**
```typescript
export function getChinaNow(): Date {
  // Return the current moment -- callers should use startOfDayInChina()
  // or formatToChinaTime() to get China-local values.
  // Do NOT add offset to the Date object itself.
  return new Date();
}
```
Then update all callers to use `startOfDayInChina(new Date())` and `formatToChinaTime(new Date())` instead of `getChinaNow()` for date comparisons.

### WR-02: Missing DelayIfStillRunning equivalent -- concurrent cron job executions possible

**File:** `server/src/schedule/schedule.module.ts`, `server/src/schedule/schedule.service.ts`
**Issue:** The Go backend uses `cron.WithChain(NewPanicRecoveryWrapper, NewLoggingWrapper, cron.DelayIfStillRunning)` which prevents a cron job from running if the previous execution is still in progress. The NestJS implementation only has `wrapWithPanicRecovery` and `wrapWithLogging` but no `DelayIfStillRunning` equivalent. The `@nestjs/schedule` `@Cron()` decorator does not provide this guard.

This is particularly important for `ScheduledPublishJob` (runs every minute) and `LinkHealthCheckJob` (HTTP calls with 10s timeout) -- if a previous execution is slow, a new one could start concurrently, causing duplicate publishes or duplicate HTTP checks.

**Go backend behavior:** `cron.DelayIfStillRunning(cron.DefaultLogger)` in the chain.

**Fix:** Add a running-state guard to each job, or implement a shared `DelayIfStillRunning` wrapper in `ScheduleService`:
```typescript
private runningJobs = new Set<string>();

async runJobWithGuard(jobName: string, fn: () => Promise<void>): Promise<void> {
  if (this.runningJobs.has(jobName)) {
    this.logger.log(`Job ${jobName} still running, skipping this execution`);
    return;
  }
  this.runningJobs.add(jobName);
  try {
    await this.wrapWithPanicRecovery(jobName, async () => {
      await this.wrapWithLogging(jobName, fn);
    });
  } finally {
    this.runningJobs.delete(jobName);
  }
}
```

### WR-03: LinkService.forceHealthCheck updates statuses one-by-one instead of batch

**File:** `server/src/link/link.service.ts:884-892`
**Issue:** The Go backend uses `linkRepo.BatchUpdateStatus(ctx, toInvalidIDs, "INVALID")` which performs a single SQL UPDATE with WHERE id IN (...). The NestJS implementation updates each link individually in a loop:
```typescript
for (const id of toInvalidIds) {
  await this.repo.updateStatus(id, 'INVALID');
}
```
This is N+1 queries and could be slow with many links. More importantly, it is not atomic -- if the process crashes mid-loop, some links will be updated and others will not, leaving the database in an inconsistent state.

**Fix:** Add a `batchUpdateStatus(ids: number[], status: string)` method to `LinkRepository` and use it in `forceHealthCheck()`.

### WR-04: BackupService.restoreBackup does not validate JSON before parsing

**File:** `server/src/backup/backup.service.ts:165-168`
**Issue:** `restoreBackup` reads the backup file and calls `JSON.parse(content)` without try-catch. If the backup file is corrupted or its metadata is corrupted, `JSON.parse` will throw a `SyntaxError` that propagates up as an unhandled error. The Go backend's `ImportConfig` handles parse errors gracefully with a descriptive error message.

**Fix:**
```typescript
let data: Record<string, string>;
try {
  data = JSON.parse(content);
} catch {
  throw new Error('备份文件格式无效，请确保文件为有效的JSON格式');
}
```

### WR-05: BackupService.createBackup writes file before metadata -- partial state on crash

**File:** `server/src/backup/backup.service.ts:66-78`
**Issue:** `createBackup` writes the backup file first (`fs.writeFileSync`), then saves metadata. If the process crashes between these two operations, the backup file exists on disk but has no metadata. While `listBackups` handles this gracefully (falls back to file stats), the metadata will show `is_auto: false` and `description: '旧版本备份'` instead of the actual values. The Go backend has the same ordering, so this is parity, but it is worth noting.

### WR-06: ScheduledBackupJob timeout may not cancel in-progress backup

**File:** `server/src/schedule/jobs/scheduled-backup.job.ts:37-53`
**Issue:** The `Promise.race` between `doRetry()` and `timeoutPromise` only rejects the outer promise when the timeout fires. It does NOT actually cancel the in-progress `backupService.createBackup()` call. If `createBackup` is slow (e.g., large settings export + disk I/O), the timeout fires but the backup operation continues in the background. The Go backend uses `context.WithTimeout` which properly cancels the operation.

In Node.js, there is no equivalent to Go's context cancellation for synchronous file I/O. However, the `settingsService.exportAll()` is async (reads from DB), so a proper cancellation token pattern could be used.

### WR-07: CommentNotificationJob injects unused NotificationService

**File:** `server/src/schedule/jobs/comment-notification.job.ts:3,22`
**Issue:** The `CommentNotificationJob` injects `NotificationService` and `SettingsService` but never calls `NotificationService`. The Go backend's `CommentNotificationJob` only sends email, so the email-only behavior is correct. However, the NestJS implementation imports `NotificationService` in the constructor (line 22) but never uses it, which is dead code. Either remove the unused dependency or implement the in-app notification that was apparently planned.

**Fix:** Remove `NotificationService` and `SettingsService` from the constructor if not needed, or implement the in-app notification call.

### WR-08: StatisticsAggregationJob timeout does not cancel in-progress DB query

**File:** `server/src/schedule/jobs/statistics-aggregation.job.ts:29-43`
**Issue:** Same as WR-06: `Promise.race` with a timeout does not cancel the `statisticsService.aggregateDaily()` call. If the aggregation query is slow, the timeout fires but the DB operation continues. Unlike Go's `context.WithTimeout(10*time.Minute)` which cancels the SQL query, the NestJS version has no way to cancel a Drizzle query mid-execution.

This is a known limitation of Node.js vs Go, but should be documented or mitigated (e.g., by setting SQLite's `busy_timeout` and query timeouts).

## Info

### IN-01: ScheduleModule is @Global but imports many feature modules

**File:** `server/src/schedule/schedule.module.ts:1-63`
**Issue:** `ScheduleModule` is marked `@Global()` and imports 13 feature modules. Being `@Global()` means all its exports (`ScheduleService`) are available everywhere, but the heavy import list creates tight coupling. The `@Global()` decorator is appropriate here since `ScheduleService` dispatch methods are called from many services, but the module could be simplified by using `forwardRef` more selectively.

### IN-02: ThumbnailGenerationJob uses `db: any` type instead of typed Drizzle instance

**File:** `server/src/schedule/jobs/thumbnail-generation.job.ts:23`
**Issue:** `@Inject(DRIZZLE) private readonly db: any` loses type safety. This pattern is used consistently across the codebase, so it is not unique to Phase 10, but it means Drizzle query errors will not be caught at compile time.

### IN-03: LinkCleanupJob and CleanupOrphanedItemsJob delete items one-by-one in loops

**File:** `server/src/schedule/jobs/link-cleanup.job.ts:104-106`, `server/src/schedule/jobs/cleanup-orphaned-items.job.ts:49-51`
**Issue:** Both jobs delete orphaned records one at a time in a `for` loop. This is N+1 queries. A batch delete using `inArray` would be more efficient. The Go backend uses `DeleteAllUnused` and `DeleteAllUnusedExcluding` which are single SQL statements.

### IN-04: BackupService uses synchronous fs methods (writeFileSync, readFileSync, etc.)

**File:** `server/src/backup/backup.service.ts`
**Issue:** The entire `BackupService` uses synchronous file system methods (`fs.writeFileSync`, `fs.readFileSync`, `fs.readdirSync`, `fs.existsSync`, `fs.unlinkSync`, `fs.mkdirSync`). Since better-sqlite3 is synchronous, this is consistent with the project's approach, but it blocks the Node.js event loop during file I/O. For a personal blog this is acceptable, but worth noting.

---

_Reviewed: 2026-07-16T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
