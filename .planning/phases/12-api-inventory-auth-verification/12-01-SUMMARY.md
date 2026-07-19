---
phase: 12
plan: 01
subsystem: api-inventory
tags: [documentation, api-inventory, cross-reference, gap-analysis]
dependency_graph:
  requires: [12-RESEARCH.md, frontend/src/lib/api/*, server/src/**/*.controller.ts, _go-backend-archive/internal/infra/router/router.go]
  provides: [12-API-INVENTORY.md]
  affects: []
tech_stack:
  added: []
  patterns: [static-source-scan, cross-reference-verification]
key_files:
  created:
    - .planning/phases/12-api-inventory-auth-verification/12-API-INVENTORY.md
  modified: []
decisions:
  - D-274-REVISED: Auth 501 endpoints (register/activate/forgot-password/reset-password/check-email) are compatibility gaps -- Go has real handlers, NestJS returns 501
  - D-275-CONFIRMED: Theme Mall has 20 endpoints all MISSING from NestJS -- no theme controller exists
  - D-276-CONFIRMED: config/export and config/import have service methods but no controller routes
  - D-277-CONFIRMED: files/share/create is frontend-only -- Go router also lacks this endpoint
metrics:
  duration: 18m
  completed: 2026-07-19
  tasks_completed: 3
  files_created: 1
  endpoints_inventoried: 188
  implemented_count: 155
  not_implemented_501_count: 8
  missing_count: 22
status: complete
---

# Phase 12 Plan 01: API Inventory Summary

Complete frontend API endpoint inventory with NestJS cross-reference and gap analysis.

## One-liner

Built complete inventory of 188 frontend API endpoints (185 backend + 3 supplementary), cross-referenced against 34 NestJS controllers, identifying 155 IMPLEMENTED, 8 x 501 NOT_IMPLEMENTED, and 22 MISSING endpoints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build main API endpoint inventory table | ba3000b | 12-API-INVENTORY.md |
| 2 | Supplementary scan for non-apiClient API calls | ba3000b | 12-API-INVENTORY.md (appended) |
| 3 | Cross-reference inventory against NestJS controllers and produce gap summary | ba3000b | 12-API-INVENTORY.md (appended) |

## Key Findings

### Implementation Coverage

- **155 IMPLEMENTED (83.8%)** -- Frontend endpoints with matching NestJS routes returning real data
- **8 x 501 NOT_IMPLEMENTED (4.3%)** -- NestJS routes exist but throw 501
- **22 MISSING (11.9%)** -- No NestJS route found

### Critical Compatibility Gaps

1. **5 Auth endpoints (501 but Go has implementations):** register, activate, forgot-password, reset-password, check-email. Go has real handlers with rate limiting; NestJS returns 501. These are NOT matching behavior -- they are compatibility gaps requiring implementation.

2. **20 Theme Mall endpoints (MISSING):** No theme controller exists in NestJS. Go has full theme and SSR theme handlers. This is the largest gap by count.

3. **2 Config endpoints (MISSING):** config/export and config/import. NestJS SettingsService has `exportAll()` and `importAll()` methods but no controller routes expose them.

4. **1 Frontend-only endpoint:** files/share/create (#77) -- not in Go router either.

### Supplementary Scan Results

8 non-apiClient fetch calls found:
- 1 already covered in main inventory (visit-statistics-tracker uses statisticsApi)
- 7 are external services or client-side utilities (music API, lyrics, color extraction, proxy)
- None represent missing backend API endpoints

### Additional NestJS Routes Not Called by Frontend

33 NestJS routes exist but are not called by any frontend API method. These include internal/proxy routes (RSS, sitemap, direct links, thumbnails) and features not yet wired in the frontend (notifications, search, subscribers, weather).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] D-274 correction on auth 501 endpoints**
- **Found during:** Task 3 cross-reference
- **Issue:** Plan stated (D-274) that Go also does not implement register/activate/forgot-password/reset-password/check-email. Go source code verification confirms Go DOES have real handlers for all 5.
- **Fix:** Marked these as "501 NOT_IMPLEMENTED (Go has implementation -- compatibility gap)" instead of "matching 501 behavior"
- **Files modified:** 12-API-INVENTORY.md
- **Commit:** ba3000b

**2. [Rule 2 - Missing Critical Functionality] Theme Mall gap not previously quantified**
- **Found during:** Task 3 cross-reference
- **Issue:** No theme controller exists in NestJS at all -- all 20 theme mall endpoints are MISSING, not just some
- **Fix:** Documented all 20 as MISSING with Go implementation reference
- **Files modified:** 12-API-INVENTORY.md
- **Commit:** ba3000b

**3. [Rule 2 - Missing Critical Functionality] Additional supplementary scan items**
- **Found during:** Task 2 supplementary scan
- **Issue:** RESEARCH.md identified 3 supplementary items (#186-188); scan found 5 additional ones (#189-193)
- **Fix:** Added all 8 items to supplementary scan table
- **Files modified:** 12-API-INVENTORY.md
- **Commit:** ba3000b

None of these are code deviations -- this is a documentation-only plan.

## Known Stubs

None -- this is a documentation plan with no code stubs.

## Threat Flags

None -- documentation-only plan with no security surface changes.
