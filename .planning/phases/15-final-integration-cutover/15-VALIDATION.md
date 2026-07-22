---
phase: 15
slug: final-integration-cutover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 |
| **Config file** | server/vitest.config.ts |
| **Quick run command** | `cd server && npx vitest run test/phase15-verification/` |
| **Full suite command** | `cd server && npx vitest run test/phase13-verification test/phase14-verification test/api-compat test/phase15-verification` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npx vitest run test/phase15-verification/`
- **After every plan wave:** Run `cd server && npx vitest run test/phase13-verification test/phase14-verification test/api-compat test/phase15-verification`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | VERIFY-05 | — | N/A | integration | `cd server && npx vitest run test/phase13-verification test/phase14-verification test/api-compat` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | VERIFY-05 | — | N/A | fix | `cd server && npx vitest run test/phase13-verification/category-verification.spec.ts` | ✅ | ⬜ pending |
| 15-01-03 | 01 | 1 | VERIFY-05 | — | N/A | fix | `cd server && npx vitest run test/api-compat/comment-api-compat.spec.ts` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | VERIFY-05 | — | N/A | integration | `cd server && npx vitest run test/phase15-verification/` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 3 | INTEGRATION-01 | — | N/A | manual | Browser walkthrough | N/A | ⬜ pending |
| 15-04-01 | 04 | 4 | MIGRATION-01 | — | N/A | manual | `cd server && npm run migrate -- --source X --target Y` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/test/phase15-verification/` — directory for cross-module integration tests
- [ ] `server/test/phase15-verification/cross-module-integration.spec.ts` — cross-module test file

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser critical path walkthrough | VERIFY-05 | D-323: manual DevTools Console recording | Start frontend+backend, open DevTools Console, walk critical paths, record red errors |
| Migration tool verification | MIGRATION-01 | Requires Go SQLite DB source file | Run `npm run migrate -- --source <path> --target <path>`, verify output |
| Deployment README accuracy | — | Human judgment on clarity and completeness | Follow README steps from scratch, verify they work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
