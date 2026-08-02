---
phase: quick
plan: 260802-evy
type: execute
wave: 1
depends_on: []
files_modified:
  - server/Dockerfile
  - frontend/Dockerfile
  - docker-compose.yml
  - nginx/nginx.conf
  - nginx/init-letsencrypt.sh
  - server/.dockerignore
  - frontend/.dockerignore
  - ecosystem.config.js
  - deploy/anheyu-backend.service
  - deploy/anheyu-frontend.service
  - deploy/nginx-anheyu.conf
  - deploy/install.sh
  - scripts/build-prod.sh
  - DEPLOYMENT.md
autonomous: true
requirements: [QUICK-260802-EVY]
must_haves:
  truths:
    - "Docker Compose can build and run backend + frontend + nginx with one `docker compose up` command"
    - "PM2 ecosystem.config.js starts both backend (dist/main) and frontend (standalone server.js) processes"
    - "systemd units + install.sh allow one-shot bare-metal deployment on a Linux server"
    - "nginx reverse proxy routes /api/*, /f/*, /static/*, /uploads/*, /needcache/* to backend:8091 and all other paths to frontend:3000"
    - "nginx disables proxy_buffering for /api/ai/* routes so SSE streaming responses are not buffered"
    - "DEPLOYMENT.md no longer claims JWT_SECRET is auto-generated (it is NOT - runtime reads DB settings, default is insecure hardcoded value)"
    - "DEPLOYMENT.md no longer claims timestamps are stored as ISO 8601 (NestJS stores Unix epoch integer seconds)"
    - "DEPLOYMENT.md instructs admin to set a strong random JWT_SECRET in the admin panel after first deploy"
  artifacts:
    - "server/Dockerfile"
    - "frontend/Dockerfile"
    - "docker-compose.yml"
    - "nginx/nginx.conf"
    - "nginx/init-letsencrypt.sh"
    - "server/.dockerignore"
    - "frontend/.dockerignore"
    - "ecosystem.config.js"
    - "deploy/anheyu-backend.service"
    - "deploy/anheyu-frontend.service"
    - "deploy/nginx-anheyu.conf"
    - "deploy/install.sh"
    - "scripts/build-prod.sh"
    - "DEPLOYMENT.md"
  key_links:
    - "docker-compose.yml anheyu service -> server/Dockerfile -> dist/main on port 8091"
    - "docker-compose.yml frontend service -> frontend/Dockerfile -> standalone server.js on port 3000"
    - "docker-compose.yml nginx service -> nginx/nginx.conf -> anheyu:8091 + frontend:3000 upstreams"
    - "ecosystem.config.js -> server dist/main + frontend .next/standalone/server.js"
    - "deploy/install.sh -> scripts/build-prod.sh -> deploy/anheyu-backend.service + deploy/anheyu-frontend.service"
    - "deploy/nginx-anheyu.conf -> localhost:8091 + localhost:3000 upstreams (bare-metal)"
---

<objective>
Produce complete deployment infrastructure for anheyu-app: three deployment methods (Docker Compose primary, PM2, systemd+Nginx), Nginx reverse proxy with HTTPS, and a fully rewritten DEPLOYMENT.md that fixes two documented inaccuracies (JWT_SECRET "auto-generated" claim and timestamp "ISO 8601" claim).

Purpose: The project currently has no deployment artifacts (no Dockerfiles, no compose, no PM2/systemd configs) and the existing DEPLOYMENT.md contains two factually wrong statements about JWT_SECRET and timestamp storage that could mislead operators into insecure or broken deployments.

Output: 14 files covering Docker Compose (6 files), PM2/systemd/build scripts (6 files), and a rewritten DEPLOYMENT.md (1 file).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.claude/CLAUDE.md
@DEPLOYMENT.md
@server/package.json
@server/src/main.ts
@server/src/config/env.validation.ts
@server/drizzle.config.ts
@frontend/package.json
@frontend/next.config.ts
@scripts/README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Docker Compose artifacts (Dockerfiles + compose + nginx + cert script + dockerignores)</name>
  <files>server/Dockerfile, frontend/Dockerfile, docker-compose.yml, nginx/nginx.conf, nginx/init-letsencrypt.sh, server/.dockerignore, frontend/.dockerignore</files>
  <action>
Create 7 files for the Docker Compose deployment method (the primary method).

