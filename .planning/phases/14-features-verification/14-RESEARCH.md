# Phase 14: Features Verification - Research

**Researched:** 2026-07-20
**Domain:** Auxiliary feature endpoint verification (links, albums, doc-series, statistics, storage-policy, user-management, music, backup, SEO, notifications, schedule)
**Confidence:** HIGH

## Summary

Phase 14 verifies ~50 auxiliary feature endpoints across 11 modules. The research identified one critical mismatch (Link.id type: Go uses raw int, NestJS uses Sqids string) and several structural differences requiring field-by-field verification. CCP-1 (date nullability) was resolved in Phase 13 -- all tables have NOT NULL constraints on created_at/updated_at. The Album module uses camelCase JSON tags in both Go and NestJS, confirmed consistent. The User module has a Go inconsistency where userGroupID is uint in GetUserInfoResponse but string (Sqids) in AdminUserDTO; NestJS replicates this inconsistency. Statistics trend date format uses ISO strings in NestJS vs time.Time in Go; the structure matches but date serialization differs (CCP-2, LOW risk). Schedule/Cron has 10 job types registered (exceeding the 8 documented), all with @Cron decorators.

**Primary recommendation:** Fix Link.id to return raw DB int (matching Go LinkDTO.id: int), then verify all modules field-by-field using the established Phase 13 pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-301: Go LinkDTO.id is int (raw DB ID), frontend LinkItem.id is number. NestJS currently uses generatePublicID() (Sqids string) -- must verify and fix
- D-302: LinkCategory.id and LinkTag.id in NestJS retain raw int -- consistent with Go, no change needed
- D-303: Link.id fix direction depends on verification: if frontend expects number, NestJS must return raw DB int
- D-304: Go Album uses camelCase JSON tags, NestJS toResponseDTO also uses camelCase -- consistent
- D-305: Album created_at/updated_at/published_at use snake_case in both Go and NestJS -- consistent
- D-306: Album.id is raw DB int in both Go and NestJS -- consistent, no Sqids
- D-307: CCP-1 resolved in Phase 13 -- all tables have NOT NULL + default on created_at/updated_at
- D-308: Statistics key verification: summary structure, trend date format, analytics nesting, top-pages last_visited_at
- D-309: Doc-series uses Sqids encoding (EntityType.DocSeries), Go also uses Sqids -- verify encoding consistency
- D-310: Storage-policy ID type: Go StoragePolicyResponse.id is string (Sqids), NestJS uses generatePublicID -- consistent
- D-311: User management: Go AdminUserDTO.userGroupID is string (Sqids), Go GetUserInfoResponse.userGroupID is uint (raw). NestJS must match this inconsistency
- D-312: Music playlist response: Go uses gin.H{ songs, total }, NestJS must match
- D-313: Notification settings, avatar upload, backup CRUD -- LOW risk, confirm structure
- D-314: RSS/Sitemap/robots.txt are XML responses, not wrapped in { code, data, message }
- D-315: Schedule/Cron: verify 8+ job types execute correctly, no startup log spam (D-264)
- D-316: New test directory server/test/phase14-verification/
- D-317: Reuse existing helpers from server/test/helpers/
- D-318: Tests split by module into separate spec files
- D-319: All endpoints get field-by-field verification (including NONE risk)
- D-320: Verification baseline: Go DTO struct + frontend TypeScript types (dual comparison)
- D-321: MEDIUM risk endpoints first, then LOW, then NONE

### Claude's Discretion
- Specific assertion lists per endpoint
- Go DTO struct reading depth
- Frontend type definition reading scope
- Test file organization within phase14-verification/
- Link.id fix implementation details
- Statistics trend date format assertions
- RSS/Sitemap XML format verification method
- Schedule/Cron job verification approach

