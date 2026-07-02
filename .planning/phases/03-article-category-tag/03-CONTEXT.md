# Phase 3: Article & Category & Tag - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

管理员可以 CRUD 文章（含分类和标签），访客可以浏览、筛选、分页查看公开文章。这是博客 CMS 的核心内容管理功能。

**交付物：**
- POST /api/articles — 创建文章（含 Markdown 内容、封面图、SEO 元数据、分类/标签关联）
- PUT /api/articles/:id — 更新文章
- DELETE /api/articles/:id — 删除文章（软删除）
- GET /api/articles — 管理员文章列表（分页、筛选）
- GET /api/articles/:id — 管理员获取单篇文章
- POST /api/articles/upload — 文章图片上传（返回 501，依赖 Phase 05）
- POST /api/articles/primary-color — 获取文章主色调（管理员）
- POST /api/articles/export — 导出文章（管理员）
- POST /api/articles/import — 导入文章（管理员）
- DELETE /api/articles/batch — 批量删除文章（管理员）
- GET /api/public/articles — 公开文章列表（分页、分类筛选、标签筛选）
- GET /api/public/articles/home — 首页文章列表
- GET /api/public/articles/random — 随机文章
- GET /api/public/articles/archives — 归档列表
- GET /api/public/articles/statistics — 文章统计
- GET /api/public/articles/by-url — 按 URL 查询文章
- GET /api/public/articles/:id — 公开文章详情（含上下篇）
- GET /api/post-categories — 公开分类列表
- POST /api/post-categories — 创建分类（管理员）
- PUT /api/post-categories/:id — 更新分类（管理员）
- DELETE /api/post-categories/:id — 删除分类（管理员）
- GET /api/post-tags — 公开标签列表
- POST /api/post-tags — 创建标签（管理员）
- PUT /api/post-tags/:id — 更新标签（管理员）
- DELETE /api/post-tags/:id — 删除标签（管理员）
- 文章历史 CRUD（5 个端点：list, count, compare, get-version, restore）
- 文章 ID 编解码通过 Sqids 与 Go 后端一致
- 分类/标签 count 字段在文章 CRUD 时自动同步

**未实现但保留路由（返回 501）：**
- POST /api/articles/upload — 依赖 Phase 05 文件服务

</domain>

<decisions>
## Implementation Decisions

### Article Response Shape
- **D-45:** Article 响应模型完全对齐 Go 后端 ArticleResponse 结构：包含 id（Sqids 公共 ID）、title、contentMd、contentHtml、coverUrl、status、viewCount、wordCount、readingTime、primaryColor、summaries（JSON 数组）、abbrlink、copyright 相关字段、keywords、postCategories（嵌套对象数组）、postTags（嵌套对象数组）、owner（嵌套用户信息）、createdAt、updatedAt 等。Go 后端 ToAPIResponse 方法是权威参考
- **D-46:** Create/Update DTO 分离：CreateArticleDto 包含必填字段（title、status）+ 可选字段；UpdateArticleDto 所有字段可选（PartialType）。DTO 字段名使用 camelCase，与 Go 后端 JSON tag 一致
- **D-47:** 文章状态枚举：DRAFT、PUBLISHED、ARCHIVED、SCHEDULED 四种，与 Go 后端 status 字段一致。公开端点只返回 PUBLISHED 且未下架（isTakedown=false）的文章。SCHEDULED 状态配合 scheduledAt 字段用于定时发布
- **D-48:** 文章详情响应包含 prevArticle 和 nextArticle（仅公开端点），与 Go 后端 GetPublicByID 行为一致。上下篇按 createdAt 排序，同分类优先

### Public Article Listing
- **D-49:** 每个公开端点对应独立的 Service 方法，不使用统一 query builder。7 个公开端点返回不同数据形状：ListPublic 返回分页列表、ListHome 返回首页精选、GetRandom 返回单篇、ListArchives 返回按月归档、GetArticleStatistics 返回统计、GetByURL 返回按 URL 查询、GetPublic 返回详情含上下篇
- **D-50:** 公开文章列表分页参数对齐 Go 后端：page（默认 1）、pageSize（默认 10）、categoryId（可选 Sqids ID）、tagId（可选 Sqids ID）。响应格式 `{ list: ArticleResponse[], pagination: { page, pageSize, total } }`
- **D-51:** ListHome 端点返回 showOnHome=true 的已发布文章，按 homeSort + pinSort 排序。与 Go 后端 ListHome 行为一致
- **D-52:** ListArchives 返回按年月分组的文章摘要列表，格式 `{ archives: [{ year, month, count, articles: [{ id, title, createdAt }] }] }`。与 Go 后端 ListArchives 行为一致
- **D-53:** GetArticleStatistics 返回文章总数、各状态数量、分类数量、标签数量等统计信息。与 Go 后端 GetArticleStatistics 行为一致

