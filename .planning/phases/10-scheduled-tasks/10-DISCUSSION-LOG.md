# Phase 10: Scheduled Tasks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 10-Scheduled Tasks
**Areas discussed:** On-demand job dispatch, View count sync, Backup service scope, Startup aggregation catch-up

---

## On-demand job dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| Fire-and-forget Promise | 与 D-160 模式一致，unawaited Promise + try-catch，单用户博客足够 | ✓ |
| 内存队列 (自实现) | 自建简单队列，顺序处理 | |
| BullMQ | 外部 Redis 队列库，重量级 | |

**User's choice:** Fire-and-forget Promise (Recommended)
**Notes:** 用户要求 100% 复刻，与 Go 后端 goroutine worker pool 语义等价。单用户博客不需要 BullMQ。

---

## View count sync

| Option | Description | Selected |
|--------|-------------|----------|
| Daily batch | 每天凌晨 2 点批量同步，与 Go 后端完全一致 | ✓ |
| Hourly incremental | 每小时同步一次，减少数据丢失风险 | |
| Real-time per-view | 每次浏览直接写 DB | |

**User's choice:** Daily batch (Recommended)
**Notes:** 与 Go 后端 SyncViewCountsJob 完全对齐。凌晨 2 点批量从内存 Map 读取增量并写入 DB。

---

## Backup service scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full service + API | 完整 BackupService + 定时 Job + 备份管理 API 端点 | ✓ |
| Cron job only | 只实现定时备份 Job | |
| Service + Job, no API | 核心逻辑 + 定时 Job，不暴露 API | |

**User's choice:** Full service + API (Recommended)
**Notes:** 100% 复刻 Go 后端 BackupService，包括 CreateBackup、ListBackups、RestoreBackup、DeleteBackup、CleanOldBackups + 管理员 API 端点。

---

## Startup aggregation catch-up

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, full catch-up | 启动时检查遗漏日期，自动追补，与 Go 后端完全一致 | ✓ |
| No catch-up | 只依赖每天凌晨 1 点定时聚合 | |

**User's choice:** Yes, full catch-up (Recommended)
**Notes:** 完整复刻 Go 后端 CheckAndRunMissedAggregation。后台异步执行，30 分钟超时，带 panic 恢复。

---

## Claude's Discretion

- ScheduleService 的具体实现方式
- 浏览量内存 Map 的数据结构
- 批量更新 SQL 的实现
- 备份元数据存储方式
- 时区处理（中国时区 UTC+8）
- 各 Job 日志格式
- 手动健康检查与定时健康检查的代码复用方式

## Deferred Ideas

- 备份管理前端 UI — 不改前端
- 统计数据清理定时任务 — Go 后端只有空壳
- 备份加密 — Go 后端无此功能
- 定时任务管理 UI — Go 后端无此功能
