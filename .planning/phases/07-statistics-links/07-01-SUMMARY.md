---
phase: 07-statistics-links
plan: 01
subsystem: statistics
tags: [repository, dto, ua-parser, visitor-dedup, error-codes]
dependency_graph:
  requires: [visitor-log.schema, visitor-stat.schema, url-stat.schema, database.module, error-codes]
  provides: [StatisticsRepository, UAParserService, VisitorDedupService, 11 DTOs, Phase 07 error codes]
  affects: [statistics.module, statistics.service, statistics.controller]
tech_stack:
  added: [ua-parser-js@2.0.10]
  patterns: [Drizzle sql template for complex aggregations, in-memory Map with TTL for dedup/cache]
key_files:
  created:
    - server/src/statistics/statistics.repository.ts
    - server/src/statistics/statistics.repository.spec.ts
    - server/src/statistics/dto/visitor-log-request.dto.ts
    - server/src/statistics/dto/visitor-statistics.dto.ts
    - server/src/statistics/dto/visitor-analytics.dto.ts
    - server/src/statistics/dto/url-statistics.dto.ts
    - server/src/statistics/dto/visitor-trend-data.dto.ts
    - server/src/statistics/dto/statistics-summary.dto.ts
    - server/src/statistics/dto/visitor-logs-response.dto.ts
    - server/src/statistics/dto/analytics-query.dto.ts
    - server/src/statistics/dto/top-pages-query.dto.ts
    - server/src/statistics/dto/trend-query.dto.ts
    - server/src/statistics/dto/visitor-logs-query.dto.ts
    - server/src/statistics/ua-parser.ts
    - server/src/statistics/ua-parser.spec.ts
    - server/src/statistics/visitor-dedup.ts
    - server/src/statistics/visitor-dedup.spec.ts
  modified:
    - server/src/common/constants/error-codes.ts
decisions:
  - D-167: Complex aggregation queries use sql template tag, simple queries use Drizzle query builder
  - D-165: UAParserService uses ua-parser-js with MD5-keyed 12h TTL cache
  - D-161: VisitorDedupService uses 3 in-memory Maps with stat:uv/stat:pv key formats and 3s request dedup
  - ua-parser-js v2 uses named export { UAParser }, not default export
metrics:
  duration: 127m
  completed: "2026-07-11"
  tasks: 2
  tests: 38
  files_created: 17
  files_modified: 1
status: complete
---

# Phase 07 Plan 01: Statistics Data Layer & Utilities Summary

StatisticsRepository with Drizzle queries, 11 DTOs matching Go backend models, UA parser with cache, visitor dedup utility, and extended error codes.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create StatisticsRepository with all Drizzle query methods | 52d8a9e | statistics.repository.ts, statistics.repository.spec.ts |
| 2 | Create 11 statistics DTOs, UA parser, visitor dedup, extend error codes | 447a8d8 | dto/*.ts, ua-parser.ts, visitor-dedup.ts, error-codes.ts |

## Task 1: StatisticsRepository

Implemented 10 query methods following the CommentRepository pattern:

- **createLog**: Insert into visitor_logs, returns inserted record
- **countTotalViews**: Count rows in visitor_logs for a date (China timezone day boundary)
- **countUniqueVisitors**: Count distinct visitorId for a date
- **getVisitorStatsByDate**: Query visitor_stats by date
- **getVisitorStatsByDateRange**: Query visitor_stats for date range (month/year aggregation)
- **upsertVisitorStats**: Create or update visitor_stats with atomic increment
- **incrementUrlStats**: Create or update url_stats with weighted avg duration
- **getTopPages**: Query url_stats ORDER BY total_views DESC
- **getVisitorAnalytics**: 6 GROUP BY queries on visitor_logs (browser/os/device/city/country/referer)
- **getVisitorLogsByTimeRange**: Paginated visitor_logs with date range filter

Date handling uses `getChinaDayBounds()` helper that converts dates to Unix timestamp ranges for UTC+8 day boundaries, matching Go backend pattern.

TDD: 13 unit tests passing (RED/GREEN cycle completed).

## Task 2: DTOs, UA Parser, Visitor Dedup, Error Codes

### 11 DTOs

All DTOs use snake_case JSON keys matching Go json tags:

- **Request DTOs**: VisitorLogRequestDto, AnalyticsQueryDto, TopPagesQueryDto, TrendQueryDto, VisitorLogsQueryDto
- **Response DTOs**: VisitorStatisticsDto (6 fields), VisitorAnalyticsDto (6 dimension arrays), UrlStatisticsDto (8 fields), VisitorTrendDataDto (daily + empty weekly/monthly), StatisticsSummaryDto (composite), VisitorLogsResponseDto (paginated list)

### UAParserService

- Uses `ua-parser-js` v2 with named export `{ UAParser }` (not default export)
- MD5-keyed cache with 12h TTL matching Go userAgentCache
- Default device to 'Desktop' when type is undefined
- 30-minute cleanup interval matching Go cleanupCaches pattern
- 9 unit tests passing

### VisitorDedupService

- 3 Maps: uvDedupMap (stat:uv:{ip}:{date}), pvDedupMap (stat:pv:{ip}:{urlPath}:{date}), requestDedupMap ({visitorId}:{urlPath}:{windowKey})
- UV/PV TTL to end of day in China timezone
- Request dedup with 3-second window matching Go DedupExpire
- 30-minute cleanup interval
- 16 unit tests passing

### Error Codes

Extended with 12 Phase 07 entries:
- Statistics: STAT_INVALID_DATE, STAT_VISIT_RECORD_FAILED
- Links: LINK_NOT_FOUND, LINK_URL_EXISTS, LINK_CATEGORY_NOT_FOUND, LINK_CATEGORY_IN_USE, LINK_TAG_NOT_FOUND, LINK_TAG_IN_USE, LINK_SITESHOT_REQUIRED, LINK_APPLY_RATE_LIMITED, LINK_IMPORT_LIMIT_EXCEEDED, LINK_HEALTH_CHECK_RUNNING

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ua-parser-js v2 import pattern**
- **Found during:** Task 2 implementation
- **Issue:** `import UAParser from 'ua-parser-js'` fails with "default is not a constructor/function" because ua-parser-js v2 uses named export `{ UAParser }`, not default export
- **Fix:** Changed to `import { UAParser } from 'ua-parser-js'` and call `UAParser(userAgent)` directly instead of `new UAParser(userAgent).getResult()`
- **Files modified:** server/src/statistics/ua-parser.ts
- **Commit:** 447a8d8

**2. [Rule 1 - Bug] Test expectation for macOS name**
- **Found during:** Task 2 testing
- **Issue:** ua-parser-js v2 returns 'macOS' for Mac OS X, not 'Mac OS' as in v1
- **Fix:** Updated test expectation to match actual library output ('macOS')
- **Files modified:** server/src/statistics/ua-parser.spec.ts
- **Commit:** 447a8d8

## Verification

- All 38 unit tests passing across 3 test files
- TypeScript compilation clean (no errors)
- All DTOs match Go backend model field names and types
- StatisticsRepository methods return correct types
- UAParserService parses UA strings and caches results with 12h TTL
- VisitorDedupService correctly tracks and expires dedup entries
- Error codes file has 12 new Phase 07 entries

## Known Stubs

None. All data sources are wired through repository methods and utilities.

## Self-Check: PASSED

- All 18 created files verified present on disk
- Both task commits (52d8a9e, 447a8d8) verified in git log
- 38 unit tests passing
- TypeScript compilation clean
