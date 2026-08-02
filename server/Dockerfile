# syntax=docker/dockerfile:1
# anheyu-app NestJS 后端镜像
# 多阶段构建：builder 编译 TS + 解析 better-sqlite3 原生模块；runtime 精简生产镜像

# ---- builder：编译 TypeScript ----
FROM node:22-slim AS builder

# better-sqlite3 是原生模块，需要编译工具链（若无预编译二进制则从源码编译）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝构建配置与源码
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/

# 编译 TS -> dist/
RUN npm run build

# 裁剪掉 devDependencies，使 node_modules 仅含生产依赖（better-sqlite3 的 .node 会被保留）
RUN npm prune --omit=dev


# ---- runtime：精简生产镜像 ----
FROM node:22-slim AS runtime

WORKDIR /app

# 仅拷贝生产依赖与构建产物（node_modules 在 builder 中已解析好原生模块，runtime 无需编译工具）
COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 创建数据目录并以非 root 用户运行
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=8091
# SQLite 路径用绝对路径，避免 CWD 依赖
ENV DB_PATH=/app/data/blog.db
# JWT_SECRET：仅为通过 Joi 校验，运行时不读取此值（真实密钥存于数据库 settings 表，见 DEPLOYMENT.md §8）
ENV JWT_SECRET=joi-placeholder
ENV JWT_EXPIRES_IN=15m
ENV JWT_REFRESH_EXPIRES_IN=30d

EXPOSE 8091

CMD ["node", "dist/main"]
