# Phase 11: Migration & Integration - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

SQLite→SQLite 数据迁移 CLI 工具 + 全量端到端 API 兼容性测试套件。这是项目最后一个阶段，确保从 Go 后端切换到 NestJS 后端时数据完整性和 API 兼容性。

**交付物：**

数据迁移 CLI 工具：
- Node.js CLI 脚本（scripts/migrate.ts）
- 读取 Go 后端的 SQLite .db 文件，写入 NestJS 的 .db 文件
- 按 FK 依赖顺序迁移全部 33 张表
- 迁移前自动备份目标 .db 文件
- 迁移后验证：行数对比 + 关键字段抽样检查（id_seed、JWT_SECRET）
- 确保 id_seed 和 JWT_SECRET 值精确复制（Sqids 编码 + JWT 兼容性）

API 兼容性测试套件：
- 覆盖全部 ~65+ 个端点（P0 + P1 + P2）
- 按 Go 后端源码验证响应格式（非双后端对比）
- 按功能模块组织测试文件
- 每个端点验证：响应格式 { code, data, message }、字段名和类型、状态码、错误码
- 沿用 vitest + supertest + NestJS Test 模式

</domain>

<decisions>
## Implementation Decisions

### 迁移工具源数据库范围
- **D-300:** 迁移工具只支持 SQLite→SQLite。Go 后端已默认使用 SQLite（conf.ini 里 Type=sqlite），大多数用户场景是 SQLite→SQLite。PostgreSQL/MySQL 源不需要支持

### 迁移工具实现方式
- **D-301:** 迁移工具实现为 Node.js CLI 脚本（scripts/migrate.ts），使用 better-sqlite3 读取源 .db 和写入目标 .db。简单直接，无需额外依赖
- **D-302:** 表迁移按 FK 依赖顺序执行（user_groups → users → settings → 其他表），确保外键约束不会失败

### 迁移验证与安全
- **D-308:** 迁移后验证：每张表行数一致 + 关键字段抽样检查（settings 表的 id_seed、JWT_SECRET 值是否精确匹配）+ 外键引用完整性检查
- **D-309:** 迁移前自动备份目标 .db 文件（如果已存在），迁移失败时恢复备份。与 Go 后端备份模式一致
- **D-310:** id_seed 和 JWT_SECRET 是迁移中最关键的两个值，必须精确复制。id_seed 决定 Sqids 编码结果，JWT_SECRET 决定现有 Token 兼容性

### API 兼容性测试方法
- **D-303:** API 兼容性测试基于 Go 后端源码验证（非双后端对比）。读取 Go handler/service/dto 源码，验证 NestJS 响应格式是否匹配。不需要 Go 运行环境
- **D-304:** 测试框架沿用 vitest + supertest + NestJS Test 模块，与现有 phase08-api-compat.spec.ts 一致。所有测试放在 server/test/ 目录下
- **D-305:** 测试粒度：只验证响应结构（response shape）—— { code, data, message } 格式、关键字段名和类型、状态码、错误码。不验证具体数据值（测试数据每次不同）

### API 兼容性测试覆盖范围
- **D-306:** 覆盖全部 ~65+ 个端点（P0 + P1 + P2），因为 Phase 01-10 已实现所有 API
- **D-307:** 测试按功能模块组织为独立文件：auth-api-compat.spec.ts、article-api-compat.spec.ts、file-api-compat.spec.ts 等。每个文件独立可运行

### Claude's Discretion
- 迁移 CLI 的具体命令行参数设计（源路径、目标路径、是否跳过验证等）
- FK 依赖顺序的具体拓扑排序实现
- 抽样检查的具体字段列表
- 迁移 CLI 的日志格式和进度报告
- 每个 API 兼容性测试文件中的具体断言列表
- 测试数据 seeding 策略（哪些表需要预置数据、用什么数据）
- 迁移工具是否需要支持增量迁移（只迁移新增数据）
- 33 张表的具体 FK 依赖图

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端数据库和配置
- `internal/infra/persistence/database/database.go` — Go 后端数据库连接管理，支持 SQLite/PostgreSQL/MySQL 三种驱动，Ent ORM 自动迁移
- `data/conf.ini` — Go 后端配置文件，默认 Database.Type=sqlite，Database.Name=anheyu_app.db
- `ent/schema/` — Go 后端 30 个 Ent schema 文件，定义了所有表的字段、索引、外键关系

### Go 后端路由和 API 定义（API 兼容性测试的权威参考）
- `internal/infra/router/router.go` — 全部路由注册，每个端点的路径、HTTP 方法、中间件组合
- `pkg/handler/` — 各模块 Handler，定义了每个端点的请求/响应 DTO
- `pkg/service/` — 各模块 Service，定义了业务逻辑和返回数据结构
- `pkg/domain/model/` — 各模块 Domain Model，定义了数据实体字段

### 现有 NestJS 测试基础设施
- `server/test/phase08-api-compat.spec.ts` — 现有 API 兼容性测试模式（vitest + supertest + NestJS Test + Sqids seed + JWT 签名）
- `server/test/phase08-integration.spec.ts` — 现有集成测试模式
- `server/test/phase08-startup.spec.ts` — 启动验证测试模式