### Deferred Ideas (OUT OF SCOPE)
- Browser E2E walkthrough (Phase 15)
- 5 auth 501 endpoints (Phase 15 business decision)
- test-email 501 endpoint (Phase 15)
- 2 OneDrive 501 endpoints (Phase 15)
- 20 Theme/SSR-theme endpoints (future phase)
- config/export, config/import implementation (future phase)
- proxy/download implementation (future phase)
- Content endpoint verification (completed in Phase 13)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATS-01 | Visitor tracking and logging | NestJS StatisticsService.recordVisit matches Go pipeline: IP extraction, dedup, UA parse, GeoIP, async DB writes |
| STATS-02 | Statistics analytics (trends, devices, sources) | Go VisitorAnalytics has 6 sub-arrays; NestJS matches. DateRangeStats.date is time.Time in Go, ISO string in NestJS |
| LINK-FRIEND-01 | Friend link CRUD with health check | Link.id type mismatch is critical fix. All other fields match Go LinkDTO |
| ALBUM-01 | Album CRUD with categories | Album uses camelCase in both Go and NestJS. Album.id is raw int. AlbumCategoryDTO uses camelCase displayOrder |
| DOCSERIES-01 | Document series CRUD | DocSeries uses Sqids in both Go and NestJS. DocSeriesResponse fields match |
| RSS-01 | RSS/Atom feed generation | Go returns XML with Content-Type application/rss+xml. NestJS matches |
| SITEMAP-01 | Sitemap XML generation | Go uses xml.MarshalIndent with XML declaration. NestJS uses XMLBuilder with format:true |
| MUSIC-01 | Music playlist data API | Go returns { songs, total }. NestJS MusicService.fetchPlaylist returns Song[] -- controller must wrap |
| NOTIF-01 | Notification management | Go SimpleUserNotificationSettingsResponse has allowCommentReplyNotification bool. NestJS matches |
| SUBSCRIBER-01 | Subscriber subscribe/unsubscribe | Go Subscribe/Unsubscribe return void. NestJS matches |
| CRON-01 | Scheduled tasks (8 job types) | NestJS has 10 @Cron jobs registered, covering all 8 Go job types plus 2 additional |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Link CRUD + ID encoding | API / Backend | Database | Link.id type conversion happens in service layer |
| Album response formatting | API / Backend | — | camelCase field naming is service-layer concern |
| Statistics aggregation | API / Backend | Database | Trend/analytics queries use raw SQL aggregates |
| Doc-series Sqids encoding | API / Backend | — | Public ID encoding in repository layer |
| Storage-policy Sqids encoding | API / Backend | — | Public ID encoding in service layer |
| User management ID types | API / Backend | — | userGroupID inconsistency is service-layer concern |
| RSS/Sitemap XML generation | API / Backend | CDN / Static | XML is generated server-side, cached via headers |
| Music playlist fetching | API / Backend | — | External API call with in-memory cache |
| Notification settings | API / Backend | — | Simple boolean toggle |
| Schedule/Cron execution | API / Backend | Database | Jobs run server-side, write to database |
| Backup file management | API / Backend | Database | Settings export/import, file I/O |

## Module-by-Module Analysis

### Links Module (25 endpoints)

**CRITICAL MISMATCH: Link.id type**

Go `LinkDTO.id` is `int` (raw DB ID). NestJS `toLinkResponseDTO` uses `generatePublicID(link.id, EntityType.Link)` which returns a Sqids string. This is a breaking incompatibility.

**Frontend impact analysis:**
- `frontend/src/types/friends.ts`: `LinkItem.id: number` -- frontend declares number type
- `use-friends-page.ts` line 27: `selectedIds` is `Set<string>` -- uses `String(l.id)` to populate
- `FriendsTableView.tsx` line 38: `selectedIds.has(l.id)` -- Set comparison with mixed types
- `friendsApi.deleteLink(id: number)` -- passes id to URL path `/api/links/${id}`
- `friendsApi.batchDeleteLinks(ids: number[])` -- sends ids array in body
- `friendsApi.reviewLink(id: number, data)` -- passes id to URL path

**If Link.id becomes Sqids string:**
- URL interpolation still works (`/api/links/${sqidsString}`)
- Set comparison works (both sides are strings after `String()`)
- Batch delete `Number(id)` on line 147 would produce NaN for Sqids strings
- Frontend TypeScript type `number` would be violated (runtime works, type mismatch)

**Fix required:** Change NestJS `toLinkResponseDTO` to return `link.id` (raw DB int) instead of `generatePublicID(link.id, EntityType.Link)`. Also change `adminUpdateLink`, `adminDeleteLink`, `reviewLink` to accept raw int IDs via `parseInt(id, 10)` instead of `decodePublicID(id)`.

**Go LinkDTO field-by-field comparison:**

| Field | Go Type | Go JSON Key | NestJS Type | NestJS JSON Key | Match? |
|-------|---------|-------------|-------------|-----------------|--------|
| ID | int | id | **Sqids string** | id | **MISMATCH -- must fix** |
| Name | string | name | string | name | Yes |
| URL | string | url | string | url | Yes |
| RssURL | string | rss_url,omitempty | string? | rss_url? | Yes |
| Logo | string | logo | string | logo | Yes |
| Description | string | description | string | description | Yes |
| Status | string | status | string | status | Yes |
| Siteshot | string | siteshot,omitempty | string? | siteshot? | Yes |
| Email | string | email,omitempty | string? | email? | Yes |
| Type | string | type,omitempty | string? | type? | Yes |
| OriginalURL | string | original_url,omitempty | string? | original_url? | Yes |
| UpdateReason | string | update_reason,omitempty | string? | update_reason? | Yes |
| SortOrder | int | sort_order | number | sort_order | Yes |
| SkipHealthCheck | bool | skip_health_check | boolean | skip_health_check | Yes |
| Category | *LinkCategoryDTO | category | LinkCategoryResponseDto \| null | category | Yes |
| Tag | *LinkTagDTO | tag | LinkTagResponseDto \| null | tag | Yes |

**Go LinkCategoryDTO:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| ID | int | number (raw int) | Yes |
| Name | string | string | Yes |
| Style | string | string | Yes |
| Description | string | string | Yes |

**Go LinkTagDTO:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| ID | int | number (raw int) | Yes |
| Name | string | string | Yes |
| Color | string | string | Yes |

