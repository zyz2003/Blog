#!/bin/bash
# Blog 生产构建脚本（统一构建前后端）
# 产物：server/dist/main.js + frontend/.next/standalone/server.js
# 被 deploy/install.sh 调用，也可单独执行（PM2 部署用）
#
# 内存注意：next build 内存占用大，4G 以下服务器务必先加 swap，否则会 OOM 卡死：
#   fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 限制 Node 堆内存，避免构建把服务器吃爆（配合 swap 使用）
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
export NEXT_TELEMETRY_DISABLED=1

# 内存检查
if command -v free >/dev/null 2>&1; then
  MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
  SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
  TOTAL=$((MEM_MB + SWAP_MB))
  echo "[INFO] 内存: ${MEM_MB}MB, swap: ${SWAP_MB}MB, 合计: ${TOTAL}MB"
  if [ "$TOTAL" -lt 4096 ]; then
    echo "[WARN] 内存+swap 不足 4G，next build 可能 OOM 卡死！建议加 swap："
    echo "       fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
    echo "       （已加 swap 可忽略此警告，继续构建）"
  fi
fi

# 带心跳地执行命令：后台跑，每 20s 报告用时/内存/末行日志，避免干瞪眼
run_step() {
  local label="$1"; shift
  local log
  log=$(mktemp)
  echo "[INFO] $label 开始...（日志: $log，另开终端可 tail -f $log 看详情）"
  "$@" > "$log" 2>&1 &
  local pid=$!
  local start
  start=$(date +%s)
  while kill -0 "$pid" 2>/dev/null; do
    sleep 20
    local elapsed=$(( $(date +%s) - start ))
    local used_mb
    used_mb=$(free -m 2>/dev/null | awk '/^Mem:/{print $3}')
    local last_line
    last_line=$(tail -1 "$log" 2>/dev/null | tr -d '\r')
    echo "  → $label 仍在跑... ${elapsed}s 已用，系统内存 ${used_mb}MB | 末行: $last_line"
  done
  local rc=0
  wait "$pid" || rc=$?
  local dur=$(( $(date +%s) - start ))
  if [ "$rc" -ne 0 ]; then
    echo "[ERROR] $label 失败（${dur}s，退出码 $rc）。最近 30 行："
    tail -30 "$log"
    rm -f "$log"
    return "$rc"
  fi
  echo "[OK] $label 完成（${dur}s）"
  rm -f "$log"
  return 0
}

echo "[1/4] 构建后端 (server/dist)..."
cd server
run_step "后端装依赖(npm ci)" npm ci
run_step "后端构建(nest build)" npm run build
cd ..

echo "[2/4] 构建前端 (frontend/.next/standalone)..."
cd frontend
run_step "前端装依赖(npm ci)" npm ci
run_step "前端构建(next build)" npm run build
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