### 现有 NestJS 数据库层
- `server/src/database/database.service.ts` — DatabaseService：better-sqlite3 连接、WAL 模式、busy_timeout、foreign_keys
- `server/src/database/database.module.ts` — DatabaseModule：DRIZZLE token provider
- `server/src/database/schemas/index.ts` — 33 个 schema 的 barrel export
- `server/drizzle.config.ts` — Drizzle 迁移配置

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-310）
- `.planning/REQUIREMENTS.md` — 完整验收标准（MIGRATION-01, INTEGRATION-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **phase08-api-compat.spec.ts** (server/test/): 已建立完整的 API 兼容性测试模式——vitest + supertest + NestJS Test、Sqids seed 初始化、JWT 签名、测试数据 seeding、响应格式断言。Phase 11 测试文件可直接复用此模式
- **DatabaseService** (server/src/database/database.service.ts): better-sqlite3 连接创建模式，迁移 CLI 可参考
- **33 个 Schema 文件** (server/src/database/schemas/): 全部表定义，迁移工具需要知道每张表的列名和类型
- **SqidsUtil** (server/src/common/utils/sqids.util.ts): Sqids 编解码器，id_seed 迁移后需要验证编码一致性
- **SettingsService** (server/src/settings/settings.service.ts): JWT_SECRET 动态读取模式
- **现有 spec 文件** (server/src/**/*.spec.ts): 单元测试模式参考

### Established Patterns
- API 兼容性测试模式：beforeAll 中初始化 NestJS 应用 + Sqids seed + JWT secret + 测试数据 → 每个测试用 supertest 发请求 → 断言响应格式
- 测试数据 seeding：直接用 db.insert() + onConflictDoNothing() 插入 users、user_groups、settings 等基础表
- Admin token 生成：jwt.sign({ user_id: publicID, user_group_id: publicID, permissions, iss }, secret, { algorithm: 'HS256', expiresIn: '15m' })
- 响应格式断言：expect(res.body).toHaveProperty('code', 200)、expect(res.body.data).toHaveProperty('id') 等
- Go 后端数据库支持 SQLite/PostgreSQL/MySQL 三种驱动，但默认用 SQLite
- Go 后端 Ent schema 自动迁移（Schema.Create），NestJS 用 drizzle-kit push

### Integration Points
- 迁移 CLI 是独立脚本，不依赖 NestJS 运行时，但需要读取 schema 定义了解表结构
- API 兼容性测试需要完整 NestJS 应用启动（AppModule）
- 迁移 CLI 的源 .db 路径和目标 .db 路径需要可配置
- 测试文件需要在 server/test/ 目录下，遵循 vitest 配置
- 迁移后的验证可以通过 API 兼容性测试来端到端验证

</code_context>

<specifics>
## Specific Ideas

- Go 后端 conf.ini 默认配置：Database.Type=sqlite, Database.Name=anheyu_app.db，数据库文件在 ./data/ 目录
- NestJS 后端 SQLite 路径：data/anheyu.db（与 Go 后端不同名，避免冲突）
- 迁移工具应支持的命令格式示例：`npx tsx scripts/migrate.ts --source ./data/anheyu_app.db --target ./data/anheyu.db`
- 关键迁移验证点：1) settings 表 id_seed 值一致 → Sqids 编码一致 2) settings 表 JWT_SECRET 值一致 → 现有 Token 有效 3) users 表数据完整 → 登录功能正常
- 33 张表按 FK 依赖大致排序：user_groups → users → settings → storage_policies → files/file_entities → articles → article_post_category_pivot/article_post_tag_pivot → post_categories/post_tags → pages → comments → links/link_categories/link_tags/link_tag_pivot → albums/album_categories → doc_series → direct_links → subscribers → notification_types/user_notification_configs/notifications → url_stats/visitor_logs/visitor_stats → metadata → entity
- API 兼容性测试文件大致分组：auth（4 endpoints）、settings（4）、user（3）、article（8）、post-category（4）、post-tag（4）、page（5）、public（6）、version（2）、file（6）、storage-policy（4）、thumbnail（2）、direct-link（5）、comment（10）、search（1）、statistics（7）、link（12）、album（6）、album-category（4）、doc-series（4）、rss（3）、sitemap（2）、music（2）、notification（4）、subscriber（4）、backup（4）、captcha（1）
- Go 后端 Ent schema 中有 mixin（如 DefaultMixin 提供创建/更新时间字段），迁移时需注意这些字段的命名约定

</specifics>

<deferred>
## Deferred Ideas

- PostgreSQL→SQLite 迁移支持 — Go 后端支持 PostgreSQL，如果将来有用户需要可扩展迁移工具。当前大多数用户用 SQLite
- MySQL→SQLite 迁移支持 — 同上，需求更少
- 增量迁移（只迁移新增数据） — 当前只需全量迁移，增量迁移属于新能力
- 双后端对比测试（同时跑 Go 和 NestJS 对比响应） — 当前用源码验证方式，双后端对比可作为锦上添花
- 迁移工具 Web UI — CLI 足够，UI 属于新能力
- 自动化 cutover 脚本（停止 Go 后端 → 迁移 → 启动 NestJS） — 超出当前范围

</deferred>

---

*Phase: 11-Migration & Integration*
*Context gathered: 2026-07-16*