**Go ImportLinksResponse:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| Total | int | number | Yes |
| Success | int | number | Yes |
| Failed | int | number | Yes |
| Skipped | int | number | Yes |
| SuccessList | []*LinkDTO | LinkResponseDto[] | ID type mismatch |
| FailedList | []ImportLinkFailure | ImportLinkFailure[] | Yes |
| SkippedList | []ImportLinkSkipped | ImportLinkSkipped[] | Yes |

**Go LinkHealthCheckResponse:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| Total | int | number | Yes |
| Healthy | int | number | Yes |
| Unhealthy | int | number | Yes |
| UnhealthyIDs | []int | number[] | ID type mismatch |

**Go BatchDeleteLinksResponse:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| Total | int | number | Yes |
| Success | int | number | Yes |
| Failed | int | number | Yes |
| FailedList | []BatchDeleteLinkFailure | BatchDeleteLinkFailure[] | Yes |

**Go ExportLinksResponse:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| Links | []ImportLinkItem | ExportLinkItem[] | Yes |
| Total | int | number | Yes |

**Go HealthCheckStatus (handler-level struct):**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| IsRunning | bool | boolean | Yes |
| StartTime | *time.Time | string \| null | Yes (ISO string) |
| EndTime | *time.Time | string \| null | Yes (ISO string) |
| Result | *LinkHealthCheckResponse | HealthCheckResult \| null | ID type mismatch |
| Error | string | string | Yes |

### Album Module (15 endpoints)

**Go Album field-by-field comparison:**

| Field | Go Type | Go JSON Key | NestJS Type | NestJS JSON Key | Match? |
|-------|---------|-------------|-------------|-----------------|--------|
| ID | uint | id | number (raw int) | id | Yes |
| CreatedAt | time.Time | created_at | string (ISO) | created_at | Yes (CCP-2) |
| UpdatedAt | time.Time | updated_at | string (ISO) | updated_at | Yes (CCP-2) |
| ImageUrl | string | imageUrl | string | imageUrl | Yes |
| BigImageUrl | string | bigImageUrl | string | bigImageUrl | Yes |
| DownloadUrl | string | downloadUrl | string | downloadUrl | Yes |
| ThumbParam | string | thumbParam | string | thumbParam | Yes |
| BigParam | string | bigParam | string | bigParam | Yes |
| Tags | string | tags | string | tags | Yes |
| ViewCount | int | viewCount | number | viewCount | Yes |
| DownloadCount | int | downloadCount | number | downloadCount | Yes |
| Width | int | width | number | width | Yes |
| Height | int | height | number | height | Yes |
| FileSize | int64 | fileSize | number | fileSize | Yes |
| Format | string | format | string | format | Yes |
| AspectRatio | string | aspectRatio | string | aspectRatio | Yes |
| FileHash | string | fileHash | string | fileHash | **MISSING in NestJS toResponseDTO** |
| DisplayOrder | int | displayOrder | number | displayOrder | Yes |
| CategoryID | *uint | categoryId | number \| null | categoryId | Yes |
| Title | string | title | string | title | Yes |
| Description | string | description | string | description | Yes |
| Location | string | location | string | location | Yes |
| PublishedAt | *time.Time | published_at | string \| null | published_at | Yes |

**Note:** NestJS `toResponseDTO` has `widthAndHeight` (computed: "WxH" string) which Go does not have. This is an extra field -- LOW risk, frontend may or may not use it. Also `fileHash` is missing from NestJS `toResponseDTO` -- needs verification if frontend uses it.

**Go AlbumCategoryDTO:**

| Field | Go Type | Go JSON Key | NestJS Type | NestJS JSON Key | Match? |
|-------|---------|-------------|-------------|-----------------|--------|
| ID | uint | id | number (raw int) | id | Yes |
| Name | string | name | string | name | Yes |
| Description | string | description,omitempty | string | description | Yes |
| DisplayOrder | int | displayOrder | number | displayOrder | Yes |

### Doc-Series Module (5 endpoints)

**Go DocSeriesResponse field-by-field comparison:**

| Field | Go Type | Go JSON Key | NestJS Type | NestJS JSON Key | Match? |
|-------|---------|-------------|-------------|-----------------|--------|
| ID | string (Sqids) | id | string (Sqids) | id | Yes |
| CreatedAt | time.Time | created_at | string (ISO) | created_at | Yes (CCP-2) |
| UpdatedAt | time.Time | updated_at | string (ISO) | updated_at | Yes (CCP-2) |
| Name | string | name | string | name | Yes |
| Description | string | description | string | description | Yes |
| CoverURL | string | cover_url | string | cover_url | Yes |
| Sort | int | sort | number | sort | Yes |
| DocCount | int | doc_count | number | doc_count | Yes |

**Go DocSeriesWithArticles:**
- Embeds DocSeriesResponse + adds `articles: []DocArticleItem`
- DocArticleItem: { id: string, title: string, abbrlink: string, doc_sort: int, created_at: time.Time }
- NestJS returns articles from repository -- need to verify article fields match

**Go DocSeriesListResponse:**
- { list: []DocSeriesResponse, total: int64, page: int, pageSize: int }
- NestJS matches this structure

### Statistics Module (6 endpoints)

