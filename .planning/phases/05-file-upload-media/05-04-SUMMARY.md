---
plan: 05-04
phase: 05-file-upload-media
status: complete
started: 2026-07-05
completed: 2026-07-05
---

# Plan 05-04 Summary

## What was built

ThumbnailModule (WebP thumbnail generation with sharp, HMAC-SHA256 signed URLs) and DirectLinkModule (direct link CRUD with short-link download).

## Key Files

### Created
- `server/src/thumbnail/thumbnail.service.ts` — ThumbnailService (323 lines): generateThumbnail (sharp WebP 400x400), getThumbnailSign (HMAC-SHA256), serveThumbnailContent, regenerateThumbnail, regenerateThumbnailsForDirectory
- `server/src/thumbnail/thumbnail.controller.ts` — ThumbnailController with regenerate + sign endpoints, ThumbnailPublicController at @Controller('t') for signed content serving
- `server/src/direct-link/direct-link.service.ts` — DirectLinkService (156 lines): createDirectLinks with EntityType.DirectLink=7 per D-107
- `server/src/direct-link/direct-link.controller.ts` — DirectLinkController with CRUD, DirectLinkPublicController at @Controller('f') for short-link download, NeedcacheDownloadController for signed download
- `server/src/direct-link/direct-link.module.ts` — Module with forwardRef for FileModule

### Modified
- `server/src/thumbnail/thumbnail.module.ts` — Registered ThumbnailController and ThumbnailPublicController
- `server/package.json` — Added sharp dependency
- `server/src/common/constants/error-codes.ts` — Added thumbnail and direct link error codes

## Decisions Made

- Thumbnails stored at data/uploads/thumbnails/{publicID}.webp per D-104
- HMAC-SHA256 signing with 15-min expiry per D-105
- getThumbnailSign triggers sync generation if thumbnail missing per D-106
- Direct link publicID uses EntityType.DirectLink=7 (NOT EntityType.File=2) per D-107 — critical pitfall avoided
- Short-link download at /api/f/:publicID/*filename per D-108
- GET /needcache/download/:public_id registered for API compatibility

## Self-Check

- [x] TypeScript compilation passes with zero errors
- [x] ThumbnailModule generates WebP thumbnails correctly
- [x] Direct links use EntityType.DirectLink=7 (not EntityType.File=2)
- [x] HMAC-SHA256 signing works for thumbnail access
- [x] Short-link download with Content-Disposition header
