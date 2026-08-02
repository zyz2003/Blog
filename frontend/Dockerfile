# syntax=docker/dockerfile:1
# Blog Next.js 前端镜像（standalone 输出）
# 多阶段构建：deps 装依赖 -> builder 执行 next build -> runtime 仅跑 standalone server

# ---- deps：安装依赖 ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder：构建 standalone 产物 ----
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# next build 产出 .next/standalone/server.js（自包含 Node server）
RUN npm run build

# ---- runtime：仅跑 standalone server ----
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# 前端通过 API_URL 把 /api、/f、/static 等代理到后端服务（Docker Compose 中后端服务名为 backend）
ENV API_URL=http://backend:8091

# standalone 产物：需把 .next/static 与 public 拷到 server.js 同级
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