**server/Dockerfile** - Multi-stage build for the NestJS backend. Stage 1 ("builder"): use `node:22-slim` base, install python3 make g++ build tools (needed to compile better-sqlite3 native addon for Linux), copy package.json + package-lock.json, run `npm ci`, copy tsconfig.json and nest-cli.json and src/, run `npm run build` (produces dist/). Stage 2 ("runtime"): use `node:22-slim`, copy only package.json + package-lock.json, run `npm ci --omit=dev` to install production deps (this recompiles better-sqlite3 for the runtime image), copy dist/ from builder. Set WORKDIR /app. Create /app/data directory. EXPOSE 8091. Set CMD to `node dist/main`. Set DB_PATH env to absolute `/app/data/blog.db` so SQLite works regardless of CWD. Do NOT run as root - add a non-root user (node) and switch to it, but ensure /app/data is writable by that user.

**frontend/Dockerfile** - Multi-stage build for Next.js standalone. Stage 1 ("deps"): `node:22-slim`, copy package.json + package-lock.json, `npm ci`. Stage 2 ("builder"): copy deps node_modules from stage 1, copy all source, set `NEXT_TELEMETRY_DISABLED=1`, run `npm run build` (produces .next/standalone/). Stage 3 ("runtime"): `node:22-slim`, copy `.next/standalone/` from builder to `/app/`, copy `.next/static/` to `/app/.next/static/`, copy `public/` to `/app/public/` (standalone mode requires static + public alongside server.js). Set WORKDIR /app. EXPOSE 3000. Set ENV `NODE_ENV=production` and `PORT=3000`. CMD `node server.js`. Set ENV `API_URL=http://anheyu:8091` so the Next.js rewrites proxy to the Docker backend service name.

**docker-compose.yml** - Three services. Service "anheyu" (backend): build from server/Dockerfile, container_name anheyu, ports "8091:8091", environment with DB_PATH=/app/data/blog.db, JWT_SECRET set to a placeholder that satisfies Joi validation (note in comment it is unused at runtime), JWT_EXPIRES_IN=15m, JWT_REFRESH_EXPIRES_IN=30d, volume mount `./server/data:/app/data` (persists blog.db + uploads + backups), restart unless-stopped, depends_on nothing. Service "frontend": build from frontend/Dockerfile, container_name anheyu-frontend, ports "3000:3000", environment API_URL=http://anheyu:8091, restart unless-stopped, depends_on anheyu. Service "nginx": image nginx:alpine, ports "80:80" and "443:443", volumes mounting nginx/nginx.conf to /etc/nginx/conf.d/default.conf, cert volume `./nginx/certs:/etc/letsencrypt`, `./nginx/conf:/etc/nginx/conf` (for ACME challenge), restart unless-stopped, depends_on frontend. Define a top-level volumes section if needed. Add comments noting that first-time HTTPS setup requires running nginx/init-letsencrypt.sh.

