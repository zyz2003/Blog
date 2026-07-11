# Phase 07: Statistics & Links - Research

**Gathered:** 2026-07-11
**Status:** Complete

---

## 1. Statistics Module — Go Backend API Contract

### 1.1 Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/public/statistics/basic | Public | 基础统计（今日/昨日/月/年） |
| POST | /api/public/statistics/visit | Public | 记录访客访问（前端主动上报） |
| GET | /api/statistics/analytics | Admin | 访客分析（设备/浏览器/OS/来源） |
| GET | /api/statistics/top-pages | Admin | 热门页面 |
| GET | /api/statistics/trend | Admin | 访客趋势（日/周/月） |
| GET | /api/statistics/summary | Admin | 统计概览（basic+top+analytics+trend） |
| GET | /api/statistics/visitor-logs | Admin | 访客日志（分页） |

### 1.2 Request/Response DTOs

**VisitorLogRequest** (POST /public/statistics/visit):
```json
{
  "url_path": "string (required)",
  "page_title": "string (optional)",
  "referer": "string (optional)",
  "duration": "int (optional, default 0)"
}
```

**VisitorStatistics** (GET /public/statistics/basic):
```json
{
  "today_visitors": 0,
  "today_views": 0,
  "yesterday_visitors": 0,
  "yesterday_views": 0,
  "month_views": 0,
  "year_views": 0
}
```

