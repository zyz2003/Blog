---
phase: 12-api-inventory-auth-verification
plan: 03
subsystem: settings
tags: [test, api-compat, security, settings, unflatten, non-admin]
dependency_graph:
  requires: [12-01]
  provides: [settings-api-compat-tests]
  affects: [public-setting-keys]
tech_stack:
  added: []
  patterns: [recursive-private-key-scan, unflatten-verification, non-admin-jwt]
key_files:
  created: []
  modified:
    - server/test/api-compat/settings-api-compat.spec.ts
    - server/src/settings/public-setting-keys.ts
decisions:
  - D-278: Removed 57 private keys from PUBLIC_SETTING_KEYS that were incorrectly exposed (Go IsPublic: false but NestJS had them as public)
  - D-279: Settings update test uses flat key-value format matching Go handler, not wrapped { settings: {...} } format
metrics:
  duration: 27m
  completed: "2026-07-19"
  tasks: 3
  files: 2
  tests_added: 12
  tests_total: 20
status: complete
---

# Phase 12 Plan 03: Settings Verification Summary

Enhanced settings API compatibility tests with unflatten verification, flat key-value update format, non-admin filtering, site-config completeness, and 501 format for test-email. Also fixed critical security bug in public-setting-keys.ts.

## What Was Done

### Task 1: Verify get-by-keys unflatten behavior and non-admin filtering

Added 5 new tests to the get-by-keys describe block:
- **Unflatten verification**: Requesting dotted key "captcha.provider" returns nested `{ captcha: { provider: "none" } }`, not flat `{ "captcha.provider": "none" }`. Verified top-level keys do not contain dotted keys.
- **Non-admin filtering**: Generated non-admin JWT token (user_group_id=2) and verified private keys (JWT_SECRET, id_seed) are excluded from response.
- **Non-admin public key access**: Verified non-admin can still access public keys (APP_NAME, GRAVATAR_URL).
- **Mixed public/private for non-admin**: Requesting both public and private keys as non-admin returns only public values.
- **Value type parsing**: Verified response data is an object (not array) and string values are strings.

### Task 2: Verify update endpoint accepts flat key-value pairs and site-config completeness

- **Update format fix**: Changed update test from wrapped `{ settings: { APP_NAME: ... } }` to flat `{ APP_NAME: ... }` format matching Go handler and frontend.
- **Persistence verification**: After update, read back via get-by-keys to confirm change was persisted.
- **Empty body test**: Sending `{}` to update endpoint returns 400.
- **Site-config completeness**: Added 5 new tests verifying:
  - `_config_version` is a number type and positive
  - Response is properly unflattened (contains nested objects)
  - No private keys at any nesting level (recursive scan)
  - Known public key APP_NAME exists
  - At least 200 public keys present (quantitative check)

### Task 3: Verify test-email 501 format and config-version endpoint details

- **test-email 501 format**: Enhanced to verify exact format: HTTP 501, body.code=501, body.message is non-empty string, body.data is null.
- **config-version details**: Verified version is a positive number, greater than 1000000000000 (year 2001 in UnixMilli), and less than 32503680000000 (year 3000).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Fixed 57 private keys incorrectly exposed in PUBLIC_SETTING_KEYS**
- **Found during:** Task 1 (existing test "does NOT contain private keys" was failing)
- **Issue:** PUBLIC_SETTING_KEYS contained 57 keys that have IsPublic: false in Go definition.go, including JWT_SECRET, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_SENDER_NAME, SMTP_SENDER_EMAIL, SMTP_REPLY_TO_EMAIL, SMTP_FORCE_SSL, LOCAL_FILE_SIGNING_SECRET, CDN secrets (cdn.secret_key, cdn.base_url, cdn.domain, cdn.region, cdn.zone_id), API tokens (IP_API, IP_API_TOKEN, comment.qq_api_key), captcha secret keys (turnstile.secret_key, geetest.captcha_key), wechat.share.app_secret, pushoo config, webhook config, sc.mail_notify, queue/image-cache internals, email templates, and more.
- **Fix**: Removed all 57 private keys from PUBLIC_SETTING_KEYS, reducing from 310 to 249 keys. Added security documentation comment to the file.
- **Files modified**: server/src/settings/public-setting-keys.ts
- **Commit**: 8760a17

**2. [Rule 1 - Bug] Fixed existing failing test for site-config private key check**
- **Found during**: Task 1 baseline test run
- **Issue**: The existing test only checked top-level Object.keys() for private keys, but the response is unflattened so JWT_SECRET (which has no dots) appears as a top-level key. The test was failing because JWT_SECRET was incorrectly in PUBLIC_SETTING_KEYS.
- **Fix**: After removing JWT_SECRET from PUBLIC_SETTING_KEYS, the test passes. Also enhanced the test to use recursive hasPrivateKey() function for thorough checking.
- **Files modified**: server/test/api-compat/settings-api-compat.spec.ts
- **Commit**: 8760a17

**3. [Rule 1 - Bug] Fixed update test using wrong request format**
- **Found during**: Task 2 implementation
- **Issue**: Existing update test sent `{ settings: { APP_NAME: 'UpdatedTestApp' } }` (wrapped format), but Go handler and frontend both use flat format `{ APP_NAME: 'UpdatedTestApp' }`.
- **Fix**: Changed to flat format matching Go handler.
- **Files modified**: server/test/api-compat/settings-api-compat.spec.ts
- **Commit**: 8760a17

## Test Results

All 20 settings API compat tests pass:
- 8 get-by-keys tests (3 original + 5 new)
- 3 update tests (2 original + 1 new, 1 format-fixed)
- 1 test-email test (enhanced from basic to exact format)
- 6 site-config tests (2 original + 4 new)
- 2 config-version tests (1 original + 1 new)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | server/src/settings/public-setting-keys.ts | 57 private keys (JWT_SECRET, SMTP credentials, CDN secrets, API tokens) were incorrectly exposed in site-config endpoint. Fixed in this plan. |

## Self-Check: PASSED

- FOUND: server/test/api-compat/settings-api-compat.spec.ts
- FOUND: server/src/settings/public-setting-keys.ts
- FOUND: .planning/phases/12-api-inventory-auth-verification/12-03-SUMMARY.md
- FOUND: commit 8760a17