**Go VisitorStatistics (basic stats):**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| today_visitors | int64 | number | Yes |
| today_views | int64 | number | Yes |
| yesterday_visitors | int64 | number | Yes |
| yesterday_views | int64 | number | Yes |
| month_views | int64 | number | Yes |
| year_views | int64 | number | Yes |

**Go VisitorAnalytics:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| top_countries | []CountryStats | { country, count }[] | Yes |
| top_cities | []CityStats | { city, count }[] | Yes |
| top_browsers | []BrowserStats | { browser, count }[] | Yes |
| top_os | []OSStats | { os, count }[] | Yes |
| top_devices | []DeviceStats | { device, count }[] | Yes |
| top_referers | []RefererStats | { referer, count }[] | Yes |

**Go URLStatistics (top-pages):**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| url_path | string | string | Yes |
| page_title | string | string \| null | Yes |
| total_views | int64 | number | Yes |
| unique_views | int64 | number | Yes |
| bounce_count | int64 | number | Yes |
| bounce_rate | float64 | number | Yes |
| avg_duration | float64 | number | Yes |
| last_visited_at | *time.Time | string \| null | Yes |

**Go VisitorTrendData:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| daily | []DateRangeStats | { date, visitors, views }[] | date format differs |
| weekly | []DateRangeStats | [] (always empty) | Yes (Go also empty) |
| monthly | []DateRangeStats | [] (always empty) | Yes (Go also empty) |

**DateRangeStats.date format:** Go serializes `time.Time` as RFC3339 (e.g., "2026-07-20T00:00:00Z"). NestJS uses `current.toISOString()` which produces ISO 8601 with milliseconds (e.g., "2026-07-20T00:00:00.000Z"). This is CCP-2 (LOW risk).

**Go StatisticsSummary:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| basic_stats | *VisitorStatistics | VisitorStatisticsDto | Yes |
| top_pages | []*URLStatistics | UrlStatisticsDto[] | Yes |
| analytics | *VisitorAnalytics | VisitorAnalyticsDto | Yes |
| trend_data | *VisitorTrendData | VisitorTrendDataDto | Yes |

### Storage-Policy Module (7 endpoints)

**Go StoragePolicyResponse field-by-field comparison:**

| Field | Go Type | Go JSON Key | NestJS Type | NestJS JSON Key | Match? |
|-------|---------|-------------|-------------|-----------------|--------|
| ID | string (Sqids) | id | string (Sqids) | id | Yes |
| CreatedAt | time.Time | created_at | Date (raw) | created_at | **MISMATCH -- NestJS returns raw Date, not ISO string** |
| UpdatedAt | time.Time | updated_at | Date (raw) | updated_at | **MISMATCH -- NestJS returns raw Date, not ISO string** |
| Name | string | name | string | name | Yes |
| Type | string | type | string | type | Yes |
| Flag | string | flag,omitempty | string | flag | Yes |
| Server | string | server,omitempty | string | server | Yes |
| BucketName | string | bucket_name,omitempty | string | bucket_name | Yes |
| IsPrivate | bool | is_private | boolean | is_private | Yes |
| AccessKey | string | access_key,omitempty | string (masked) | access_key | Yes (masked in NestJS) |
| SecretKey | string | secret_key,omitempty | string (masked) | secret_key | Yes (masked in NestJS) |
| MaxSize | int64 | max_size | number | max_size | Yes |
| BasePath | string | base_path,omitempty | string | base_path | Yes |
| VirtualPath | string | virtual_path,omitempty | string | virtual_path | Yes |
| Settings | map[string]interface{} | settings,omitempty | object | settings | Yes |

**Critical finding:** NestJS storage-policy service line 253-254 returns `policy.createdAt` and `policy.updatedAt` as raw Date objects instead of ISO strings via `toISODateString()`. This needs to be fixed to match Go behavior and other modules.

**Go PolicyListResponse:** { list: []*StoragePolicyResponse, total: int64 }
NestJS returns same structure.

### User Management Module (7 endpoints)

**Go AdminUserDTO field-by-field comparison:**

| Field | Go Type | Go JSON Key | NestJS Type | NestJS JSON Key | Match? |
|-------|---------|-------------|-------------|-----------------|--------|
| ID | string (Sqids) | id | string (Sqids) | id | Yes |
| CreatedAt | string | created_at | string | created_at | Yes |
| UpdatedAt | string | updated_at | string | updated_at | Yes |
| Username | string | username | string | username | Yes |
| Nickname | string | nickname | string | nickname | Yes |
| Avatar | string | avatar | string | avatar | Yes |
| Email | string | email | string | email | Yes |
| Website | string | website | string \| null | website | Yes |
| LastLoginAt | *string | lastLoginAt | string \| null | lastLoginAt | Yes |
| UserGroupID | **string (Sqids)** | userGroupID | **string (Sqids)** | userGroupID | Yes |
| UserGroup | UserGroup | userGroup | UserGroupDTO | userGroup | Yes |
| Status | int | status | number | status | Yes |

**Go GetUserInfoResponse.userGroupID is uint (raw DB ID)** -- different from AdminUserDTO.userGroupID which is string (Sqids). NestJS replicates this inconsistency: `getUserInfo` returns `user.userGroupId` (raw number), `adminListUsers` returns `generatePublicID(user.userGroupId, EntityType.UserGroup)` (Sqids string).

