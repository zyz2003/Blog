# Phase 06: Comment & Search - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

访客可以发表评论和浏览带有嵌套回复的评论；所有用户可以通过 FTS5 全文搜索文章。评论支持嵌套回复、审核工作流、点赞/取消点赞、置顶、图片上传。搜索使用 SQLite FTS5 实现文章全文检索。

**交付物：**
- GET /api/public/comments — ListByPath（按目标路径获取评论树）
- GET /api/public/comments/latest — ListLatest（全站最新评论）
- GET /api/public/comments/:id/children — ListChildren（获取子评论）
- POST /api/public/comments — Create（JWT optional，访客/管理员发表评论）
- POST /api/public/comments/upload — UploadImage（JWT optional，评论图片上传）
- POST /api/public/comments/:id/like — LikeComment（点赞）
- POST /api/public/comments/:id/unlike — UnlikeComment（取消点赞）
- GET /api/comments — AdminList（管理员评论列表，含筛选）
- DELETE /api/comments — Delete（批量删除评论）
- PUT /api/comments/:id — UpdateContent（管理员更新评论内容）
- PUT /api/comments/:id/info — UpdateCommentInfo（管理员更新评论信息）
- PUT /api/comments/:id/status — UpdateStatus（管理员更新评论状态）
- PUT /api/comments/:id/pin — SetPin（管理员置顶/取消置顶）
- GET /api/search — Search（全文搜索文章）
- GET /api/public/weather/ip-location — GetIPLocation（IP 地理位置查询）

</domain>

<decisions>
## Implementation Decisions

### Comment Schema & Data Model
- **D-115:** 使用 Phase 01 已定义的 `comments` 表 Schema（comment.schema.ts），包含完整字段：id, createdAt, updatedAt, deletedAt, targetPath, targetTitle, userId, parentId, replyToId, nickname, email, emailMd5, website, content, contentHtml, status, isAdminComment, isAnonymous, userAgent, ipAddress, ipLocation, likeCount, pinnedAt。无需修改 Schema
- **D-116:** 评论 ID 使用 Sqids 编码（EntityTypeComment）。所有公开端点的 :id 参数和响应中的 id 字段都是 Sqids 编码的公共 ID。管理员端点 /api/comments/:id 同样使用 Sqids 编码
- **D-117:** 评论状态枚举：1=已发布(Published), 2=待审核(Pending), 3=已拒绝(Rejected)。新评论默认 status=2（待审核），除非管理员评论默认 status=1。与 Go 后端一致

### Comment Nested Reply
- **D-118:** 评论嵌套使用 `parentId`（顶级评论 ID）+ `replyToId`（直接回复目标 ID）双字段模型。与 Go 后端 Comment schema 完全一致。`parentId` 标识顶级评论（用于树形结构），`replyToId` 标识直接回复的评论（用于对话链）。直接回复顶级评论时 replyToId 可以等于 parentId 或为空
- **D-119:** ListByPath 端点完整复刻 Go 后端的内存建树算法：1) 一次性获取该路径下所有已发布评论（最多 500 条）→ 2) 在内存中构建评论树（rootComments + descendantsMap）→ 3) 根评论排序（置顶优先，然后按 createdAt 倒序）→ 4) 根评论分页 → 5) 每个根评论返回前 3 个链头（chainHeads）及其完整对话链。与 Go 后端 ListByPath 行为完全一致
- **D-120:** ListChildren 端点获取指定评论的所有子评论（直接回复和间接回复），分页返回。与 Go 后端 ListChildren 行为一致
- **D-121:** ListLatest 端点返回全站最新已发布评论列表（扁平列表，不建树）。批量查询父评论和回复目标评论填充 replyTo 信息。与 Go 后端 ListLatest 行为一致

