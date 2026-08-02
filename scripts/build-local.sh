#!/bin/bash
# 本地构建脚本：在开发机构建前后端，打包成 blog-build.tar.gz
# 上传到服务器解压即可。服务器只需 npm ci --omit=dev 装后端依赖
# （better-sqlite3 是原生模块，必须在 Linux 服务器上装；前端 standalone 是纯 JS，本地构建即可移植）
#
# 在开发机（Windows Git Bash 或 Linux/Mac）执行：bash scripts/build-local.sh
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
export NEXT_TELEMETRY_DISABLED=1

echo "========== [1/3] 构建前端 (next build) =========="
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
echo "========== [2/3] 构建后端 (nest build -> dist) =========="
cd server
npm ci
npm run build
cd "$PROJECT_ROOT"

echo ""
echo "========== [3/3] 打包 blog-build.tar.gz =========="
# 前端 standalone（含 traced node_modules + static + public，纯 JS 可移植）
# 后端 dist（TS 编译产物，可移植）+ package.json + package-lock.json（服务器装依赖用）
tar -czf blog-build.tar.gz \
  frontend/.next/standalone \
  server/dist \
  server/package.json \
  server/package-lock.json

echo ""
echo "✅ 构建打包完成"
ls -lh blog-build.tar.gz | awk '{print "   文件:", $NF, " 大小:", $5}'
echo ""
echo "──────── 上传到服务器 ────────"
echo "  scp blog-build.tar.gz root@你的服务器IP:/home/zhangyazhou/blog-new/"
echo ""
echo "──────── 服务器上执行 ────────"
echo "  cd /home/zhangyazhou/blog-new"
echo "  tar -xzf blog-build.tar.gz          # 解压（覆盖 frontend/.next/standalone 和 server/dist）"
echo "  cd server && npm ci --omit=dev && cd ..   # 装后端生产依赖（编译 better-sqlite3，快且轻）"
echo ""
echo "──────── 启动 ────────"
echo "  # 方式一：PM2"
echo "  pm2 start ecosystem.config.js"
echo "  # 方式二：手动"
echo "  PORT=8091 DB_PATH=./data/blog.db node server/dist/main &"
echo "  PORT=3000 API_URL=http://localhost:8091 node frontend/.next/standalone/server.js &"
echo ""
echo "注：server/data/（blog.db + uploads）不在本包内，用之前的 blog-data.tar.gz 解压到 server/data/"
