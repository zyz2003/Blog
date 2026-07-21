---
phase: 14
slug: features-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-20
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | server/vitest.config.ts |
| **Quick run command** | `npx vitest run server/test/phase14-verification/ --reporter=verbose` |
| **Full suite command** | `npx vitest run server/test/phase14-verification/ server/test/api-compat/ --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/test/phase14-verification/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run server/test/phase14-verification/ server/test/api-compat/ --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 14-01-T1 | 01 | 1 | LINK-FRIEND-01 | fix+integration | `npx vitest run server/test/phase14-verification/link-verification.spec.ts` | ⬜ pending |
| 14-01-T2 | 01 | 1 | LINK-FRIEND-01 | integration | `npx vitest run server/test/phase14-verification/link-verification.spec.ts` | ⬜ pending |
| 14-02-T1 | 02 | 1 | ALBUM-01 | fix+integration | `npx vitest run server/test/phase14-verification/album-verification.spec.ts` | ⬜ pending |
| 14-02-T2 | 02 | 1 | ALBUM-01 | integration | `npx vitest run server/test/phase14-verification/album-verification.spec.ts` | ⬜ pending |
| 14-03-T1 | 03 | 2 | DOCSERIES-01 | integration | `npx vitest run server/test/phase14-verification/doc-series-verification.spec.ts` | ⬜ pending |
| 14-03-T2 | 03 | 2 | STATS-01, STATS-02 | integration | `npx vitest run server/test/phase14-verification/statistics-verification.spec.ts` | ⬜ pending |
| 14-04-T1 | 04 | 2 | STORAGE-POLICY, USER-MANAGEMENT | fix+integration | `npx vitest run server/test/phase14-verification/storage-policy-verification.spec.ts` | ⬜ pending |
| 14-04-T2 | 04 | 2 | STORAGE-POLICY, USER-MANAGEMENT | integration | `npx vitest run server/test/phase14-verification/user-management-verification.spec.ts` | ⬜ pending |
| 14-05-T1 | 05 | 3 | MUSIC-01, NOTIF-01, SUBSCRIBER-01 | integration | `npx vitest run server/test/phase14-verification/music-verification.spec.ts` | ⬜ pending |
| 14-05-T2 | 05 | 3 | MUSIC-01, NOTIF-01, SUBSCRIBER-01 | integration | `npx vitest run server/test/phase14-verification/notification-verification.spec.ts` | ⬜ pending |
| 14-06-T1 | 06 | 3 | RSS-01 | integration | `npx vitest run server/test/phase14-verification/seo-verification.spec.ts` | ⬜ pending |
| 14-06-T2 | 06 | 3 | SITEMAP-01 | integration | `npx vitest run server/test/phase14-verification/seo-verification.spec.ts` | ⬜ pending |
| 14-07-T1 | 07 | 4 | CRON-01 | integration | `npx vitest run server/test/phase14-verification/schedule-verification.spec.ts` | ⬜ pending |
| 14-07-T2 | 07 | 4 | ALL (regression) | regression | `npx vitest run server/test/phase14-verification/ server/test/api-compat/` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/test/phase14-verification/link-verification.spec.ts` — stubs for LINK-FRIEND-01
- [ ] `server/test/phase14-verification/album-verification.spec.ts` — stubs for ALBUM-01
- [ ] `server/test/phase14-verification/doc-series-verification.spec.ts` — stubs for DOCSERIES-01
- [ ] `server/test/phase14-verification/statistics-verification.spec.ts` — stubs for STATS-01, STATS-02
- [ ] `server/test/phase14-verification/storage-policy-verification.spec.ts` — stubs
- [ ] `server/test/phase14-verification/user-management-verification.spec.ts` — stubs
- [ ] `server/test/phase14-verification/music-verification.spec.ts` — stubs for MUSIC-01
- [ ] `server/test/phase14-verification/notification-verification.spec.ts` — stubs for NOTIF-01, SUBSCRIBER-01
- [ ] `server/test/phase14-verification/seo-verification.spec.ts` — stubs for RSS-01, SITEMAP-01
- [ ] `server/test/phase14-verification/schedule-verification.spec.ts` — stubs for CRON-01

*Existing infrastructure (server/test/helpers/api-compat-helpers.ts) covers shared fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RSS feed renders in browser | RSS-01 | XML format validation in browser | Navigate to /rss.xml, verify RSS reader can parse |
| Sitemap renders in browser | SITEMAP-01 | XML format validation in browser | Navigate to /sitemap.xml, verify sitemap structure |
| Cron jobs execute on schedule | CRON-01 | Timing-dependent, requires waiting | Check server logs for cron execution messages |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (except final regression gate in Plan 07)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
