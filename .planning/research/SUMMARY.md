# Project Research Summary: anheyu-app NestJS + SQLite Backend

**Date:** 2026-06-28

## Key Findings

### 技术栈
- **核心**: NestJS v11 + Drizzle ORM v0.45 + better-sqlite3 v12 + TypeScript
- **认证**: @nestjs/jwt + @nestjs/passport
- **图片**: sharp（缩略图生成）
- **ID编码**: sqids（与 Go 后端兼容）
- **搜索**: SQLite FTS5（替代 PostgreSQL tsvector）
- **缓存**: 内存 Map + TTL（替代 Redis）

### 功能范围
- **Table Stakes（20项）**: 文章 CRUD、JWT 认证、文件上传、评论、分类/标签、页面、搜索、访客追踪、设置、SEO、友链
- **Differentiators（15+项）**: 分块上传、多存储策略、缩略图、版本历史、高级分析、主题市场、SSR 主题
- **Anti-features**: PRO 功能（支付、AI 等）

### 架构
- Go 后端 25+ 个 Handler → NestJS 25+ 个 Module
- 30 个数据表 → Drizzle Schema 定义
- 构建顺序: 基础设施 → 认证+内容 → 文件+评论+搜索 → 统计+友链 → 相册+主题 → 迁移+集成

### 关键陷阱
1. **SQLite 并发**: 必须启用 WAL + busy_timeout
2. **ID 编码**: Sqids seed 必须与 Go 后端一致
3. **响应格式**: 必须全局拦截器确保 `{ code, data, message }`
4. **JWT 兼容**: Token 结构、密钥、算法必须与 Go 一致
5. **分块上传**: Session + Chunk + Finalize 机制复杂

## Implications for Roadmap

1. **Phase 0 必须优先解决兼容性基础设施** — 响应格式、ID 编码、JWT 结构
2. **SQLite 配置是 Phase 0 的一部分** — WAL + busy_timeout 必须在首次写入前设置
3. **6 个阶段**（细粒度）比 3 个阶段（粗粒度）更合适 — 每阶段聚焦一个领域
4. **迁移工具放在最后** — 先确保 API 兼容，再做数据迁移
5. **前端联调是持续过程** — 每完成一个 Phase 就应该测试对应 API

## Sources

- STACK.md — 技术栈研究（npm 验证版本）
- FEATURES.md — 功能研究（Go 源码分析）
- ARCHITECTURE.md — 架构研究（Go 源码结构分析）
- PITFALLS.md — 陷阱研究（兼容性风险分析）

---
*Summary synthesized: 2026-06-28*
