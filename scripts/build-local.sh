#!/bin/bash
# 本地构建脚本：在开发机构建前后端，打包成 blog-build.tar.gz（含部署说明）
# 上传到服务器解压即可。服务器只需 npm ci --omit=dev 装后端依赖
# （better-sqlite3 是原生模块，必须在 Linux 服务器上装；前端 standalone 是纯 JS，本地构建即可移植）
#
# 在开发机（Windows Git Bash 或 Linux/Mac）执行：bash scripts/build-local.sh
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
export NEXT_TELEMETRY_DISABLED=1

echo "========== [1/4] 构建前端 (next build) =========="
cd frontend
npm ci
npm run build
# Next.js standalone 不会自动包含 .next/static 与 public，需手动拷到 server.js 同级
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
rm -rf .next/standalone/public
cp -r public .next/standalone/public
cd "$PROJECT_ROOT"

echo ""
echo "========== [2/4] 构建后端 (nest build -> dist) =========="
cd server
npm ci
npm run build
cd "$PROJECT_ROOT"

echo ""
echo "========== [3/4] 生成部署说明 =========="
cat > 部署说明.md << 'DOC_EOF'
# Blog 部署说明（本地构建产物）

本压缩包是**本地构建好的前后端产物**，服务器无需再 build（避免 4G 服务器跑 next build 导致 OOM）。

## 包含内容
- `frontend/.next/standalone/` — 前端完整产物（含 traced node_modules + static + public，纯 JS 可直接跑）
- `server/dist/` — 后端编译产物（TS -> JS）
- `server/package.json` + `server/package-lock.json` — 后端依赖清单（服务器装依赖用）

## 不包含（需另行准备）
- `server/data/`（blog.db + uploads）— 用 `blog-data.tar.gz` 解压到 `server/data/`
- 后端 node_modules — 服务器执行 `npm ci --omit=dev` 安装（better-sqlite3 是原生模块，必须在 Linux 装）

## 前置条件
- Node.js **v22+**（`node -v` 确认，低于 22 先升级）
- `server/data/blog.db` 已就位（从 blog-data.tar.gz 解压）

## 部署步骤

### 1. 解压（在项目根目录）
```bash
tar -xzf blog-build.tar.gz
```

### 2. 装后端依赖（快且轻，不会 OOM）
```bash
cd server && npm ci --omit=dev && cd ..
```

### 3. 确认数据在位
```bash
ls server/data/blog.db server/data/uploads/articles/
# 应看到 blog.db 和 6 个图片文件
```

### 4. 启动
```bash
# 方式一：PM2（推荐）
pm2 start ecosystem.config.js
pm2 save && pm2 startup   # 开机自启

# 方式二：手动（临时测试）
PORT=8091 DB_PATH=./data/blog.db node server/dist/main &
PORT=3000 API_URL=http://localhost:8091 node frontend/.next/standalone/server.js &
```

### 5. 验证
```bash
curl -f http://localhost:8091/api/version   # 后端应返回 200
curl -I http://localhost:3000                # 前端应返回 200
```

### 6. 对外访问（Nginx 反代 + HTTPS）
```bash
# 用项目自带的 nginx 配置
sudo cp deploy/nginx-blog.conf /etc/nginx/sites-available/blog
sudo ln -sf /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog
sudo sed -i 's/YOUR_DOMAIN/你的域名/g' /etc/nginx/sites-available/blog
sudo certbot --nginx -d 你的域名          # 签发 HTTPS 证书
sudo nginx -t && sudo systemctl reload nginx
```
或一键安装：`sudo bash deploy/install.sh 你的域名`

## 注意事项
- **JWT_SECRET**：首次启动自动生成强随机值写入数据库，无需手动配。
- **首次登录后台**：用 `admin@test.com` / `password123`，**立即改密码**。
- **端口**：后端 8091，前端 3000。
- **数据持久化**：`server/data/`（blog.db + uploads + backups），备份认准这个目录，别和根目录 data/ 搞混。
- **后续更新代码**：本地重新跑 `bash scripts/build-local.sh`，上传新的 blog-build.tar.gz，服务器解压覆盖 + 重启即可（数据不动）。
DOC_EOF
echo "   已生成 部署说明.md"

echo ""
echo "========== [4/4] 打包 blog-build.tar.gz =========="
# 前端 standalone（含 traced node_modules + static + public，纯 JS 可移植）
# 后端 dist（TS 编译产物，可移植）+ package.json + package-lock.json（服务器装依赖用）
# 部署说明.md（本文件）
tar -czf blog-build.tar.gz \
  frontend/.next/standalone \
  server/dist \
  server/package.json \
  server/package-lock.json \
  部署说明.md
rm -f 部署说明.md

echo ""
echo "✅ 构建打包完成"
ls -lh blog-build.tar.gz | awk '{print "   文件:", $NF, " 大小:", $5}'
echo "   解压后先看 部署说明.md"
echo ""
echo "上传到服务器：scp blog-build.tar.gz root@你的服务器IP:/home/zhangyazhou/blog-new/"