**nginx/nginx.conf** - Reverse proxy config for Docker Compose. Define upstream blocks: `anheyu_backend` pointing to `anheyu:8091`, `anheyu_frontend` pointing to `frontend:3000`. Server block on port 80 with a location for /.well-known/acme-challenge/ serving from /etc/nginx/conf (for Let's Encrypt). Redirect all other port-80 traffic to HTTPS. Server block on port 443 with ssl_certificate / ssl_certificate_key paths under /etc/letsencrypt/live/. SSL config: use modern protocols TLSv1.2 TLSv1.3, sensible cipher suite. Location routing: `/api/ai/` -> proxy to anheyu_backend with `proxy_buffering off`, `proxy_cache off`, `proxy_set_header X-Accel-Buffering no`, and `chunked_transfer_encoding on` (SSE streaming support). `/api/` -> proxy to anheyu_backend. `/f/` -> proxy to anheyu_backend (rewrite to /api/f/). `/needcache/` -> proxy to anheyu_backend. `/static/` -> proxy to anheyu_backend. `/uploads/` -> proxy to anheyu_backend. `/` (catch-all) -> proxy to anheyu_frontend. All proxy blocks set standard headers: Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto. Set `proxy_http_version 1.1` and `Connection ""` for all upstreams. Set reasonable `client_max_body_size 10m` (matches backend body limit). Add gzip compression for text/css/js/json.

**nginx/init-letsencrypt.sh** - Shell script for first-time Let's Encrypt cert issuance. Steps: check that domain arg is provided, create necessary directories under ./nginx/certs and ./nginx/conf, download certbot, run certbot certonly --webroot with the domain, then output instructions to restart nginx. Make it executable (chmod +x noted in docs). Start with `#!/bin/bash` and `set -e`.

**server/.dockerignore** - Exclude node_modules, dist, .env, data/, .git, test/, *.md, .DS_Store, nest-cli.json can stay (needed for build). Key: do NOT exclude tsconfig.json, nest-cli.json, src/ as they are needed for the build stage.

**frontend/.dockerignore** - Exclude node_modules, .next, .env, .git, *.md, .DS_Store. Do NOT exclude public/, src/, or config files needed for next build.
  </action>
  <verify>
    <automated>cd "D:/CodeDevelopment/project/Blog" && test -f server/Dockerfile && test -f frontend/Dockerfile && test -f docker-compose.yml && test -f nginx/nginx.conf && test -f nginx/init-letsencrypt.sh && test -f server/.dockerignore && test -f frontend/.dockerignore && echo "ALL_FILES_EXIST" && (docker compose config -q 2>/dev/null && echo "COMPOSE_VALID" || echo "DOCKER_NOT_AVAILABLE_SKIP")</automated>
  </verify>
  <done>All 7 Docker Compose artifacts exist on disk. docker-compose.yml parses without syntax errors (if Docker CLI is available). nginx.conf contains proxy_buffering off for AI routes. Both Dockerfiles use multi-stage builds. server/Dockerfile installs build tools for better-sqlite3 native compilation.</done>
</task>

<task type="auto">
  <name>Task 2: PM2 + systemd + build script artifacts</name>
  <files>ecosystem.config.js, deploy/anheyu-backend.service, deploy/anheyu-frontend.service, deploy/nginx-anheyu.conf, deploy/install.sh, scripts/build-prod.sh</files>
  <action>
Create 6 files for the PM2 and systemd/Nginx deployment methods, plus a unified build script.

**ecosystem.config.js** - PM2 ecosystem config exporting an array of two app configs. App 1 "anheyu-backend": cwd set to `./server`, script `dist/main`, instances 1, exec_mode fork, env with NODE_ENV=production, PORT=8091, DB_PATH=./data/blog.db, JWT_SECRET set to a Joi-satisfying placeholder (comment that it is unused at runtime), max_memory_restart 512M, error_file and out_file under `./server/logs/`. App 2 "anheyu-frontend": cwd set to `./frontend`, script `.next/standalone/server.js`, instances 1, exec_mode fork, env with NODE_ENV=production, PORT=3000, API_URL=http://localhost:8091 (bare-metal: frontend proxies to local backend), max_memory_restart 512M, error_file and out_file under `./frontend/logs/`. Add a comment that `scripts/build-prod.sh` must be run first.

**deploy/anheyu-backend.service** - systemd unit. [Unit] Description=anheyu-app NestJS backend, After=network.target. [Service] Type=simple, User=node (or www-data), WorkingDirectory=/opt/anheyu/server, ExecStart=/usr/bin/node /opt/anheyu/server/dist/main, Restart=on-failure, RestartSec=5, Environment=NODE_ENV=production, Environment=PORT=8091, Environment=DB_PATH=/opt/anheyu/server/data/blog.db (absolute path), Environment=JWT_SECRET=change-me-joi-placeholder (comment: unused at runtime, see DEPLOYMENT.md), Environment=JWT_EXPIRES_IN=15m, Environment=JWT_REFRESH_EXPIRES_IN=30d. [Install] WantedBy=multi-user.target.

**deploy/anheyu-frontend.service** - systemd unit. [Unit] Description=anheyu-app Next.js frontend, After=network.target anheyu-backend.service. [Service] Type=simple, User=node (or www-data), WorkingDirectory=/opt/anheyu/frontend, ExecStart=/usr/bin/node /opt/anheyu/frontend/.next/standalone/server.js, Restart=on-failure, RestartSec=5, Environment=NODE_ENV=production, Environment=PORT=3000, Environment=API_URL=http://localhost:8091. [Install] WantedBy=multi-user.target.

**deploy/nginx-anheyu.conf** - Nginx site config for bare-metal deployment (used by both PM2 and systemd methods). Same routing logic as nginx/nginx.conf but upstreams point to `localhost:8091` and `localhost:3000` instead of Docker service names. Include the same SSE proxy_buffering off for /api/ai/*. Include the same HTTPS redirect + Let's Encrypt cert paths (adjust paths for system nginx: /etc/letsencrypt/live/). Include client_max_body_size 10m and gzip. This file gets symlinked to /etc/nginx/sites-available/ and /etc/nginx/sites-enabled/ by install.sh.

**deploy/install.sh** - One-shot installer for bare-metal Linux deployment. Steps: (1) Check Node.js v22+ and npm installed, exit with message if not. (2) Check running as root or sudo, exit if not. (3) Define INSTALL_DIR=/opt/anheyu (configurable via env). (4) Copy project files to INSTALL_DIR (or assume script is run from project root and installs in-place). (5) Run `scripts/build-prod.sh` to build both frontend and backend. (6) Run `cd server && npx drizzle-kit push --force` to push schema to SQLite. (7) Create data directory: `mkdir -p server/data/uploads server/data/backups`. (8) Copy systemd units to /etc/systemd/system/. (9) systemctl daemon-reload, enable + start both services. (10) Copy deploy/nginx-anheyu.conf to /etc/nginx/sites-available/anheyu, symlink to sites-enabled, remove default site. (11) Test nginx config (`nginx -t`), reload nginx. (12) Print success message with URL and reminder to set JWT_SECRET in admin panel. Start with `#!/bin/bash` and `set -e`.

**scripts/build-prod.sh** - Unified production build script for both frontend and backend. Steps: (1) `set -e`, echo progress. (2) cd server, `npm ci`, `npm run build` (produces dist/). (3) cd ../frontend, `npm ci`, `npm run build` (produces .next/standalone/). (4) Copy frontend/.next/static/ to frontend/.next/standalone/.next/static/ if not already there. (5) Copy frontend/public/ to frontend/.next/standalone/public/ if not already there. (6) Echo success. Start with `#!/bin/bash` and `set -e`. This script is called by deploy/install.sh and can also be run standalone for PM2 deployments.
  </action>
  <verify>
    <automated>cd "D:/CodeDevelopment/project/Blog" && test -f ecosystem.config.js && test -f deploy/anheyu-backend.service && test -f deploy/anheyu-frontend.service && test -f deploy/nginx-anheyu.conf && test -f deploy/install.sh && test -f scripts/build-prod.sh && bash -n scripts/build-prod.sh && bash -n deploy/install.sh && bash -n nginx/init-letsencrypt.sh && echo "ALL_FILES_EXIST_AND_SCRIPTS_SYNTAX_VALID"</automated>
  </verify>
  <done>All 6 PM2/systemd/build artifacts exist. Shell scripts (build-prod.sh, install.sh, init-letsencrypt.sh) pass `bash -n` syntax check. ecosystem.config.js exports two app configs. systemd units reference absolute paths. deploy/nginx-anheyu.conf uses localhost upstreams (not Docker service names).</done>
</task>

<task type="auto">
  <name>Task 3: Rewrite DEPLOYMENT.md (3 methods + fix 2 inaccuracies + JWT warning)</name>
  <files>DEPLOYMENT.md</files>
  <action>
Completely rewrite DEPLOYMENT.md (do NOT patch - full rewrite). The document must cover all three deployment methods comprehensively. Structure:

**Section 1: Overview** - Brief intro: anheyu-app is NestJS + Drizzle + SQLite backend with Next.js standalone frontend. Three deployment methods available.

**Section 2: Prerequisites** - Node.js v22+, npm v10+ for bare-metal methods. Docker + Docker Compose for the Docker method. Domain name + DNS A record for HTTPS.

**Section 3: Quick Start (Docker Compose - Primary Method)** - Clone repo, copy .env.example or set env vars, run `docker compose up -d --build`. First run: schema is auto-pushed by the backend on startup OR run `docker compose exec anheyu npx drizzle-kit push --force` manually. Explain that backend auto-seeds 334 settings + admin user on first startup. Frontend accessible at http://localhost (via nginx) or https://your-domain after HTTPS setup. For HTTPS: run `bash nginx/init-letsencrypt.sh your-domain.com` before starting compose, then `docker compose up -d`.

**Section 4: Bare-Metal Deployment (systemd + Nginx)** - Run `sudo bash deploy/install.sh` for one-shot install. Or manual steps: run `scripts/build-prod.sh`, push schema with `cd server && npx drizzle-kit push --force`, copy systemd units, enable services, configure nginx with `deploy/nginx-anheyu.conf`, set up HTTPS with certbot. Frontend runs as standalone Node server on port 3000, backend on 8091, nginx reverse-proxies both.

**Section 5: PM2 Deployment** - Run `scripts/build-prod.sh`, push schema, then `pm2 start ecosystem.config.js`. Save PM2 process list with `pm2 save` and `pm2 startup` for auto-restart. Configure nginx separately using `deploy/nginx-anheyu.conf`.

**Section 6: Nginx Reverse Proxy & HTTPS** - Explain routing: /api/*, /f/*, /static/*, /uploads/*, /needcache/* -> backend:8091, all other paths -> frontend:3000. Note that /api/ai/* has proxy_buffering off for SSE streaming (AI chat responses). HTTPS via Let's Encrypt: use `nginx/init-letsencrypt.sh` for Docker, or `certbot --nginx` for bare-metal. Auto-renewal via certbot systemd timer or cron.

**Section 7: Environment Variables** - Table with PORT (default 8091), DB_PATH (default data/blog.db, MUST be absolute path in containers/systemd), JWT_EXPIRES_IN (default 15m), JWT_REFRESH_EXPIRES_IN (default 30d), NODE_TLS_REJECT_UNAUTHORIZED (set to 0 for music proxy SSL bypass, matches Go InsecureSkipVerify), API_URL (frontend -> backend URL, default http://anheyu:8091 in Docker, http://localhost:8091 bare-metal).

**Section 8: JWT_SECRET - CRITICAL SECURITY WARNING** - This section replaces the FALSE claim on the old line 50. State clearly: (a) The env var JWT_SECRET is marked `required` by Joi validation - the app will NOT start without a value in .env. (b) HOWEVER, this env value is NEVER used at runtime for signing JWTs. The runtime reads `settingsService.get('JWT_SECRET')` from the database settings table. (c) On first startup, the DB settings table is seeded with JWT_SECRET as an EMPTY STRING. (d) An empty string is falsy, so the auth code falls back to a HARDCODED insecure default value `'change-me-in-production'`. (e) This means out-of-the-box, ALL JWTs are signed with a publicly known secret - anyone can forge tokens. (f) REQUIRED ACTION: After first deploy, log into the admin panel, navigate to settings, and set JWT_SECRET to a strong random string (e.g., `openssl rand -base64 32`). Restart the backend after changing it. (g) The .env JWT_SECRET only exists to satisfy Joi - set it to any non-empty string (e.g., "joi-placeholder"). Do NOT put your real secret in .env - it will be ignored.

**Section 9: Database** - SQLite with WAL mode, busy_timeout=5000, foreign_keys=ON. Location: server/data/blog.db (absolute path in production). Schema push: `cd server && npx drizzle-kit push --force`. Auto-seeds 334 settings + admin user (admin@test.com / password123) on first startup. CHANGE THE ADMIN PASSWORD immediately after first login.

**Section 10: Data Migration (from Go Backend)** - This section fixes the FALSE claim on old line 78. The migration tool transfers data from a Go backend SQLite database. CRITICAL CORRECTION: The Go backend stores timestamps as ISO8601/RFC3339 text strings. The NestJS backend stores timestamps as Unix epoch INTEGER SECONDS (NOT ISO 8601). The migration automatically converts ISO8601 -> Unix epoch. Command: `cd server && npm run migrate -- --source /path/to/go-backend.db --target ./data/blog.db`. Dry run: `npm run migrate:dry-run -- --source ... --target ...`. Options table same as before. Note: migration is optional - can start from empty DB with auto-seed.

**Section 11: Backup and Restore** - Backup: stop backend, copy server/data/blog.db + blog.db-shm + blog.db-wal + server/data/uploads/ + server/data/backups/ to a safe location. Or use SQLite backup API. Restore: stop backend, replace files, restart. For Docker: `docker compose exec anheyu sqlite3 /app/data/blog.db ".backup /app/data/backups/backup-$(date +%F).db"` or mount the volume and copy. Settings backups are auto-created by the backend in server/data/backups/.

**Section 12: Persistence Directories** - Document the three persistence dirs: server/data/blog.db (+ .db-shm, .db-wal) = database, server/data/uploads/ = uploaded files, server/data/backups/ = settings backups. NOTE: root-level data/ is a DIFFERENT directory (gitignored storage/cache) - do not confuse with server/data/.

**Section 13: Verification / Health Check** - After deploy: curl http://localhost:8091/api/health (or the nginx-proxied equivalent) should return 200. Visit http://localhost:3000 (or domain) to verify frontend loads. Check `docker compose ps` or `systemctl status anheyu-backend anheyu-frontend` or `pm2 status`.

**Section 14: Running Tests** - Keep the existing test section from the current DEPLOYMENT.md (lines 118-132) - push schema to test DB, run vitest verification tests. Copy verbatim.

IMPORTANT: The document must NOT contain the phrase "JWT_SECRET is auto-generated" anywhere. The document must NOT say timestamps are stored as "ISO 8601" in the NestJS backend (only the Go source is ISO 8601 - the NestJS target is Unix epoch). Grep both before finishing.
  </action>
  <verify>
    <automated>cd "D:/CodeDevelopment/project/Blog" && grep -ci "auto-generated" DEPLOYMENT.md | grep -qx "0" && grep -ni "ISO 8601" DEPLOYMENT.md | grep -vi "go\|source\|rfc3339\|iso8601/rfc3339\|->\|from\|convert" | grep -qi "nestjs\|target\|stores\|stored" && echo "INACCURACY_STILL_PRESENT" || echo "INACCURACIES_FIXED_OR_CONTEXTUAL" && grep -ci "Unix epoch" DEPLOYMENT.md | grep -qx "0" && echo "MISSING_EPOCH" || echo "EPOCH_PRESENT" && grep -ci "change-me-in-production\|hardcoded\|insecure" DEPLOYMENT.md | grep -qx "0" && echo "MISSING_JWT_WARNING" || echo "JWT_WARNING_PRESENT"</automated>
  </verify>
  <done>DEPLOYMENT.md is fully rewritten with all 14 sections. The phrase "auto-generated" does NOT appear in relation to JWT_SECRET. The NestJS backend timestamps are correctly documented as Unix epoch integer seconds (not ISO 8601). The JWT_SECRET section contains a prominent security warning about the hardcoded default and instructions to set a strong secret in the admin panel. All three deployment methods (Docker Compose, PM2, systemd+Nginx) are documented with commands.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Internet -> Nginx | Untrusted HTTP/HTTPS traffic enters at the reverse proxy |
| Nginx -> Backend (8091) | Proxied requests to NestJS app |
| Nginx -> Frontend (3000) | Proxied requests to Next.js standalone |
| Backend -> SQLite file | Local file I/O for database, uploads, backups |
| Client -> /api/ai/* (SSE) | Streaming AI chat responses, must not be buffered |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-01 | Spoofing | JWT auth (default secret) | critical | mitigate | DEPLOYMENT.md Section 8 documents that default JWT_SECRET is the hardcoded insecure value 'change-me-in-production'; instructs admin to set strong random secret in admin panel immediately after first deploy |
| T-quick-02 | Information Disclosure | Nginx HTTPS config | high | mitigate | nginx.conf and deploy/nginx-anheyu.conf both enforce HTTPS redirect on port 80 -> 443 with Let's Encrypt certs; TLSv1.2+ only |
| T-quick-03 | Tampering | Docker containers running as root | medium | mitigate | server/Dockerfile uses non-root user (node) for runtime stage; frontend/Dockerfile same |
| T-quick-04 | Denial of Service | SSE streaming connections | medium | accept | proxy_buffering off for /api/ai/* is required for functionality; backend ThrottlerGuard (100 req/60s) provides rate limiting |
| T-quick-SC | Tampering | npm ci installs in Dockerfiles | medium | mitigate | Using package-lock.json pinned versions; no [ASSUMED] packages - all dependencies already vetted in existing package.json |
</threat_model>

<verification>
After all 3 tasks complete:
1. All 14 files exist on disk (7 Docker + 6 PM2/systemd + 1 DEPLOYMENT.md)
2. Shell scripts pass `bash -n` syntax validation
3. docker-compose.yml parses without errors (if Docker CLI available)
4. DEPLOYMENT.md does NOT contain "auto-generated" in JWT context
5. DEPLOYMENT.md documents Unix epoch (not ISO 8601) for NestJS timestamp storage
6. DEPLOYMENT.md contains prominent JWT_SECRET security warning with "change-me-in-production" and "hardcoded"
7. nginx configs contain `proxy_buffering off` for AI/SSE routes
8. server/Dockerfile contains build tools (python3 make g++) for better-sqlite3 compilation
</verification>

<success_criteria>
- An operator can deploy anheyu-app via any of the three methods following DEPLOYMENT.md alone
- JWT_SECRET insecurity is prominently documented with remediation steps
- Timestamp storage format is correctly documented as Unix epoch integer seconds
- SSE streaming works through nginx (proxy_buffering off for AI routes)
- All persistence directories (server/data/) are documented with backup/restore procedures
</success_criteria>

<output>
Create `.planning/quick/260802-evy-anheyu-app-deployment-md-jwt-secret-dock/260802-evy-SUMMARY.md` when done
</output>
