---
phase: 09-seo-music-notifications
plan: 05
reviewed: 2026-07-14T13:35:59Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - server/src/notification/notification.service.ts
  - server/src/notification/notification.controller.ts
  - server/src/notification/notification.module.ts
  - server/src/notification/notification.repository.ts
  - server/src/notification/dto/notification-type.dto.ts
  - server/src/notification/dto/user-notification-config.dto.ts
  - server/src/notification/dto/simple-notification-settings.dto.ts
  - server/src/notification/dto/notification.dto.ts
  - server/src/database/schemas/notification.schema.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 09-05: Code Review Report

**Reviewed:** 2026-07-14T13:35:59Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Notification module implementation (9 files) against the 09-05-PLAN specification and Go backend API contracts. The module implements 7 endpoints (4 Go-compatible, 3 new in-app), 4 default notification types, and the notifications table schema. The overall structure follows established codebase patterns correctly.

**Key concern:** The `findNotifications` repository method uses `select()` without specifying columns, which returns all columns including `userId`. This internal database ID leaks through the `GET /api/user/notifications` endpoint response. While the user can only see their own notifications (JWT-scoped), exposing the internal `userId` in the API response is an information disclosure issue and breaks the Go backend's convention of using Sqids-encoded public IDs externally.

Additional issues include: missing `ParseIntPipe` on the `:id` route parameter (returns 404 instead of 400 for non-numeric IDs), an authorization gap in `updateUserNotificationConfig` where `userId` is accepted but never verified against the config's owner, unused imports in the controller, missing validation decorator on `customSettings` in the DTO, and an unused import in the repository.

## Critical Issues

### CR-01: Internal userId leaked in notification list API response

**File:** `server/src/notification/notification.repository.ts:167-173`
**Issue:** The `findNotifications` method uses `select()` without specifying columns, which returns all columns from the `notifications` table including `userId`. This data flows through `NotificationService.listNotifications()` (line 247-253) directly to the `GET /api/user/notifications` controller endpoint (line 125-129). The internal database `userId` is exposed in the API response, violating the Go backend's convention of never exposing raw database IDs externally (they use Sqids-encoded public IDs). The `NotificationResponseDto` (in `notification.dto.ts`) does not include `userId`, confirming the intent was to exclude it, but the repository query does not enforce this.

**Fix:**
```typescript
// In notification.repository.ts, replace the select() in findNotifications:
const list = await this.db
  .select({
    id: notifications.id,
    notificationTypeId: notifications.notificationTypeId,
    title: notifications.title,
    content: notifications.content,
    isRead: notifications.isRead,
    createdAt: notifications.createdAt,
    readAt: notifications.readAt,
  })
  .from(notifications)
  .where(whereClause)
  .orderBy(desc(notifications.createdAt))
  .limit(options.pageSize)
  .offset((options.page - 1) * options.pageSize);
```

## Warnings

### WR-01: Missing ParseIntPipe on notification :id route parameter

**File:** `server/src/notification/notification.controller.ts:141-144`
**Issue:** The `:id` parameter in `PUT /api/user/notifications/:id/read` is parsed with `parseInt(id, 10)` without `ParseIntPipe` validation. If `id` is non-numeric (e.g., `abc`), `parseInt` returns `NaN`, which propagates to `findNotificationById(id=NaN, userId)`. The `eq(notifications.id, NaN)` condition never matches, so the endpoint returns a 404 "notification not found" instead of the correct 400 "bad request". Other controllers in this codebase (album, album-category) use `@Param('id', ParseIntPipe)` for proper validation.

**Fix:**
```typescript
@Put('user/notifications/:id/read')
@UseGuards(JwtAuthGuard)
async markNotificationAsRead(
  @CurrentUser() user: any,
  @Param('id', ParseIntPipe) id: number,
) {
  const userId = this.getUserId(user);
  await this.notificationService.markNotificationAsRead(id, userId);
  return null;
}
```

### WR-02: Authorization gap in updateUserNotificationConfig -- userId parameter ignored

**File:** `server/src/notification/notification.service.ts:199-209`
**Issue:** The `updateUserNotificationConfig` method accepts a `userId` parameter but never uses it to verify that the config being updated belongs to that user. The repository's `updateUserNotificationConfig` (line 129-144) updates by `configId` only, with no user-scoped WHERE clause. If this method is ever exposed via a controller endpoint, any authenticated user could update any other user's notification config by guessing the config ID (IDOR vulnerability). Currently, this method is only called internally by `updateUserNotificationSettings` (which correctly looks up the config by userId+typeId first), so it is not exploitable today. However, the unused `userId` parameter signals incorrect intent and creates a latent security trap.