**Go UserGroup (handler-level, not domain model):**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| ID | string (Sqids) | string (Sqids) | Yes |
| Name | string | string | Yes |
| Description | string | string | **MISMATCH -- DB allows null, Go returns "", NestJS may return null** |

**Go UserGroupDTO (admin endpoint):**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| ID | string (Sqids) | string (Sqids) | Yes |
| Name | string | string | Yes |
| Description | string | string | **MISMATCH -- same nullability issue** |

**UserGroup.description nullability:** Go `string` type zero value is `""`. NestJS `group.description` returns whatever the DB has -- if null, returns null. The `user_groups.description` schema column is `text('description')` without `.notNull()`, so null is possible. Fix: NestJS should return `group.description ?? ''` to match Go.

**Go AdminListUsersResponse:** { users: []AdminUserDTO, total: int64, page: int, size: int }
NestJS returns same structure.

### User Center Module (5 endpoints)

**Go GetUserInfoResponse:** Covered above. Key fields match NestJS except the userGroupID inconsistency which is Go's own design.

**Go SimpleUserNotificationSettingsResponse:**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| allowCommentReplyNotification | bool | boolean | Yes |

**Avatar upload:** Go returns avatar URL string. NestJS needs verification.

### Music Module (1 endpoint)

**Go playlist response:** `gin.H{ "songs": songs, "total": len(songs) }` where `songs` is `[]music.Song`.

**Go Song struct (from service):**
- id: string (NeteaseID)
- neteaseId: string
- name: string
- artist: string
- url: string
- pic: string
- lrc: string

**NestJS MusicService.fetchPlaylist()** returns `Song[]` with same fields. The controller wraps it as `{ songs, total }` -- need to verify controller does this wrapping.

### Backup Module (5 endpoints)

**Go BackupInfo (inferred from handler):**

| Field | Go Type | NestJS Type | Match? |
|-------|---------|-------------|--------|
| filename | string | string | Yes |
| size | int64 | number | Yes |
| created_at | time.Time | string (ISO) | Yes (CCP-2) |
| description | string | string | Yes |
| is_auto | bool | boolean | Yes |

All backup operations (create, restore, delete, clean) return void or BackupInfo. Structure matches.

### SEO Module (RSS/Sitemap/robots.txt ~4 endpoints)

**RSS feed:**
- Go: Returns XML string with `Content-Type: application/rss+xml; charset=utf-8`
- Go: Sets `Cache-Control: public, max-age=3600`, `X-Content-Type-Options: nosniff`, `Last-Modified`
- NestJS: Need to verify Content-Type, cache headers, and XML structure

**Sitemap:**
- Go: Uses `xml.MarshalIndent` with `<?xml version="1.0" encoding="UTF-8"?>` declaration
- Go: Sets `Content-Type: text/xml; charset=utf-8`, `Cache-Control: public, max-age=3600`
- NestJS: Uses XMLBuilder with `format: true, indentBy: '  '` -- should produce equivalent XML

**robots.txt:**
- Go: Returns plain text with `Content-Type: text/plain; charset=utf-8`, `Cache-Control: public, max-age=86400`
- NestJS: `generateRobots()` returns same structure (User-agent, Allow, Disallow, Sitemap)

**Key verification points:**
- XML declaration presence
- Content-Type headers
- Cache-Control headers
- XML structure (urlset > url > loc, lastmod, changefreq, priority)
- RSS item structure (title, link, description, pubDate, guid)

### Notification/Subscriber Module (~8 endpoints)

**Go NotificationTypeDTO:**

| Field | Go Type | Go JSON Key | NestJS Type | Match? |
|-------|---------|-------------|-------------|--------|
| ID | uint | id | number | Yes |
| Code | string | code | string | Yes |
| Name | string | name | string | Yes |
| Description | string | description | string | Yes |
| Category | string | category | string | Yes |
| IsActive | bool | isActive | boolean | Yes |
| DefaultEnabled | bool | defaultEnabled | boolean | Yes |
| SupportedChannels | []string | supportedChannels | string[] | Yes |
| CreatedAt | time.Time | createdAt | string (ISO) | Yes (CCP-2) |
| UpdatedAt | time.Time | updatedAt | string (ISO) | Yes (CCP-2) |

**Go UserNotificationConfigDTO:**

| Field | Go Type | Go JSON Key | NestJS Type | Match? |
|-------|---------|-------------|-------------|--------|
| ID | uint | id | number | Yes |
| UserID | uint | userId | number | Yes |
| NotificationTypeID | uint | notificationTypeId | number | Yes |
| IsEnabled | bool | isEnabled | boolean | Yes |
| EnabledChannels | []string | enabledChannels | string[] | Yes |
| NotificationEmail | string | notificationEmail,omitempty | string? | Yes |
| CustomSettings | map[string]interface{} | customSettings,omitempty | object? | Yes |
| NotificationType | *NotificationTypeDTO | notificationType,omitempty | object? | Yes |
| CreatedAt | time.Time | createdAt | string (ISO) | Yes (CCP-2) |
| UpdatedAt | time.Time | updatedAt | string (ISO) | Yes (CCP-2) |

