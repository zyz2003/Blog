---
phase: 10-scheduled-tasks
plan: 02
subsystem: infra
tags: [schedule, dispatch, jobs, email, notification, cleanup, thumbnail]

requires:
  - phase: 10-01
    provides: ScheduleModule, ScheduleService with dispatch() and runJob() infrastructure
provides:
  - 4 on-demand dispatch jobs (ThumbnailGeneration, CommentNotification, LinkCleanup, CleanupOrphanedItems)
  - 4 typed dispatch methods on ScheduleService
  - Dispatch hooks in UploadService, CommentService, LinkService, ArticleService
  - SettingsService exportAll/importAll for backup service
  - EmailService.sendCommentNotification with admin and reply notification
  - Comment reply and admin notification HTML email templates
affects: [backup, email, settings, file-upload, comment, link, article]

tech-stack:
  added: []
  patterns: [on-demand-dispatch, fire-and-forget-job, dual-notification-email-plus-pushoo]

key-files:
  created:
    - server/src/schedule/jobs/thumbnail-generation.job.ts
    - server/src/schedule/jobs/comment-notification.job.ts
    - server/src/schedule/jobs/link-cleanup.job.ts
    - server/src/schedule/jobs/cleanup-orphaned-items.job.ts
  modified:
    - server/src/schedule/schedule.service.ts
    - server/src/schedule/schedule.module.ts
    - server/src/schedule/jobs/index.ts
    - server/src/file/upload.service.ts
    - server/src/comment/comment.service.ts
    - server/src/comment/comment.module.ts
    - server/src/link/link.service.ts
    - server/src/article/article.service.ts
    - server/src/settings/settings.service.ts
    - server/src/email/email.service.ts
    - server/src/email/email.templates.ts

key-decisions:
  - "Direct job injection in ScheduleService constructor instead of ModuleRef — simpler, avoids lazy resolution complexity"
  - "Replaced synchronous thumbnail generation in UploadService with async dispatch — matches Go fire-and-forget pattern"
  - "CommentNotificationJob dispatches for all new comments, not just replies — job internally checks for parent and handles both admin and reply scenarios"
  - "LinkCleanupJob uses subquery NOT IN pattern for finding unused categories/tags — matches Go HasLinks() relationship check"
  - "EmailService.sendCommentNotification handles both admin and reply scenarios in one method — matches Go SendCommentNotification dual-scenario design"

patterns-established:
  - "On-demand dispatch: inject job into ScheduleService, call dispatch() with job name and closure"
  - "Dual notification: email via EmailService + in-app via NotificationService, matching Go Pushoo+email pattern"
  - "Settings export/import: plain object copy of cache for backup, upsert+refresh for restore"

requirements-completed: [CRON-01]

coverage:
  - id: D1
    description: "4 on-demand dispatch jobs (ThumbnailGeneration, CommentNotification, LinkCleanup, CleanupOrphanedItems)"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit — compilation passes with all job types"
        status: pass
    human_judgment: false
  - id: D2
    description: "4 typed dispatch methods on ScheduleService matching Go Broker.DispatchXxx"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit — dispatch methods type-check correctly"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dispatch hooks in UploadService, CommentService, LinkService, ArticleService"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit — service injection and dispatch calls compile"
        status: pass
    human_judgment: false
  - id: D4
    description: "SettingsService exportAll/importAll methods for backup service"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit — methods compile with correct types"
        status: pass
    human_judgment: false
  - id: D5
    description: "EmailService.sendCommentNotification with admin and reply notification templates"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit — method and templates compile correctly"
        status: pass
    human_judgment: true
    rationale: "Email sending requires SMTP configuration to verify end-to-end; template rendering should be visually verified"

duration: 34min
completed: 2026-07-15
status: complete
---

# Phase 10 Plan 02: On-Demand Dispatch & Service Extensions Summary

**4 on-demand dispatch jobs with typed ScheduleService dispatch methods, service hooks for async thumbnail/notification/cleanup, SettingsService export/import, and EmailService comment notification with dual admin+reply templates**

## Performance

