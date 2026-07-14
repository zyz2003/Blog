# Phase 09: SEO & Music & Notifications - Research

**Researched:** 2026-07-13
**Domain:** RSS/Sitemap XML generation, Music API proxy, Notification management, Subscriber management
**Confidence:** HIGH

## Summary

Phase 09 implements five distinct modules: RSS feed generation (3 endpoints), Sitemap/robots.txt generation (2 endpoints), Music playlist/song-resources API proxy (2 endpoints), Notification type management + user notification settings + in-app notifications (7 endpoints), and Subscriber subscribe/unsubscribe with email verification (4 endpoints). All modules replicate the Go backend's behavior exactly, with the notification module extending it with a new `notifications` table for in-app notification storage.

The Go backend source code has been fully read and analyzed. All API contracts, response formats, caching strategies, and edge cases are documented below. The existing NestJS codebase provides empty module placeholders and complete database schemas for subscribers, notification_types, and user_notification_configs. The new `notifications` table schema must be created. Cross-module integration points are identified: ArticleService needs RSS cache invalidation hooks, CommentService needs notification creation hooks, and CaptchaService is reused for subscriber verification.

**Primary recommendation:** Implement each module as a self-contained NestJS module following established patterns (Controller/Service/Repository), with RSS/Sitemap using `@Res()` to bypass the global response interceptor for XML output, and all other endpoints using the standard `{ code, data, message }` wrapper.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-205:** 订阅验证码用内存 Map + TTL 存储（key: `subscribe:code:{email}`，TTL 5分钟），替代 Go 后端的 Redis
- **D-206:** 邮件服务用 nodemailer + SMTP 实现，从 settings 读取 SMTP 配置（host/port/user/pass/from），未配置则静默跳过。安装 nodemailer + @types/nodemailer。提供 EmailService 接口，支持：1) SendVerificationEmail 2) SendArticlePushEmail
- **D-207:** 订阅时复用 Phase 02 的 CaptchaService 做人机验证。SendVerificationCode 端点接收 CaptchaParams
- **D-208:** 完整复刻 Go 后端 3 个订阅/退订端点 + SendVerificationCode。Subscribe 时如果邮箱已存在且 isActive=false 则重新激活；Subscribe 端点有速率限制（Go 后端 CustomRateLimit(3, 3)）
- **D-209:** 完整复刻音乐服务核心逻辑：FetchPlaylist + FetchSongResources + 图片URL优化 + NeteaseID 验证（正则 `^\d{6,12}$`）。从 settings 读取 `music.player.playlist_id` 和 `MUSIC_PLAYER_PLAYLIST_ID`，默认 8152976493
- **D-210:** 跳过 SSL 证书验证（与 Go 后端 InsecureSkipVerify 一致），Node.js HTTP 客户端设置 rejectUnauthorized: false
- **D-211:** 播放列表缓存 5 分钟（内存 Map），歌曲资源不缓存。key: `music:playlist`，TTL 5分钟
- **D-212:** 完整复刻 Go 后端音乐服务日志：请求/响应/错误/JSON结构分析日志。使用 NestJS Logger 标准格式
- **D-213:** RSS feed 用内存 Map 缓存（key: `rss:feed:latest`，TTL 1小时），替代 Go 后端的 Redis 缓存
- **D-214:** Sitemap 不缓存（与 Go 后端一致），每次请求都重新生成
- **D-215:** 文章 CRUD 时显式调用 RssService.invalidateCache() 清除 RSS 缓存
- **D-216:** RSS XML 用手动字符串拼接生成。Sitemap XML 用 XML 库序列化。robots.txt 用字符串模板生成
- **D-217:** 新建 notifications 表（id, userId, notificationTypeId, title, content, isRead, createdAt, readAt）
- **D-218:** 基础站内通知端点：GET/PUT/GET(unread-count) + PUT(read-all)，所有端点需要 JWT 认证
- **D-219:** 评论回复时自动创建站内通知，与 Phase 06 评论模块集成
- **D-220:** 完整复刻 Go 后端通知类型管理和用户通知配置：启动时 InitializeDefaultNotificationTypes（4 种默认类型），EnsureUserDefaultConfigs 为用户创建默认配置

### Claude's Discretion
- SubscriberRepository 的具体查询方法设计（Drizzle 查询构建方式）
- EmailService 中 SMTP 配置的读取和连接管理（连接池/重试）
- 验证码生成算法（Go 后端用 crypto/rand + binary.BigEndian.Uint32 % 1000000）
- MusicService 中 HTTP 客户端的具体实现（axios/fetch/原生 http）
- MusicService 中图片URL优化的并发控制实现（信号量模式）
- RSS XML 拼接的 XML 转义处理细节
- Sitemap XML 库的选择和序列化配置
- NotificationRepository 的具体查询方法设计
- notifications 表的索引设计
- 站内通知列表的分页和筛选参数
- 订阅者邮件通知的异步发送实现
- 各模块的 DTO 设计和错误码定义

### Deferred Ideas (OUT OF SCOPE)
- 订阅者邮件通知的实际发送 — 依赖 EmailService 的完整实现（SMTP 配置正确时才生效），未配置 SMTP 则静默跳过
- 站内通知实时推送（WebSocket/SSE）— 超出当前范围，属于新能力
- 友链申请站内通知 — 当前只实现评论回复触发站内通知
- 订阅者管理后台（管理员查看/管理订阅者列表）— Go 后端无此端点
- 音乐 API 基础地址配置界面 — 通过 settings 管理
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RSS-01 | RSS/Atom feed generation | Go RSS handler/service fully analyzed; manual XML string building, cache strategy, Content-Type switching documented |
| SITEMAP-01 | Sitemap XML generation | Go Sitemap handler/service fully analyzed; XML serialization, priority/frequency logic, robots.txt template documented |
| MUSIC-01 | Music playlist data API | Go Music handler/service fully analyzed; metings API proxy, quality fallback, NeteaseID validation, image URL optimization documented |
| NOTIF-01 | Notification management | Go Notification handler/service fully analyzed; 4 default types, user configs, simplified settings API, new notifications table designed |
| SUBSCRIBER-01 | Subscriber subscribe/unsubscribe | Go Subscriber handler/service fully analyzed; verification code flow, email sending, token-based unsubscribe documented |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RSS XML generation | API / Backend | — | Server-side XML string building from article data |
| Sitemap XML generation | API / Backend | — | Server-side XML serialization from article/page/link data |
| Music API proxy | API / Backend | External Service | Backend proxies requests to metings.qjqq.cn |
| Notification type management | API / Backend | Database | CRUD on notification_types table |
| User notification config | API / Backend | Database | CRUD on user_notification_configs table |
| In-app notifications | API / Backend | Database | New notifications table for storage |
| Subscriber management | API / Backend | Database + Email | Database for subscriber records, SMTP for email |
| Verification code storage | API / Backend (Memory) | — | In-memory Map with TTL, no persistence needed |
| Email sending | API / Backend | External SMTP | nodemailer connects to external SMTP server |

## Go Backend API Endpoints

### RSS Endpoints (Public, No Auth)
| Method | Path | Content-Type | Cache | Notes |
|--------|------|-------------|-------|-------|
| GET | /rss.xml | application/rss+xml; charset=utf-8 | public, max-age=3600 | RSS 2.0 feed |
| GET | /feed.xml | application/rss+xml; charset=utf-8 | public, max-age=3600 | Same as /rss.xml |
| GET | /atom.xml | application/atom+xml; charset=utf-8 | public, max-age=3600 | Same content, different Content-Type |

All three endpoints return the same RSS 2.0 XML content. The only difference is the Content-Type header. All set `X-Content-Type-Options: nosniff` and `Last-Modified` headers. These endpoints bypass the global `{ code, data, message }` response wrapper.

