# Deployment Guide — anheyu-app NestJS Backend

## 1. Prerequisites

- **Node.js** v22+ — verify with `node --version`
- **npm** v10+ — verify with `npm --version`

## 2. Quick Start

```bash
# Install backend dependencies
cd server && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Start backend (port 8091)
cd ../server && npm run dev

# In a new terminal, start frontend (port 3000)
cd frontend && npm run dev
```

Open http://localhost:3000 in your browser. The frontend proxies all `/api/*` requests to the backend on port 8091.

## 3. Database

- **Location:** `server/data/anheyu.db` (auto-created on first startup)
- **Engine:** SQLite with WAL mode (concurrent reads, serialized writes)
- **Configuration:** `busy_timeout=5000`, `foreign_keys=ON`
- **Schema:** Applied via `drizzle-kit push` (run once after fresh install):

```bash
cd server && npx drizzle-kit push --force
```

- **Default settings:** 334 settings auto-seeded from Go `definition.go` on first startup
- **Default admin user:** email=`admin@test.com`, password=`password123`

## 4. Environment Variables

No `.env` file is required for local development. All configuration is stored in the database.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8091` | Backend HTTP port (matches Go backend, frontend expects this) |
| `DB_PATH` | `data/anheyu.db` | SQLite database file path (relative to `server/` directory) |
| `NODE_TLS_REJECT_UNAUTHORIZED` | — | Set to `0` to bypass SSL verification for music proxy (matches Go `InsecureSkipVerify`) |

**JWT_SECRET** is auto-generated and stored in the database `settings` table on first startup — not in a `.env` file. This matches the Go backend behavior where the secret is persisted in the database.

## 5. Data Migration (from Go Backend)

The migration tool transfers data from a Go backend SQLite database to the NestJS backend database.

**Prerequisites:** An existing Go backend SQLite database file.

```bash
# Run migration (with auto-backup and post-migration verification)
cd server && npm run migrate -- --source /path/to/go-backend.db --target ./data/anheyu.db

# Dry run (preview changes without writing)
cd server && npm run migrate:dry-run -- --source /path/to/go-backend.db --target ./data/anheyu.db
```

**Options:**

| Flag | Description |
|------|-------------|
| `--source <path>` | Source Go SQLite `.db` file (required) |
| `--target <path>` | Target NestJS SQLite `.db` file (required) |
| `--skip-backup` | Skip auto-backup of target DB |
| `--skip-verify` | Skip post-migration verification |
| `--verbose` | Verbose logging |

**Migration handles:**
- FK dependency ordering (correct insert sequence)
- Timestamp conversion (Go RFC3339 → JS ISO 8601)
- Table/column name mapping (Go schema → NestJS schema differences)
- Post-migration verification (row counts, data integrity)

**Note:** Migration is optional. You can start from an empty database — the app auto-seeds default settings and creates the admin user on first startup.

## 6. Build for Production

```bash
# Build backend
cd server && npm run build

# Start production backend
cd server && npm run start:prod

# Build frontend
cd frontend && npm run build

# Start production frontend
cd frontend && npm start
```

## 7. 501 Endpoints (Not Yet Implemented)

The following endpoints return `501 NOT_IMPLEMENTED` — the frontend handles these gracefully:

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | User registration |
| `POST /api/auth/activate` | Account activation |
| `POST /api/auth/forgot-password` | Password reset request |
| `POST /api/auth/reset-password` | Password reset confirmation |
| `GET /api/auth/check-email` | Email availability check |
| `POST /api/settings/test-email` | Email configuration test |
| `POST /api/files/onedrive/upload` | OneDrive file upload |
| `POST /api/files/onedrive/download` | OneDrive file download |
| `POST /api/config/export` | Configuration export |
| `POST /api/config/import` | Configuration import |
| `GET /api/proxy/download` | Proxy download |

## 8. Running Tests

```bash
# Push schema to test DB (required before first test run)
cd server && npx drizzle-kit push --force

# Run all verification tests (sequential for DB isolation)
cd server && npx vitest run test/phase13-verification/ --no-file-parallelism
cd server && npx vitest run test/phase14-verification/ --no-file-parallelism
cd server && npx vitest run test/api-compat/ --no-file-parallelism
cd server && npx vitest run test/phase15-verification/

# Run single test file
cd server && npx vitest run test/api-compat/auth-api-compat.spec.ts
```
