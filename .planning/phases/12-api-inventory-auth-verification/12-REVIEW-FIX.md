---
phase: 12-api-inventory-auth-verification
fixed_at: 2026-07-19T10:30:00Z
review_path: .planning/phases/12-api-inventory-auth-verification/12-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-07-19T10:30:00Z
**Source review:** .planning/phases/12-api-inventory-auth-verification/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: 7 Go public keys missing from PUBLIC_SETTING_KEYS

**Files modified:** `server/src/settings/public-setting-keys.ts`
**Commit:** a641a99
**Applied fix:** Added 7 keys that are `IsPublic: true` in Go but missing from the NestJS public list:
- `userpanel.show_user_center`, `userpanel.show_notifications`, `userpanel.show_publish_article`, `userpanel.show_admin_dashboard`
- `FRIEND_LINK_APPLY_CUSTOM_CODE_HTML`, `FRIEND_LINK_APPLY_CUSTOM_CODE`
- `about.page.comic`

### CR-02: generate-default-settings.js regex misses 3 Go definition entries

**Files modified:** `scripts/generate-default-settings.js`, `server/src/settings/default-settings.ts`
**Commit:** 37f8ca3
**Applied fix:** Replaced the regex-based parser with a character-level parser that correctly handles:
- Multiline backtick strings (FRIEND_LINK_APPLY_CUSTOM_CODE spans 50+ lines)
- Go string concatenation (backtick + double-quote + backtick, including chained concatenation)
- Escaped characters in double-quoted values (\n, \t, etc.)

Regenerated default-settings.ts: 331 -> 334 entries (matching Go source exactly).
Added: `post.copy.copyright_original`, `post.copy.copyright_reprint`, `FRIEND_LINK_APPLY_CUSTOM_CODE`

### WR-01: CDN_AFFECTED_KEYS uses Go constant name instead of actual key

**Files modified:** `server/src/settings/settings.service.ts`
**Commit:** b63420a
**Applied fix:** Replaced `'FRONT_DESK_SITE_OWNER_NAME'` (Go constant name) with `'frontDesk.siteOwner.name'` (actual setting key used in cache lookups). The CDN cache change detection was non-functional for this key because `cache.get()` looks up by the actual key string.

### WR-02: incrementUrlStats computes avgDuration from stale values

**Files modified:** `server/src/statistics/statistics.repository.ts`
**Commit:** 108780e
**Applied fix:** Moved avgDuration computation from JavaScript (which reads stale totalViews and avgDuration before the SQL update) to a SQL CASE expression that computes the weighted average atomically alongside the other field increments. This eliminates the correctness defect where concurrent requests could compute avgDuration from the same stale values.

**Status:** fixed: requires human verification (logic change -- SQL CASE expression for weighted average)

### WR-03: Test PRIVATE_KEY_PATTERNS list is incomplete

**Files modified:** `server/test/api-compat/settings-api-compat.spec.ts`
**Commit:** 89392c3
**Applied fix:** Expanded PRIVATE_KEY_PATTERNS from 5 to 18 patterns, adding: SMTP_USERNAME, SMTP_HOST, secret_id, secret_key, captcha_key, app_secret, smtp_pass, smtp_user, qq_api_key, pushoo, webhook, IP_API_TOKEN, cdn.secret.

### WR-04: Test does not verify userpanel keys are present in site-config

**Files modified:** `server/test/api-compat/settings-api-compat.spec.ts`
**Commit:** cf75125
**Applied fix:** Added two new test cases:
1. Verifies `userpanel.show_user_center`, `show_notifications`, `show_publish_article`, `show_admin_dashboard` are present in site-config response
2. Verifies `about.page.comic`, `FRIEND_LINK_APPLY_CUSTOM_CODE_HTML`, `FRIEND_LINK_APPLY_CUSTOM_CODE` are present

Also updated seeded settings count comment from 331 to 334.

### WR-05: about.page.content in PUBLIC_SETTING_KEYS does not exist in Go

**Files modified:** `server/src/settings/public-setting-keys.ts`
**Commit:** a641a99 (combined with CR-01)
**Applied fix:** Removed `'about.page.content'` from the PUBLIC_SETTING_KEYS Set. This key does not exist in the Go backend's definition.go or setting.go constants -- it was a phantom key that would never match any entry in the cache.

---

_Fixed: 2026-07-19T10:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
