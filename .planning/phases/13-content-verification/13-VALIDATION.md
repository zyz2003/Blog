---
phase: 13
slug: content-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-19
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (supertest for HTTP) |
| **Config file** | server/vitest.config.ts |
| **Quick run command** | `npx vitest run server/test/phase13-verification/ --reporter=verbose` |
| **Full suite command** | `npx vitest run server/test/phase13-verification/ --reporter=verbose` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/test/phase13-verification/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run server/test/phase13-verification/ --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-T1 | 01 | 1 | CCP-1, ARTICLE-01..03 | — | N/A | integration | `npx vitest run server/test/phase13-verification/article-verification.spec.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-01-T2 | 01 | 1 | CATEGORY-01, TAG-01 | — | N/A | integration | `npx vitest run server/test/phase13-verification/category-verification.spec.ts server/test/phase13-verification/tag-verification.spec.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-02-T1 | 02 | 1 | PAGE-01 | — | N/A | integration | `npx vitest run server/test/phase13-verification/page-verification.spec.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-03-T1 | 03 | 2 | FILE-01..02, THUMB-01, STORAGE-01, LINK-DIRECT-01 | — | N/A | integration | `npx vitest run server/test/phase13-verification/file-verification.spec.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-04-T1 | 04 | 2 | COMMENT-01 | — | N/A | integration | `npx vitest run server/test/phase13-verification/comment-verification.spec.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-05-T1 | 05 | 3 | SEARCH-01 | — | N/A | integration | `npx vitest run server/test/phase13-verification/search-verification.spec.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-06-T1 | 06 | 4 | ALL | — | N/A | regression | `npx vitest run server/test/ --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/test/phase13-verification/` — test directory with stubs
- [ ] `server/test/phase13-verification/article-verification.spec.ts` — stubs for ARTICLE-01..03 + CCP-1 audit
- [ ] `server/test/phase13-verification/category-verification.spec.ts` — stubs for CATEGORY-01
- [ ] `server/test/phase13-verification/tag-verification.spec.ts` — stubs for TAG-01
- [ ] `server/test/phase13-verification/page-verification.spec.ts` — stubs for PAGE-01
- [ ] `server/test/phase13-verification/file-verification.spec.ts` — stubs for FILE-01..02, THUMB-01, STORAGE-01, LINK-DIRECT-01
- [ ] `server/test/phase13-verification/comment-verification.spec.ts` — stubs for COMMENT-01
- [ ] `server/test/phase13-verification/search-verification.spec.ts` — stubs for SEARCH-01

*Existing infrastructure (server/test/helpers/) covers shared fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