**VisitorAnalytics** (GET /statistics/analytics):
```json
{
  "top_countries": [{ "country": "string", "count": 0 }],
  "top_cities": [{ "city": "string", "count": 0 }],
  "top_browsers": [{ "browser": "string", "count": 0 }],
  "top_os": [{ "os": "string", "count": 0 }],
  "top_devices": [{ "device": "string", "count": 0 }],
  "top_referers": [{ "referer": "string", "count": 0 }]
}
```
Query params: `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD). Default: last 7 days (China timezone).

**URLStatistics** (GET /statistics/top-pages):
```json
[{
  "url_path": "string",
  "page_title": "string",
  "total_views": 0,
  "unique_views": 0,
  "bounce_count": 0,
  "bounce_rate": 0.0,
  "avg_duration": 0.0,
  "last_visited_at": "time.Time|null"
}]
```
Query params: `limit` (default 10, max 100).

**VisitorTrendData** (GET /statistics/trend):
```json
{
  "daily": [{ "date": "time.Time", "visitors": 0, "views": 0 }],
  "weekly": [],
  "monthly": []
}
```
Query params: `period` (daily/weekly/monthly, default daily), `days` (default 30, max 365).
**Note:** Go backend currently only returns `daily` data regardless of `period` param (weekly/monthly are empty arrays).

**StatisticsSummary** (GET /statistics/summary):
```json
{
  "basic_stats": VisitorStatistics,
  "top_pages": [URLStatistics],
  "analytics": VisitorAnalytics,
  "trend_data": VisitorTrendData
}
```
Summary uses: basic stats + top 10 pages + last 7 days analytics + last 30 days daily trend.

**VisitorLogs** (GET /statistics/visitor-logs):
```json
{
  "list": [{
    "user_agent": "string",
    "ip_address": "string",
    "city": "string",
    "url_path": "string",
    "duration": 0,
    "created_at": "RFC3339 string"
  }],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```
Query params: `start_date`, `end_date` (YYYY-MM-DD), `page` (default 1), `page_size` (default 20, max 200). Default range: last 7 days.

### 1.3 RecordVisit Business Logic (Go Backend)

1. **Get client IP** from X-Forwarded-For → X-Real-IP → X-Original-Forwarded-For → c.ClientIP()
2. **Get User-Agent** from request header
3. **Generate visitor ID** = MD5(IP + UserAgent) as hex string
4. **Request dedup check** (in-memory sync.Map): key = `visitorID:urlPath:timestamp/3s`, if exists → return nil (skip)
5. **Create visit task** and push to non-blocking channel (queue size 1000, max 50 workers)
6. **Worker processes task asynchronously**:
   a. Redis SADD for visitor dedup (key: `anheyu:stats:visitors:set:YYYY-MM-DD`)
   b. If new visitor: increment today visitors counter, set TTL 48h
   c. Increment today views counter, set TTL 24h
   d. Delete basic stats cache (async)
   e. Parse User-Agent (with MD5-based cache, 12h TTL)
   f. Create visitor_logs record
   g. Update url_stats (IncrementViews: totalViews+1, uniqueViews+1 if new, avgDuration, bounceCount)
7. **Return immediately** with success response (data persisted asynchronously)

**Key insight:** Go backend uses Redis for real-time counters + dedup, and a worker pool for async processing. NestJS replaces Redis with in-memory Map and uses Promise-based async processing.

### 1.4 GetBasicStatistics Logic

1. Try cache (Redis key `anheyu:stats:basic`, TTL 5min)
2. If cache miss, try Redis real-time counters for today
3. If Redis has today data, get yesterday/month/year from DB visitor_stats
4. **enrichTodayYesterdayFromVisitorLogs**: Always override today/yesterday from visitor_logs (CountTotalViews + CountUniqueVisitors by date range) — this ensures accuracy even before daily aggregation runs
5. Write to cache

### 1.5 GetVisitorTrend Logic

- Iterates day-by-day from startDay to endDay
- For each day: CountTotalViews + CountUniqueVisitors from visitor_logs
- Only returns `daily` array (weekly/monthly are empty)
- Uses China timezone for date boundaries

### 1.6 GetVisitorAnalytics Logic

- Delegates to visitorLogRepo.GetVisitorAnalytics
- Queries visitor_logs with GROUP BY on browser/os/device/city/country/referer
- Returns top N for each dimension

---

## 2. Friend Link Module — Go Backend API Contract

### 2.1 Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/public/links | Public (rate-limited) | 申请友链 |
| GET | /api/public/links | Public | 公开友链列表（APPROVED） |
| GET | /api/public/links/random | Public | 随机友链 |
| GET | /api/public/links/applications | Public | 所有友链申请列表 |
| GET | /api/public/links/check-exists | Public | 检查URL是否已存在 |
| GET | /api/public/link-categories | Public | 有APPROVED友链的分类 |
| POST | /api/links | Admin | 创建友链 |
| GET | /api/links | Admin | 管理员友链列表（含筛选） |
| DELETE | /api/links/batch-delete | Admin | 批量删除 |
| PUT | /api/links/:id | Admin | 更新友链 |
| DELETE | /api/links/:id | Admin | 删除友链 |
| PUT | /api/links/:id/review | Admin | 审核友链 |
| POST | /api/links/import | Admin | 导入友链 |
| GET | /api/links/export | Admin | 导出友链 |
| POST | /api/links/health-check | Admin | 触发健康检查 |
| GET | /api/links/health-check/status | Admin | 健康检查状态 |
| PUT | /api/links/sort | Admin | 批量更新排序 |
| GET | /api/links/categories | Admin | 分类列表 |
| POST | /api/links/categories | Admin | 创建分类 |
| PUT | /api/links/categories/:id | Admin | 更新分类 |
| DELETE | /api/links/categories/:id | Admin | 删除分类 |
| GET | /api/links/tags | Admin | 标签列表 |
| POST | /api/links/tags | Admin | 创建标签 |
| PUT | /api/links/tags/:id | Admin | 更新标签 |
| DELETE | /api/links/tags/:id | Admin | 删除标签 |

### 2.2 Request/Response DTOs

**ApplyLinkRequest** (POST /public/links):
```json
{
  "type": "NEW|UPDATE (required)",
  "name": "string (required)",
  "url": "string URL (required)",
  "rss_url": "string URL (optional, max 512)",
  "logo": "string (optional)",
  "description": "string (optional)",
  "siteshot": "string (optional)",
  "email": "string email (required)",
  "original_url": "string URL (optional, for UPDATE type)",
  "update_reason": "string (optional, for UPDATE type)",
  "turnstile_token": "string (optional)",
  "geetest_*": "string (optional)",
  "image_captcha_*": "string (optional)"
}
```
Response: `{ code: 200, data: null, message: "申请已提交，等待审核" }`

**LinkDTO** (response shape for all link endpoints):
```json
{
  "id": 0,
  "name": "string",
  "url": "string",
  "rss_url": "string (omitempty)",
  "logo": "string",
  "description": "string",
  "status": "PENDING|APPROVED|REJECTED|INVALID",
  "siteshot": "string (omitempty)",
  "email": "string (omitempty)",
  "type": "NEW|UPDATE (omitempty)",
  "original_url": "string (omitempty)",
  "update_reason": "string (omitempty)",
  "sort_order": 0,
  "skip_health_check": false,
  "category": { "id": 0, "name": "string", "style": "card|list", "description": "string" },
  "tag": { "id": 0, "name": "string", "color": "string" }
}
```
**Note:** `tag` is a single tag (not array), matching Go backend's current implementation.

**LinkListResponse**:
```json
{
  "list": [LinkDTO],
  "total": 0,
  "page": 1,
  "pageSize": 10
}
```

**AdminCreateLinkRequest** (POST /links):
```json
{
  "name": "string (required)",
  "url": "string URL (required)",
  "rss_url": "string URL (optional, max 512)",
  "logo": "string (optional)",
  "description": "string (optional)",
  "category_id": "int (required)",
  "tag_id": "int|null (optional)",
  "status": "PENDING|APPROVED|REJECTED|INVALID (required)",
  "siteshot": "string (optional)",
  "email": "string email (optional)",
  "type": "NEW|UPDATE (optional)",
  "original_url": "string URL (optional)",
  "update_reason": "string (optional)",
  "sort_order": "int (default 0)",
  "skip_health_check": "bool (default false)"
}
```

**ReviewLinkRequest** (PUT /links/:id/review):
```json
{
  "status": "APPROVED|REJECTED (required)",
  "siteshot": "string|null (optional)",
  "reject_reason": "string|null (optional)"
}
```

**ImportLinksRequest** (POST /links/import):
```json
{
  "links": [ImportLinkItem],
  "skip_duplicates": false,
  "create_categories": false,
  "create_tags": false,
  "default_category_id": "int|null"
}
```
Max 1000 links per import.

**ImportLinkItem**:
```json
{
  "name": "string (required)",
  "url": "string URL (required)",
  "rss_url": "string URL (optional)",
  "logo": "string (optional)",
  "description": "string (optional)",
  "siteshot": "string (optional)",
  "email": "string email (optional)",
  "category_name": "string (optional, auto-create if needed)",
  "tag_name": "string (optional, auto-create if needed)",
  "tag_color": "string (optional, default #409EFF)",
  "status": "PENDING|APPROVED|REJECTED|INVALID (default PENDING)"
}
```

**ImportLinksResponse**:
```json
{
  "total": 0,
  "success": 0,
  "failed": 0,
  "skipped": 0,
  "success_list": [LinkDTO],
  "failed_list": [{ "link": ImportLinkItem, "reason": "string" }],
  "skipped_list": [{ "link": ImportLinkItem, "reason": "string" }]
}
```

**ExportLinksResponse** (GET /links/export):
```json
{
  "links": [ImportLinkItem],
  "total": 0
}
```

**CheckLinkExistsResponse** (GET /public/links/check-exists):
```json
{ "exists": false, "url": "string" }
```

**HealthCheckStatus** (GET /links/health-check/status):
```json
{
  "is_running": false,
  "start_time": "time|null",
  "end_time": "time|null",
  "result": {
    "total": 0,
    "healthy": 0,
    "unhealthy": 0,
    "unhealthy_ids": [0]
  },
  "error": "string"
}
```

**BatchUpdateLinkSortRequest** (PUT /links/sort):
```json
{ "items": [{ "id": 0, "sort_order": 0 }] }
```

**BatchDeleteLinksRequest** (DELETE /links/batch-delete):
```json
{ "ids": [0] }
```
Max 100 IDs.

**BatchDeleteLinksResponse**:
```json
{
  "total": 0,
  "success": 0,
  "failed": 0,
  "failed_list": [{ "id": 0, "reason": "string" }]
}
```

**LinkCategoryDTO**:
```json
{ "id": 0, "name": "string", "style": "card|list", "description": "string" }
```

**LinkTagDTO**:
```json
{ "id": 0, "name": "string", "color": "string" }
```

### 2.3 ApplyLink Business Logic

1. Normalize email (lowercase, trim)
2. Check if email has previous applications (HasApplicationByEmail)
3. If repeat applicant → require CAPTCHA verification (Turnstile/Geetest/Image)
4. Check if URL already exists (ExistsByURL)
5. If URL exists and type=NEW → error "该网站已申请过友链"
6. Get default category ID from settings (KeyFriendLinkDefaultCategory, default 2)
7. Get default category, check style
8. If card style and no siteshot → error "卡片样式的友链申请时必须提供网站快照"
9. Create link with PENDING status, default category
10. Send Pushoo notification (async, if pushChannel configured and notifyAdmin=true)
11. Send email notification (async, if emailSvc available and conditions met)
12. Return LinkDTO

### 2.4 ReviewLink Business Logic

1. Get link by ID
2. If status=APPROVED:
   - Check link has category
   - If card style → siteshot must be provided and non-empty
3. If status=REJECTED: reject_reason is optional
4. Update status in DB (UpdateStatus with id, status, siteshot)
5. If APPROVED: publish LinkCreated event
6. Send email notification (async)

### 2.5 Health Check Business Logic

1. Get all APPROVED links + all INVALID links
2. Create HTTP client with 10s timeout, max 5 redirects
3. Concurrent check with semaphore (max 10 concurrent)
4. For each link: HTTP GET, check status 2xx/3xx = healthy
5. APPROVED links that fail → mark INVALID
6. INVALID links that recover → mark APPROVED
7. Return summary: total, healthy, unhealthy, unhealthyIDs

### 2.6 ImportLinks Business Logic

1. Validate: at least 1 link, max 1000
2. Build category/tag caches
3. For each link:
   a. Resolve category (by name, auto-create if create_categories=true, else use default)
   b. Check intra-import dedup (processedURLs map)
   c. If skip_duplicates=true, check DB for existing URL+category
   d. Resolve tag (by name, auto-create if create_tags=true, with custom color or #409EFF)
   e. Set default status (PENDING if empty)
   f. Create via AdminCreate
4. Return ImportLinksResponse with success/failed/skipped counts

### 2.7 ExportLinks Business Logic

1. Build ListLinksRequest with same filters, pageSize=10000
2. Get all matching links
3. Convert each to ImportLinkItem format (with category_name, tag_name, tag_color)
4. Return ExportLinksResponse

### 2.8 Category/Tag CRUD

- **CreateCategory**: name (required), style (card|list, required), description (optional)
- **UpdateCategory**: same fields
- **DeleteCategory**: only if no links using it (DeleteIfUnused)
- **CreateTag**: name (required), color (optional, default #666666)
- **UpdateTag**: same fields
- **DeleteTag**: only if no links using it (DeleteIfUnused)
- **ListCategories**: all categories (admin)
- **ListPublicCategories**: only categories with APPROVED links (public)

---

## 3. Existing NestJS Code Status

### 3.1 Schemas (Already Defined in Phase 01)

| Schema | File | Status |
|--------|------|--------|
| visitor_logs | visitor-log.schema.ts | ✅ Complete (all fields + 6 indexes) |
| visitor_stats | visitor-stat.schema.ts | ✅ Complete (date unique index) |
| url_stats | url-stat.schema.ts | ✅ Complete (3 indexes) |
| links | link.schema.ts | ✅ Complete (all fields + categoryId FK) |
| link_categories | link-category.schema.ts | ✅ Complete |
| link_tags | link-tag.schema.ts | ✅ Complete |
| link_tag_pivot | link-tag-pivot.schema.ts | ✅ Complete |

### 3.2 Module Placeholders

- `statistics.module.ts` — empty `@Module({})`
- `link.module.ts` — empty `@Module({})`

### 3.3 Sqids EntityType

Current EntityType has values 1-21. Need to add:
- `Link: 22` (for friend link ID encoding)

### 3.4 Error Codes

Need to add Phase 07 error codes:
- Statistics: STAT_INVALID_DATE, STAT_VISIT_RECORD_FAILED
- Links: LINK_NOT_FOUND, LINK_URL_EXISTS, LINK_CATEGORY_NOT_FOUND, LINK_CATEGORY_IN_USE, LINK_TAG_NOT_FOUND, LINK_TAG_IN_USE, LINK_SITESHOT_REQUIRED, LINK_APPLY_RATE_LIMITED, LINK_IMPORT_LIMIT_EXCEEDED, LINK_HEALTH_CHECK_RUNNING

### 3.5 Reusable Services

- **GeoIPService** (weather/geoip.service.ts): IP → city/region/country lookup
- **SettingsService**: in-memory cache + dynamic config reading
- **Pushoo push** (from comment module): can be extracted as shared utility

---

## 4. Key Implementation Notes

### 4.1 Statistics — Redis → In-Memory Map Migration

Go backend uses Redis for:
1. **Visitor dedup**: SADD to `anheyu:stats:visitors:set:YYYY-MM-DD` → NestJS: Map with key `stat:uv:{ip}:{date}`, TTL to end of day
2. **Real-time counters**: INCR `anheyu:stats:today:views:YYYY-MM-DD` → NestJS: Map with key `stat:pv:{date}`, TTL to end of day
3. **Request dedup**: sync.Map with 3s TTL → NestJS: Map with 3s TTL
4. **UA parse cache**: sync.Map with 12h TTL → NestJS: Map with 12h TTL
5. **Stats cache**: Redis GET/SET with 5min TTL → NestJS: Map with 5min TTL

### 4.2 Statistics — Query Patterns

- **GetBasicStatistics**: Query visitor_stats for yesterday/month/year, enrich today/yesterday from visitor_logs
- **GetVisitorAnalytics**: GROUP BY queries on visitor_logs (browser, os, device, city, country, referer)
- **GetTopPages**: ORDER BY total_views DESC on url_stats
- **GetVisitorTrend**: Day-by-day iteration, CountTotalViews + CountUniqueVisitors from visitor_logs
- **GetVisitorLogs**: Paginated query on visitor_logs with date range filter

### 4.3 Link — Tag Relationship

Go backend uses many-to-many (link_tag_pivot table), but the LinkDTO only returns a single `tag` field (not `tags`). This means each link is associated with at most one tag in practice, even though the schema supports many-to-many.

### 4.4 Link — Health Check

- Async execution with mutex-protected status
- HTTP GET with 10s timeout, max 5 redirects
- Max 10 concurrent checks
- APPROVED→INVALID if unhealthy, INVALID→APPROVED if recovered
- Status 2xx/3xx = healthy

### 4.5 Link — Default Category

- Default category ID from settings (KeyFriendLinkDefaultCategory, default 2)
- Card style requires siteshot
- List style does not require siteshot

### 4.6 New Dependencies

- **ua-parser-js**: UA parsing (replaces Go's hand-rolled parser with more accurate results)
- No other new dependencies needed

---

*Research completed: 2026-07-11*