### Comment Content Pipeline
- **D-122:** 评论 Markdown→HTML 使用 `marked` 库。与 Phase 03 文章的 HTML 处理独立（文章使用 markdown-it 或其他库），评论使用 marked 因为它更轻量且支持评论所需的扩展（自动链接、emoji 等）。安装 marked + @types/marked
- **D-123:** 评论图片 URL 重写复刻 Go 后端 `renderHTMLURLs`：将评论 HTML 中的图片 URL 追加 `!styleName` 后缀（如果 ImageStyleService 可用且 comment_image 策略启用了 image_process.default_style）。如果 ImageStyleService 不可用则保持原 URL 不变
- **D-124:** 评论 HTML 清理使用 `isomorphic-dompurify`（Phase 03 已引入 D-70），与文章 HTML 清理保持一致。清理在 Markdown→HTML 转换后执行
- **D-125:** 评论内容字段存储：`content` 存储 Markdown 原文，`contentHtml` 存储经 marked 渲染 + dompurify 清理后的安全 HTML。与 Go 后端双字段存储模式一致

### Comment Create Flow
- **D-126:** 评论创建完整复刻 Go 后端 Create 流程：1) IP 速率限制检查 → 2) 解码 parentId/replyToId（Sqids→DB ID）→ 3) 验证父评论存在且属于同一 targetPath → 4) 验证回复目标存在且非匿名评论 → 5) Markdown→HTML 渲染 → 6) 计算 emailMd5 → 7) IP 地理位置查询 → 8) 违禁词检测 → 9) 判断是否管理员评论 → 10) 匿名评论验证 → 11) 创建评论记录 → 12) 通知推送
- **D-127:** 管理员评论判断：如果 JWT claims 存在且用户是管理员（userGroupId=1）且评论邮箱与管理员邮箱匹配，则 isAdminComment=true 且 status=Published。匿名评论不允许被回复
- **D-128:** 匿名评论验证：如果前端标记 isAnonymous=true，验证邮箱与 settings 中的 `comment_anonymous_email` 匹配。不匹配则拒绝。与 Go 后端一致
- **D-129:** 非管理员评论如果邮箱与管理员邮箱匹配，返回错误（`ErrAdminEmailUsedByGuest`）。与 Go 后端一致

### Comment Rate Limiting & Anti-Spam
- **D-130:** 评论速率限制复刻 Go 后端逻辑：从 settings 读取 `comment_limit_per_minute`，使用内存 Map 记录 IP+分钟维度的评论计数。key 格式 `comment:rate_limit:{ip}:{minute}`，计数超过限制时返回错误"您的评论太频繁了，请稍后再试"。与 Go 后端使用 Redis Increment 模式等效
- **D-131:** 违禁词检测复刻 Go 后端：从 settings 读取 `comment_forbidden_words`（逗号分隔），检测评论内容是否包含违禁词。包含违禁词的评论 status=Pending（待审核），不阻止发布但需要管理员审核。与 Go 后端一致
- **D-132:** AI 违禁词检测（Go 后端 `comment_ai_detect_enable`）Phase 06 暂不实现。预留接口和 settings key，实际 AI 检测功能留待后续阶段。AI 检测需要外部 API 调用，复杂度较高且非核心功能

### Comment Like/Unlike & Pin
- **D-133:** LikeComment/UnlikeComment 使用 Sqids 解码评论 ID 后直接对 likeCount 字段 +1/-1（最小值 0）。返回更新后的 likeCount 数值。与 Go 后端行为一致
- **D-134:** SetPin 复刻 Go 后端：isPinned=true 时设置 pinnedAt=当前时间，isPinned=false 时清空 pinnedAt（设为 NULL）。置顶评论在 ListByPath 中排在最前面（按 pinnedAt 倒序）。与 Go 后端 SetPin 行为一致

### Comment Admin Operations
- **D-135:** AdminList 端点支持筛选参数：page, pageSize, nickname, email, targetPath, ipAddress, content, status。与 Go 后端 AdminListRequest DTO 完全一致。返回包含管理员工具所需信息的评论列表（email, ipAddress, content 原文, status）
- **D-136:** 批量删除评论（DELETE /api/comments）接收 `{ ids: string[] }` body，ids 为 Sqids 编码的公共 ID 数组。使用软删除（设置 deletedAt）。与 Go 后端一致
- **D-137:** UpdateContent 更新评论 Markdown 内容，同时重新渲染 HTML（marked + dompurify）。UpdateCommentInfo 更新评论的 nickname/email/website 等用户信息。与 Go 后端两个独立更新端点一致

