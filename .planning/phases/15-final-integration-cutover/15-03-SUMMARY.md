---
phase: 15-final-integration-cutover
plan: 03
subsystem: deployment
tags: [browser-walkthrough, deployment, migration]

# Dependency graph
requires:
  - phase: 15-02
    provides: Full regression suite passing (566 tests)
provides:
  - Browser critical path walkthrough results
  - DEPLOYMENT.md documentation
  - Migration tool verification
affects: [15-final-integration-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DEPLOYMENT.md as single source of truth for startup, migration, and configuration"

---

## Plan 15-03: Browser Walkthrough + Deployment Docs + Migration Tool

### What was built

1. **Browser critical path walkthrough completed** — 5 critical paths walked with DevTools Console open
2. **DEPLOYMENT.md** written at project root with 8 sections covering all deployment needs
3. **Migration tool verified** — `npm run migrate -- --help` outputs usage, graceful error on missing source file

### Browser Walkthrough Results

| Critical Path | Red Console Errors | Classification |
|---|---|---|
| 1. Homepage browse | None | ✓ Pass |
| 2. Article detail | 1 API error (qq-info 400) | A — Expected (QQ API not configured) |
| 3. Admin login | None | ✓ Pass |
| 4. Article CRUD | None | ✓ Pass |
| 5. Settings modification | None | ✓ Pass |

**Non-error console messages:**
- PostDetailContent.tsx position warning — frontend UI library warning, harmless
- CSS preload warnings — Next.js resource hints, harmless

**qq-info 400 analysis:** The `GET /api/public/comments/qq-info?qq=2163447956` returns 400 because `comment_qq_api_url` and `comment_qq_api_key` settings are empty (not configured). This matches Go backend behavior — the Go handler also returns an error when QQ API is not configured. The frontend handles this gracefully with a fallback. This is NOT a NestJS bug.

### DEPLOYMENT.md Sections

1. Prerequisites (Node.js v22+, npm v10+)
2. Quick Start (npm run dev for both server and frontend)
3. Database (SQLite auto-created, WAL mode, drizzle-kit push for schema)
4. Environment Variables (PORT, DB_PATH, JWT_SECRET in DB not .env)
5. Data Migration (npm run migrate with --source/--target, dry-run option)
6. Build for Production (npm run build + npm run start:prod)
7. 501 Endpoints (11 unimplemented endpoints listed)
8. Running Tests (drizzle-kit push + vitest with --no-file-parallelism)

### Migration Tool Verification

- `npm run migrate -- --help` → outputs usage with all options
- `npm run migrate:dry-run -- --source ./data/nonexistent.db --target ./data/test-migrate.db` → "Error: Source file does not exist: ./data/nonexistent.db" (graceful error)

### key-files

created:
  - DEPLOYMENT.md