**Subscriber endpoints:** Subscribe, Unsubscribe, UnsubscribeByToken, SendVerificationCode -- all return void (simple responses). LOW risk.

### Schedule/Cron Module (10 job types)

NestJS has 10 @Cron-decorated jobs (exceeding the 8 documented in CONTEXT.md):

| Job | Cron Expression | Go Equivalent | Match? |
|-----|----------------|---------------|--------|
| ScheduledPublishJob | `* * * * *` (every minute) | Yes | Yes |
| StatisticsAggregationJob | `0 1 * * *` (1 AM daily) | Yes | Yes |
| SyncViewCountsJob | `0 2 * * *` (2 AM daily) | Yes | Yes |
| CleanupAbandonedUploadsJob | `0 3 * * *` (3 AM daily) | Yes | Yes |
| LinkHealthCheckJob | `0 3 * * *` (3 AM daily) | Yes | Yes |
| ArticleHistoryCleanupJob | `30 3 * * *` (3:30 AM daily) | Yes | Yes |
| ScheduledBackupJob | `0 4 * * *` (4 AM daily) | Yes | Yes |
| ThumbnailGenerationJob | (dispatch-based, not cron) | Yes | Yes |
| CommentNotificationJob | (dispatch-based, not cron) | Yes | Yes |
| LinkCleanupJob | (dispatch-based, not cron) | Yes | Yes |
| CleanupOrphanedItemsJob | (dispatch-based, not cron) | Yes | Yes |

Wait -- that's 11 items. Let me recount: 7 @Cron jobs + 4 dispatch-based jobs = 11 total. The 4 dispatch-based jobs (ThumbnailGeneration, CommentNotification, LinkCleanup, CleanupOrphanedItems) are triggered by service calls, not cron timers. The 7 @Cron jobs match Go's cron schedule.

**Verification approach:** Cannot wait for cron triggers in tests. Must call job methods directly or use ScheduleService.runJob().

## Cross-Cutting Findings

1. **Link.id type mismatch is the only HIGH-risk item in Phase 14 scope.** All other mismatches are MEDIUM or LOW.

2. **Storage-policy date serialization bug:** `policy.createdAt` and `policy.updatedAt` are returned as raw Date objects instead of ISO strings. This is inconsistent with all other modules that use `toISODateString()`.

3. **UserGroup.description nullability:** DB allows null but Go returns "". NestJS should default to "" for consistency.

4. **Album.toResponseDTO missing `fileHash` field** that Go Album includes. Need to verify if frontend uses it.

5. **Album.toResponseDTO has extra `widthAndHeight` field** not in Go Album. LOW risk (extra field ignored by frontend).

6. **CCP-1 resolved:** Phase 13 confirmed all 28 tables with created_at/updated_at have NOT NULL + default constraints. No null dates possible.

7. **CCP-2 (date precision):** Go uses RFC3339 without milliseconds, NestJS uses ISO 8601 with milliseconds. LOW risk -- frontend parsers handle both.

8. **Go inconsistency: userGroupID type differs between endpoints.** GetUserInfo returns uint (raw), AdminListUsers returns string (Sqids). NestJS replicates this exactly.

## Risk Assessment

| Risk Level | Count | Items |
|-----------|-------|-------|
| HIGH | 1 | Link.id type mismatch (int vs Sqids string) |
| MEDIUM | 4 | Storage-policy date serialization, UserGroup.description nullability, Album missing fileHash, Album extra widthAndHeight |
| LOW | 3 | CCP-2 date precision, Album import result structure, Music playlist wrapping |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Link ID encoding | Custom int-to-string conversion | Raw DB int (link.id) | Go uses raw int, no encoding needed |
| Date serialization | Manual date formatting | toISODateString() | Consistent with all other modules |
| UserGroup description default | null check at response time | `group.description ?? ''` | Matches Go string zero value |

## Common Pitfalls

### Pitfall 1: Link.id Sqids encoding breaks frontend batch operations
**What goes wrong:** Frontend does `Number(id)` on Sqids strings, producing NaN
**Why it happens:** NestJS uses generatePublicID() for Link.id but Go uses raw int
**How to avoid:** Change Link.id to return raw DB int, change path param parsing to use parseInt()
**Warning signs:** Batch delete fails with NaN IDs, review/update URLs contain Sqids strings

### Pitfall 2: Storage-policy returns raw Date objects
**What goes wrong:** JSON serialization produces different format than ISO strings
**Why it happens:** Service returns `policy.createdAt` directly instead of `toISODateString(policy.createdAt)`
**How to avoid:** Apply toISODateString() in storage-policy service, matching all other modules
**Warning signs:** Date fields show as "2026-07-20T00:00:00.000Z" instead of consistent ISO format

### Pitfall 3: UserGroup.description null breaks frontend string operations
**What goes wrong:** Frontend expects string, gets null, string operations fail
**Why it happens:** DB allows null, Go returns "" (zero value), NestJS returns null
**How to avoid:** Default to empty string: `group.description ?? ''`
**Warning signs:** Frontend crashes on `.length` or `.trim()` of null description

## Code Examples