### Comment Response Format
- **D-138:** 评论响应 DTO 精确复制 Go 后端 dto.Response 结构：id（Sqids）, created_at, pinned_at, nickname, email_md5, qq_number, avatar_url, website, content_html, is_admin_comment, is_anonymous, ip_location, user_agent, target_path, target_title, parent_id, reply_to_id, reply_to_nick, like_count, total_children, children[]。管理员工具字段（email, ip_address, content, status）仅在管理员视图中返回
- **D-139:** ListByPath 响应格式：`{ list: Response[], total: number, total_with_children: number, page: number, pageSize: number, has_more: boolean }`。total 是根评论数（分页依据），total_with_children 包含所有子评论数（前端展示）。has_more 表示是否达到 500 条上限。与 Go 后端 ListResponse 完全一致
- **D-140:** ListLatest 响应格式同 ListResponse，但 total = total_with_children（扁平列表无子评论树）。children 为空数组

### Comment Image Upload
- **D-141:** 评论图片上传复用 Phase 05 的 UploadService，使用 `comment_image` 存储策略标志。与 Go 后端 UploadCommentImage 行为一致。返回 `{ id: string }`（文件 Sqids 公共 ID）
- **D-142:** 评论图片上传端点使用 JwtAuthOptionalGuard（允许访客上传），使用 multer 中间件接收单文件

### IP Geolocation & Weather
- **D-143:** IP 地理位置使用 NSUUU API（`https://api.nsuuu.com/api/ip-location`），与 Go 后端 GeoIPService 一致。查询失败时 ipLocation 默认为"未知"
- **D-144:** 天气 IP 定位端点（GET /api/public/weather/ip-location）复刻 Go 后端 GetIPLocation：返回 IP 对应的地理位置信息（经纬度、城市等），如果 IP 是局域网或无法定位，返回 settings 中的 `sidebar.weather.rectangle` 默认坐标。与 Go 后端 GetIPLocation 行为一致

### Search — FTS5 Engine
- **D-145:** 使用 SQLite FTS5 替代 Go 后端的三种搜索引擎（SimpleSearcher/RedisSearcher/MeiliSearchSearcher）。FTS5 是 SQLite 内置扩展，零外部依赖，符合项目目标。创建虚拟 FTS5 表 `articles_fts`，使用 `content=''` contentless 模式（数据存储在主 articles 表，FTS5 只存索引）
- **D-146:** FTS5 tokenizer 使用 `unicode61` 并设置 `tokens "0"`（禁用分隔符标记化），以更好地支持中文搜索。unicode61 支持 CJK 字符按字符分词，对个人博客场景足够。Go 后端的 unigram+bigram 中文分词更精确，但 FTS5 的 unicode61 在标准 SQL 中无法实现等价的 bigram 功能，接受此精度差异
- **D-147:** FTS5 索引列：title（权重 10.0）、content（权重 1.0）、keywords（权重 5.0）。使用 `bm25(articles_fts, 10.0, 1.0, 5.0)` 排序函数实现加权搜索。title 权重最高，keywords 次之，content 最低。与 Go 后端 SimpleSearcher 的 title+10/content+1 评分逻辑等效
- **D-148:** 搜索结果格式精确复制 Go 后端 SearchResult/SearchHit 结构：`{ pagination: { total, page, size, totalPages }, hits: [{ id, type, url, title, snippet, author, category, tags, publish_date, cover_url, abbrlink, view_count, word_count, reading_time }] }`。id 为文章 Sqids 公共 ID，type 自动填充为 "post" 或 "doc"，url 根据 type 生成 "/posts/{abbrlink}" 或 "/doc/{id}"
- **D-149:** 搜索端点 GET /api/search 不需要认证（@Public()）。参数：q（搜索关键词）、page（默认 1）、size（默认 10）。与 Go 后端 Search handler 一致