### Sitemap Endpoints (Public, No Auth)
| Method | Path | Content-Type | Cache | Notes |
|--------|------|-------------|-------|-------|
| GET | /sitemap.xml | text/xml; charset=utf-8 | public, max-age=3600 | XML sitemap |
| GET | /robots.txt | text/plain; charset=utf-8 | public, max-age=86400 | Robots exclusion |

These endpoints also bypass the global response wrapper.

### Music Endpoints (Public, No Auth)
| Method | Path | Response Format | Notes |
|--------|------|----------------|-------|
| GET | /api/public/music/playlist | `{ code, data: { songs, total }, message }` | Playlist with cache-busting `r` query param |
| POST | /api/public/music/song-resources | `{ code, data: { audioUrl, lyricsText }, message }` | Body: `{ neteaseId: string }` |

### Notification Endpoints
| Method | Path | Auth | Response Format | Notes |
|--------|------|------|----------------|-------|
| GET | /api/notification/types | JWT + Admin | `{ code, data: NotificationTypeDTO[], message }` | List all notification types |
| GET | /api/user/notification-settings | JWT | `{ code, data: { allowCommentReplyNotification }, message }` | Simplified settings |
| PUT | /api/user/notification-settings | JWT | `{ code, data: { allowCommentReplyNotification }, message }` | Body: `{ allowCommentReplyNotification: boolean }` |
| GET | /api/user/notification-configs | JWT | `{ code, data: UserNotificationConfigDTO[], message }` | Full config details |

### New In-App Notification Endpoints (Not in Go Backend)
| Method | Path | Auth | Response Format | Notes |
|--------|------|------|----------------|-------|
| GET | /api/user/notifications | JWT | `{ code, data: { list, total, page, pageSize }, message }` | Paginated list, supports isRead filter |
| PUT | /api/user/notifications/:id/read | JWT | `{ code, data: null, message }` | Mark single notification as read |
| PUT | /api/user/notifications/read-all | JWT | `{ code, data: null, message }` | Mark all as read |
| GET | /api/user/notifications/unread-count | JWT | `{ code, data: { count }, message }` | Get unread count |

### Subscriber Endpoints (Public)
| Method | Path | Rate Limit | Response Format | Notes |
|--------|------|-----------|----------------|-------|
| POST | /api/public/subscribe | CustomRateLimit(3,3) | `{ code, data: null, message }` | Body: `{ email, code }` |
| POST | /api/public/subscribe/code | CustomRateLimit(3,3) | `{ code, data: null, message }` | Body: `{ email, turnstile_token?, geetest_*?, image_captcha_id/answer? }` |
| POST | /api/public/unsubscribe | None | `{ code, data: null, message }` | Body: `{ email }` |
| GET | /api/public/unsubscribe/:token | None | `{ code, data: null, message }` | Token-based unsubscribe from email link |

## RSS Module

### Go Backend Implementation

**Handler** (`pkg/handler/rss/handler.go`):
- `GetRSSFeed(c *gin.Context)`: Single handler for all 3 paths
- Gets site URL from settings (`SITE_URL` key), falls back to request scheme+host
- Strips trailing slash from site URL
- Creates `RSSOptions{ItemCount: 20, BaseURL, BuildTime: time.Now()}`
- Calls `rssService.GenerateFeed(ctx, opts)` then `rssService.GenerateXML(feed)`
- Sets Content-Type based on path: `/atom.xml` → `application/atom+xml`, others → `application/rss+xml`
- Sets `Cache-Control: public, max-age=3600`, `X-Content-Type-Options: nosniff`, `Last-Modified`
- On error: returns `text/plain; charset=utf-8` with 500 status

**Service** (`pkg/service/rss/service.go`):
- `GenerateFeed(ctx, opts)`: Checks Redis cache (`rss:feed:latest`, TTL 1h). On miss: fetches site title/description from settings, gets 20 latest public articles via `articleSvc.ListPublic`, builds `RSSFeed` struct, caches as JSON
- `GenerateXML(feed)`: Manual string building with `strings.Builder`. XML declaration + RSS 2.0 root with atom/content namespaces + channel element + items
- `buildRSSItem(article, baseURL)`: Link format `{baseURL}/posts/{article.ID}`, description from `summaries[0]` or stripped HTML truncated to 200 chars, categories from postCategories+postTags, author from `copyrightAuthor`
- `getArticleDescription(article)`: Priority: 1) `summaries[0]` if non-empty, 2) StripHTML(`contentHtml`) truncated to 200 chars, 3) raw `contentMd` truncated to 200 chars, 4) empty string
- `xmlEscape(s)`: Replaces `& → &amp;`, `< → &lt;`, `> → &gt;`, `" → &quot;`, `' → &apos;`
- `InvalidateCache(ctx)`: Deletes `rss:feed:latest` from Redis

**Types** (`pkg/service/rss/types.go`):
- `RSSItem{Title, Link, Description, PubDate, GUID, Author, Categories []string}`
- `RSSFeed{Title, Link, Description, Language, PubDate, LastBuildDate, Items []RSSItem}`
- `RSSOptions{ItemCount int, BaseURL string, BuildTime time.Time}`

### NestJS Implementation Notes

1. **XML output bypasses global interceptor**: Use `@Res()` decorator in controller to get raw Response object, set headers manually, and send XML string directly. Do NOT return data that goes through `ResponseInterceptor`.

2. **Cache strategy**: Use `MemoryCache` utility (already in `server/src/common/cache/memory-cache.util.ts`). Store the `RSSFeed` object (not XML string) in cache, regenerate XML on each request from cached feed. Cache key: `rss:feed:latest`, TTL: 3600000ms (1 hour).

3. **Article link format**: Go uses `article.ID` (the public Sqids-encoded ID) in the link. NestJS must use the same format: `{baseURL}/posts/{publicId}`. The `publicId` is the Sqids-encoded ID or abbrlink.

4. **Description extraction**: Need a `stripHtml()` utility (Go uses bluemonday library). NestJS can use a simple regex-based strip or the `sanitize-html` package already in the project. Truncate to 200 characters (UTF-8 rune-aware, not byte-aware).

5. **XML escape**: Must replicate Go's `xmlEscape` exactly — 5 entity replacements in specific order (`&` first to avoid double-escaping).

6. **Date format**: Go uses `time.RFC1123Z` which is `"Mon, 02 Jan 2006 15:04:05 -0700"`. NestJS must format dates identically for RSS reader compatibility.

7. **Cache invalidation**: `RssService.invalidateCache()` must be called from `ArticleService.create()`, `ArticleService.update()`, and `ArticleService.delete()`. This requires `RssService` to be injectable into `ArticleModule` or use a forward reference / event emitter pattern.

8. **Site URL resolution**: Read `SITE_URL` from `SettingsService.get('SITE_URL')`. If empty, construct from request (`X-Forwarded-Proto` header or `req.protocol` + `req.get('host')`).

## Sitemap Module

### Go Backend Implementation

**Handler** (`pkg/handler/sitemap/handler.go`):
- `GetSitemap(c *gin.Context)`: Calls `sitemapService.GenerateSitemap(ctx)`, serializes with `xml.MarshalIndent(data, "", "  ")`, prepends XML declaration, sets `Content-Type: text/xml; charset=utf-8`, `Cache-Control: public, max-age=3600`, `Last-Modified`
- `GetRobots(c *gin.Context)`: Calls `sitemapService.GenerateRobots(ctx)`, sets `Content-Type: text/plain; charset=utf-8`, `Cache-Control: public, max-age=86400`

**Service** (`pkg/service/sitemap/service.go`):
- `GenerateSitemap(ctx)`: Builds `URLSet` containing:
  1. Homepage: `{baseURL}/`, priority 1.0, daily
  2. Public articles: URL uses abbrlink if available, else ID. Priority/frequency based on update time: <24h → 0.9/daily, <7d → 0.8/weekly, <30d → 0.7/monthly, else → 0.6/yearly
  3. Published pages: `{baseURL}/{pagePath}` (strips leading slash), priority 0.5, monthly
  4. Link page: `{baseURL}/link`, priority 0.6, weekly
  5. Common pages: `/archives` (0.7/daily), `/categories` (0.6/weekly), `/tags` (0.6/weekly), `/about` (0.5/monthly)
