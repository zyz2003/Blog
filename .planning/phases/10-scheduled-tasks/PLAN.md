# Phase 10: Scheduled Tasks — Plan Index

**Phase:** 10-Scheduled Tasks
**Goal:** Cron jobs for history cleanup, temp data cleanup, statistics aggregation, view sync, thumbnail generation, link health check, scheduled publishing, and backup
**Requirement:** CRON-01
**Created:** 2026-07-15

---

## Plan Overview

| Plan | Name | Goal | Dependencies |
|------|------|------|--------------|
| 10-01 | Schedule Infrastructure & Core Jobs | ScheduleModule, ScheduleService with panic-recovery/logging wrappers, 7 cron jobs, view count Map, startup catch-up | None (extends existing modules) |
| 10-02 | On-Demand Dispatch & Service Extensions | 4 on-demand jobs, dispatch methods, ArticleService/ArticleRepository/StatisticsService/SettingsService extensions | 10-01 |
| 10-03 | Backup Service & Admin API | BackupService, BackupController, settings export/import, error codes, integration | 10-02 |

---

## Wave Structure

```
Wave 1 (10-01) ─── ScheduleModule + 7 cron jobs + view count Map + startup catch-up
     │
     ▼
Wave 2 (10-02) ─── On-demand dispatch + service extensions (Article, Statistics, Settings)
     │
     ▼
Wave 3 (10-03) ─── BackupService + BackupController + admin API + wiring + verification
```

---

## Success Criteria Verification

- [ ] Article history cleanup job runs on schedule (3:30 AM), removing entries beyond retention
- [ ] Temporary upload sessions cleaned on schedule (3:00 AM)
- [ ] Statistics aggregation job computes daily rollups (1:00 AM)
- [ ] View count sync job persists in-memory counts to database (2:00 AM)
- [ ] Link health check job verifies friend link availability (3:00 AM)
- [ ] Scheduled publishing job publishes articles with future publish_at dates (every minute)
- [ ] Backup job exports configuration as JSON on schedule (4:00 AM)
- [ ] All jobs use @nestjs/schedule with configurable intervals
- [ ] Startup catch-up runs missed aggregation dates
- [ ] On-demand dispatch works for thumbnail, notification, link cleanup, orphan cleanup
- [ ] Backup admin API endpoints functional (create, list, restore, delete, clean)
- [ ] All panic-recovery and logging wrappers operational

---

*Phase 10 — Scheduled Tasks*
