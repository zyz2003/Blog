---
phase: 09-seo-music-notifications
plan: 04
subsystem: api
tags: [music, metings-api, proxy, caching, nestjs, https, ssl-bypass]

requires:
  - phase: 01-infrastructure
    provides: MemoryCache, CommonModule, SettingsModule, @Public() decorator, ResponseInterceptor
  - phase: 02-auth-settings
    provides: SettingsService with dynamic config reading

provides:
  - MusicService with fetchPlaylist (metings API proxy + 5min cache) and fetchSongResources (quality fallback exhigh→standard)
  - MusicController with GET /api/public/music/playlist and POST /api/public/music/song-resources
  - GetSongResourcesDto with neteaseId validation
  - Music error codes in error-codes.ts

affects: [music, api-compatibility]

tech-stack:
  added: []
  patterns: [node-https-with-ssl-bypass, form-urlencoded-post-proxy, quality-fallback-pattern]

key-files:
  created:
    - server/src/music/music.service.ts
    - server/src/music/music.controller.ts
    - server/src/music/dto/get-song-resources.dto.ts
  modified:
    - server/src/music/music.module.ts
    - server/src/common/constants/error-codes.ts

key-decisions:
  - "Used Node.js built-in https module instead of axios (not in package.json) with custom Agent for rejectUnauthorized:false per D-210"
  - "Playlist cached for 5 minutes in MemoryCache per D-211; song resources NOT cached (audio URLs are time-limited)"
  - "Image URL optimization methods implemented for completeness but NOT called from fetchPlaylist (matches Go handler behavior)"

patterns-established:
  - "HTTP proxy pattern: Node.js https module with rejectUnauthorized:false for external APIs with unknown CA certificates"
  - "Quality fallback pattern: try exhigh first, fallback to standard on failure or empty audioUrl"

requirements-completed: [MUSIC-01]

coverage:
  - id: D1
    description: "MusicService with fetchPlaylist (metings API proxy + 5min MemoryCache), fetchSongResources (quality fallback exhigh→standard), fetchSongV1 (form-urlencoded POST), NeteaseID validation, image URL optimization methods, structured logging"
    requirement: MUSIC-01
    verification:
      - kind: unit
        ref: "TypeScript compilation passes (npx tsc --noEmit)"
        status: pass
    human_judgment: true
    rationale: "External metings API not reachable in test environment; playlist and song-resources endpoints require live API to verify end-to-end"
  - id: D2
    description: "MusicController with GET /api/public/music/playlist and POST /api/public/music/song-resources, both @Public()"
    requirement: MUSIC-01
    verification:
      - kind: unit
        ref: "TypeScript compilation passes (npx tsc --noEmit)"
        status: pass
    human_judgment: true
    rationale: "Controller endpoints proxy to external API; need live verification to confirm response format matches Go backend"

duration: 11min
completed: 2026-07-14
status: complete
---

# Phase 09 Plan 04: Music Module Summary

**Music API proxy with metings.qjqq.cn, playlist caching, quality fallback exhigh→standard, and Node.js https with SSL bypass**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-14T11:31:41Z
- **Completed:** 2026-07-14T11:42:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- MusicService with fetchPlaylist proxying to metings API with 5-minute MemoryCache (per D-211)
- fetchSongResources with quality fallback: exhigh first, standard on failure (per D-209)
- fetchSongV1 with exact Go headers and form-urlencoded POST body
- NeteaseID validation with regex ^\d{6,12}$ preventing URL injection (per D-209, T-09-08 mitigation)
- Image URL optimization methods (upgradePicSize, constructHighQualityURL) implemented but not called from fetchPlaylist (matches Go handler)
- Structured logging per D-212 (request/response/error/JSON structure/performance metrics)
- HTTP client using Node.js built-in https with rejectUnauthorized:false (per D-210)
- MusicController with GET /api/public/music/playlist and POST /api/public/music/song-resources, both @Public()
- GetSongResourcesDto with class-validator (IsString + IsNotEmpty)
- MusicModule wired with CommonModule (MemoryCache) and SettingsModule
- Music error codes added: MUSIC_INVALID_NETEASE_ID, MUSIC_SONG_RESOURCE_FAILED, MUSIC_PLAYLIST_FETCH_FAILED

## Task Commits

Each task was committed atomically:

1. **Task 1: MusicService with playlist fetching, song resources, quality fallback, and caching** - `aca5dc9` (feat)
2. **Task 2: MusicController with playlist and song-resources endpoints + MusicModule wiring** - `6b90a13` (feat)

## Files Created/Modified
- `server/src/music/music.service.ts` - MusicService with fetchPlaylist, fetchSongResources, fetchSongV1, validation helpers, image URL optimization, structured logging, Node.js https client
- `server/src/music/music.controller.ts` - MusicController with GET /playlist and POST /song-resources, both @Public()
- `server/src/music/music.module.ts` - MusicModule wired with CommonModule and SettingsModule
- `server/src/music/dto/get-song-resources.dto.ts` - GetSongResourcesDto with neteaseId validation
- `server/src/common/constants/error-codes.ts` - Added MUSIC_INVALID_NETEASE_ID, MUSIC_SONG_RESOURCE_FAILED, MUSIC_PLAYLIST_FETCH_FAILED

## Decisions Made
- Used Node.js built-in https module instead of axios (not in package.json) with custom Agent for rejectUnauthorized:false per D-210
- Playlist cached for 5 minutes in MemoryCache per D-211; song resources NOT cached (audio URLs are time-limited)
- Image URL optimization methods implemented for completeness but NOT called from fetchPlaylist (matches Go handler behavior where GetPlaylist only calls FetchPlaylist, not optimizePicUrlsWithTimeout)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Music module complete and ready for frontend integration
- Both endpoints are @Public() and return data in the standard { code, data, message } format via ResponseInterceptor
- External metings.qjqq.cn API must be reachable for endpoints to work (no fallback for unreachable API)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 09-seo-music-notifications*
*Completed: 2026-07-14*