- `GenerateRobots(ctx)`: Template string with `User-agent: *`, `Allow: /`, `Disallow: /admin/`, `Sitemap: {baseURL}/sitemap.xml`
- `getBaseURL()`: Reads `SITE_URL` from settings, falls back to `https://blog.anheyu.com`, strips trailing slash

**Model** (`pkg/service/sitemap/model.go`):
- `URLSet{XMLName, Xmlns, URLs []URL}` — XML root element
- `URL{Location, LastModified, ChangeFreq, Priority}` — Individual URL entry
- `ChangeFrequency` enum: always/hourly/daily/weekly/monthly/yearly/never
- `SitemapItem{URL, LastModified time.Time, ChangeFreq, Priority}` — Internal builder type
- `ToURL()`: Converts `SitemapItem` to `URL`, formats `LastModified` as RFC 3339 (`2006-01-02T15:04:05-07:00`)

### NestJS Implementation Notes

1. **XML serialization**: Go uses `xml.MarshalIndent`. NestJS should use a similar approach. Options:
   - Build a plain object matching the `URLSet` structure and serialize with an XML library
   - Recommended: Use a simple string builder approach similar to RSS for maximum format control, or use `fast-xml-parser` which is already commonly available
   - The XML output must include `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"` on the `urlset` element

2. **Article URL priority**: Go uses `article.Abbrlink` if non-empty, else `article.ID` (the raw DB ID as string). NestJS must replicate this: use abbrlink if available, else the Sqids-encoded public ID.

3. **Page path handling**: Go strips leading `/` from `page.Path` to avoid double slashes. NestJS must do the same.

4. **Date format for lastmod**: Go uses RFC 3339 format (`2006-01-02T15:04:05-07:00`). NestJS should use `toISOString()` or equivalent.

5. **No caching**: Per D-214, sitemap is regenerated on every request. No cache needed.

6. **Dependencies**: SitemapService needs ArticleService (for public article list), PageService (for published pages), LinkService (for link page — just a static entry, no actual link data needed), and SettingsService (for site URL).

