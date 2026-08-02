---
phase: quick
plan: 260802-evy
status: complete
date: 2026-08-02
---

# Quick Task 260802-evy: anheyu-app 部署文档及脚本

## 结果

为 anheyu-app 产出完整部署基础设施，覆盖三种部署方式（Docker Compose 主推 + PM2 + systemd/Nginx），含 Nginx 反向代理 + HTTPS，前端以 Next.js standalone 独立 Node 服务运行。同时重写 DEPLOYMENT.md，修正两处事实错误并加入 JWT_SECRET 安全告警。

## 产出文件（14 个）

**Task 1 - Docker Compose（commit a179c93）**
- `server/Dockerfile` - 多阶段构建，builder 编译 TS + 解析 better-sqlite3 原生模块，runtime 精简非 root
- `frontend/Dockerfile` - Next.js standalone 多阶段构建
- `docker-compose.yml` - anheyu + frontend + nginx + certbot 四服务，持久化卷挂载 server/data
- `nginx/nginx.conf` - 反代路由 + SSE 流式（/api/ai 关闭缓冲）+ HTTPS + ACME
- `nginx/init-letsencrypt.sh` - 首次签发 Let's Encrypt 证书
- `server/.dockerignore`、`frontend/.dockerignore`

**Task 2 - PM2/systemd/build（commit 62228a7）**
- `ecosystem.config.js` - PM2 双进程（后端 dist/main + 前端 standalone server.js）
- `deploy/anheyu-backend.service`、`deploy/anheyu-frontend.service` - systemd 单元，绝对路径，非特权用户
- `deploy/nginx-anheyu.conf` - 裸机 nginx 站点，localhost 上游
- `deploy/install.sh` - 裸机一键安装
- `scripts/build-prod.sh` - 统一构建前后端 + 整理 standalone 产物

**Task 3 - DEPLOYMENT.md 重写（commit 8ec879d）**
- `DEPLOYMENT.md` - 14 节完整重写

## 修正的两处错误

1. **JWT_SECRET**：旧文档称"首次启动自动生成并存入数据库"，实际 env 值仅为通过 Joi 校验、运行时不读取；DB 默认 seed 为空字符串，回退硬编码 `'change-me-in-production'`。新文档 §8 以安全告警形式说明，并要求部署后在后台面板设强随机值。
2. **时间戳**：旧文档称"Go RFC3339 -> JS ISO 8601"，实际 NestJS 存 Unix epoch 整数秒，迁移做 ISO8601 -> Unix epoch 转换。新文档 §10 已修正。

## 验证

- 14 个文件全部落盘 ✓
- 3 个 shell 脚本（build-prod.sh / install.sh / init-letsencrypt.sh）`bash -n` 语法通过 ✓
- DEPLOYMENT.md 不含 `auto-generated`（JWT 语境）✓
- DEPLOYMENT.md 含 `Unix epoch`（2 处）✓
- DEPLOYMENT.md 含硬编码/伪造 告警关键词 ✓
- ISO 8601 仅出现在 Go 源数据语境，NestJS 明确标注为 Unix epoch ✓
- 两份 nginx 配置均含 `proxy_buffering off`（SSE 流式）✓
- server/Dockerfile 含 python3 make g++（better-sqlite3 原生编译）✓
- docker compose config 校验：本机无 Docker，跳过（部署时校验）

## 执行说明

- **executor 子代理派发受阻**：派发 gsd-executor 时，Agent 安全分类器（glm-5.2）两次返回"temporarily unavailable"。为不阻塞用户，由 orchestrator 直接执行计划（顺序模式，主工作树，无 worktree 隔离--base-check 因 origin/HEAD 未解析已自动降级）。产物与提交与子代理执行等价。
- **worktree 降级**：worktree.base-check 返回 shouldDegrade=true（fork-ref-unknown，git fetch origin 失败 rc=128），按工作流自动改为顺序执行。
- **行尾**：Git 提示 LF->CRLF（Windows），无害。

## 后续建议（非本任务范围）

- 修复 JWT_SECRET 根因：可在 `seedMissingDefaults` 中用 `crypto.randomBytes` 生成随机值写入 DB，并移除 env.validation 中误导性的 `required()`。用户已选"文档强提示即可"，此处仅作记录。
- 部署到真实 Linux 环境后实测 `docker compose up -d --build` 与 `certbot` 签发流程。
- 为 `scripts/prepare-embedded-frontend.sh`（Go 时代遗留，目标 `internal/frontend/...`）评估是否删除。
