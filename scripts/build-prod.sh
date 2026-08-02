#!/bin/bash
# Blog 生产构建脚本（统一构建前后端）
# 产物：server/dist/main.js + frontend/.next/standalone/server.js
# 被 deploy/install.sh 调用，也可单独执行（PM2 部署用）
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "[1/4] 构建后端 (server/dist)..."
cd server
npm ci
npm run build
cd ..

echo "[2/4] 构建前端 (frontend/.next/standalone)..."
cd frontend
npm ci
npm run build
cd ..

echo "[3/4] 整理前端 standalone 产物..."
# Next.js standalone 不会自动包含 .next/static 与 public，需手动拷到 server.js 同级
mkdir -p frontend/.next/standalone/.next
rm -rf frontend/.next/standalone/.next/static
cp -r frontend/.next/static frontend/.next/standalone/.next/static
rm -rf frontend/.next/standalone/public
cp -r frontend/public frontend/.next/standalone/public

echo "[4/4] 构建完成"
echo "  后端产物: server/dist/main.js"
echo "  前端产物: frontend/.next/standalone/server.js"
