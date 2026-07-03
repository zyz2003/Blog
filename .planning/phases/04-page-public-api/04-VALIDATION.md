---
phase: 04
slug: page-public-api
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | server/vitest.config.ts |
| **Quick run command** | `cd server && npx vitest run --reporter=verbose 2>&1 \| head -50` |
| **Full suite command** | `cd server && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npx vitest run --reporter=verbose 2>&1 | head -50`
- **After every plan wave:** Run `cd server && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PAGE-01 | — | PageRepository CRUD with soft-delete | unit | `cd server && npx vitest run test/page/page.repository.spec.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | PAGE-01 | — | PageService with path validation, script splitting | unit | `cd server && npx vitest run test/page/page.service.spec.ts` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | VERSION-01 | — | Version endpoints, no-cache headers, @Res() bypass | unit | `cd server && npx vitest run test/version/version.controller.spec.ts` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | PAGE-01 | — | PageController admin CRUD | type | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 2 | PUBLIC-01 | — | PublicPageController wildcard path | type | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-04-01 | 04 | 3 | PAGE-01, PUBLIC-01, VERSION-01 | — | AppModule wiring | type | `cd server && npx tsc --noEmit` | ✅ | ⬜ pending |
| 04-04-02 | 04 | 3 | PAGE-01, PUBLIC-01 | — | Controller tests, full suite | unit | `cd server && npx vitest run test/page/ test/version/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `server/test/helpers/page-fixtures.ts` — test mock factories (created in Plan 04-01)
- [x] `server/test/page/page.repository.spec.ts` — stubs for PAGE-01 (created in Plan 04-01)
- [x] `server/test/page/page.service.spec.ts` — stubs for PAGE-01 (created in Plan 04-01)
- [x] `server/test/version/version.controller.spec.ts` — stubs for VERSION-01 (created in Plan 04-02)
- Existing test infrastructure covers Vitest framework, Drizzle test setup, and NestJS testing utilities

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /api/version/string returns raw JSON without wrapper | VERSION-01 | Requires observing raw HTTP response | `curl -i http://localhost:8091/api/version/string` — verify no `{ code, data, message }` wrapper |
| No-cache headers on version endpoints | VERSION-01 | HTTP header inspection | `curl -I http://localhost:8091/api/version` — verify Cache-Control, Pragma, Expires headers |
| Public page wildcard path matching | PAGE-01 | Requires running server + path routing | `curl http://localhost:8091/api/public/pages/privacy` and `curl http://localhost:8091/api/public/pages/docs/guide` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-03