- **Duration:** 34 min
- **Started:** 2026-07-15T13:38:23Z
- **Completed:** 2026-07-15T14:12:19Z
- **Tasks:** 5
- **Files modified:** 17

## Accomplishments
- Implemented 4 on-demand dispatch jobs matching Go backend ThumbnailGenerationJob, CommentNotificationJob, LinkCleanupJob, CleanupOrphanedItemsJob
- Added 4 typed dispatch methods to ScheduleService (dispatchThumbnailGeneration, dispatchCommentNotification, dispatchLinkCleanup, dispatchOrphanCleanup) matching Go Broker.DispatchXxx
- Wired dispatch hooks into UploadService (thumbnail), CommentService (notification), LinkService (cleanup), ArticleService (orphan cleanup)
- Added SettingsService exportAll/importAll methods for backup service integration
- Added EmailService.sendCommentNotification with dual admin+reply notification and HTML templates

## Task Commits

1. **Task 1-5: All tasks** - `b6c5996` (feat) — combined commit for all 5 tasks since they are tightly coupled

## Files Created/Modified
- `server/src/schedule/jobs/thumbnail-generation.job.ts` - On-demand thumbnail generation with 5-min timeout
- `server/src/schedule/jobs/comment-notification.job.ts` - Comment notification job with email dispatch
- `server/src/schedule/jobs/link-cleanup.job.ts` - Unused link category/tag cleanup with protected IDs
- `server/src/schedule/jobs/cleanup-orphaned-items.job.ts` - Orphaned post_tag/post_category cleanup
- `server/src/schedule/jobs/index.ts` - Updated barrel export with 4 new jobs
- `server/src/schedule/schedule.service.ts` - Added 4 dispatch methods + job injection
- `server/src/schedule/schedule.module.ts` - Added new job providers + EmailModule/CommentModule/ThumbnailModule/DatabaseModule imports
- `server/src/file/upload.service.ts` - Replaced sync thumbnail with async dispatch
- `server/src/comment/comment.service.ts` - Added ScheduleService injection + dispatchCommentNotification hook
- `server/src/comment/comment.module.ts` - Exported CommentRepository for job injection
- `server/src/link/link.service.ts` - Added ScheduleService injection + dispatchLinkCleanup hooks
- `server/src/article/article.service.ts` - Added ScheduleService injection + dispatchOrphanCleanup hooks
- `server/src/settings/settings.service.ts` - Added exportAll/importAll methods
- `server/src/email/email.service.ts` - Added sendCommentNotification method
- `server/src/email/email.templates.ts` - Added commentReplyEmailTemplate + commentAdminEmailTemplate
- `server/src/comment/comment.service.spec.ts` - Updated constructor for new ScheduleService param
- `server/src/link/link.service.spec.ts` - Updated constructor for new ScheduleService param

## Decisions Made
- Direct job injection in ScheduleService constructor instead of ModuleRef — simpler, avoids lazy resolution complexity
- Replaced synchronous thumbnail generation in UploadService with async dispatch — matches Go fire-and-forget pattern
- CommentNotificationJob dispatches for all new comments, not just replies — job internally checks for parent and handles both admin and reply scenarios
- LinkCleanupJob uses subquery NOT IN pattern for finding unused categories/tags — matches Go HasLinks() relationship check
- EmailService.sendCommentNotification handles both admin and reply scenarios in one method — matches Go SendCommentNotification dual-scenario design

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- CleanupOrphanedItemsJob.run() returns `{ deletedTags, deletedCategories }` but dispatch() expects `Promise<void>` — fixed by wrapping in async closure that discards return value
- Test files needed constructor parameter updates for new ScheduleService injection — updated both comment.service.spec.ts and link.service.spec.ts

## Next Phase Readiness
- ScheduleService dispatch infrastructure complete with both cron and on-demand jobs
- SettingsService exportAll/importAll ready for BackupService in Plan 10-03
- EmailService.sendCommentNotification ready for use by CommentNotificationJob
- All dispatch hooks wired and TypeScript compilation clean

---
*Phase: 10-scheduled-tasks*
*Completed: 2026-07-15*