### Article History Scope
- **D-54:** 文章历史功能纳入 Phase 03 范围。article_histories 表 Schema 已存在，Go 后端有 5 个历史端点（list, count, compare, get-version, restore），属于文章核心功能的一部分
- **D-55:** 文章历史在 Create 和 Update 时自动创建。Create 时创建 version=1；Update 时 version 自增。历史记录包含 title、contentMd、contentHtml、coverUrl、summaries、wordCount、keywords 等快照字段
- **D-56:** CompareVersions 端点返回两个版本之间的差异（字段级 diff），与 Go 后端 CompareVersions 行为一致

### Category/Tag Relationship
- **D-57:** Articles ↔ PostCategories 和 Articles ↔ PostTags 均使用多对多关系，通过两个联结表实现：article_post_categories（文章-分类）和 article_post_tags（文章-标签）。需要新建 article-post-category-pivot.schema.ts 和 article-post-tag-pivot.schema.ts 两个联结表。前端发送 post_category_ids: [...] 和 post_tag_ids: [...] 数组，与 Go 后端 M2M 模式完全一致
- **D-58:** PostCategories.count 和 PostTags.count 字段在文章 CRUD 时自动同步：创建文章时关联的分类/标签 count+1，删除文章时 count-1，更新文章时 diff 计算增量/减量。与 Go 后端 diffIDs 逻辑一致
- **D-59:** 分类和标签的 CRUD 端点独立于文章模块：PostCategoryModule 和 PostTagModule 各自包含 controller + service + repository。文章模块通过 Drizzle 关系查询关联分类和标签数据

