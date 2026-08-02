# 部署指南 - anheyu-app

> anheyu-app 后端为 NestJS + Drizzle + SQLite，前端为 Next.js（standalone）。提供三种部署方式：**Docker Compose（推荐）**、**systemd + Nginx（裸机）**、**PM2**。

## 目录

1. [概览](#1-概览)
2. [环境要求](#2-环境要求)
3. [快速开始：Docker Compose（推荐）](#3-快速开始docker-compose推荐)
4. [裸机部署：systemd + Nginx](#4-裸机部署systemd--nginx)
5. [PM2 部署](#5-pm2-部署)
6. [Nginx 反向代理与 HTTPS](#6-nginx-反向代理与-https)
7. [环境变量](#7-环境变量)
8. [⚠️ JWT_SECRET 安全告警](#8-️-jwt_secret-安全告警)
9. [数据库](#9-数据库)
10. [数据迁移（从 Go 后端）](#10-数据迁移从-go-后端)
11. [备份与恢复](#11-备份与恢复)
12. [持久化目录](#12-持久化目录)
13. [健康检查](#13-健康检查)
14. [运行测试](#14-运行测试)

---

## 1. 概览

| 组件 | 技术栈 | 默认端口 |
|------|--------|----------|
| 后端 | NestJS 11 + Drizzle ORM + SQLite (better-sqlite3) | 8091 |
| 前端 | Next.js 16（`output: "standalone"`） | 3000 |
| 反向代理 | Nginx（HTTPS + Let's Encrypt） | 80 / 443 |

后端所有 API 路由前缀为 `/api`（RSS/sitemap/robots.txt/`needcache` 例外，走根路径）。前端通过 `API_URL` 把 `/api`、`/f`、`/static` 等请求代理到后端。Nginx 统一对外入口，按路径分流到后端或前端。

## 2. 环境要求

| 方式 | 要求 |
|------|------|
| Docker Compose | Docker 24+、Docker Compose v2 |
| 裸机 / PM2 | Node.js v22+、npm v10+、Nginx |
| HTTPS | 一个域名，DNS A 记录指向服务器 IP |

## 3. 快速开始：Docker Compose（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/zyz2003/Blog.git
cd Blog

# 2. （可选 HTTPS）签发证书并替换域名占位符
bash nginx/init-letsencrypt.sh your-domain.com you@example.com

# 3. 构建并启动全部服务
docker compose up -d --build
```

启动后：

- 前台：`https://your-domain.com`（已配 HTTPS）或 `http://localhost`（未配 HTTPS）
- 后端 API：`http://localhost:8091/api`
- 容器状态：`docker compose ps`
- 查看日志：`docker compose logs -f anheyu`

**首次启动说明：**

- 后端首次启动时自动 seed 334 条默认设置并创建管理员账户（`admin@test.com` / `password123`）。
- 数据库 schema 需手动推送一次：

  ```bash
  docker compose exec anheyu npx drizzle-kit push --force
  ```

- 数据库文件、上传文件、备份均持久化在宿主机 `./server/data` 目录（挂载到容器 `/app/data`）。

**未配 HTTPS 直接跑 HTTP：** 跳过第 2 步，直接 `docker compose up -d --build`。此时 Nginx 的 443 块因证书不存在会启动失败——需先把 `nginx/nginx.conf` 中 443 的 server 块注释掉，或先执行证书签发。

## 4. 裸机部署：systemd + Nginx

一键安装（推荐）：

```bash
sudo bash deploy/install.sh your-domain.com
```

`install.sh` 会自动完成：Node 版本检查 → 构建前后端（`scripts/build-prod.sh`）→ 推送 SQLite schema → 创建数据目录 → 安装并启用 systemd 服务 → 配置 Nginx 站点。

手动步骤：

```bash
# 1. 构建前后端
bash scripts/build-prod.sh

# 2. 推送数据库 schema
cd server && npx drizzle-kit push --force && cd ..

# 3. 安装 systemd 服务
sudo cp deploy/anheyu-backend.service /etc/systemd/system/
sudo cp deploy/anheyu-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now anheyu-backend anheyu-frontend

# 4. 配置 Nginx
sudo cp deploy/nginx-anheyu.conf /etc/nginx/sites-available/anheyu
sudo ln -sf /etc/nginx/sites-available/anheyu /etc/nginx/sites-enabled/anheyu
sudo sed -i 's/YOUR_DOMAIN/your-domain.com/g' /etc/nginx/sites-available/anheyu
sudo nginx -t && sudo systemctl reload nginx

# 5. 签发 HTTPS 证书
sudo certbot --nginx -d your-domain.com
```

服务管理：

```bash
systemctl status anheyu-backend anheyu-frontend
journalctl -u anheyu-backend -f     # 实时日志
```

## 5. PM2 部署

```bash
# 1. 构建前后端
bash scripts/build-prod.sh

# 2. 推送数据库 schema
cd server && npx drizzle-kit push --force && cd ..

# 3. 用 PM2 启动两个进程
pm2 start ecosystem.config.js

# 4. 保存进程列表 + 开机自启
pm2 save
pm2 startup
```

Nginx 配置与裸机相同（使用 `deploy/nginx-anheyu.conf`，上游为 `localhost:8091` / `localhost:3000`）。

PM2 管理：

```bash
pm2 status
pm2 logs anheyu-backend
pm2 restart all
```

## 6. Nginx 反向代理与 HTTPS

**路由规则**（见 `nginx/nginx.conf` 与 `deploy/nginx-anheyu.conf`）：

| 路径 | 上游 | 说明 |
|------|------|------|
| `/api/ai/*` | 后端 | **SSE 流式**：`proxy_buffering off`，AI 对话逐字推送 |
| `/api/*` | 后端 | REST API |
| `/f/*` | 后端 `/api/f/*` | 文件直链 |
| `/needcache/*` | 后端 | 缓存文件（根路径，不加 `/api`） |
| `/static/*` | 后端 | 静态资源 |
| `/uploads/*` | 后端 | 上传文件（`@nestjs/serve-static`） |
| `/` | 前端 | 其余路径交给 Next.js |

> **SSE 流式关键：** `/api/ai/` 必须设置 `proxy_buffering off` + `X-Accel-Buffering no`，否则 AI 对话流式响应会被 Nginx 缓冲卡住。两份 nginx 配置均已处理。

**HTTPS：**

- Docker Compose：`bash nginx/init-letsencrypt.sh your-domain.com you@example.com`
- 裸机 / PM2：`sudo certbot --nginx -d your-domain.com`
- 自动续期：certbot 默认装 systemd timer；Docker 场景定期执行 `docker compose run --rm certbot renew && docker compose restart nginx`

## 7. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8091` | 后端端口（与原 Go 后端一致，前端依赖此端口） |
| `DB_PATH` | `data/blog.db` | SQLite 路径；**容器/systemd 中必须用绝对路径**（如 `/app/data/blog.db`） |
| `JWT_SECRET` | - | ⚠️ 仅为通过 Joi 校验，**运行时不读取**。详见 [§8](#8-️-jwt_secret-安全告警) |
| `JWT_EXPIRES_IN` | `15m` | JWT 过期时间 |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh Token 过期时间 |
| `NODE_TLS_REJECT_UNAUTHORIZED` | - | 设为 `0` 可跳过音乐代理的 SSL 校验（对应 Go 的 `InsecureSkipVerify`） |
| `API_URL` | `http://anheyu:8091`（Docker）/ `http://localhost:8091`（裸机） | 前端代理后端的地址 |

> 本地开发无需 `.env` 文件（除 `JWT_SECRET` 需占位值满足 Joi 校验外）。所有业务配置存在数据库 `settings` 表，通过后台面板修改。

## 8. ⚠️ JWT_SECRET 安全告警

> **这是部署后必须立即处理的安全问题。** 旧文档曾称"JWT_SECRET 首次启动自动生成并存入数据库"，**此说法错误**，实际情况如下：

**真实行为：**

1. 环境变量 `JWT_SECRET` 被 Joi 标记为 `required()`——`.env` 中必须填一个非空值，**否则后端无法启动**。
2. **但这个环境变量在运行时从不被读取。** 签发/校验 JWT 时，代码读取的是 `settingsService.get('JWT_SECRET')`，即数据库 `settings` 表里的值。
3. 首次启动时，数据库 `settings` 表中的 `JWT_SECRET` 被 seed 为**空字符串**。
4. 空字符串是 falsy，认证代码回退到**硬编码的不安全默认值** `'change-me-in-production'`。

**这意味着：** 开箱即用状态下，**所有 JWT 都用一个公开的硬编码密钥签发**——任何人都能伪造 token，等同未鉴权。

**必须执行的操作（部署后立即）：**

1. 生成一个强随机密钥：

   ```bash
   openssl rand -base64 32
   ```

2. 登录后台管理面板 → 系统设置，把 `JWT_SECRET` 设为上面生成的值。
3. 重启后端使设置生效：

   ```bash
   # Docker
   docker compose restart anheyu
   # systemd
   sudo systemctl restart anheyu-backend
   # PM2
   pm2 restart anheyu-backend
   ```

4. （已有用户需重新登录，旧 token 失效。）

**关于 `.env` 里的 `JWT_SECRET`：** 它只是为通过 Joi 校验而存在，填任意非空字符串即可（如 `joi-placeholder`）。**不要**把真实密钥写进 `.env`——它会被忽略。

## 9. 数据库

- **引擎：** SQLite + WAL 模式（并发读、串行写），`busy_timeout=5000`，`foreign_keys=ON`
- **位置：** `server/data/blog.db`（生产环境用绝对路径）
- **schema 推送：** 首次部署执行一次

  ```bash
  cd server && npx drizzle-kit push --force
  ```

- **自动 seed：** 首次启动 seed 334 条默认设置 + 管理员账户（`admin@test.com` / `password123`）。**首次登录后立即修改密码。**

## 10. 数据迁移（从 Go 后端）

迁移工具把数据从 Go 后端的 SQLite 数据库迁到 NestJS 后端的 SQLite 数据库。

> **时间戳格式修正：** 旧文档曾称"Go RFC3339 -> JS ISO 8601"。**实际：Go 后端用 ISO8601/RFC3339 文本字符串存时间，NestJS 后端用 Unix epoch 整数秒存时间**，迁移时自动把 ISO8601 转为 Unix epoch。

```bash
# 迁移（自动备份 + 迁移后校验）
cd server && npm run migrate -- --source /path/to/go-backend.db --target ./data/blog.db

# 干跑（预览不写入）
cd server && npm run migrate:dry-run -- --source /path/to/go-backend.db --target ./data/blog.db
```

| 参数 | 说明 |
|------|------|
| `--source <path>` | 源 Go SQLite `.db` 文件（必填） |
| `--target <path>` | 目标 NestJS SQLite `.db` 文件（必填） |
| `--skip-backup` | 跳过目标库自动备份 |
| `--skip-verify` | 跳过迁移后校验 |
| `--verbose` | 详细日志 |

迁移处理：FK 依赖排序、ISO8601 → Unix epoch 时间戳转换、表/列名映射、迁移后校验（行数 + `id_seed`/`JWT_SECRET` 比对 + FK 完整性）。详见 [scripts/README.md](scripts/README.md)。

> 迁移是可选的——也可以从空库开始，应用首次启动自动 seed 默认设置与管理员。

## 11. 备份与恢复

**备份：**

```bash
# Docker：用 SQLite backup API 生成一致快照
docker compose exec anheyu sqlite3 /app/data/blog.db ".backup /app/data/backups/backup-$(date +%F).db"

# 裸机/PM2：停后端后拷贝文件
sudo systemctl stop anheyu-backend
cp server/data/blog.db /backup/blog-$(date +%F).db
sudo systemctl start anheyu-backend
```

同时备份 `server/data/uploads/`（上传文件）。`server/data/backups/` 下的设置备份由后端自动生成。

**恢复：** 停后端 → 用备份文件替换 `blog.db`（及其 `-shm`、`-wal`）→ 重启后端。

## 12. 持久化目录

| 路径 | 内容 | 必须持久化 |
|------|------|------------|
| `server/data/blog.db`（+ `.db-shm`、`.db-wal`） | 数据库 | ✅ |
| `server/data/uploads/` | 上传的图片/文件 | ✅ |
| `server/data/backups/` | 设置备份（运行时自动创建） | ✅ |

> ⚠️ **根目录 `data/` 与 `server/data/` 是两个不同的目录。** 根 `data/` 的是 gitignore 的 storage/cache；应用实际使用的是 `server/data/`。Docker 挂卷、裸机备份都认准 `server/data/`，切勿挂错。

## 13. 健康检查

部署后验证：

```bash
# 后端存活（/api/version 是公开端点，返回 200 说明后端正常）
curl -f http://localhost:8091/api/version

# 前端可访问
curl -I http://localhost:3000

# 进程/容器状态
docker compose ps              # Docker
systemctl status anheyu-backend anheyu-frontend  # systemd
pm2 status                     # PM2
```

浏览器访问 `https://your-domain.com` 确认前台加载、后台可登录。

## 14. 运行测试

```bash
# 推送 schema 到测试库（首次测试前必须执行一次）
cd server && npx drizzle-kit push --force

# 顺序执行验证测试（DB 隔离需要）
cd server && npx vitest run test/phase13-verification/ --no-file-parallelism
cd server && npx vitest run test/phase14-verification/ --no-file-parallelism
cd server && npx vitest run test/api-compat/ --no-file-parallelism
cd server && npx vitest run test/phase15-verification/

# 单文件
cd server && npx vitest run test/api-compat/auth-api-compat.spec.ts
```

---

## 部署后检查清单

- [ ] 数据库 schema 已推送（`drizzle-kit push --force`）
- [ ] 后端 `/api/version` 返回 200
- [ ] 前台可访问、后台可登录
- [ ] **JWT_SECRET 已在后台面板设为强随机值**（[§8](#8-️-jwt_secret-安全告警)）
- [ ] 默认管理员密码已修改（不再用 `password123`）
- [ ] HTTPS 证书已签发并自动续期
- [ ] `server/data/` 已纳入定期备份
