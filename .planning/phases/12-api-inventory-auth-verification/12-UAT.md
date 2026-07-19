---
status: testing
phase: 12-api-inventory-auth-verification
source: 12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md
started: 2026-07-19T17:00:00+08:00
updated: 2026-07-19T17:00:00+08:00
---

## Current Test

number: 1
name: Auth API compat tests pass
expected: |
  Running `cd server && npx vitest run test/api-compat/auth-api-compat.spec.ts` shows all 16 tests pass. Tests cover: login field-by-field verification (13 userInfo fields + 4 top-level fields), token refresh dual-channel (header + body + no token), captcha flow (structure + behavior), and 5 unimplemented endpoints returning 501 format.
awaiting: user response

## Tests

### 1. Auth API compat tests pass
expected: All 16 auth API compat tests pass — login field-by-field, token refresh dual-channel, captcha flow e2e, 5 unimplemented endpoints 501 format
result: pending

### 2. Settings API compat tests pass
expected: All 20 settings API compat tests pass — get-by-keys unflatten, non-admin filtering, flat key-value update, site-config completeness (200+ keys, no private keys), test-email 501, config-version
result: pending

### 3. Private keys no longer exposed in site-config
expected: GET /api/public/site-config (without auth) does NOT contain any of: JWT_SECRET, id_seed, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT, SMTP_USERNAME, CDN secret_key, turnstile.secret_key, geetest.captcha_key. Previously 57 private keys were incorrectly exposed.
result: pending

### 4. API Inventory document is complete
expected: 12-API-INVENTORY.md contains 188 endpoints across 19 module tables, with Supplementary Scan section and Cross-Reference Gap Summary showing 155 IMPLEMENTED, 8 x 501, 22 MISSING
result: pending

### 5. Risk Marking document is complete
expected: 12-RISK-MARKING.md has risk levels for all 188 endpoints (HIGH 25, MEDIUM 72, LOW 18, NONE 69), with Prioritized Risk Summary for Phases 13-15
result: pending

### 6. Known compatibility gaps documented
expected: Test file auth-api-compat.spec.ts has Known Compatibility Gaps comment documenting: (1) expires format Go=number/NestJS=string (NONE risk), (2) 5 auth 501 endpoints (HIGH risk), (3) created_at/updated_at nullability (MEDIUM risk)
result: pending

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

[none yet]