### Article Module Organization
- **D-60:** ArticleModule 包含 ArticleController、ArticleService、ArticleRepository。ArticleController 处理管理员和用户端点（/api/articles/*），公开端点（/api/public/articles/*）也放在 ArticleController 中用 @Public() 装饰器标记
- **D-61:** ArticleHistoryModule 独立模块，包含 ArticleHistoryController、ArticleHistoryService、ArticleHistoryRepository。路由挂载在 /api/articles/:id/history/* 下
- **D-62:** PostCategoryModule 和 PostTagModule 各自独立，包含 controller + service + repository。公开端点（GET /api/post-categories、GET /api/post-tags）不需要认证，管理员端点需要 JwtAuth + AdminAuth

### Article ID Handling
- **D-63:** 所有文章 ID 参数（URL path、request body）使用 Sqids 公共 ID。Controller 层解码为数据库 ID 后传给 Service。与 Go 后端 idgen.DecodePublicID 模式一致
- **D-64:** 文章 abbrlink 字段作为 URL slug 使用。公开端点 GetPublic 和 GetByURL 支持 abbrlink 和 Sqids ID 双重查询。与 Go 后端 GetPublicBySlugOrID 行为一致

### View Count & Statistics
- **D-65:** 文章浏览量（viewCount）在公开文章详情端点调用时自增。使用内存计数器 + 定期批量写入数据库（Phase 10 定时任务完善），Phase 03 先实现简单自增
- **D-66:** 文章字数（wordCount）和阅读时间（readingTime）在 Create/Update 时自动计算。与 Go 后端 calculatePostStats 逻辑一致

### Primary Color
- **D-67:** 文章主色调（primaryColor）支持手动设置和自动提取两种模式。isPrimaryColorManual=true 时使用手动值，否则从封面图/topImgUrl 自动提取。Phase 03 实现手动设置 + 默认值，自动提取依赖图片处理（Phase 05 sharp 库），暂时返回默认色值

### Export/Import
- **D-68:** 文章导出（ExportArticles）返回 ZIP 文件，内含 JSON 数据 + Markdown 文件。与 Go 后端 ExportArticles 行为完全一致
- **D-69:** 文章导入（ImportArticles）接受 ZIP 文件，批量创建文章。与 Go 后端 ImportArticles 行为一致

### HTML Sanitization
- **D-70:** 使用 isomorphic-dompurify 在 Create/Update 时消毒 content_html，与 Go 后端的 SanitizeHTML 行为一致。安装 isomorphic-dompurify + @types/dompurify 依赖

### Claude's Discretion
- ArticleRepository 的具体查询方法设计（Drizzle 查询构建方式）
- ArticleService 中缓存策略的具体实现（哪些查询结果缓存、TTL 设置）
- DTO 验证规则的具体细节（字符串长度限制、枚举值验证）
- 文章历史 diff 算法的具体实现（字段级对比方式）
- 联结表的具体命名和索引设计
- 公开端点分页查询的性能优化策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端文章源码（API 兼容性的权威参考）
- `pkg/handler/article/handler.go` — ArticleHandler：List、Create、Update、Delete、Get、ListPublic、ListHome、GetRandom、ListArchives、GetArticleStatistics、GetByURL、GetPublic、UploadImage、GetPrimaryColor、ExportArticles、BatchDelete、ImportArticles
- `pkg/service/article/service.go` — ArticleService：ToAPIResponse（响应格式转换）、Create、Update、Delete、List、ListPublic、ListHome、GetRandom、ListArchives、GetArticleStatistics、GetPublicBySlugOrID、GetBySlugOrIDForPreview、validateAbbrlink、calculatePostStats、diffIDs、fillOwnerInfo
- `pkg/service/article/import_export_service.go` — 文章导入导出逻辑
- `pkg/domain/model/article.go` — ArticleResponse、SimpleArticleResponse、ArticleDetailResponse、CreateArticleRequest、UpdateArticleRequest、ListArticlesOptions、ListPublicArticlesOptions、ArticleStatistics、ArchiveSummaryResponse 等数据模型定义
- `ent/schema/article.go` — Article 表 Schema 定义（30+ 字段 + edges）
- `ent/schema/postcategory.go` — PostCategory 表 Schema 定义（name, slug, description, count, is_series, sort_order + edge to articles）
- `ent/schema/posttag.go` — PostTag 表 Schema 定义（name, slug, count + edge to articles）
- `ent/schema/tag.go` — Tag 表 Schema 定义（name only）

### Go 后端分类/标签源码
- `pkg/handler/post_category/handler.go` — PostCategoryHandler：Create、List、Update、Delete
- `pkg/handler/post_tag/handler.go` — PostTagHandler：Create、List、Update、Delete

### Go 后端文章历史源码
- `pkg/handler/article_history/handler.go` — ArticleHistoryHandler：ListHistory、GetVersion、CompareVersions、RestoreVersion、GetHistoryCount
- `ent/schema/articlehistory.go` — ArticleHistory 表 Schema 定义

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，文章/分类/标签/历史端点的路径和中间件组合

### 现有 NestJS 代码（Phase 01/02 产出）
- `server/src/article/article.module.ts` — ArticleModule 占位
- `server/src/database/schemas/article.schema.ts` — articles 表 Schema（30+ 字段 + 5 索引）
- `server/src/database/schemas/post-category.schema.ts` — post_categories 表 Schema
- `server/src/database/schemas/post-tag.schema.ts` — post_tags 表 Schema
- `server/src/database/schemas/tag.schema.ts` — tags 表 Schema
- `server/src/database/schemas/article-history.schema.ts` — article_histories 表 Schema
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/decorators/current-user.decorator.ts` — @CurrentUser() 装饰器
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器
- `server/src/settings/settings.service.ts` — SettingsService（内存缓存）
- `server/src/auth/auth.service.ts` — AuthService
- `server/src/auth/token.service.ts` — TokenService

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-44）
- `.planning/REQUIREMENTS.md` — 完整验收标准

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Article Schema** (server/src/database/schemas/article.schema.ts): 30+ 字段已定义，包含 status、coverUrl、summaries、abbrlink、copyright、extraConfig、isDoc、docSeriesId 等完整字段
- **PostCategory/PostTag/Tag Schemas**: 已定义基本字段（name, slug, count, description, sortOrder 等）
- **ArticleHistory Schema**: 已定义快照字段（version, title, contentMd, contentHtml, coverUrl, summaries, wordCount, keywords, editorId, changeNote 等）
- **Sqids Encoder** (server/src/common/utils/sqids.ts): 已实现 Go 兼容的编解码，支持 EntityType 常量
- **Guards**: JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现，可直接用于路由保护
- **@Public() decorator**: 公开路由跳过认证，用于 /api/public/articles/* 等端点
- **@CurrentUser() decorator**: 从 request 中提取用户信息，可用于 Controller 层获取操作者
- **ResponseInterceptor**: 全局包装 { code, data, message }，Controller 直接返回 data 即可
- **SettingsService**: 内存缓存 + 动态配置读取，可用于文章相关配置
- **Error Codes** (server/src/common/constants/): 错误码常量文件，可扩展文章相关错误码

### Established Patterns
- Go 后端文章 ID 使用 Sqids 公共 ID，URL 参数和响应中的 id 都是编码后的字符串
- Go 后端文章响应包含嵌套的 postCategories、postTags、owner 对象，不是简单的 ID 引用
- Go 后端 abbrlink 作为 URL slug 使用，公开端点支持 abbrlink 和 Sqids ID 双重查询
- Go 后端文章列表分页使用 page + pageSize 参数，响应包含 pagination 对象
- Go 后端文章状态：DRAFT/PUBLISHED/ARCHIVED，公开端点只返回 PUBLISHED 且 isTakedown=false
- Go 后端分类/标签 count 字段在文章关联变更时自动同步（diffIDs 增量计算）
- Go 后端文章历史在 Create/Update 时自动创建，version 自增
- Go 后端时间格式化使用中国时区（UTC+8），格式为 "2006-01-02 15:04:05"

### Integration Points
- ArticleModule 需要注册到 AppModule
- ArticleHistoryModule 需要注册到 AppModule
- PostCategoryModule 和 PostTagModule 需要注册到 AppModule
- 文章创建/更新时需要调用 Sqids 编码生成公共 ID
- 文章详情需要关联查询分类、标签、作者信息
- 文章浏览量自增需要与 Phase 10 定时任务协调
- 文章图片上传（/api/articles/upload）返回 501，Phase 05 实现后对接
- 文章主色调自动提取依赖 Phase 05 sharp 库

### Missing Schemas
- **article_post_category_pivot.schema.ts**: 文章-分类多对多联结表需要新建
- **article_post_tag_pivot.schema.ts**: 文章-标签多对多联结表需要新建

</code_context>

<specifics>
## Specific Ideas

- Go 后端 ToAPIResponse 方法是文章响应格式的权威参考，包含 30+ 字段的映射逻辑，NestJS 的 ArticleService.toApiResponse 必须精确复制
- Go 后端文章与分类是一对多关系（一篇文章属于一个分类），与标签是多对多关系（一篇文章可有多个标签）。ent schema 中 article edge.To("post_categories", PostCategory.Type) 实际是 O2M 而非 M2M
- Go 后端 diffIDs 函数计算分类/标签关联变更的增量/减量，用于同步 count 字段
- Go 后端 fillOwnerInfo 填充文章作者信息（昵称、头像），使用缓存避免重复查询
- Go 后端 validateAbbrlink 确保 abbrlink 唯一性，创建/更新时都需要验证
- Go 后端 calculatePostStats 从 Markdown 内容计算字数和阅读时间

</specifics>

<deferred>
## Deferred Ideas

- 文章图片上传（/api/articles/upload）— 留待 Phase 05 文件上传完成后实现，依赖文件服务、存储策略
- 文章主色调自动提取 — 留待 Phase 05 sharp 库集成后实现，Phase 03 只支持手动设置 + 默认值
- 文章浏览量批量写入优化 — Phase 03 实现简单自增，Phase 10 定时任务完善批量写入
- PRO 功能（付费文章、密码保护、登录可见）— Out of Scope，不属于任何当前阶段
- 定时发布执行 — Phase 03 只支持 SCHEDULED 状态和 scheduledAt 字段存储，实际定时发布逻辑留待 Phase 10 定时任务

</deferred>

---

*Phase: 3-Article & Category & Tag*
*Context gathered: 2026-07-02*
