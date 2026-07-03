# Phase 4: Page & Public API - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

管理员可以 CRUD 页面（含自定义路径、JS/CSS、发布状态），访客可以按路径浏览公开页面，前端可访问版本信息 API。所有 API 响应格式必须与原 Go 后端完全兼容。

**交付物：**
- POST /api/pages — 创建页面（含 title、path、content、markdown_content、custom_js、custom_css、description、is_published、show_comment、sort）
- GET /api/pages — 管理员页面列表（分页、搜索、发布状态筛选）
- GET /api/pages/:id — 管理员获取单个页面（原始数字 ID）
- PUT /api/pages/:id — 更新页面（所有字段可选，指针类型）
- DELETE /api/pages/:id — 删除页面
- POST /api/pages/initialize — 初始化默认页面（隐私政策、Cookie 政策、版权声明）
- GET /api/public/pages/*path — 根据路径获取已发布页面（通配符匹配多级路径）
- GET /api/version — 获取版本信息（BuildInfo JSON 格式）
- GET /api/version/string — 获取版本字符串（纯文本格式）

**未实现但保留路由：**
- 页面评论功能依赖 Phase 06 Comment 模块

</domain>

<decisions>
## Implementation Decisions

### Page ID 处理
- **D-71:** Page 管理端（/api/pages/:id）使用原始数字 ID，不经过 Sqids 编码。与 Go 后端完全一致，Page 是唯一不使用 Sqids 公共 ID 的实体类型。PageRepository 的 ID 查询直接使用数字 ID，无需解码步骤。前端类型定义 CustomPage.id: number 证实 Page ID 是数字类型（参见 frontend/src/types/page-management.ts）
- **D-72:** Page 公开端（/api/public/pages/*path）使用路径路由而非 ID 路由。与 Go 后端 GetByPath 行为一致，路径是页面的主要标识
- **D-73:** Page 列表响应格式精确复制 Go 后端：`{ pages: PageResponse[], total: number, page: number, size: number }`。与文章列表的 `{ list, pagination }` 格式不同，但必须与 Go 后端保持一致

### Page 公开路由与可见性
- **D-74:** 公开页面端点使用通配符路径匹配：`GET /api/public/pages/*path`，支持多级路径（如 /docs/guide）。NestJS 中使用 `@Get('*path')` 装饰器实现，与 Gin 的 `c.Param("path")` 行为一致
- **D-75:** 公开端点只返回 is_published=true 的页面。未发布页面返回 404"页面不存在"，不暴露页面存在信息。与 Go 后端 GetByPath 行为一致
- **D-76:** 路径规范化逻辑复刻 Go 后端 normalizePath：去除首尾空格、确保以 / 开头、去除尾部 /（根路径除外）。GetByPath 还包含兼容历史数据的尾斜杠回退逻辑

### Page CRUD 细节
- **D-77:** Page Create DTO 必填字段：title、path、content（与 Go 后端 binding:"required" 一致）。可选字段：markdown_content、custom_js、custom_css、description、is_published、show_comment、sort
- **D-78:** Page Update DTO 所有字段可选（指针类型 *string/*bool/*int），与 Go 后端 UpdatePageOptions 一致。仅更新提供的字段
- **D-79:** Page 路径验证逻辑复刻 Go 后端 validatePath：不能为空、必须以 / 开头、不能包含空格和特殊字符（<, >, ", ', &, ?, #, =, +, ;）
- **D-80:** 创建/更新页面时检查路径唯一性。更新时如果修改了 path，需要验证新路径不与现有页面冲突（排除自身）
- **D-81:** Page 删除使用软删除（deletedAt 字段），与 pages 表 schema 中的 deleted_at 一致

### InitializeDefaultPages
- **D-82:** 完整复刻 Go 后端 InitializeDefaultPages 功能：创建三个默认页面（隐私政策 /privacy、Cookie 政策 /cookies、版权声明 /copyright），包含完整的中文内容和嵌入式 JavaScript
- **D-83:** 复刻 Go 后端 splitContentAndCustomJS 逻辑：使用正则提取 `<script>` 标签内容到 custom_js 字段，内容字段只保留非脚本部分。隐私政策页面有特殊的脚本拆分处理
- **D-84:** 初始化时检查页面是否已存在（按 path 查询），已存在则跳过。与 Go 后端 InitializeDefaultPages 的幂等行为一致
- **D-85:** 隐私政策页面的历史数据迁移逻辑：如果已存在的隐私政策页面 custom_js 为空，自动从 content/markdown_content 中提取脚本迁移到 custom_js。与 Go 后端的兼容逻辑一致

### Public 聚合端点
- **D-86:** PUBLIC-01 需求"聚合端点"指的是确保 /api/public/* 下所有公开端点正常工作，不是创建新的合并端点。Go 后端没有统一的"聚合"端点，各功能分散在 /api/public/ 下的不同子路径
- **D-87:** Phase 04 只实现 /api/public/pages/*path 和 /api/public/site-config（已在 Phase 02 实现）。其他 /api/public/* 端点（albums、comments、links、statistics 等）在对应 Phase 中实现

### Version 端点
- **D-88:** GET /api/version 返回 BuildInfo JSON：`{ version, commit, date, node_version }`。Go 后端的 go_version 字段替换为 node_version（Node.js 版本）。响应通过全局拦截器包装为 `{ code: 200, data: BuildInfo, message: "获取版本信息成功" }`
- **D-89:** GET /api/version/string 返回 `{ version: string }` JSON 格式，不经过全局拦截器包装（Go 后端直接 c.JSON 返回，不走 response.Success）。NestJS 中需要绕过全局拦截器，使用 @Res() 装饰器手动写入响应。前端当前不调用此端点，但需实现以保持 API 兼容性
- **D-90:** 版本信息通过构建时环境变量注入（VERSION、COMMIT、BUILD_DATE），运行时回退到 git 信息检测。与 Go 后端 ldflags 注入模式等效
- **D-91:** Version 端点设置 no-cache 响应头（Cache-Control: no-cache, no-store, must-revalidate, private, max-age=0；Pragma: no-cache；Expires: 0），与 Go 后端行为一致

### Page 模块组织
- **D-92:** PageModule 包含 PageController（管理端 + 公开页面获取）和 PageService、PageRepository。管理端和公开端点在同一个 Controller 中，用 @Public() 区分
- **D-93:** VersionModule 独立模块，包含 VersionController。VersionController 无依赖服务，直接读取构建时注入的版本信息

### Claude's Discretion
- PageRepository 的具体查询方法设计（Drizzle 查询构建方式）
- PageService 中路径规范化正则的具体实现细节
- splitContentAndCustomJS 正则的精确复制（scriptTagPattern）
- Version 信息注入的具体机制（环境变量 vs 构建脚本 vs 运行时检测）
- DTO 验证规则的具体细节（路径格式验证、搜索关键词长度限制）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端页面源码（API 兼容性的权威参考）
- `pkg/handler/page/page.go` — PageHandler：Create、GetByID、GetByPath、List、Update、Delete、InitializeDefaultPages
- `pkg/service/page/page.go` — PageService：Create、GetByID、GetByPath（含尾斜杠回退逻辑）、List、Update、Delete、InitializeDefaultPages、validatePath、normalizePath、splitContentAndCustomJS
- `pkg/domain/model/page.go` — Page、CreatePageOptions、UpdatePageOptions、ListPagesOptions 数据模型定义
- `ent/schema/page.go` — Page 表 Schema 定义

### Go 后端版本源码
- `pkg/handler/version/handler.go` — VersionHandler：GetVersion、GetVersionString
- `internal/pkg/version/version.go` — BuildInfo 结构体、GetBuildInfo、GetVersion、GetCommit、GetBuildDate、GetVersionString

### Go 后端公开端点源码
- `pkg/handler/public/handler.go` — PublicHandler（album 相关，Phase 04 不实现，但结构参考）

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，页面/版本/公开端点的路径和中间件组合：
  - pagesPublic: GET /api/public/pages/*path → pageHandler.GetByPath
  - pagesAdmin: POST/GET/PUT/DELETE /api/pages + POST /api/pages/initialize
  - versionGroup: GET /api/version + GET /api/version/string

### 现有 NestJS 代码（Phase 01/02/03 产出）
- `server/src/page/page.module.ts` — PageModule 占位
- `server/src/database/schemas/page.schema.ts` — pages 表 Schema（id, title, path, content, markdownContent, customJs, customCss, description, isPublished, showComment, sort, createdAt, updatedAt, deletedAt）
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/decorators/current-user.decorator.ts` — @CurrentUser() 装饰器
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器
- `server/src/article/public-article.controller.ts` — 公开端点 Controller 模式参考
- `server/src/settings/settings.service.ts` — SettingsService（内存缓存）
- `server/src/auth/auth.service.ts` — AuthService

### 前端页面 API 调用（确认请求/响应格式）
- `frontend/src/lib/api/page-management.ts` — 页面管理 API 服务：确认管理端用数字 ID、分页参数用 page_size、公开端用路径路由
- `frontend/src/types/page-management.ts` — CustomPage（id: number）、PageListParams（page_size）、PageListResponse（pages/total/page/size）、CreatePageRequest、UpdatePageRequest 类型定义
- `frontend/src/lib/version.ts` — 版本检测工具：确认前端期望 /api/version 返回 `{ code: 200, data: BuildInfo }` 格式

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-44，加上 Phase 03 的 D-45 到 D-70）
- `.planning/REQUIREMENTS.md` — 完整验收标准（PAGE-01, PUBLIC-01, VERSION-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Page Schema** (server/src/database/schemas/page.schema.ts): 已定义所有字段（id, title, path, content, markdownContent, customJs, customCss, description, isPublished, showComment, sort, createdAt, updatedAt, deletedAt），可直接使用
- **PageModule** (server/src/page/page.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **Guards**: JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现，可直接用于路由保护
- **@Public() decorator**: 公开路由跳过认证，用于 /api/public/pages/*path 等端点
- **@CurrentUser() decorator**: 从 request 中提取用户信息
- **ResponseInterceptor**: 全局包装 { code, data, message }，Controller 直接返回 data 即可
- **PublicArticleController** (server/src/article/public-article.controller.ts): 公开端点 Controller 模式参考 — @Public() 类装饰器 + @Controller('public/articles')
- **SettingsService**: 内存缓存 + 动态配置读取

### Established Patterns
- Go 后端 Page 不使用 Sqids 公共 ID，管理端直接使用数据库数字 ID
- Go 后端公开页面使用路径路由（/api/public/pages/*path），不是 ID 路由
- Go 后端 Page 列表响应格式 { pages, total, page, size }，与文章的 { list, pagination } 不同
- Go 后端页面路径规范化：trim、确保 / 开头、去除尾部 /（根路径除外）
- Go 后端路径验证：检查特殊字符（<, >, ", ', &, ?, #, =, +, ;）
- Go 后端 InitializeDefaultPages 创建三个默认页面，含完整中文内容和嵌入式 JavaScript
- Go 后端 splitContentAndCustomJS 用正则 `<script[^>]*>(.*?)</script>` 提取脚本
- Go 后端 GetByPath 有尾斜杠回退逻辑（兼容历史数据）
- Go 后端 Version 端点设置 no-cache 响应头
- Go 后端 GetVersionString 直接返回 JSON `{ version: string }`，不走 response.Success 包装

### Integration Points
- PageModule 需要注册到 AppModule
- VersionModule 需要注册到 AppModule
- /api/public/site-config 已在 Phase 02 实现，Phase 04 只需确保路由存在
- 页面评论功能（showComment 字段）依赖 Phase 06 Comment 模块
- Version 端点不需要认证，直接用 @Public() 标记

</code_context>

<specifics>
## Specific Ideas

- Go 后端 Page 模型的 ID 字段序列化为 JSON 数字（uint），不是 Sqids 编码字符串。前端管理页面的 URL 使用 /api/pages/1 这种数字 ID
- Go 后端 List 接口的分页参数使用 page_size（下划线格式），不是 pageSize（驼峰格式）。Go 后端响应用 size 而非 pageSize
- Go 后端 GetByPath 公开端点的路由是 `pagesPublic.GET("/*path", r.pageHandler.GetByPath)`，Gin 的通配符 /*path 可以匹配 /privacy、/docs/guide 等多级路径。NestJS 中需要用 @Get('*path') 实现
- Go 后端 InitializeDefaultPages 中的隐私政策页面内容非常长（约 300+ 行 Markdown），包含嵌入式 JavaScript 用于获取访客 IP 信息。需要精确复制这些内容
- Go 后端 splitContentAndCustomJS 使用 `(?is)<script[^>]*>(.*?)</script>` 正则，(?is) 表示单行模式 + 大小写不敏感
- Go 后端 Version Handler 的 GetVersion 手动返回 `{ code: 200, data: BuildInfo, message: "获取版本信息成功" }`（与 response.Success 格式相同，NestJS 走全局拦截器效果一致）。GetVersionString 直接返回 `{ version: string }`（不走 response.Success 包装），NestJS 中需用 @Res() 绕过拦截器
- 前端 /api/version 调用期望 `{ code: 200, data: { version, commit, date, go_version } }` 格式（参见 frontend/src/lib/version.ts 第 56 行 `result.code === 200 && result.data`）
- 前端 /api/version/string 端点当前未被调用，但需实现以保持 API 兼容性

</specifics>

<deferred>
## Deferred Ideas

- Page ID 统一使用 Sqids 编码 — 后续考虑是否统一。当前与 Go 后端一致使用原始数字 ID，但如果后续所有实体都统一 Sqids 编码，Page 也应该跟进。需要评估前端改动影响
- 页面评论功能 — 依赖 Phase 06 Comment 模块实现，Phase 04 只预留 showComment 字段

</deferred>

---

*Phase: 4-Page & Public API*
*Context gathered: 2026-07-03*
