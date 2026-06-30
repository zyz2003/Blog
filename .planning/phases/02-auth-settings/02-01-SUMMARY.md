---
phase: 02-auth-settings
plan: 01
subsystem: settings
tags: [drizzle, sqlite, in-memory-cache, unflatten, public-private-filtering, ai-masking, cdn-detection, auto-backup]

requires:
  - phase: 01
    provides: Database module, Drizzle schemas, guards, decorators, interceptors, memory-cache util
provides:
  - SettingsService with in-memory cache, unflatten, public/private filtering
  - SettingsController with get-by-keys, update, test-email, site-config endpoints
  - Public setting keys list matching Go IsPublicSetting()
  - Time formatting utility (UTC+8)
  - AI profiles API key masking and preservation
  - CDN cache purge detection
  - Auto-backup before settings update
affects: [auth, captcha, user, app-module]

tech-stack:
  added: [date-fns, date-fns-tz]
  patterns: [global-module-with-cached-service, unflatten-dot-notation-to-nested, public-private-key-filtering]

key-files:
  created:
    - server/src/settings/settings.service.ts
    - server/src/settings/settings.controller.ts
    - server/src/settings/public-setting-keys.ts
    - server/src/settings/dto/get-by-keys-request.dto.ts
    - server/src/settings/dto/update-settings-request.dto.ts
    - server/src/common/utils/time.util.ts
    - server/src/settings/settings.service.spec.ts
    - server/src/settings/settings.controller.spec.ts
  modified:
    - server/src/settings/settings.module.ts

key-decisions:
  - "SettingsModule marked @Global() so AuthService can inject SettingsService without explicit import"
  - "Used Intl.DateTimeFormat with Asia/Shanghai timezone instead of date-fns-tz for simpler time formatting"
  - "AI profiles masking: api_key shows last 4 chars, keys <= 4 chars show ****, has_api_key boolean added"

patterns-established:
  - "Global module pattern: @Global() module exports service for cross-module injection without import"
  - "Unflatten pattern: flat dot-notation keys → nested objects with auto type parsing (JSON > bool > number > string)"
  - "Public/private key filtering: hardcoded Set in public-setting-keys.ts, service checks before returning"

requirements-completed: [SETTING-01, SETTING-02, API-COMPAT-06]

coverage:
  - id: D1
    description: "SettingsService loads all settings into memory cache at startup via onModuleInit"
    requirement: SETTING-01
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 1: should load all settings from database into memory cache"
        status: pass
    human_judgment: false
  - id: D2
    description: "getByKeys returns unflattened objects with auto-parsed types matching Go unflatten()"
    requirement: SETTING-01
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 3: should return unflattened nested objects"
        status: pass
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 4a-4e: auto-parse JSON/bool/number/string"
        status: pass
    human_judgment: false
  - id: D3
    description: "Public/private key filtering: non-admin gets only public keys, admin gets all"
    requirement: SETTING-01
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 5: filter private keys for non-admin"
        status: pass
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 6: return all keys for admin"
        status: pass
    human_judgment: false
  - id: D4
    description: "getSiteConfig returns all public settings unflattened with _config_version"
    requirement: SETTING-02
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 13: return all public settings unflattened with _config_version"
        status: pass
    human_judgment: false
  - id: D5
    description: "getConfigVersion returns millisecond timestamp refreshed on every update"
    requirement: SETTING-02
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 14: return millisecond timestamp"
        status: pass
    human_judgment: false
  - id: D6
    description: "AI profiles masking: api_key masked, has_api_key added, preserve on update"
    requirement: SETTING-01
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 9: mask API keys"
        status: pass
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 10: preserve existing API key when incoming is masked"
        status: pass
    human_judgment: false
  - id: D7
    description: "CDN cache purge detection logs warning on affected key changes"
    requirement: SETTING-01
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 11: log warning when CDN-affected keys change"
        status: pass
    human_judgment: false
  - id: D8
    description: "Auto-backup creates JSON file before every settings update"
    requirement: SETTING-01
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 12: create backup before update"
        status: pass
    human_judgment: false
  - id: D9
    description: "SettingsController endpoints with correct auth levels and response format"
    requirement: API-COMPAT-06
    verification:
      - kind: unit
        ref: "server/src/settings/settings.controller.spec.ts#Tests 1-7: all controller endpoints"
        status: pass
    human_judgment: false
  - id: D10
    description: "formatToChinaTime formats dates in UTC+8 as YYYY-MM-DD HH:mm:ss"
    requirement: SETTING-01
    verification:
      - kind: unit
        ref: "server/src/settings/settings.service.spec.ts#Test 15a-15c: formatToChinaTime"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-06-30
status: complete
---

# Phase 02: Auth & Settings - Plan 01 Summary

**SettingsService with in-memory cache, unflatten, public/private filtering, AI masking, CDN detection, auto-backup, and SettingsController with all endpoints**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-30
- **Completed:** 2026-06-30
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- SettingsService with full in-memory cache lifecycle (startup load, update refresh, config version tracking)
- Unflatten logic replicating Go's dot-notation → nested object conversion with auto type parsing
- Public/private key filtering matching Go's IsPublicSetting() classification
- AI profiles API key masking with last-4-chars visibility and has_api_key boolean
- CDN cache purge detection logging warning on HTML-rendering config changes
- Auto-backup creating JSON snapshot before every settings update
- SettingsController with get-by-keys, update, test-email (501), site-config, config-version endpoints
- formatToChinaTime utility for UTC+8 date formatting

## Task Commits

1. **Task 1: SettingsService with in-memory cache, unflatten, and public/private key classification** - `d3c8331` (test), `b273959` (feat)
2. **Task 2: SettingsController with all settings endpoints and public site config** - included in `b273959` (feat)

## Files Created/Modified
- `server/src/settings/settings.service.ts` - Core service with cache, unflatten, filtering, masking, backup
- `server/src/settings/settings.controller.ts` - REST endpoints for settings CRUD and public config
- `server/src/settings/public-setting-keys.ts` - Hardcoded Set of public config keys
- `server/src/settings/dto/get-by-keys-request.dto.ts` - Request DTO for get-by-keys
- `server/src/settings/dto/update-settings-request.dto.ts` - Request DTO for update
- `server/src/common/utils/time.util.ts` - formatToChinaTime utility
- `server/src/settings/settings.module.ts` - @Global() module exporting SettingsService
- `server/src/settings/settings.service.spec.ts` - 31 unit tests
- `server/src/settings/settings.controller.spec.ts` - 7 unit tests

## Decisions Made
- SettingsModule marked @Global() so AuthService can inject SettingsService without explicit import
- Used Intl.DateTimeFormat with Asia/Shanghai timezone for time formatting (simpler than date-fns-tz)
- AI profiles masking: api_key shows last 4 chars for keys > 4 chars, **** for short keys

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SettingsService ready for AuthService/TokenService to call get('JWT_SECRET')
- Public site config endpoint ready for frontend consumption
- SettingsModule is @Global() so downstream modules can inject without import

---
*Phase: 02-auth-settings*
*Completed: 2026-06-30*
