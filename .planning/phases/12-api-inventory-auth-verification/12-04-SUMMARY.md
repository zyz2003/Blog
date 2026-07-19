---
phase: "12"
plan: "04"
subsystem: "risk-marking"
tags: ["documentation", "risk-marking", "go-comparison", "api-compat"]
dependency_graph:
  requires: ["12-01", "12-02", "12-03"]
  provides: ["risk-marking-document"]
  affects: [".planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md"]
tech_stack:
  added: []
  patterns: ["cross-cutting-risk-patterns", "per-module-risk-tables", "prioritized-phase-guidance"]
key_files:
  created:
    - ".planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md"
  modified: []
decisions:
  - "CCP-1: created_at/updated_at nullability is MEDIUM (not HIGH) because DB likely has NOT NULL constraints, but needs verification"
  - "Album camelCase field naming flagged as MEDIUM but noted may be HIGH if frontend depends on camelCase"
  - "Link/LinkCategory/LinkTag ID type flagged as MEDIUM but noted may be HIGH if frontend expects int not string"
  - "5 auth 501 endpoints marked HIGH (business decision needed) not HIGH (must fix) per plan instructions"
  - "20 theme endpoints marked HIGH but deferred to future phase (major feature, not verification scope)"
metrics:
  duration: "18m"
  completed: "2026-07-19"
  tasks: 2
  files: 1
  endpoints_total: 188
  endpoints_high: 25
  endpoints_medium: 72
  endpoints_low: 18
  endpoints_none: 69
  endpoints_na: 4
status: complete
---

# Phase 12 Plan 04: Go Comparison Risk Marking Summary

Created 12-RISK-MARKING.md with risk levels for all 188 API endpoints based on Go source code comparison and Plan 02/03 test results, plus a prioritized risk summary for Phases 13-15.

## What Was Done

### Task 1: Mark risk level for each inventory endpoint based on Go source comparison

Read Go handler source files and model definitions for all modules (article, page, file, comment, link, album, doc-series, music, storage-policy, user, statistics) and compared response structures with NestJS DTOs. Created per-module risk tables with columns: Endpoint, Risk Level, Issue Description, Go Behavior, NestJS Behavior, Phase to Fix.

Key findings:
- **Cross-cutting pattern CCP-1:** created_at/updated_at nullability affects 40+ endpoints. Go uses `time.Time` (never null), NestJS uses `toISODateString()` which returns null for null dates.
- **Album camelCase fields:** Go Album model uses camelCase JSON tags (imageUrl, bigImageUrl, etc.) while most other models use snake_case. NestJS may normalize to snake_case, breaking frontend.
- **Link ID type:** Go LinkDTO uses `id: int` (raw DB ID), while NestJS may use Sqids (string). Frontend may expect int.
- **Comment ListResponse extra fields:** Go includes `total_with_children` and `has_more` fields that may be missing in NestJS.
- **File pagination naming:** Go uses `page_size` in Pagination struct, NestJS may use `pageSize`.

### Task 2: Produce prioritized risk summary for Phases 13-15

Appended Prioritized Risk Summary section with:
- Phase 13 priority list: Content endpoints ranked by risk (MEDIUM first, then LOW, then NONE)
- Phase 14 priority list: Feature endpoints ranked by risk (HIGH theme endpoints first, then MEDIUM, then LOW)
- Phase 15 must-fix list: 5 items that must be resolved before production cutover
- Business decision items: 8 endpoints (5 auth 501 + test-email + 2 OneDrive) need business decision
- Deferred items: config/export, config/import, 20 theme endpoints, files/share/create
- Summary statistics: HIGH 25 (13.4%), MEDIUM 72 (38.7%), LOW 18 (9.7%), NONE 69 (37.1%), N/A 4 (2.2%)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None -- documentation only, no code changes.

## Threat Flags

None -- planning artifact, not deployed code.

## Self-Check: PASSED

- .planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md: FOUND
- Commit d023408 (Tasks 1+2): FOUND
- HIGH risk count >= 3: PASS (26 HIGH references found)
- Prioritized Risk Summary with Phase 13/14/15: PASS