### FTS5 Index Lifecycle
- **D-150:** FTS5 索引在应用启动时全量重建：从 articles 表读取所有已发布文章，INSERT INTO articles_fts 填充索引。启动时重建确保索引与数据库数据一致（避免增量更新遗漏）
- **D-151:** 文章 CRUD 时通过 ArticleService hooks 增量更新 FTS5 索引：Create → INSERT 索引、Update → DELETE+重新 INSERT、Delete → DELETE 索引。通过 SearchService 的 IndexArticle/DeleteArticle 方法实现，与 Go 后端 SearchService.IndexArticle/DeleteArticle 接口等效
- **D-152:** 搜索的 snippet（摘要）从文章 contentHtml 中提取：去除 HTML 标签后截取前 150 个字符，超过则追加 "..."。与 Go 后端 SimpleSearcher.articleToSearchHit 的摘要生成逻辑一致

### Comment Notification Push
- **D-153:** 评论创建后的通知推送分两部分：1) Pushoo 即时推送（微信/钉钉等）→ Phase 06 实现调用点和框架，从 settings 读取 `pushoo_channel`/`pushoo_token` 等配置，如果未配置则静默跳过。2) 站内通知 → 延迟到 Phase 09（NOTIF-01），Phase 06 只预留 INotificationService 接口 stub
- **D-154:** 评论邮件通知（Go 后端通过 broker.DispatchCommentNotification 异步发送）→ Phase 06 不实现邮件发送。Phase 06 在评论创建后记录日志，邮件通知框架留待 Phase 09 通知模块实现
- **D-155:** Pushoo 推送逻辑复刻 Go 后端的两个场景：场景一 — 通知管理员有新评论（顶级评论或回复普通用户的评论）；场景二 — 通知被回复者有新回复（仅当被回复者是管理员时发送即时通知）。避免自己通知自己

### QQ Info Lookup
- **D-156:** QQ 信息查询（GET /api/public/comments/qq-info）Phase 06 暂不实现。Go 后端通过 QQ 邮箱格式检测提取 QQ 号，然后调用外部 API 获取 QQ 头像和昵称。需要外部 API 依赖，复杂度中等但非核心功能。响应 DTO 中 qq_number 字段预留为 optional

### Module Organization
- **D-157:** CommentModule 包含 CommentController（公开端点 + 管理员端点）、CommentService、CommentRepository。公开端点使用 @Public() + JwtAuthOptionalGuard，管理员端点使用 AdminGuard。与 Phase 03/04 的 Controller 组织模式一致
- **D-158:** SearchModule 包含 SearchController、SearchService。SearchService 负责全文搜索和 FTS5 索引管理（IndexArticle/DeleteArticle/RebuildAllIndexes）。SearchController 只有一个端点 GET /api/search
- **D-159:** WeatherModule 独立模块（或在 CommentModule 中作为子模块），包含 WeatherController。WeatherController 处理 GET /api/public/weather/ip-location 端点

### Claude's Discretion
- CommentRepository 的具体查询方法设计（Drizzle 查询构建方式）
- CommentService 中 Markdown→HTML 的 marked 配置（扩展、插件）
- FTS5 虚拟表的精确 CREATE TABLE 语句和触发器设计
- SearchService 中 snippet 提取的具体实现（HTML 标签清理 + 截断）
- IP 地理位置查询的错误处理和缓存策略
- Pushoo 推送服务的具体 HTTP 请求实现
- 评论图片 URL 重写（renderHTMLURLs）的正则表达式细节
- CommentController 中管理员视图字段的条件返回策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端评论源码（API 兼容性的权威参考）
- `pkg/handler/comment/handler.go` — CommentHandler：ListChildren, UploadCommentImage, ListLatest, SetPin, UpdateStatus, Create, ListByPath, LikeComment, UnlikeComment, AdminList, Delete, UpdateContent, UpdateCommentInfo, GetQQInfo, GetIPLocation, ExportComments, ImportComments
- `pkg/service/comment/service.go` — CommentService：Create（含速率限制、违禁词检测、管理员判断、匿名验证、通知推送）、ListByPath（内存建树分页算法）、ListLatest、ListChildren、LikeComment、UnlikeComment、UpdateStatus、SetPin、UpdateContent、UpdateCommentInfo、toResponseDTO、renderHTMLURLs
- `pkg/handler/comment/dto/dto.go` — CreateRequest, AdminListRequest, DeleteRequest, UpdateStatusRequest, SetPinRequest, UpdateContentRequest, UpdateCommentRequest, Response, ListResponse, UploadImageResponse 等 DTO 定义
- `ent/schema/comment.go` — Comment 表 Schema 定义（30+ 字段 + edges + indexes）

