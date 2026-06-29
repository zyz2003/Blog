# Phase 1: Infrastructure - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

NestJS 项目脚手架搭建，包含 Drizzle+SQLite 数据层、全局响应拦截器、认证守卫体系、Sqids ID 编解码器、所有 30 个数据库表 Schema 定义。这是后续 10 个阶段的基石——所有业务模块都依赖此阶段的基础设施。

**交付物：**
- `npm run dev` 启动 NestJS 监听 8091 端口
- 所有 30 个 Drizzle Schema 文件，`drizzle-kit push` 创建 SQLite 数据库
- SQLite WAL 模式 + busy_timeout=5000ms
- 全局响应拦截器包装 `{ code, data, message }`
- Sqids encode/decode 与 Go 后端兼容
- JWT Guard + Admin Guard 功能性验证
- 所有业务模块目录结构预创建

</domain>

<decisions>
## Implementation Decisions

### 项目结构
- **D-01:** 功能模块组织方式——每个功能域一个目录（article/、auth/、settings/），内含 module.ts + controller.ts + service.ts + repository.ts
- **D-02:** 共享代码放 common/（guards/、interceptors/、decorators/、filters/），数据库初始化放 database/（schemas/、drizzle 初始化）
- **D-03:** Phase 01 一次性创建全部业务模块目录（article、auth、settings、page、file、comment、search、statistics、link、album、doc-series、rss、sitemap、music、notification、subscriber、thumbnail、config），每个目录放占位 module.ts
- **D-04:** 配置文件放 config/（env.validation.ts 等），NestJS 后端代码在 server/ 目录下，顶层 server/src/ 目录结构：article/、auth/、common/、config/、database/、app.module.ts、main.ts

### Schema 组织
- **D-05:** 一表一文件，放在 database/schemas/ 目录下（article.schema.ts、user.schema.ts 等）
- **D-06:** Phase 01 一次性定义全部 30 个表的 Schema（字段、类型、关系、索引），直接对齐 Go 的 ent/schema/ 定义

### Guard & Interceptor 接线
- **D-07:** 3 个独立 Guard 实现：JwtAuthGuard（验证 Token 必须）、JwtAuthOptionalGuard（有 Token 解析无 Token 放行）、AdminGuard（检查 UserGroupID 是否管理员）
- **D-08:** JwtAuthGuard 全局注册（APP_GUARD），公开路由用自定义 @Public() 装饰器跳过认证
- **D-09:** AdminGuard 手动 @UseGuards(AdminGuard) 加在需要管理员权限的 Controller/Method 上
- **D-10:** 全局 ResponseInterceptor（APP_INTERCEPTOR）包装所有返回值为 `{ code, data, message }`，code 默认 200

### 数据目录
- **D-11:** 所有数据文件统一放 data/ 目录：data/anheyu.db（SQLite）、data/uploads/（上传文件）、data/thumbnails/（缩略图），与 Go 后端一致

### 错误码映射
- **D-12:** 定义 error-codes.ts 常量文件，包含所有 Go 后端的错误码和中文消息映射。所有 Service/Controller 引用常量，不硬编码字符串

### Sqids 初始化
- **D-13:** 应用启动时从 settings 表读取 id_seed，调用 InitSqidsEncoderWithSeed 初始化。数据库为空时先生成随机 seed 存入 settings 表。编码格式 [dbID, entityType]，minLength=4

### 缓存策略
- **D-14:** Map + TTL 基础版内存缓存，启动时定时清理过期条目。Phase 01 只建基础设施

### 配置管理
- **D-15:** 用 @nestjs/config 的 ConfigModule.forRoot() 加载 .env 文件，支持验证和缓存

### 日志框架
- **D-16:** 用 NestJS 内置 Logger，自带彩色输出和上下文标识

### Go 代码处理
- **D-17:** Go 后端代码在开发期间保留在仓库中作为 API 兼容性参考，NestJS 后端在独立的 server/ 目录下新建。Phase 11 集成测试通过后删除所有 Go 代码（ent/、internal/、pkg/、cmd/、main.go、go.mod、go.sum 等）

### Claude's Discretion
- 数据库连接初始化方式（Drizzle + better-sqlite3 的注入方式）
- drizzle.config.ts 配置细节
- CORS 配置（参照 Go 后端的 cors.go）
- Repository 层抽象程度（直接在 Service 中写 Drizzle 查询 vs 抽象 Repository 类）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端源码（API 兼容性的权威参考）
- `ent/schema/*.go` — 30 个表的 Schema 定义，Drizzle Schema 必须完全对齐
- `pkg/response/response.go` — 响应格式 `{ code, message, data }`，code 等于 HTTP 状态码
- `pkg/idgen/idgen.go` — Sqids 编解码逻辑，含 DefaultAlphabet、EntityType 常量、shuffleAlphabet 算法
- `internal/infra/router/router.go` — 全部路由注册，路径和中间件组合是 API 兼容性的核心
- `internal/app/middleware/auth.go` — JWT 认证中间件实现，Token payload 结构
- `internal/app/middleware/cors.go` — CORS 配置
- `internal/infra/persistence/` — 数据访问层实现

### 前端配置
- `frontend/next.config.ts` — rewrites 代理 /api/* 到 localhost:8091

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-08）
- `.planning/REQUIREMENTS.md` — 完整验收标准

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Go 后端 `ent/schema/` 有 30 个完整的表定义，可直接映射为 Drizzle Schema
- Go 后端 `pkg/idgen/idgen.go` 有完整的 Sqids 实现（alphabet、entityType、shuffle 算法），可直接移植为 TypeScript
- Go 后端 `internal/infra/router/router.go` 有全部路由定义，可直接映射为 NestJS Controller 装饰器

### Established Patterns
- Go 后端三层认证：JWTAuth（必须认证）、JWTAuthOptional（可选认证）、AdminAuth（管理员），对应 NestJS 三个 Guard
- Go 后端响应格式统一 `{ code: int, message: string, data: any }`，code 等于 HTTP 状态码
- Go 后端 Sqids 编码 [dbID, entityType] 对，decode 返回两个数字
- Go 后端错误消息用中文，前端依赖中文消息文本

### Integration Points
- 前端 `next.config.ts` 的 rewrites 代理 /api/* 到 localhost:8091
- 数据库 data/ 目录需要与 Go 后端保持一致，迁移工具（Phase 11）需要读取
- JWT Token 需要兼容 Go 后端签发的 Token（Phase 02 详细实现）

</code_context>

<specifics>
## Specific Ideas

- 用户明确要求"一次性生成全部模块目录"，而非逐阶段创建
- 用户对照抄 Go 后端分层结构有疑问，最终接受功能模块方式
- Sqids 的 shuffleAlphabet 算法必须精确移植，包括 seedInt 的计算方式（`int64(c) * int64(i+1)` 求和）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Infrastructure*
*Context gathered: 2026-06-28*