**Fix:**
```typescript
async updateUserNotificationConfig(
  userId: number,
  configId: number,
  dto: UpdateUserNotificationConfigDto,
) {
  // Verify the config belongs to the user before updating
  const config = await this.repo.findUserNotificationConfigById(configId);
  if (!config || config.userId !== userId) {
    throw new NotFoundException(ErrorCodes.NOTIFICATION_CONFIG_UPDATE_FAILED);
  }
  const updated = await this.repo.updateUserNotificationConfig(configId, dto);
  if (!updated) {
    throw new NotFoundException(ErrorCodes.NOTIFICATION_CONFIG_UPDATE_FAILED);
  }
  return updated;
}
```

### WR-03: customSettings field in UpdateUserNotificationConfigDto lacks validation decorator, will be stripped by whitelist

**File:** `server/src/notification/dto/user-notification-config.dto.ts:36`
**Issue:** The `customSettings` property has no validation decorator (`@IsOptional()`, `@IsObject()`, or `@ValidateNested()`). The global `ValidationPipe` is configured with `whitelist: true`, which strips properties that lack decorators. This means `customSettings` will be silently removed from any incoming request body, making it impossible to update via API. If this DTO is ever wired to a controller endpoint, the `customSettings` field will be non-functional.

**Fix:**
```typescript
@IsOptional()
@IsObject()
customSettings?: Record<string, any>;
```

### WR-04: notificationEmail in UpdateUserNotificationConfigDto accepts any string instead of validating email format

**File:** `server/src/notification/dto/user-notification-config.dto.ts:32-33`
**Issue:** The `notificationEmail` field uses `@IsString()` but not `@IsEmail()`. Any arbitrary string (e.g., "not-an-email") will be accepted and stored in the database. If this email is later used for sending notifications, it will cause SMTP errors or bounces.

**Fix:**
```typescript
@IsOptional()
@IsEmail()
notificationEmail?: string;
```

### WR-05: Negative or zero page values produce incorrect offset calculations

**File:** `server/src/notification/notification.controller.ts:126`
**Issue:** The `page` query parameter is parsed with `parseInt(page, 10)` without bounds validation. If `page` is `0`, `-1`, or a non-numeric string (producing `NaN`), the offset calculation `(options.page - 1) * options.pageSize` produces negative or NaN values. SQLite treats negative OFFSET as 0 and NaN OFFSET as 0, so the query returns results from the beginning rather than signaling an error. This means `?page=0` and `?page=1` return the same results, and `?page=abc` silently returns page 1 data.

**Fix:**
```typescript
page: Math.max(1, page ? parseInt(page, 10) : 1),
pageSize: Math.max(1, Math.min(100, pageSize ? parseInt(pageSize, 10) : 10)),
```

## Info

### IN-01: Unused import -- EntityType in notification.controller.ts

**File:** `server/src/notification/notification.controller.ts:13`
**Issue:** `EntityType` is imported from `sqids.util` but never used in the controller. The `getUserId` helper only uses `decodePublicID`, not `EntityType`.

**Fix:** Remove `EntityType` from the import:
```typescript
import { decodePublicID } from '../common/utils/sqids.util';
```

### IN-02: Unused import -- UpdateUserNotificationConfigDto in notification.controller.ts

**File:** `server/src/notification/notification.controller.ts:16`
**Issue:** `UpdateUserNotificationConfigDto` is imported but never used in the controller. No controller endpoint currently accepts this DTO.

**Fix:** Remove the import:
```typescript
// Remove: import { UpdateUserNotificationConfigDto } from './dto/user-notification-config.dto';
```

### IN-03: Unused import -- isNull in notification.repository.ts

**File:** `server/src/notification/notification.repository.ts:6`
**Issue:** `isNull` is imported from `drizzle-orm` but never used in any query method.

**Fix:** Remove `isNull` from the import:
```typescript
import { eq, and, desc, sql } from 'drizzle-orm';
```

### IN-04: Excessive use of `any` type casts in notification.service.ts

**File:** `server/src/notification/notification.service.ts:97,142`
**Issue:** `ensureUserDefaultConfigs` uses `(c: any)` at line 97 and `getUserNotificationSettings` uses `(configs as any[])` at line 142. These bypass TypeScript's type safety. The repository's `findUserNotificationConfigs` returns a well-defined select shape that includes `notificationTypeId` and `notificationType.code`, so proper typing is available.

**Fix:** Define a type for the repository's return value and use it instead of `any`:
```typescript
// At the top of the service or in a shared types file:
type UserNotificationConfigWithtype = {
  id: number;
  notificationTypeId: number;
  isEnabled: boolean;
  notificationType?: { code: string };
  // ... other fields
};

// Then in the service:
const existingTypeIds = new Set(
  existingConfigs.map((c) => c.notificationTypeId),
);
```

---

_Reviewed: 2026-07-14T13:35:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