### Go 后端搜索源码
- `pkg/handler/search/handler.go` — SearchHandler：Search 端点
- `pkg/service/search/search_service.go` — SearchService：Search（含 SearchProvider 扩展）、IndexArticle、DeleteArticle、RebuildAllIndexes、InitializeSearchEngine、normalizeSearchHits
- `pkg/service/search/simple_searcher.go` — SimpleSearcher（降级搜索实现）：Search、articleToSearchHit、tokenize
- `pkg/service/search/redis_searcher.go` — RedisSearcher：tokenize 函数（unigram+bigram 中文分词算法参考）
- `pkg/domain/model/search.go` — SearchResult, SearchPagination, SearchHit, Searcher interface, IndexedArticle 数据模型

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，评论/搜索/天气端点的路径和中间件组合：
  - commentsPublic: GET/POST /api/public/comments/*（含 JWTAuthOptional）
  - commentsAdmin: GET/DELETE/PUT /api/comments/*
  - searchGroup: GET /api/search
  - weatherGroup: GET /api/public/weather/ip-location

### 现有 NestJS 代码（Phase 01-05 产出）
- `server/src/comment/comment.module.ts` — CommentModule 空占位
- `server/src/search/search.module.ts` — SearchModule 空占位
- `server/src/database/schemas/comment.schema.ts` — comments 表 Schema（完整字段 + 4 个索引）
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/decorators/current-user.decorator.ts` — @CurrentUser() 装饰器
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器（需确认 EntityTypeComment 已定义）
- `server/src/common/constants/error-codes.ts` — 错误码常量文件（需扩展评论/搜索相关错误码）
- `server/src/settings/settings.service.ts` — SettingsService（内存缓存 + 动态配置读取）
- `server/src/file/upload.service.ts` — UploadService（评论图片上传复用，PolicyFlagCommentImage）
- `server/src/article/article.service.ts` — ArticleService（FTS5 索引 hook 需要对接）

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-114）
- `.planning/REQUIREMENTS.md` — 完整验收标准（COMMENT-01, SEARCH-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Comment Schema** (server/src/database/schemas/comment.schema.ts): 完整字段已定义，包含 4 个索引（target_path+status, parent_id, user_id, email），可直接使用
- **SearchModule** (server/src/search/search.module.ts): 空模块占位，需要添加 Controller/Service
- **CommentModule** (server/src/comment/comment.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **Guards**: JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现，可直接用于路由保护
- **@Public() decorator**: 公开路由跳过认证
- **@CurrentUser() decorator**: 从 request 中提取用户信息
- **ResponseInterceptor**: 全局包装 { code, data, message }，Controller 直接返回 data 即可
- **Sqids Encoder** (server/src/common/utils/sqids.ts): 需确认 EntityTypeComment 常量已定义，评论 ID 编解码需要
- **SettingsService**: 内存缓存 + 动态配置读取，用于读取 comment_limit_per_minute、comment_forbidden_words 等设置
- **UploadService** (server/src/file/upload.service.ts): 评论图片上传可复用，PolicyFlagCommentImage 已在 Phase 05 定义
- **Error Codes**: 已有错误码常量文件，需扩展评论/搜索相关错误码

### Established Patterns
- Go 后端评论使用 parentId + replyToId 双字段模型实现嵌套回复，replyToId 优先，向后兼容使用 parent
- Go 后端 ListByPath 使用内存建树算法：全量加载 → 建树 → 根分页 → 链头预览（3个）+ 对话链
- Go 后端评论创建流程包含：速率限制 → 验证 → Markdown渲染 → 违禁词检测 → 管理员判断 → 匿名验证 → 创建 → 通知
- Go 后端搜索使用降级链：插件搜索 > Redis > Simple（内存）。NestJS 统一使用 FTS5
- Go 后端搜索结果自动填充 type 字段（post/doc）和 url 字段（/posts/{abbrlink} 或 /doc/{id}）
- Go 后端评论管理员列表返回额外字段（email, ipAddress, content, status），公开列表不返回
- Go 后端评论软删除（SoftDeleteMixin），NestJS 使用 deletedAt 字段

### Integration Points
- CommentModule 需要注册到 AppModule
- SearchModule 需要注册到 AppModule
- ArticleService 的 Create/Update/Delete 方法需要调用 SearchService.IndexArticle/DeleteArticle 更新 FTS5 索引
- 评论图片上传复用 FileModule 的 UploadService（Phase 05 已实现）
- IP 地理位置查询使用外部 NSUUU API
- 评论通知推送使用 Pushoo API（从 settings 读取配置）
- FTS5 索引需要在应用启动时全量重建
- Sqids 编解码器需要确认 EntityTypeComment 常量存在

</code_context>

<specifics>
## Specific Ideas

- Go 后端评论的 Response DTO 包含 qq_number 和 avatar_url 字段：qq_number 从 QQ 邮箱格式检测提取，avatar_url 从关联用户的头像获取。Phase 06 暂不实现 QQ 信息查询，qq_number 字段预留为 optional
- Go 后端 ListByPath 的内存建树算法非常精巧：先找根评论，再构建 descendantsMap，然后对根评论排序（置顶优先 + 时间倒序），分页后每个根评论只返回前 3 个链头及其完整对话链。NestJS 必须精确复刻此逻辑
- Go 后端评论创建的违禁词检测分两层：1) 基础违禁词（settings comment_forbidden_words 逗号分隔）→ status=Pending；2) AI 违禁词（settings comment_ai_detect_enable + 外部 API）→ reject 或 status=Pending。Phase 06 只实现基础违禁词检测
- Go 后端 toResponseDTO 在管理员视图中额外返回 email、ipAddress、content（Markdown 原文）、status 字段。非管理员视图中这些字段为 undefined/省略。NestJS 使用 isAdmin 参数控制
- Go 后端评论创建后如果 status=Published，会触发三个通知流程：1) broker.DispatchCommentNotification（邮件通知）、2) inAppNotificationCallback（站内通知）、3) pushooSvc.SendCommentNotification（即时推送）。Phase 06 只实现 Pushoo 即时推送的框架
- Go 后端搜索的 normalizeSearchHits 自动为没有 type 的搜索结果填充 type 和 url：isDoc=true → type="doc" + url="/doc/{id}"，否则 type="post" + url="/posts/{abbrlink}"。NestJS 必须复刻此逻辑
- FTS5 的 unicode61 tokenizer 对中文的基本分词是按单个 CJK 字符，这对于中文搜索来说足够（个人博客场景），但不如 Go 的 unigram+bigram 精确。可在后续阶段考虑使用 jieba-wasm 或 ICU tokenizer 提升中文分词质量
- Go 后端评论的匿名评论验证逻辑：前端传 isAnonymous=true 时，后端验证 email 与 settings 中的 comment_anonymous_email 匹配。不匹配则拒绝。匿名评论不允许被回复

</specifics>

<deferred>
## Deferred Ideas

- QQ 信息查询（GET /api/public/comments/qq-info）— 需要外部 QQ API 依赖，非核心功能，后续阶段按需实现
- AI 违禁词检测（comment_ai_detect_enable）— 需要外部 AI API 依赖，复杂度较高，后续阶段按需实现
- 评论导出/导入（ExportComments/ImportComments）— 管理员功能，低优先级，后续阶段按需实现
- 评论邮件通知（broker.DispatchCommentNotification）— 依赖邮件服务基础设施，Phase 09 通知模块实现
- 站内通知（inAppNotificationCallback）— Phase 09 通知模块实现（NOTIF-01）
- FTS5 中文分词优化（jieba-wasm 或 ICU tokenizer）— 后续阶段按需优化，当前 unicode61 基础分词对个人博客足够
- SearchProvider 扩展机制 — Go 后端的 SearchService 支持注册额外搜索内容提供者（如 Pro 版专属搜索），Phase 06 不实现此扩展点
- 评论审核邮件通知（审核通过后通知评论者）— 后续阶段按需实现

</deferred>

---

*Phase: 06-Comment & Search*
*Context gathered: 2026-07-06*
