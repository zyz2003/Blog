---
phase: "01"
slug: infrastructure
created: "2026-06-28"
---

# Phase 01: Infrastructure - Validation Strategy

## Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @nestjs/testing |
| Quick run | `npx vitest run --reporter=verbose` |
| Full suite | `npx vitest run` |

## Requirements -> Test Map
| Req ID | Behavior | Test Type | Command | File |
|--------|----------|-----------|---------|------|
| INFRA-01 | Server on port 8091 | integration | vitest -t "bootstrap" | app.e2e-spec.ts |
| INFRA-02 | SQLite in data/ | integration | vitest -t "database connection" | database.spec.ts |
| INFRA-03 | WAL + busy_timeout | integration | vitest -t "sqlite pragmas" | database.spec.ts |
| INFRA-04 | npm run dev starts | smoke | manual | -- |
| INFRA-05 | drizzle-kit push | integration | npx drizzle-kit push | -- |
| INFRA-06 | 30 schemas defined | unit | vitest -t "schema count" | schemas.spec.ts |
| API-COMPAT-01 | Route prefix /api | unit | vitest -t "route prefix" | app.e2e-spec.ts |
| API-COMPAT-02 | Response { code, data, message } | unit | vitest -t "response interceptor" | response-interceptor.spec.ts |
| API-COMPAT-04 | JWT claims structure | unit | vitest -t "jwt claims" | guards.spec.ts |
| API-COMPAT-05 | Pagination format | deferred | Phase 03+ | -- |

## Sampling Rate
- Per task: `npx vitest run --reporter=verbose`
- Per wave: `npx vitest run`
- Phase gate: Full suite green