### Fix: Link.id return raw int (matching Go)
```typescript
// BEFORE (link.service.ts toLinkResponseDTO):
dto.id = generatePublicID(link.id, EntityType.Link) as any;

// AFTER:
dto.id = link.id;
```

### Fix: Link path param parsing (matching Go)
```typescript
// BEFORE (link.service.ts adminUpdateLink):
let decoded: { dbID: number; entityType: number };
try {
  decoded = decodePublicID(publicId);
} catch {
  throw new NotFoundException(ErrorCodes.LINK_NOT_FOUND);
}

// AFTER:
const dbID = parseInt(publicId, 10);
if (isNaN(dbID) || dbID <= 0) {
  throw new NotFoundException(ErrorCodes.LINK_NOT_FOUND);
}
```

### Fix: Storage-policy date serialization
```typescript
// BEFORE (storage-policy.service.ts):
created_at: policy.createdAt,
updated_at: policy.updatedAt,

// AFTER:
created_at: toISODateString(policy.createdAt),
updated_at: toISODateString(policy.updatedAt),
```

### Fix: UserGroup.description nullability
```typescript
// BEFORE (user.service.ts):
description: group.description,

// AFTER:
description: group.description ?? '',
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Link.id as Sqids string | Link.id as raw int | Phase 14 fix | Matches Go LinkDTO.id: int |
| Storage-policy raw Date | toISODateString() | Phase 14 fix | Consistent with all other modules |
| UserGroup.description nullable | Default to empty string | Phase 14 fix | Matches Go string zero value |

**Deprecated/outdated:**
- generatePublicID() for Link.id: No longer used -- Link uses raw int IDs like Go

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Frontend does not use Album.fileHash field | Album Module | If frontend uses it, NestJS must add it to toResponseDTO |
| A2 | Frontend ignores Album.widthAndHeight extra field | Album Module | If frontend rejects unknown fields, must remove it |
| A3 | Music controller wraps playlist as { songs, total } | Music Module | If not wrapped, response format differs from Go |
| A4 | NestJS sitemap produces valid XML with declaration | SEO Module | If XML is malformed, RSS readers break |

## Open Questions

1. **Does the frontend use Album.fileHash?**
   - What we know: Go Album includes fileHash, NestJS toResponseDTO omits it
   - What's unclear: Whether any frontend component reads album.fileHash
   - Recommendation: Search frontend code for "fileHash" references

2. **Does the music controller wrap playlist correctly?**
   - What we know: Go returns { songs, total }, NestJS service returns Song[]
   - What's unclear: Whether the controller adds the { songs, total } wrapper
   - Recommendation: Read music.controller.ts to verify

3. **Are there more Link.id consumers in the frontend?**
   - What we know: FriendsTableView, use-friends-page, friendsApi all use link.id
   - What's unclear: Whether public link pages (SiteCardGroup, FlinkList) use link.id for API calls
   - Recommendation: Search for all link.id usages in frontend

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | NestJS runtime | Yes | 22+ | -- |
| better-sqlite3 | Database | Yes | 12.x | -- |
| Jest | Test runner | Yes | 29.x | -- |
| supertest | HTTP testing | Yes | 6.x | -- |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x |
| Config file | server/jest.config.ts |
| Quick run command | `npx jest test/phase14-verification/ --passWithNoTests` |
| Full suite command | `npx jest test/phase14-verification/ --verbose --forceExit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINK-FRIEND-01 | Link CRUD with correct ID type (int) | unit | `npx jest test/phase14-verification/link-verification.spec.ts -x` | No -- Wave 0 |
| STATS-01 | Visitor tracking records visits | unit | `npx jest test/phase14-verification/statistics-verification.spec.ts -x` | No -- Wave 0 |
| STATS-02 | Statistics analytics structure matches Go | unit | `npx jest test/phase14-verification/statistics-verification.spec.ts -x` | No -- Wave 0 |
| ALBUM-01 | Album CRUD with camelCase fields | unit | `npx jest test/phase14-verification/album-verification.spec.ts -x` | No -- Wave 0 |
| DOCSERIES-01 | Doc-series CRUD with Sqids IDs | unit | `npx jest test/phase14-verification/doc-series-verification.spec.ts -x` | No -- Wave 0 |
| RSS-01 | RSS feed valid XML | unit | `npx jest test/phase14-verification/seo-verification.spec.ts -x` | No -- Wave 0 |
| SITEMAP-01 | Sitemap valid XML | unit | `npx jest test/phase14-verification/seo-verification.spec.ts -x` | No -- Wave 0 |
| MUSIC-01 | Music playlist structure | unit | `npx jest test/phase14-verification/music-verification.spec.ts -x` | No -- Wave 0 |
| NOTIF-01 | Notification settings structure | unit | `npx jest test/phase14-verification/notification-verification.spec.ts -x` | No -- Wave 0 |
| SUBSCRIBER-01 | Subscribe/unsubscribe | unit | `npx jest test/phase14-verification/notification-verification.spec.ts -x` | No -- Wave 0 |
| CRON-01 | Schedule jobs execute | unit | `npx jest test/phase14-verification/schedule-verification.spec.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest test/phase14-verification/<file> -x`
- **Per wave merge:** `npx jest test/phase14-verification/ --verbose --forceExit`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/test/phase14-verification/link-verification.spec.ts` -- covers LINK-FRIEND-01
- [ ] `server/test/phase14-verification/album-verification.spec.ts` -- covers ALBUM-01
- [ ] `server/test/phase14-verification/doc-series-verification.spec.ts` -- covers DOCSERIES-01
- [ ] `server/test/phase14-verification/statistics-verification.spec.ts` -- covers STATS-01, STATS-02
- [ ] `server/test/phase14-verification/storage-policy-verification.spec.ts` -- covers storage-policy
- [ ] `server/test/phase14-verification/user-management-verification.spec.ts` -- covers user management
- [ ] `server/test/phase14-verification/music-verification.spec.ts` -- covers MUSIC-01
- [ ] `server/test/phase14-verification/notification-verification.spec.ts` -- covers NOTIF-01, SUBSCRIBER-01
- [ ] `server/test/phase14-verification/backup-verification.spec.ts` -- covers backup
- [ ] `server/test/phase14-verification/seo-verification.spec.ts` -- covers RSS-01, SITEMAP-01
- [ ] `server/test/phase14-verification/schedule-verification.spec.ts` -- covers CRON-01

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT via @nestjs/passport |
| V3 Session Management | yes | JWT token refresh |
| V4 Access Control | yes | AuthGuard + AdminGuard |
| V5 Input Validation | yes | class-validator DTOs |
| V6 Cryptography | no | -- |

### Known Threat Patterns for NestJS + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in backup filenames | Tampering | validateBackupFilename() sanitizes input |
| SQL injection in statistics queries | Tampering | Drizzle parameterized queries |
| IDOR in link/admin endpoints | Elevation of Privilege | AuthGuard + ownership checks |
| XSS in RSS feed content | Tampering | HTML escaping in RSS item builder |

## Sources

### Primary (HIGH confidence)
- `_go-backend-archive/pkg/domain/model/link.go` - LinkDTO, LinkCategoryDTO, LinkTagDTO definitions
- `_go-backend-archive/pkg/domain/model/album.go` - Album, AlbumCategoryDTO definitions
- `_go-backend-archive/pkg/domain/model/docseries.go` - DocSeriesResponse, DocSeriesWithArticles definitions
- `_go-backend-archive/pkg/domain/model/visitor_stat.go` - VisitorStatistics, VisitorAnalytics, URLStatistics definitions
- `_go-backend-archive/pkg/domain/model/storage_policy.go` - StoragePolicyResponse definition
- `_go-backend-archive/pkg/domain/model/user.go` - User, UserGroup definitions
- `_go-backend-archive/pkg/domain/model/notification.go` - NotificationType, UserNotificationConfig definitions
- `_go-backend-archive/pkg/handler/link/handler.go` - Link handler implementation
- `_go-backend-archive/pkg/handler/statistics/statistics_handler.go` - Statistics handler + StatisticsSummary struct
- `_go-backend-archive/pkg/handler/user/handler.go` - User handler + AdminUserDTO, GetUserInfoResponse structs
- `_go-backend-archive/pkg/handler/notification/dto.go` - Notification DTO definitions
- `_go-backend-archive/pkg/handler/music/handler.go` - Music handler + playlist response format
- `_go-backend-archive/pkg/handler/rss/handler.go` - RSS handler + Content-Type headers
- `_go-backend-archive/pkg/handler/sitemap/handler.go` - Sitemap handler + XML generation
- `_go-backend-archive/pkg/handler/subscriber/handler.go` - Subscriber handler
- `server/src/link/link.service.ts` - NestJS LinkService + toLinkResponseDTO
- `server/src/album/album.service.ts` - NestJS AlbumService + toResponseDTO
- `server/src/doc-series/doc-series.service.ts` - NestJS DocSeriesService + toAPIResponse
- `server/src/statistics/statistics.service.ts` - NestJS StatisticsService
- `server/src/storage-policy/storage-policy.service.ts` - NestJS StoragePolicyService
- `server/src/user/user.service.ts` - NestJS UserService
- `server/src/notification/notification.service.ts` - NestJS NotificationService
- `server/src/music/music.service.ts` - NestJS MusicService
- `server/src/backup/backup.service.ts` - NestJS BackupService
- `server/src/rss/rss.service.ts` - NestJS RssService
- `server/src/sitemap/sitemap.service.ts` - NestJS SitemapService
- `server/src/schedule/schedule.service.ts` - NestJS ScheduleService
- `frontend/src/types/friends.ts` - Frontend LinkItem, LinkCategory, LinkTag types
- `frontend/src/lib/api/friends.ts` - Frontend friends API functions
- `frontend/src/app/admin/friends/_hooks/use-friends-page.ts` - Frontend friends page hook

### Secondary (MEDIUM confidence)
- `12-RISK-MARKING.md` - Per-endpoint risk levels from Phase 12
- `13-SUMMARY.md` - Phase 13 execution results

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all modules read from source code
- Architecture: HIGH - service/controller patterns verified
- Pitfalls: HIGH - concrete mismatches identified with fixes

**Research date:** 2026-07-20
**Valid until:** 2026-08-20