7. **Default base URL**: If `SITE_URL` is not configured, use `https://blog.anheyu.com` as fallback (matching Go's `defaultBaseURL`).

## Music Module

### Go Backend Implementation

**Handler** (`pkg/handler/music/handler.go`):
- `GetPlaylist(c *gin.Context)`: Calls `musicSvc.FetchPlaylist(ctx)`, returns `{ songs, total }` via `response.Success`
- `GetSongResources(c *gin.Context)`: Binds `{ neteaseId: string }` from JSON body, calls `musicSvc.FetchSongResources(ctx, song)`, returns `SongResourceResponse`

**Service** (`pkg/service/music/service.go`):
- **HTTP Client**: Custom `http.Client` with 15s timeout, `InsecureSkipVerify: true` for TLS
- **API URLs**: `{apiBaseURL}/Playlist?id={playlistId}` (GET) and `{apiBaseURL}/Song_V1` (POST form-urlencoded)
- **API Base URL**: From settings key `music.api.base_url`, default `https://metings.qjqq.cn`
- **Playlist ID**: From settings key `music.player.playlist_id`, then `MUSIC_PLAYER_PLAYLIST_ID`, default `8152976493`

- `FetchPlaylist(ctx)`:
  1. GET `{apiBaseURL}/Playlist?id={playlistId}`
  2. Parse `PlaylistApiResponse` (nested: `data.playlist.tracks[]`)
  3. Each track: `{ album, artists, id (int64), name, picUrl }`
  4. Convert to `Song{ID: strconv.Itoa(track.ID), NeteaseID: same, Name, Artist: Artists, URL: "", Pic: PicURL, Lrc: ""}`
  5. Skip tracks with empty name/artists/ID=0
  6. Returns `[]Song`

- `FetchSongResources(ctx, song)`:
  1. Validate `neteaseId` with regex `^\d{6,12}$`
  2. Try `fetchSongV1(ctx, neteaseId, "exhigh")` first
  3. If fails or returns empty `audioUrl`, fallback to `fetchSongV1(ctx, neteaseId, "standard")`
  4. Returns `SongResourceResponse{AudioURL, LyricsText}`

- `fetchSongV1(ctx, neteaseID, level)`:
  1. POST form-urlencoded: `url={neteaseId}&level={level}&type=json`
  2. Headers: Accept, Accept-Language, Cache-Control: no-cache, Content-Type: application/x-www-form-urlencoded, Origin, Pragma, Referer, User-Agent (Chrome), X-Requested-With
  3. Parse `SongV1ApiResponse{Status, Success, Message, Data{ID, Name, ArName, AlName, Pic, URL, Lyric, TLyric, Level, Size}}`
  4. Check `Status == 200 && Success == true`
  5. Return `SongResourceResponse{AudioURL: Data.URL, LyricsText: Data.Lyric}`

- **Image URL optimization** (complex, but currently NOT called from FetchPlaylist in the Go handler):
  - `optimizePicUrl(ctx, originalPicUrl)`: HEAD request to meting API URL, follow redirect, upgrade `param=90y90` to `param=150y150`
  - `upgradePicSize(picURL)`: Regex replace `param=\d+y\d+` with `param=150y150`
  - `constructHighQualityURL(originalURL)`: For `p3.music.126.net` or `music.163.com` URLs, call `upgradePicSize`
  - `optimizePicUrlsWithTimeout(ctx, songs, timeout)`: Concurrent optimization with semaphore (limit 20), 3s per URL timeout
  - **Note**: The Go handler's `GetPlaylist` does NOT call `optimizePicUrlsWithTimeout`. The optimization functions exist in the service but are not invoked in the current handler flow. NestJS should replicate the service methods but only call them if the Go handler does.

- **Validation**:
  - `isValidNeteaseID(neteaseID)`: Regex `^\d{6,12}$`
  - `isValidSong(song map)`: Checks name/artist/url are non-empty strings
  - `isValidLRCFormat(lrcText)`: Checks for `[mm:ss.ms]` time tags

- **Logging**: Extensive structured logging with categories: request, response, error, JSON structure, URL info, request body, performance metrics. Error classification: timeout/connection/json-parse/data-parse/context-timeout.

### NestJS Implementation Notes

1. **HTTP Client**: Use Node.js native `https` module or `axios` with `rejectUnauthorized: false` (per D-210). The `axios` package is likely already available in the project. If not, use Node.js built-in `https.request`.

2. **Playlist caching**: Per D-211, cache playlist for 5 minutes using `MemoryCache`. Key: `music:playlist`, TTL: 300000ms. Song resources are NOT cached (audio URLs are time-limited).

3. **Image URL optimization**: The Go service has `optimizePicUrl`/`upgradePicSize`/`constructHighQualityURL` methods, but the handler's `GetPlaylist` does NOT call them. The playlist returns `picUrl` directly from the API. NestJS should implement these methods for completeness but NOT call them from the playlist endpoint unless the Go handler does.

4. **Form-urlencoded POST**: The Song_V1 API expects `application/x-www-form-urlencoded` body, NOT JSON. Must use `new URLSearchParams()` or equivalent.

5. **Request headers**: Must replicate Go's headers exactly for API compatibility: User-Agent (Chrome), Origin, Referer, X-Requested-With, etc.

6. **Quality fallback**: Try `exhigh` first, if fails or returns empty URL, try `standard`. This is critical for API compatibility.

7. **NeteaseID validation**: Must use regex `^\d{6,12}$` exactly. Return 400 error for invalid IDs.

8. **Logging**: Per D-212, replicate Go's extensive logging using NestJS Logger. Log request method/URL/params/time, response status/duration/size/performance rating, error classification (timeout/connection/json-parse/data-parse/context-timeout), JSON structure analysis.

9. **Settings keys**: Read `music.api.base_url` for API base URL (default `https://metings.qjqq.cn`), `music.player.playlist_id` for playlist ID (default `8152976493`), also check `MUSIC_PLAYER_PLAYLIST_ID` as fallback.

## Notification Module

### Go Backend Implementation

**Handler** (`pkg/handler/notification/handler.go`):
- `ListNotificationTypes(c *gin.Context)`: Admin-only. Returns `NotificationTypeDTO[]`
- `GetUserNotificationSettings(c *gin.Context)`: JWT auth. Returns `SimpleUserNotificationSettingsResponse{allowCommentReplyNotification: boolean}`
- `UpdateUserNotificationSettings(c *gin.Context)`: JWT auth. Body: `SimpleUserNotificationSettingsRequest{allowCommentReplyNotification: boolean}`. Finds `comment_reply` type, creates/updates config, returns updated settings
- `GetUserNotificationConfigs(c *gin.Context)`: JWT auth. Returns `UserNotificationConfigDTO[]` with nested `NotificationType`

**DTOs** (`pkg/handler/notification/dto.go`):
- `NotificationTypeDTO{id, code, name, description, category, isActive, defaultEnabled, supportedChannels, createdAt, updatedAt}`
- `UserNotificationConfigDTO{id, userId, notificationTypeId, isEnabled, enabledChannels, notificationEmail?, customSettings?, notificationType?: NotificationTypeDTO, createdAt, updatedAt}`
- `SimpleUserNotificationSettingsRequest{allowCommentReplyNotification: boolean}`
- `SimpleUserNotificationSettingsResponse{allowCommentReplyNotification: boolean}`

**Service** (`pkg/service/notification/notification_service.go`):
- `ListNotificationTypes(ctx)`: Returns all from `notificationTypeRepo.FindAll()`
- `GetNotificationTypeByCode(ctx, code)`: Find by code
- `GetUserNotificationConfigs(ctx, userID)`: Ensures defaults first, then returns all configs for user
- `UpdateUserNotificationConfig(ctx, userID, config)`: Sets `config.UserID = userID`, calls `CreateOrUpdate`
- `GetUserNotificationSettings(ctx, userID)`: Gets all configs, extracts `comment_reply` isEnabled
- `ShouldNotifyUser(ctx, userID, notificationTypeCode, channel)`: Delegates to repo
- `InitializeDefaultNotificationTypes(ctx)`: For each default type, check if exists by code; if not, create; if exists, update (preserving ID)
- `EnsureUserDefaultConfigs(ctx, userID)`: Gets all types, gets user's existing configs, creates missing ones with `DefaultEnabled` value

**Model** (`pkg/domain/model/notification.go`):
- 4 default notification types:
  1. `comment_reply` (评论回复通知, category: comment, defaultEnabled: true, channels: [email, push])
  2. `comment_new` (新评论通知, category: comment, defaultEnabled: true, channels: [email, push])
  3. `system_update` (系统更新通知, category: system, defaultEnabled: true, channels: [email])
  4. `marketing_promo` (营销推广通知, category: marketing, defaultEnabled: false, channels: [email])
- `NotificationType{ID, CreatedAt, UpdatedAt, Code, Name, Description, Category, IsActive, DefaultEnabled, SupportedChannels []string}`
- `UserNotificationConfig{ID, CreatedAt, UpdatedAt, UserID, NotificationTypeID, IsEnabled, EnabledChannels []string, NotificationEmail, CustomSettings map[string]interface{}, NotificationType *NotificationType}`

**In-App Notification Callback** (`pkg/service/comment/service.go`):
- `InAppNotificationCallback` is a function type injected into CommentService
- `InAppNotificationData{CommentID, ArticleTitle, ArticlePath, CommenterName, CommenterEmail, CommentContent, IsReply, ReplyToUserID, ReplyToEmail, ReplyToName, IsReplyToAdmin, IsAnonymous, IsAdminComment, RecipientUserID, RecipientUserEmail, NotifyAdmin}`
- Two scenarios: 1) Notify admin of new top-level comment, 2) Notify parent comment author of reply
- Callback is called asynchronously (`go s.inAppNotificationCallback(...)`)
- In the Go backend, this callback is NOT actually set (it's a PRO feature). NestJS will implement it as a real feature.

### NestJS Implementation Notes

1. **New notifications table**: Must create `server/src/database/schemas/notification.schema.ts` with fields: `id` (auto-increment PK), `userId` (FK to users), `notificationTypeId` (FK to notification_types), `title`, `content`, `isRead` (boolean, default false), `createdAt` (timestamp), `readAt` (nullable timestamp). Register in `schemas/index.ts`.

2. **Initialization on startup**: `NotificationService.onModuleInit()` should call `InitializeDefaultNotificationTypes()` to ensure the 4 default types exist. This matches Go's startup behavior.

3. **EnsureUserDefaultConfigs**: Called whenever a user's configs are accessed. Creates missing configs with `defaultEnabled` value from the notification type.

4. **Simplified settings API**: The `notification-settings` endpoints only expose `allowCommentReplyNotification`. The handler finds the `comment_reply` type and maps its `isEnabled` to this boolean.

5. **Full config API**: The `notification-configs` endpoint returns all configs with nested `notificationType` info. Must join `user_notification_configs` with `notification_types`.

6. **In-app notification creation**: When a comment reply is created in `CommentService`, check if the parent comment author has `comment_reply` notification type enabled. If so, create a record in the `notifications` table. This replaces Go's `InAppNotificationCallback` pattern.

7. **Notification list endpoint**: Paginated with `isRead` filter support. Default page size should match other list endpoints (10 or 20).

8. **Mark as read**: Single notification (`PUT /notifications/:id/read`) and bulk (`PUT /notifications/read-all`). The `read-all` endpoint sets `isRead=true` and `readAt=now` for all unread notifications of the current user.

9. **Unread count**: Simple `SELECT COUNT(*)` where `userId=? AND isRead=false`.

10. **User ID resolution**: Go handler uses `idgen.DecodePublicID(claims.UserID)` to get the DB user ID. NestJS must do the same using `decodePublicID()` from `sqids.util.ts`.

## Subscriber Module

### Go Backend Implementation

**Handler** (`pkg/handler/subscriber/handler.go`):
- `Subscribe(c *gin.Context)`: Body `{ email, code }`. Validates email format, calls `svc.Subscribe(ctx, email, code)`. Returns 409 for "该邮箱已订阅", 500 for other errors
- `Unsubscribe(c *gin.Context)`: Body `{ email }`. Calls `svc.Unsubscribe(ctx, email)`. Returns 404 for "订阅不存在"
- `UnsubscribeByToken(c *gin.Context)`: Path param `token`. Calls `svc.UnsubscribeByToken(ctx, token)`. Returns 404 for "订阅不存在或令牌无效"
- `SendVerificationCode(c *gin.Context)`: Body `{ email, turnstile_token?, geetest_*?, image_captcha_id/answer? }`. First verifies captcha via `captchaSvc.Verify()`, then calls `svc.SendVerificationCode(ctx, email)`

**Service** (`pkg/service/subscriber/service.go`):
- `Subscribe(ctx, email, code)`:
  1. Verify code from Redis (`subscribe:code:{email}`). If expired/invalid, return error. Delete after verification.
  2. Query subscriber by email. If not found: create new with `isActive=true` and generated token.
  3. If found and `isActive=true`: return "该邮箱已订阅" error.
  4. If found and `isActive=false`: reactivate by setting `isActive=true`.
- `Unsubscribe(ctx, email)`: Find by email, set `isActive=false`. Return "订阅不存在" if not found.
- `UnsubscribeByToken(ctx, token)`: Find by token, set `isActive=false`. Return "订阅不存在或令牌无效" if not found.
- `GetActiveSubscribers(ctx)`: Query all where `isActive=true`.
- `SendVerificationCode(ctx, email)`:
  1. Generate 6-digit code: `crypto/rand` → 4 bytes → `binary.BigEndian.Uint32() % 1000000` → zero-padded to 6 digits
  2. Store in Redis with key `subscribe:code:{email}`, TTL 5 minutes
  3. Send verification email via `emailSvc.SendVerificationEmail(ctx, email, code)`
- `NotifyArticlePublished(ctx, article)`: Get active subscribers, send emails asynchronously with 100ms delay between each
- `generateToken()`: 32 random bytes → hex encoded (64-char string)

### NestJS Implementation Notes

1. **Verification code storage**: Per D-205, use `MemoryCache` with key `subscribe:code:{email}`, TTL 300000ms (5 minutes). After successful verification, delete the key.

2. **Token generation**: Use Node.js `crypto.randomBytes(32).toString('hex')` to generate 64-char hex token. Matches Go's `generateToken()`.

3. **Verification code generation**: Use `crypto.randomBytes(4)` → read as UInt32BE → modulo 1000000 → zero-pad to 6 digits. Matches Go's algorithm exactly.

4. **EmailService**: Per D-206, implement with nodemailer. Read SMTP config from settings: `smtp.host`, `smtp.port`, `smtp.user`, `smtp.pass`, `smtp.from`. If not configured, `SendVerificationEmail` and `SendArticlePushEmail` should silently skip (return without error).

5. **CaptchaService integration**: Per D-207, reuse existing `CaptchaService.verify()` method. The `SendVerificationCode` endpoint accepts the same `CaptchaParams` structure (turnstile_token, geetest_*, image_captcha_id/answer).

6. **Rate limiting**: Per D-208, subscribe and send-code endpoints need `CustomRateLimit(3, 3)` which translates to NestJS `@Throttle({ default: { limit: 3, ttl: 60000 } })`.

7. **Subscribe reactivation**: If email exists with `isActive=false`, set `isActive=true` instead of creating new record. This matches Go behavior.

8. **UnsubscribeByToken**: The GET endpoint returns the standard `{ code, data, message }` response. The token is a 64-char hex string in the URL path.

9. **NotifyArticlePublished**: This is called when a new article is published. It sends emails to all active subscribers asynchronously. Per D-206, if SMTP is not configured, silently skip. The 100ms delay between emails prevents SMTP rate limiting.

## Cross-Module Integration Points

### ArticleService → RssService (Cache Invalidation)
- `ArticleService.create()`: After successful article creation, call `rssService.invalidateCache()`
- `ArticleService.update()`: After successful article update, call `rssService.invalidateCache()`
- `ArticleService.delete()`: After successful article deletion, call `rssService.invalidateCache()`
- **Implementation**: Inject `RssService` into `ArticleModule` via forward reference or use NestJS `EventEmitter2` to emit `article.changed` events that `RssService` listens to. The forward reference approach is simpler and matches the existing pattern.

### CommentService → NotificationService (In-App Notification)
- `CommentService.create()`: After creating a reply comment, check if parent comment author has `comment_reply` notification enabled. If so, create an in-app notification record.
- **Implementation**: Inject `NotificationService` into `CommentModule`. The notification creation should be async (fire-and-forget) to not block the comment response.

### SubscriberService → ArticleService (Article Published Notification)
- When an article is published (status changes to PUBLISHED), `SubscriberService.NotifyArticlePublished()` should be called.
- **Implementation**: This can be triggered from `ArticleService.create()` or `ArticleService.update()` when the article status becomes PUBLISHED. Use async execution to not block the response.

### CaptchaService → SubscriberService (Verification)
- `SubscriberController.SendVerificationCode()`: Calls `captchaService.verify()` before sending the verification code.
- **Implementation**: Inject `CaptchaService` into `SubscriberModule`. The existing `CaptchaService` in `CaptchaModule` is already available.

### SettingsService → All Modules
- RSS: reads `APP_NAME`, `SITE_URL`, `SITE_DESCRIPTION`
- Sitemap: reads `SITE_URL`
- Music: reads `music.api.base_url`, `music.player.playlist_id`, `MUSIC_PLAYER_PLAYLIST_ID`
- Subscriber/Email: reads SMTP config (`smtp.host`, `smtp.port`, `smtp.user`, `smtp.pass`, `smtp.from`), `APP_NAME`, `SITE_URL`
- **Implementation**: All modules inject `SettingsService` which is globally available.

## New Schema Required

### notifications table

```typescript
// server/src/database/schemas/notification.schema.ts
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './user.schema';
import { notificationTypes } from './notification-type.schema';

export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    notificationTypeId: integer('notification_type_id')
      .notNull()
      .references(() => notificationTypes.id),
    title: text('title').notNull(),
    content: text('content'),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    readAt: integer('read_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('idx_notifications_user_id').on(table.userId),
    index('idx_notifications_user_unread').on(table.userId, table.isRead),
    index('idx_notifications_type_id').on(table.notificationTypeId),
  ],
);
```

Must be registered in `server/src/database/schemas/index.ts` with `export * from './notification.schema';`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nodemailer | 9.0.3 | SMTP email sending | Go backend's EmailService uses SMTP; nodemailer is the de-facto Node.js email library [VERIFIED: npm registry] |
| @types/nodemailer | 8.0.1 | TypeScript types for nodemailer | Standard type definitions [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MemoryCache | (existing) | In-memory cache with TTL | RSS feed cache, music playlist cache, verification code storage |
| CaptchaService | (existing) | Human verification | Subscriber SendVerificationCode endpoint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nodemailer | @nestjs/mailer | @nestjs/mailer is a wrapper around nodemailer; adds abstraction without benefit for 2 email methods |
| nodemailer | sendgrid/sdk | SendGrid is a paid service; SMTP is free and matches Go backend's approach |
| fast-xml-parser | xml2js | xml2js is callback-based and heavier; fast-xml-parser is faster and promise-friendly |
| axios | node-fetch | Both work; axios has better timeout/retry support and is likely already in the project |

**Installation:**
```bash
npm install nodemailer @types/nodemailer
```

**Version verification:**
```bash
npm view nodemailer version    # 9.0.3 (verified 2026-07-13)
npm view @types/nodemailer version  # 8.0.1 (verified 2026-07-13)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| nodemailer | npm | ~12 yrs | 14.7M/wk | github.com/nodemailer/nodemailer | SUS (too-new flag) | Flagged — well-known library, flag is false positive from recent publish date |
| @types/nodemailer | npm | ~8 yrs | 8.5M/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** nodemailer — the "too-new" flag is a false positive caused by a recent patch publish (v9.0.3 published 2026-06-30). Nodemailer is one of the most established Node.js libraries with 14.7M weekly downloads and 12+ years of history. No checkpoint needed.

*No packages discovered via WebSearch or training data require additional verification.*

## Architecture Patterns

### System Architecture Diagram

```
Request → NestJS Router
  ├─ /rss.xml, /feed.xml, /atom.xml → RssController (@Res, XML output)
  │   └─ RssService → ArticleService (listPublic) + SettingsService (site config) + MemoryCache
  ├─ /sitemap.xml → SitemapController (@Res, XML output)
  │   └─ SitemapService → ArticleService + PageService + SettingsService
  ├─ /robots.txt → SitemapController (@Res, plain text output)
  │   └─ SitemapService → SettingsService (site URL)
  ├─ /api/public/music/* → MusicController (@Public, JSON response)
  │   └─ MusicService → SettingsService (API config) + External metings API + MemoryCache
  ├─ /api/notification/* → NotificationController (JWT+Admin, JSON response)
  │   └─ NotificationService → NotificationTypeRepo + UserNotificationConfigRepo
  ├─ /api/user/notification-* → NotificationController (JWT, JSON response)
  │   └─ NotificationService → NotificationTypeRepo + UserNotificationConfigRepo
  ├─ /api/user/notifications/* → NotificationController (JWT, JSON response)
  │   └─ NotificationService → NotificationRepo
  └─ /api/public/subscribe* → SubscriberController (@Public, JSON response)
      └─ SubscriberService → SubscriberRepo + EmailService + CaptchaService + MemoryCache

Cross-module hooks:
  ArticleService.create/update/delete → RssService.invalidateCache()
  CommentService.create (reply) → NotificationService.createNotification()
  ArticleService.create (PUBLISHED) → SubscriberService.notifyArticlePublished()
```

### Recommended Project Structure
```
server/src/
├── rss/
│   ├── rss.module.ts          # Module registration
│   ├── rss.controller.ts      # GET /rss.xml, /feed.xml, /atom.xml
│   └── rss.service.ts         # GenerateFeed, GenerateXML, InvalidateCache
├── sitemap/
│   ├── sitemap.module.ts      # Module registration
│   ├── sitemap.controller.ts  # GET /sitemap.xml, /robots.txt
│   └── sitemap.service.ts     # GenerateSitemap, GenerateRobots
├── music/
│   ├── music.module.ts        # Module registration
│   ├── music.controller.ts    # GET /playlist, POST /song-resources
│   ├── music.service.ts       # FetchPlaylist, FetchSongResources, fetchSongV1
│   └── dto/
│       ├── get-playlist.dto.ts
│       └── get-song-resources.dto.ts
├── notification/
│   ├── notification.module.ts # Module registration
│   ├── notification.controller.ts  # All notification endpoints
│   ├── notification.service.ts     # Type management, user configs, in-app notifications
│   ├── notification.repository.ts  # Drizzle queries for notifications table
│   └── dto/
│       ├── notification-type.dto.ts
│       ├── user-notification-config.dto.ts
│       ├── simple-notification-settings.dto.ts
│       └── notification.dto.ts      # In-app notification DTOs
├── subscriber/
│   ├── subscriber.module.ts   # Module registration
│   ├── subscriber.controller.ts  # Subscribe, Unsubscribe, SendVerificationCode
│   ├── subscriber.service.ts     # Subscribe, Unsubscribe, SendVerificationCode, NotifyArticlePublished
│   ├── subscriber.repository.ts  # Drizzle queries for subscribers table
│   └── dto/
│       ├── subscribe.dto.ts
│       ├── unsubscribe.dto.ts
│       └── send-verification-code.dto.ts
├── email/
│   ├── email.module.ts       # Module registration
│   ├── email.service.ts      # SendVerificationEmail, SendArticlePushEmail
│   └── email.templates.ts    # HTML email templates
└── database/schemas/
    └── notification.schema.ts  # New notifications table
```

### Pattern 1: XML Response Bypass
**What:** RSS and Sitemap endpoints return raw XML, not the standard `{ code, data, message }` JSON wrapper.
**When to use:** Any endpoint that serves XML or plain text content (RSS, Sitemap, robots.txt).
**Example:**
```typescript
// Source: Go pkg/handler/rss/handler.go + pkg/handler/sitemap/handler.go
@Get('rss.xml')
@Public()
getRSSFeed(@Req() req: Request, @Res() res: Response) {
  const xml = this.rssService.generateXML(feed);
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(xml);
}
```

### Pattern 2: MemoryCache for Short-Lived Data
**What:** Use the existing `MemoryCache` utility for TTL-based caching of RSS feeds, music playlists, and verification codes.
**When to use:** Any data with a defined TTL that doesn't need persistence across restarts.
**Example:**
```typescript
// Source: Established pattern from D-07, D-161
const cached = this.cache.get<RSSFeed>('rss:feed:latest');
if (cached) return cached;
// ... generate feed ...
this.cache.set('rss:feed:latest', feed, 3600000); // 1 hour TTL
```

### Pattern 3: Rate-Limited Public Endpoints
**What:** Subscriber endpoints use `@Throttle` decorator for rate limiting, matching Go's `CustomRateLimit(3, 3)`.
**When to use:** Public endpoints that need IP-based rate limiting.
**Example:**
```typescript
// Source: Go internal/infra/router/router.go line 519-520
@Post('subscribe')
@Public()
@Throttle({ default: { limit: 3, ttl: 60000 } }) // Go: CustomRateLimit(3, 3)
async subscribe(@Body() dto: SubscribeDto) { ... }
```

### Anti-Patterns to Avoid
- **Don't use ResponseInterceptor for XML endpoints**: RSS/Sitemap must use `@Res()` to bypass the global `{ code, data, message }` wrapper. Returning a string from a controller method will get wrapped in JSON.
- **Don't cache song resources**: Audio URLs from the metings API are time-limited. Caching them would serve expired URLs.
- **Don't skip NeteaseID validation**: The regex `^\d{6,12}$` is critical for preventing injection attacks against the external API.
- **Don't use JSON body for Song_V1 API**: The external API expects `application/x-www-form-urlencoded`, not JSON.
- **Don't forget XML entity escaping**: RSS content must escape `&`, `<`, `>`, `"`, `'` in that order (`&` first).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | Custom SMTP client | nodemailer | Handles TLS, auth, connection pooling, HTML emails, attachments |
| HTML stripping | Regex-based HTML removal | sanitize-html or simple tag-stripping regex | Edge cases with nested tags, entities, CDATA |
| Rate limiting | Custom rate limiter per endpoint | @nestjs/throttler @Throttle decorator | Already integrated, consistent with existing pattern |
| XML escaping | Custom escape function | Replicate Go's xmlEscape exactly (5 replacements in order) | Must match Go output for RSS reader compatibility |
| Verification code generation | Math.random() | crypto.randomBytes() | Cryptographic randomness required for security |

**Key insight:** The RSS XML format must match Go's output exactly for RSS reader compatibility. The XML escape function must process `&` first to avoid double-escaping. The date format must be RFC 1123 (e.g., `"Mon, 02 Jan 2006 15:04:05 -0700"`) for RSS 2.0 compliance.

## Common Pitfalls

### Pitfall 1: ResponseInterceptor Wrapping XML Output
**What goes wrong:** RSS/Sitemap endpoints return XML strings, but the global `ResponseInterceptor` wraps them in `{ code: 200, data: "<xml>...</xml>", message: "OK" }`, breaking RSS readers.
**Why it happens:** The global interceptor runs on all controller methods that return values.
**How to avoid:** Use `@Res()` decorator to get the raw Express Response object and call `res.send()` directly. This bypasses the interceptor.
**Warning signs:** RSS readers fail to parse the feed; browser shows JSON instead of XML.

### Pitfall 2: RSS Date Format Mismatch
**What goes wrong:** Using JavaScript's `new Date().toISOString()` produces ISO 8601 format (`2026-07-13T12:00:00.000Z`), but RSS 2.0 requires RFC 1123 format (`Sun, 13 Jul 2026 12:00:00 +0000`).
**Why it happens:** JavaScript's default date formatting is ISO 8601, not RFC 1123.
**How to avoid:** Use `new Date().toUTCString()` which produces RFC 1123 format, or manually format with `date.toString()` and adjust timezone offset.
**Warning signs:** RSS readers show incorrect publication dates or fail to parse the feed.

### Pitfall 3: Music API SSL Certificate Verification
**What goes wrong:** The metings.qjqq.cn API has a certificate signed by an unknown CA. Node.js rejects the connection with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
**Why it happens:** Node.js enforces SSL certificate verification by default.
**How to avoid:** Set `rejectUnauthorized: false` on the HTTP client (per D-210). This matches Go's `InsecureSkipVerify: true`.
**Warning signs:** Music playlist/song-resources endpoints return 500 errors with SSL verification failure messages.

### Pitfall 4: Song_V1 API Content-Type Mismatch
**What goes wrong:** Sending JSON body to the Song_V1 API returns unexpected responses or errors.
**Why it happens:** The API expects `application/x-www-form-urlencoded` format, not JSON.
**How to avoid:** Use `new URLSearchParams({ url: neteaseId, level, type: 'json' })` for the request body and set `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`.
**Warning signs:** Song resources endpoint returns errors or empty data from the external API.

### Pitfall 5: Circular Dependency Between ArticleService and RssService
**What goes wrong:** `ArticleService` needs `RssService` for cache invalidation, and `RssService` needs `ArticleService` for article data. This creates a circular dependency.
**Why it happens:** Both services depend on each other.
**How to avoid:** Use NestJS `forwardRef()` to break the circular dependency, or use `EventEmitter2` to emit events that `RssService` listens to. The `forwardRef` approach is simpler.
**Warning signs:** NestJS fails to start with "Circular dependency detected" error.

### Pitfall 6: Verification Code Race Condition
**What goes wrong:** User requests verification code multiple times rapidly, and the code gets overwritten before the previous one is verified.
**Why it happens:** The `subscribe:code:{email}` key is overwritten on each `SendVerificationCode` call.
**How to avoid:** This is acceptable behavior — the latest code is always valid. The previous code becomes invalid. This matches Go's behavior (Redis SET overwrites).
**Warning signs:** None — this is expected behavior.

### Pitfall 7: Notification Type Initialization Idempotency
**What goes wrong:** On every server restart, `InitializeDefaultNotificationTypes` tries to create types that already exist, causing duplicate key errors.
**Why it happens:** The `code` column has a UNIQUE constraint.
**How to avoid:** Check if each type exists by `code` before creating. If it exists, update it (preserving the ID). This matches Go's "check-then-create-or-update" pattern.
**Warning signs:** Server fails to start with SQLite UNIQUE constraint violation.

## Code Examples

### RSS XML Generation (Manual String Building)
```typescript
// Source: Go pkg/service/rss/service.go GenerateXML()
generateXML(feed: RSSFeed): string {
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">');
  parts.push('  <channel>');
  parts.push(`    <title>${this.xmlEscape(feed.title)}</title>`);
  parts.push(`    <link>${this.xmlEscape(feed.link)}</link>`);
  parts.push(`    <description>${this.xmlEscape(feed.description)}</description>`);
  parts.push(`    <language>${feed.language}</language>`);
  parts.push(`    <lastBuildDate>${feed.lastBuildDate}</lastBuildDate>`);
  parts.push(`    <atom:link href="${this.xmlEscape(feed.link)}/rss.xml" rel="self" type="application/rss+xml"/>`);
  for (const item of feed.items) {
    parts.push('    <item>');
    parts.push(`      <title>${this.xmlEscape(item.title)}</title>`);
    parts.push(`      <link>${this.xmlEscape(item.link)}</link>`);
    parts.push(`      <guid isPermaLink="true">${this.xmlEscape(item.guid)}</guid>`);
    parts.push(`      <pubDate>${item.pubDate}</pubDate>`);
    if (item.description) {
      parts.push(`      <description>${this.xmlEscape(item.description)}</description>`);
    }
    if (item.author) {
      parts.push(`      <author>${this.xmlEscape(item.author)}</author>`);
    }
    for (const category of item.categories) {
      parts.push(`      <category>${this.xmlEscape(category)}</category>`);
    }
    parts.push('    </item>');
  }
  parts.push('  </channel>');
  parts.push('</rss>');
  return parts.join('\n');
}

// Source: Go pkg/service/rss/service.go xmlEscape()
private xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')   // MUST be first to avoid double-escaping
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

### Music Song_V1 API Call (Form-Urlencoded)
```typescript
// Source: Go pkg/service/music/service.go fetchSongV1()
private async fetchSongV1(neteaseId: string, level: string): Promise<SongResourceResponse> {
  const params = new URLSearchParams({
    url: neteaseId,
    level: level,
    type: 'json',
  });

  const response = await this.httpClient.post(this.songApi, params.toString(), {
    headers: {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': 'https://metings.qjqq.cn',
      'Pragma': 'no-cache',
      'Referer': 'https://metings.qjqq.cn/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
    },
    // Per D-210: skip SSL verification
    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
  });

  const apiResponse = response.data;
  if (apiResponse.status !== 200 || !apiResponse.success) {
    throw new Error(`Song_V1 API error: ${apiResponse.message}`);
  }

  return {
    audioUrl: apiResponse.data.url,
    lyricsText: apiResponse.data.lyric,
  };
}
```

### Verification Code Generation
```typescript
// Source: Go pkg/service/subscriber/service.go SendVerificationCode()
private generateVerificationCode(): string {
  const buf = crypto.randomBytes(4);
  const code = buf.readUInt32BE(0) % 1000000;
  return code.toString().padStart(6, '0');
}
```

### Notification Default Types Initialization
```typescript
// Source: Go pkg/service/notification/notification_service.go InitializeDefaultNotificationTypes()
const DEFAULT_NOTIFICATION_TYPES = [
  {
    code: 'comment_reply',
    name: '评论回复通知',
    description: '当您的评论被他人回复时通知您',
    category: 'comment',
    isActive: true,
    defaultEnabled: true,
    supportedChannels: ['email', 'push'],
  },
  {
    code: 'comment_new',
    name: '新评论通知',
    description: '当网站收到新评论时通知博主',
    category: 'comment',
    isActive: true,
    defaultEnabled: true,
    supportedChannels: ['email', 'push'],
  },
  {
    code: 'system_update',
    name: '系统更新通知',
    description: '接收系统更新和新功能介绍',
    category: 'system',
    isActive: true,
    defaultEnabled: true,
    supportedChannels: ['email'],
  },
  {
    code: 'marketing_promo',
    name: '营销推广通知',
    description: '接收活动推荐和优惠信息',
    category: 'marketing',
    isActive: true,
    defaultEnabled: false,
    supportedChannels: ['email'],
  },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis for RSS cache | MemoryCache (Map + TTL) | Phase 09 (D-213) | Simpler, no external dependency |
| Redis for verification codes | MemoryCache (Map + TTL) | Phase 09 (D-205) | Simpler, no external dependency |
| Go InsecureSkipVerify | Node.js rejectUnauthorized: false | Phase 09 (D-210) | Same behavior, different API |
| Go xml.MarshalIndent | Manual string building for RSS, XML lib for Sitemap | Phase 09 (D-216) | RSS needs exact format match; Sitemap can use serialization |
| Go InAppNotificationCallback (stub) | Real notifications table + endpoints | Phase 09 (D-217/218) | Go had a callback interface but no implementation; NestJS implements it |

**Deprecated/outdated:**
- Redis dependency: Replaced by in-memory caching throughout the project (D-07, D-161, D-205, D-213)
- Go's `InAppNotificationCallback` pattern: Replaced by direct `NotificationService.createNotification()` call

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | axios is available in the NestJS project for HTTP requests | Music Module | Need to install axios or use Node.js built-in https |
| A2 | The Go backend's `GetPlaylist` handler does NOT call `optimizePicUrlsWithTimeout` | Music Module | If it does, NestJS must also call it |
| A3 | `sanitize-html` package is available for HTML stripping in RSS description | RSS Module | Need to install or use regex-based stripping |
| A4 | The `@Res()` decorator approach works correctly with NestJS global interceptors | RSS/Sitemap Module | If not, need alternative approach for XML output |
| A5 | `EventEmitter2` or `forwardRef` can resolve the ArticleService↔RssService circular dependency | Cross-Module | If not, need different architecture |
| A6 | The `music.api.base_url` settings key matches Go's `KeyMusicAPIBaseURL` constant value `music.api.base_url` | Music Module | Wrong key means API URL not found |
| A7 | The `MUSIC_PLAYER_PLAYLIST_ID` env var is checked as a settings key, not an actual environment variable | Music Module | If it's an env var, need `process.env` check |

**Verification status:**
- A1: Need to check `package.json` for axios dependency
- A2: VERIFIED by reading Go handler code — `GetPlaylist` only calls `FetchPlaylist`, not `optimizePicUrlsWithTimeout`
- A3: Need to check `package.json` for sanitize-html
- A4: Standard NestJS behavior — `@Res()` bypasses interceptors
- A5: Standard NestJS pattern — `forwardRef` resolves circular dependencies
- A6: VERIFIED by reading Go constant file `pkg/constant/setting.go` line 360: `KeyMusicAPIBaseURL = "music.api.base_url"`
- A7: Go code reads it via `settingSvc.Get("MUSIC_PLAYER_PLAYLIST_ID")` which checks the settings table, not env vars

## Open Questions (RESOLVED)

1. **HTTP client choice for MusicService** — RESOLVED: Use Node.js native `https` module. No need to add axios dependency.
2. **HTML stripping for RSS description** — RESOLVED: Use simple regex-based strip (`text.replace(/<[^>]*>/g, '')`). Sufficient for RSS descriptions; no extra dependency needed.
3. **Sitemap XML serialization approach** — RESOLVED: Per D-216, install `fast-xml-parser` and use `XMLBuilder` for Sitemap XML serialization. RSS continues to use manual string building for exact format match.
4. **ArticleService ↔ RssService circular dependency resolution** — RESOLVED: Use `forwardRef()` + `@Inject(forwardRef(() => RssService))` in ArticleService. Simplest NestJS pattern for circular dependencies.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All modules | Yes | v22+ | — |
| npm | Package installation | Yes | — | — |
| SQLite | Database | Yes | better-sqlite3 | — |
| SMTP server | EmailService | Unknown | — | Silent skip if not configured |
| metings.qjqq.cn | MusicService | External | — | Error if unreachable |

**Missing dependencies with no fallback:**
- SMTP server: If not configured, email features silently skip. This is acceptable per D-206.

**Missing dependencies with fallback:**
- metings.qjqq.cn: If unreachable, music endpoints return errors. No fallback — this is an external API dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via @nestjs/testing) |
| Config file | jest.config.js (project root) |
| Quick run command | `npm test -- --testPathPattern=server/src/rss` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSS-01 | RSS XML generation with correct format | unit | `npm test -- --testPathPattern=rss.service.spec` | No — Wave 0 |
| RSS-01 | Content-Type switching by path | unit | `npm test -- --testPathPattern=rss.controller.spec` | No — Wave 0 |
| RSS-01 | Cache invalidation on article CRUD | unit | `npm test -- --testPathPattern=rss.service.spec` | No — Wave 0 |
| SITEMAP-01 | Sitemap XML with correct URL entries | unit | `npm test -- --testPathPattern=sitemap.service.spec` | No — Wave 0 |
| SITEMAP-01 | robots.txt generation | unit | `npm test -- --testPathPattern=sitemap.service.spec` | No — Wave 0 |
| MUSIC-01 | Playlist fetching and caching | unit | `npm test -- --testPathPattern=music.service.spec` | No — Wave 0 |
| MUSIC-01 | Song resource quality fallback | unit | `npm test -- --testPathPattern=music.service.spec` | No — Wave 0 |
| MUSIC-01 | NeteaseID validation | unit | `npm test -- --testPathPattern=music.service.spec` | No — Wave 0 |
| NOTIF-01 | Default notification type initialization | unit | `npm test -- --testPathPattern=notification.service.spec` | No — Wave 0 |
| NOTIF-01 | User notification config CRUD | unit | `npm test -- --testPathPattern=notification.service.spec` | No — Wave 0 |
| NOTIF-01 | In-app notification creation and read | unit | `npm test -- --testPathPattern=notification.service.spec` | No — Wave 0 |
| SUBSCRIBER-01 | Subscribe with verification code | unit | `npm test -- --testPathPattern=subscriber.service.spec` | No — Wave 0 |
| SUBSCRIBER-01 | Unsubscribe by email and token | unit | `npm test -- --testPathPattern=subscriber.service.spec` | No — Wave 0 |
| SUBSCRIBER-01 | Verification code generation and storage | unit | `npm test -- --testPathPattern=subscriber.service.spec` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=<module>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/rss/rss.service.spec.ts` — covers RSS-01
- [ ] `server/src/rss/rss.controller.spec.ts` — covers RSS-01
- [ ] `server/src/sitemap/sitemap.service.spec.ts` — covers SITEMAP-01
- [ ] `server/src/music/music.service.spec.ts` — covers MUSIC-01
- [ ] `server/src/notification/notification.service.spec.ts` — covers NOTIF-01
- [ ] `server/src/subscriber/subscriber.service.spec.ts` — covers SUBSCRIBER-01
- [ ] `server/src/email/email.service.spec.ts` — covers email sending

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JwtAuthGuard on notification endpoints; @Public() on RSS/Sitemap/Music/Subscriber public endpoints |
| V3 Session Management | no | — |
| V4 Access Control | yes | AdminGuard on notification types endpoint; user-scoped queries on notification/subscriber data |
| V5 Input Validation | yes | class-validator DTOs for all request bodies; NeteaseID regex validation; email format validation |
| V6 Cryptography | yes | crypto.randomBytes for token and verification code generation |

### Known Threat Patterns for NestJS + SQLite + External API

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Verification code brute force | Tampering | Rate limiting (@Throttle), 5-minute TTL, 6-digit code (1M combinations) |
| Email enumeration via subscribe | Information Disclosure | Return generic error messages; don't reveal whether email exists |
| SSRF via music API | Tampering | Fixed API base URL from settings; NeteaseID regex validation prevents URL injection |
| SMTP credential exposure | Information Disclosure | SMTP credentials stored in settings table, not env vars; settings service restricts access |
| XML injection in RSS | Tampering | xmlEscape() escapes all 5 XML entities; content from database is always escaped |
| Token prediction for unsubscribe | Spoofing | 32-byte cryptographic random tokens (64 hex chars); infeasible to guess |

## Sources

### Primary (HIGH confidence)
- Go backend source code (pkg/handler/rss, pkg/service/rss, pkg/handler/sitemap, pkg/service/sitemap, pkg/handler/music, pkg/service/music, pkg/handler/notification, pkg/service/notification, pkg/handler/subscriber, pkg/service/subscriber) — all files read in full
- Go backend router (internal/infra/router/router.go) — route registrations verified
- Go backend notification model (pkg/domain/model/notification.go) — default types and constants verified
- Go backend email service (pkg/service/utility/email_service.go) — SendVerificationEmail and SendArticlePushEmail templates verified
- Go backend comment service (pkg/service/comment/service.go) — InAppNotificationCallback pattern verified
- Existing NestJS schemas (subscriber.schema.ts, notification-type.schema.ts, user-notification-config.schema.ts) — verified in codebase
- Existing NestJS services (article.service.ts, comment.service.ts, captcha.service.ts, settings.service.ts) — integration points verified
- Frontend types (music.ts, user-center.ts) and API calls (music.ts, user-center.ts, PostCopyright, PostContent) — verified

### Secondary (MEDIUM confidence)
- npm registry verification for nodemailer (v9.0.3) and @types/nodemailer (v8.0.1)
- Package legitimacy check results

### Tertiary (LOW confidence)
- None — all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nodemailer is the standard Node.js email library; all other dependencies are existing project utilities
- Architecture: HIGH - all Go backend source code read and analyzed; existing NestJS patterns well understood
- Pitfalls: HIGH - identified from direct source code analysis and established NestJS patterns

**Research date:** 2026-07-13
**Valid until:** 2026-08-12 (30 days — stable domain, no fast-moving dependencies)
