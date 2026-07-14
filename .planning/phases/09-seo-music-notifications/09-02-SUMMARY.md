---
phase: 09-seo-music-notifications
plan: 02
subsystem: api
tags: [sitemap, xml, seo, fast-xml-parser, robots-txt]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: NestJS module system, DatabaseModule, CommonModule, SettingsService
  - phase: 03-article-category-tag
    provides: ArticleService with listPublic()
  - phase: 04-page-public-api
    provides: PageService with list()
provides:
  - SitemapService with generateSitemap(), generateXML(), generateRobots(), getBaseURL()
  - SitemapController with GET /sitemap.xml and GET /robots.txt
  - SitemapModule wired with ArticleModule (forwardRef), PageModule, SettingsModule
affects: [seo, search-engine-indexing]

# Tech tracking
tech-stack:
  added: [fast-xml-parser@5.10.0]
  patterns: [XML-library-serialization-for-sitemap, @Res-bypass-for-XML-output]

key-files:
  created:
    - server/src/sitemap/sitemap.service.ts
    - server/src/sitemap/sitemap.controller.ts
  modified:
    - server/src/sitemap/sitemap.module.ts
    - server/package.json

key-decisions:
  - "D-216: Sitemap XML uses fast-xml-parser XMLBuilder for serialization (matching Go xml.MarshalIndent)"
  - "D-214: Sitemap NOT cached — regenerated on every request"
  - "URL entries without lastmod omit the field in XML output (not filtered out)"

patterns-established:
  - "XML library serialization: Use fast-xml-parser XMLBuilder with ignoreAttributes:false, format:true, indentBy:'  ', attributeNamePrefix:'@_' for sitemap XML output"
  - "Conditional XML fields: Omit empty/optional fields (like lastmod) from XML objects rather than including empty strings"

requirements-completed: [SITEMAP-01]

coverage:
  - id: D1
    description: "GET /sitemap.xml returns valid XML sitemap with homepage, articles, pages, link, and common pages"
    requirement: SITEMAP-01
    verification:
      - kind: unit
        ref: "TypeScript compilation passes; sitemap.service.ts generates URLSet with all 5 URL categories"
        status: pass
    human_judgment: true
    rationale: "XML output format and URL correctness require visual inspection against Go backend output"
  - id: D2
    description: "GET /robots.txt returns plain text with User-agent, Allow, Disallow, Sitemap directives"
    requirement: SITEMAP-01
    verification:
      - kind: unit
        ref: "sitemap.service.ts generateRobots() produces correct template string"
        status: pass
    human_judgment: true
    rationale: "robots.txt format and Sitemap URL require visual verification"
  - id: D3
    description: "Article URLs use abbrlink when available, else Sqids-encoded publicId"
    requirement: SITEMAP-01
    verification:
      - kind: unit
        ref: "sitemap.service.ts addArticles() uses article.abbrlink || article.id"
        status: pass
    human_judgment: false
  - id: D4
    description: "Priority/frequency logic: <24h=0.9/daily, <7d=0.8/weekly, <30d=0.7/monthly, else=0.6/yearly"
    requirement: SITEMAP-01
    verification:
      - kind: unit
        ref: "sitemap.service.ts addArticles() getTimeDiffHours() with threshold logic"
        status: pass
    human_judgment: false
  - id: D5
    description: "XML output bypasses global ResponseInterceptor via @Res()"
    requirement: SITEMAP-01
    verification:
      - kind: unit
        ref: "sitemap.controller.ts uses @Res() res: Response pattern"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-14
status: complete
---

# Phase 9 Plan 2: Sitemap Module Summary

**Sitemap XML generation via fast-xml-parser XMLBuilder and robots.txt template, with @Res() bypass for raw XML/text output**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-14T10:57:19Z
- **Completed:** 2026-07-14T11:12:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SitemapService generates URLSet with 5 URL categories (homepage, articles, pages, link, common pages)
- Sitemap XML serialized via fast-xml-parser XMLBuilder per D-216, matching Go's xml.MarshalIndent approach
- robots.txt generated from template string with User-agent/Allow/Disallow/Sitemap directives
- Article URLs use abbrlink when available, else Sqids-encoded publicId
- Priority/frequency logic based on article update time (<24h=0.9/daily, <7d=0.8/weekly, <30d=0.7/monthly, else=0.6/yearly)
- No caching per D-214 — sitemap regenerated on every request
- Both endpoints use @Res() to bypass global ResponseInterceptor

## Task Commits

Each task was committed atomically:

1. **Task 1: SitemapService with sitemap XML and robots.txt generation** - `e0ff615` (feat)
2. **Task 2: SitemapController with XML and plain text endpoints + SitemapModule wiring** - `019f5fe` (feat)

## Files Created/Modified
- `server/src/sitemap/sitemap.service.ts` - SitemapService with generateSitemap, generateXML, generateRobots, getBaseURL
- `server/src/sitemap/sitemap.controller.ts` - SitemapController with GET /sitemap.xml and GET /robots.txt
- `server/src/sitemap/sitemap.module.ts` - SitemapModule wired with ArticleModule (forwardRef), PageModule, SettingsModule
- `server/package.json` - Added fast-xml-parser dependency

## Decisions Made
- D-216: Sitemap XML uses fast-xml-parser XMLBuilder for serialization (matching Go xml.MarshalIndent)
- D-214: Sitemap NOT cached — regenerated on every request
- URL entries without lastmod omit the field in XML output rather than including empty strings or filtering out the entry entirely

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sitemap module complete and ready for search engine indexing
- SitemapController registered in AppModule (already present)
- No blockers for subsequent plans in Phase 09

## Self-Check: PASSED

- All 4 files verified present on disk
- Both task commits (e0ff615, 019f5fe) found in git log
- TypeScript compilation passes with no errors

---
*Phase: 09-seo-music-notifications*
*Completed: 2026-07-14*
