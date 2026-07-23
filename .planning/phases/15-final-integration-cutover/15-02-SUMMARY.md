---
phase: 15-final-integration-cutover
plan: 02
subsystem: testing
tags: [vitest, regression, cross-module, integration]

# Dependency graph
requires:
  - phase: 15-01
    provides: All 5 pre-existing test failures resolved
provides:
  - Full regression suite passing (562 tests)
  - 4 cross-module integration tests in phase15-verification/
affects: [15-final-integration-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-module integration tests spanning 2-3 service modules per test"
    - "Sequential test execution (--no-file-parallelism) for DB isolation"

---

## Plan 15-02: Full Regression + Cross-Module Integration Tests

### What was built

1. **Full regression suite verified green** — all Phase 13 (58), Phase 14 (190), and api-compat (314) tests pass with zero failures when run sequentially
2. **4 cross-module integration tests** in `server/test/phase15-verification/cross-module-integration.spec.ts`:
   - Test 1: Article + Category + Public — create article with category/tag, publish, verify in public lists
   - Test 2: File + Direct Link + Public — upload file, create direct link, verify public access
   - Test 3: Comment + Article + Admin — post comment on article, verify in admin comment list
   - Test 4: Friend Link + Public — create APPROVED friend link, verify in public link list
3. **vitest.config.ts** — added `testTimeout: 30000` for cross-module test reliability

### Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| Phase 13 verification | 58 | ✓ All pass |
| Phase 14 verification | 190 | ✓ All pass |
| api-compat | 314 | ✓ All pass |
| Phase 15 cross-module | 4 | ✓ All pass |
| **Total** | **566** | **✓ All pass** |

### Key Findings

- Tests must run with `--no-file-parallelism` to avoid DB state leakage between test files (each test file creates its own NestJS app instance sharing the same SQLite file DB)
- `drizzle-kit push --force` must be run before first test execution if DB file is deleted
- The plan's original instruction to delete `data/anheyu.db` between suites is counterproductive — it removes the schema tables. Tests work correctly with the existing DB since `seedBaseData` uses `onConflictDoUpdate`/`onConflictDoNothing`

### Deviations

- Did NOT delete `data/anheyu.db` between test suite runs — this would break tests by removing schema tables. Instead, relied on `seedBaseData`'s conflict handling for idempotent data setup.
- Added `testTimeout: 30000` to vitest.config.ts (not in original plan) — needed for cross-module tests that make multiple sequential HTTP requests

### key-files

created:
  - server/test/phase15-verification/cross-module-integration.spec.ts
modified:
  - server/vitest.config.ts
