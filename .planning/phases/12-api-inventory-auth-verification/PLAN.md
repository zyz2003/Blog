# Phase 12: API Inventory & Auth & Settings Verification

**Phase:** 12-api-inventory-auth-verification
**Goal:** Systematically collect all API calls made by the frontend; verify auth and settings endpoints work correctly with the frontend
**Status:** Ready for execution

## Success Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| 1 | Complete inventory of all frontend API calls (188 endpoints) | 12-API-INVENTORY.md with row count |
| 2 | Auth login returns correct token structure and user info matching Go handler | Field-by-field test in auth-api-compat.spec.ts |
| 3 | Token refresh works via both header and body channels | Dual-channel test in auth-api-compat.spec.ts |
| 4 | Unimplemented auth endpoints return correct 501 format | 501 format test in auth-api-compat.spec.ts |
| 5 | Captcha flow end-to-end verified (config → image → login) | Captcha flow test in auth-api-compat.spec.ts |
| 6 | GET /api/public/site-config returns all public keys (290+) with correct nesting | Site-config test with key count assertion |
| 7 | POST /api/settings/update accepts flat key-value pairs and persists correctly | Update format test in settings-api-compat.spec.ts |
| 8 | POST /api/settings/get-by-keys returns correct values for admin and non-admin | Non-admin filtering test in settings-api-compat.spec.ts |
| 9 | Version endpoint returns correct format | Config-version test in settings-api-compat.spec.ts |
| 10 | Go comparison risk marking complete for all 188 endpoints | 12-RISK-MARKING.md with risk levels |

## Plan Structure

| Plan | Wave | Tasks | Description | Files Modified |
|------|------|-------|-------------|----------------|
| 12-01 | 1 | 3 | API Inventory (documentation) | 12-API-INVENTORY.md |
| 12-02 | 2 | 3 | Auth Verification (test code) | auth-api-compat.spec.ts |
| 12-03 | 2 | 3 | Settings Verification (test code) | settings-api-compat.spec.ts |
| 12-04 | 3 | 2 | Go Comparison Risk Marking (documentation) | 12-RISK-MARKING.md |

## Execution Order

```
Wave 1: Plan 01 (API Inventory)
  ↓
Wave 2: Plan 02 (Auth) + Plan 03 (Settings) — parallel
  ↓
Wave 3: Plan 04 (Risk Marking) — depends on Plans 01-03
```

## Key Decisions Applied

| Decision | Plan | Task |
|----------|------|------|
| D-270: Static scan of api/ files | 01 | 1 |
| D-271: Main inventory + supplementary scan | 01 | 1, 2 |
| D-272: Markdown table, grouped by module | 01 | 1 |
| D-273: Summary-level granularity | 01 | 1 |
| D-274: 5 auth endpoints verify 501 format only | 02 | 2 |
| D-275: No frontend UI walkthrough for 501 | — | (by omission) |
| D-276: Captcha flow end-to-end | 02 | 2 |
| D-277: Token refresh dual-channel | 02 | 1 |
| D-278: Login response field-by-field | 02 | 1 |
| D-279: Phase 12 does 3 things | 01-04 | all |
| D-280: Go comparison risk marking | 04 | 1 |
| D-281: No browser walkthrough | — | (by omission) |

## Known Compatibility Gaps (from Research)

| Gap | Risk | Plan | Resolution |
|-----|------|------|------------|
| `expires` format: Go returns number, NestJS returns string | NONE | 02 Task 3 | NestJS string matches frontend type `expires: string`; Go number is Go's inconsistency |
| 5 auth endpoints: Go implemented, NestJS 501 | HIGH | 02 Task 2 | Document as compatibility gap |
| `created_at`/`updated_at`: Go never null, NestJS can be null | MEDIUM | 02 Task 3 | Document in Known Gaps |
| Settings update body: test was using wrong format | HIGH | 03 Task 2 | Fix test to use flat format |

## Verification Commands

```bash
# Auth tests
cd d:/CodeDevelopment/project/Blog/server && npx vitest run test/api-compat/auth-api-compat.spec.ts

# Settings tests
cd d:/CodeDevelopment/project/Blog/server && npx vitest run test/api-compat/settings-api-compat.spec.ts

# Full API compat suite
cd d:/CodeDevelopment/project/Blog/server && npx vitest run test/api-compat/

# Inventory document check
test -f .planning/phases/12-api-inventory-auth-verification/12-API-INVENTORY.md

# Risk marking document check
test -f .planning/phases/12-api-inventory-auth-verification/12-RISK-MARKING.md
```

---

*Phase 12 plan created: 2026-07-19*
