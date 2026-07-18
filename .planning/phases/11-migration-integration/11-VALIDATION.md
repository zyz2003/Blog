# Phase 11: Validation Architecture

**Phase:** 11-Migration & Integration
**Created:** 2026-07-16

## Validation Strategy

Phase 11 has two distinct deliverables, each with its own validation approach:

### 1. Migration CLI Tool Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| CLI starts and shows help | `npx tsx scripts/migrate.ts --help` | Usage text displayed, exit code 0 |
| Timestamp conversion correct | Unit test with known pairs | `"2025-07-13T23:40:12Z"` → `1752450012`, null → null, integer passthrough |
| Migration completes on test data | Run with test source .db | Exit code 0, no errors |
| Row count parity | Post-migration verification | All 33 tables: source count = target count |
| Critical values preserved | Spot-check settings table | id_seed: exact match, JWT_SECRET: exact match |
| FK integrity | `PRAGMA foreign_key_check` | No violations |
| Auto-backup works | Run migration with existing target | Backup file created before write |
| Rollback on failure | Introduce deliberate error | Backup restored, exit code 1 |

### 2. API Compat Test Suite Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Test infrastructure compiles | Import helpers in test file | No TypeScript errors |
| TestContext interface correct | All test files use createTestApp() | Consistent return type across all files |
| Each module test file passes | `npx vitest run {file}` | Exit code 0 per file |
| Full test suite passes | `npx vitest run server/test/api-compat/` | Exit code 0, 0 failures |
| Response wrapper format | assertSuccessResponse on every endpoint | `{ code, data, message }` present |
| Error response format | assertErrorResponse on auth failures | `{ code, message, data: null }` |
| Paginated list format | assertPaginatedResponse on list endpoints | `{ list, total, pageNum/page, pageSize }` |
| Multipart upload works | uploadFile helper in file/article tests | File upload returns success response |

### 3. Integration Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| NestJS starts on port 8091 | `npm run dev` in server/ | No startup errors, listening on 8091 |
| Frontend connects | `npm run dev` in root | Frontend loads, no console errors |
| Login works | Manual or automated test | Admin can log in with migrated credentials |
| Article list loads | Frontend navigation | Articles display correctly |
| Migration + NestJS combo | Migrate real data → start NestJS | All features work with migrated data |

## Endpoint Coverage Tracking

Total documented endpoints: ~130+ (from RESEARCH.md Section 2)

| Module | Test File | Endpoints | Status |
|--------|-----------|-----------|--------|
| Auth | auth-api-compat.spec.ts | 7 | Plan 11-02 |
| Settings | settings-api-compat.spec.ts | 5 | Plan 11-02 |
| Version | version-api-compat.spec.ts | 2 | Plan 11-02 |
| User | user-api-compat.spec.ts | 11 | Plan 11-02 |
| Article | article-api-compat.spec.ts | 17 | Plan 11-02 |
| Page | page-api-compat.spec.ts | 7 | Plan 11-02 |
| Post Category | post-category-api-compat.spec.ts | 4 | Plan 11-03 |
| Post Tag | post-tag-api-compat.spec.ts | 4 | Plan 11-03 |
| Comment | comment-api-compat.spec.ts | 16 | Plan 11-03 |
| Search | search-api-compat.spec.ts | 1 | Plan 11-03 |
| Doc Series | doc-series-api-compat.spec.ts | 8 | Plan 11-03 |
| Article History | article-history-api-compat.spec.ts | 5 | Plan 11-03 |
| File | file-api-compat.spec.ts | 19 | Plan 11-03 |
| Storage Policy | storage-policy-api-compat.spec.ts | 7 | Plan 11-03 |
| Thumbnail | thumbnail-api-compat.spec.ts | 4 | Plan 11-03 |
| Direct Link | direct-link-api-compat.spec.ts | 2 | Plan 11-03 |
| Statistics | statistics-api-compat.spec.ts | 7 | Plan 11-04 |
| Link | link-api-compat.spec.ts | 25 | Plan 11-04 |
| Album | album-api-compat.spec.ts | 11 | Plan 11-04 |
| Album Category | album-category-api-compat.spec.ts | 5 | Plan 11-04 |
| RSS | rss-api-compat.spec.ts | 3 | Plan 11-04 |
| Sitemap | sitemap-api-compat.spec.ts | 2 | Plan 11-04 |
| Music | music-api-compat.spec.ts | 2 | Plan 11-04 |
| Notification | notification-api-compat.spec.ts | 4 | Plan 11-04 |
| Subscriber | subscriber-api-compat.spec.ts | 4 | Plan 11-04 |
| Backup | backup-api-compat.spec.ts | 7 | Plan 11-05 |
| Captcha | captcha-api-compat.spec.ts | 2 | Plan 11-05 |
| Weather | weather-api-compat.spec.ts | 1 | Plan 11-05 |
| Proxy/Download | proxy-api-compat.spec.ts | 2 | Plan 11-05 |
| **Total** | **29 test files** | **~190** | |

## Known Limitations

1. **Theme/SSR Theme endpoints** — Not tested (Go backend has theme management but NestJS doesn't implement it — frontend theme system is separate)
2. **OneDrive endpoints** — Storage policy OneDrive connect/authorize not tested (cloud storage deferred per D-99)
3. **Rate limiting** — Only verified that rate-limited endpoints exist and return proper format; actual rate limit behavior not tested (would require rapid sequential requests)
4. **Data values** — Per D-305, only response shapes are verified, not specific data values
