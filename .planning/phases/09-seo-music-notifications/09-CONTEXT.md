# Phase 09: SEO & Music & Notifications - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

RSS/Sitemap XML 订阅源；音乐播放列表 API（网易云音乐代理）；通知类型管理+用户通知配置+站内通知；订阅者管理（邮箱订阅/退订/验证码）。百分百复刻 Go 后端的四个功能模块，并在通知模块基础上新增站内通知存储。

**交付物：**

RSS 端点：
- GET /rss.xml — RSS 2.0 feed（手动 XML 拼接）
- GET /feed.xml — 同 /rss.xml
- GET /atom.xml — 同 /rss.xml，Content-Type 为 application/atom+xml

Sitemap 端点：
- GET /sitemap.xml — XML 格式站点地图
- GET /robots.txt — 搜索引擎爬虫规则

音乐公开端点：
- GET /api/public/music/playlist — 获取播放列表
- POST /api/public/music/song-resources — 获取歌曲资源（音频URL+歌词）

通知管理端点：
- GET /api/notification/types — 获取所有通知类型（管理员）
- GET /api/user/notification-settings — 获取用户通知设置（简化版）
- PUT /api/user/notification-settings — 更新用户通知设置（简化版）
- GET /api/user/notification-configs — 获取用户通知配置详情（完整版）

站内通知端点（新增，Go 后端不存在）：
- GET /api/user/notifications — 获取用户通知列表
- PUT /api/user/notifications/:id/read — 标记通知已读
- PUT /api/user/notifications/read-all — 全部标记已读
- GET /api/user/notifications/unread-count — 获取未读通知数

订阅者公开端点：
- POST /api/public/subscribe — 订阅博客（含验证码验证）
- POST /api/public/subscribe/code — 发送验证码（含人机验证）
- POST /api/public/unsubscribe — 邮箱退订
- GET /api/public/unsubscribe/:token — 令牌退订

</domain>

<decisions>
## Implementation Decisions

### 订阅验证码与邮件
- **D-205:** 订阅验证码用内存 Map + TTL 存储（key: `subscribe:code:{email}`，TTL 5分钟），替代 Go 后端的 Redis。与项目其他模块一致（D-07, D-161），验证码是短时效数据，进程重启丢失可接受
- **D-206:** 邮件服务用 nodemailer + SMTP 实现，从 settings 读取 SMTP 配置（host/port/user/pass/from），未配置则静默跳过。安装 nodemailer + @types/nodemailer。提供 EmailService 接口，支持：1) SendVerificationEmail（发送验证码邮件）2) SendArticlePushEmail（发送文章发布通知邮件，含退订链接）
- **D-207:** 订阅时复用 Phase 02 的 CaptchaService 做人机验证。SendVerificationCode 端点接收 CaptchaParams（Turnstile/极验/系统验证码），验证通过后发送邮件验证码
- **D-208:** 完整复刻 Go 后端 3 个订阅/退订端点 + SendVerificationCode。Subscribe 时如果邮箱已存在且 isActive=false 则重新激活；Unsubscribe 通过邮箱退订；UnsubscribeByToken 通过令牌退订（邮件链接点击）。Subscribe 端点有速率限制（Go 后端 CustomRateLimit(3, 3)）

### 音乐API代理策略
- **D-209:** 完整复刻音乐服务核心逻辑：FetchPlaylist（调用外部 metings API 获取网易云歌单）+ FetchSongResources（调用 Song_V1 API 获取音频URL+歌词，先 exhigh 音质失败降级 standard）+ 图片URL优化（90y90→150y150，含缓存和并发控制）+ NeteaseID 验证（正则 `^\d{6,12}$`）。从 settings 读取 `music.player.playlist_id` 和 `MUSIC_PLAYER_PLAYLIST_ID`，默认 8152976493
- **D-210:** 跳过 SSL 证书验证（与 Go 后端 InsecureSkipVerify 一致），因为 metings.qjqq.cn 证书由未知 CA 签名。Node.js HTTP 客户端设置 rejectUnauthorized: false
- **D-211:** 播放列表缓存 5 分钟（内存 Map），歌曲资源不缓存（音频 URL 有时效性）。Go 后端音乐服务无缓存，NestJS 新增缓存减少外部 API 调用。key: `music:playlist`，TTL 5分钟
- **D-212:** 完整复刻 Go 后端音乐服务日志：请求日志（方法/URL/参数/时间）、响应日志（状态码/耗时/大小/性能评级）、错误日志（分类：timeout/connection/json-parse/data-parse/context-timeout）、JSON结构分析（字段/key/嵌套结构摘要）。使用 NestJS Logger 标准格式

### RSS/Sitemap缓存策略
- **D-213:** RSS feed 用内存 Map 缓存（key: `rss:feed:latest`，TTL 1小时），替代 Go 后端的 Redis 缓存。缓存 feed 结构体（RSSFeed），每次请求先检查缓存
- **D-214:** Sitemap 不缓存（与 Go 后端一致），每次请求都重新生成。Sitemap 请求频率低（搜索引擎偶尔抓取），不值得缓存
- **D-215:** 文章 CRUD 时显式调用 RssService.invalidateCache() 清除 RSS 缓存。与 Go 后端 InvalidateCache 一致，确保新文章发布后 RSS feed 立即更新。需要在 ArticleService 的 Create/Update/Delete 方法中添加缓存失效调用
- **D-216:** RSS XML 用手动字符串拼接生成（与 Go 后端 strings.Builder 一致，输出格式完全匹配）。Sitemap XML 用 XML 库序列化（Go 后端用 xml.MarshalIndent，NestJS 用同等功能）。robots.txt 用字符串模板生成

### 通知模块范围
- **D-217:** 在 Go 后端通知模块基础上新增站内通知存储。新建 notifications 表（id, userId, notificationTypeId, title, content, isRead, createdAt, readAt）。notifications 表需新增 Schema 文件
- **D-218:** 基础站内通知端点：GET /api/user/notifications（分页列表，支持 isRead 筛选）、PUT /api/user/notifications/:id/read（标记已读）、PUT /api/user/notifications/read-all（全部已读）、GET /api/user/notifications/unread-count（未读数）。所有端点需要 JWT 认证
- **D-219:** 评论回复时自动创建站内通知，与 Phase 06 评论模块集成。CommentService 创建评论后，如果被回复者有 comment_reply 通知类型且 isEnabled=true，调用 NotificationService.createNotification 创建站内通知。与 Go 后端 inAppNotificationCallback 行为一致
- **D-220:** 完整复刻 Go 后端通知类型管理和用户通知配置：启动时 InitializeDefaultNotificationTypes（4 种默认类型：comment_reply/comment_new/system_update/marketing_promo），EnsureUserDefaultConfigs 为用户创建默认配置。简化版 API（notification-settings）只暴露 allowCommentReplyNotification 开关

### Claude's Discretion
- SubscriberRepository 的具体查询方法设计（Drizzle 查询构建方式）
- EmailService 中 SMTP 配置的读取和连接管理（连接池/重试）
- 验证码生成算法（Go 后端用 crypto/rand + binary.BigEndian.Uint32 % 1000000）
- MusicService 中 HTTP 客户端的具体实现（axios/fetch/原生 http）
- MusicService 中图片URL优化的并发控制实现（信号量模式）
- RSS XML 拼接的 XML 转义处理细节
- Sitemap XML 库的选择和序列化配置
- NotificationRepository 的具体查询方法设计
- notifications 表的索引设计
- 站内通知列表的分页和筛选参数
- 订阅者邮件通知的异步发送实现
- 各模块的 DTO 设计和错误码定义

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端 RSS 源码（API 兼容性的权威参考）
- `pkg/handler/rss/handler.go` — RSSHandler：GetRSSFeed（含 Content-Type 按路径切换、缓存头设置、站点URL获取逻辑）
- `pkg/service/rss/service.go` — RSSService：GenerateFeed（含缓存逻辑）、GenerateXML（手动 XML 拼接）、buildRSSItem、getArticleDescription、xmlEscape、InvalidateCache
- `pkg/service/rss/types.go` — RSSItem、RSSFeed、RSSOptions 类型定义

### Go 后端 Sitemap 源码
- `pkg/handler/sitemap/handler.go` — SitemapHandler：GetSitemap（XML 序列化+声明头）、GetRobots（robots.txt 模板生成）
- `pkg/service/sitemap/service.go` — SitemapService：GenerateSitemap（主页+文章+页面+友链+常用页面）、GenerateRobots、addArticles（文章URL优先用 abbrlink）、addPages、addLinkPages
- `pkg/service/sitemap/model.go` — URLSet、URL、ChangeFrequency、SitemapItem 类型定义

### Go 后端音乐源码
- `pkg/handler/music/handler.go` — MusicHandler：GetPlaylist（返回 {songs, total}）、GetSongResources（接收 neteaseId，返回 SongResourceResponse）
- `pkg/service/music/service.go` — MusicService：FetchPlaylist（metings API 调用）、FetchSongResources（音质降级逻辑 exhigh→standard）、fetchSongV1、图片URL优化（optimizePicUrl/upgradePicSize/constructHighQualityURL）、验证逻辑（isValidNeteaseID/isValidSong/isValidLRCFormat）、日志系统（logRequest/logResponse/logError/logJSONStructure/logURLInfo/logRequestBodyInfo/logPerformanceMetrics）

### Go 后端通知源码
- `pkg/handler/notification/handler.go` — NotificationHandler：ListNotificationTypes、GetUserNotificationSettings（简化版）、UpdateUserNotificationSettings（简化版）、GetUserNotificationConfigs（完整版）
- `pkg/handler/notification/dto.go` — NotificationTypeDTO、UserNotificationConfigDTO、UpdateUserNotificationConfigRequest、BatchUpdateUserNotificationConfigRequest、SimpleUserNotificationSettingsRequest/Response
- `pkg/service/notification/notification_service.go` — NotificationService：ListNotificationTypes、GetNotificationTypeByCode、GetUserNotificationConfigs、UpdateUserNotificationConfig、BatchUpdateUserNotificationConfigs、GetUserNotificationSettings、ShouldNotifyUser、InitializeDefaultNotificationTypes、EnsureUserDefaultConfigs
- `pkg/domain/model/notification.go` — NotificationType、UserNotificationConfig、通知常量（NotificationTypeCommentReply/CommentNew/SystemUpdate/MarketingPromo）、DefaultNotificationTypes()

### Go 后端订阅者源码
- `pkg/handler/subscriber/handler.go` — SubscriberHandler：Subscribe（验证码验证+邮箱查重+重新激活）、Unsubscribe（邮箱退订）、UnsubscribeByToken（令牌退订）、SendVerificationCode（人机验证+验证码生成+邮件发送）、CaptchaParams/SubscribeRequest/UnsubscribeRequest/SendVerificationCodeRequest DTO
- `pkg/service/subscriber/service.go` — SubscriberService：Subscribe（Redis验证码验证+创建/重新激活订阅）、Unsubscribe、UnsubscribeByToken、GetActiveSubscribers、SendVerificationCode（Redis存储+邮件发送）、NotifyArticlePublished（异步逐个发送邮件）、generateToken

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，Phase 09 端点的路径和中间件组合：
  - rssGroup: GET /rss.xml, /feed.xml, /atom.xml（公开，无认证）
  - sitemapGroup: GET /sitemap.xml, /robots.txt（公开，无认证）
  - musicPublic: GET /api/public/music/playlist, POST /api/public/music/song-resources（公开）
  - publicSubscribe: POST /api/public/subscribe（CustomRateLimit(3,3)）, POST /api/public/subscribe/code（CustomRateLimit(3,3)）
  - publicUnsubscribe: POST /api/public/unsubscribe, GET /api/public/unsubscribe/:token
  - userNotification: GET/PUT /api/user/notification-settings, GET /api/user/notification-configs（JWTAuth）
  - notificationAdmin: GET /api/notification/types（JWTAuth + AdminAuth）

### 现有 NestJS 代码（Phase 01-08 产出）
- `server/src/rss/rss.module.ts` — RssModule 空占位
- `server/src/music/music.module.ts` — MusicModule 空占位
- `server/src/notification/notification.module.ts` — NotificationModule 空占位
- `server/src/subscriber/subscriber.module.ts` — SubscriberModule 空占位
- `server/src/database/schemas/subscriber.schema.ts` — subscribers 表 Schema（id, email, isActive, token, createdAt, updatedAt + is_active 索引）
- `server/src/database/schemas/notification-type.schema.ts` — notification_types 表 Schema（id, code, name, description, category, isActive, defaultEnabled, supportedChannels + category 索引）
- `server/src/database/schemas/user-notification-config.schema.ts` — user_notification_configs 表 Schema（id, userId, notificationTypeId, isEnabled, enabledChannels, notificationEmail, customSettings + userId+notificationTypeId unique 索引）
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器
- `server/src/common/constants/error-codes.ts` — 错误码常量文件
- `server/src/settings/settings.service.ts` — SettingsService（内存缓存 + 动态配置读取）
- `server/src/article/article.service.ts` — ArticleService（RSS 缓存失效需在此添加调用）
- `server/src/comment/comment.service.ts` — CommentService（站内通知触发需在此添加调用）
- `server/src/captcha/captcha.service.ts` — CaptchaService（订阅人机验证可复用）

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-204）
- `.planning/REQUIREMENTS.md` — 完整验收标准（RSS-01, SITEMAP-01, MUSIC-01, NOTIF-01, SUBSCRIBER-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **subscribers Schema** (server/src/database/schemas/subscriber.schema.ts): 完整字段已定义（id, email, isActive, token, createdAt, updatedAt + is_active 索引），可直接使用
- **notification_types Schema** (server/src/database/schemas/notification-type.schema.ts): 完整字段已定义（code, name, description, category, isActive, defaultEnabled, supportedChannels + category 索引），可直接使用
- **user_notification_configs Schema** (server/src/database/schemas/user-notification-config.schema.ts): 完整字段已定义（userId, notificationTypeId, isEnabled, enabledChannels, notificationEmail, customSettings + userId+notificationTypeId unique 索引），可直接使用
- **RssModule** (server/src/rss/rss.module.ts): 空模块占位，需要添加 Controller/Service
- **MusicModule** (server/src/music/music.module.ts): 空模块占位，需要添加 Controller/Service
- **NotificationModule** (server/src/notification/notification.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **SubscriberModule** (server/src/subscriber/subscriber.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **Guards**: JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现
- **@Public() decorator**: 公开路由跳过认证
- **ResponseInterceptor**: 全局 { code, data, message } 包装，Controller 直接返回 data 即可
- **SettingsService**: 内存缓存 + 动态配置读取，用于读取 SMTP 配置、音乐 API 配置、站点 URL 等
- **ArticleService** (server/src/article/article.service.ts): 文章 CRUD，需要在 Create/Update/Delete 方法中添加 RSS 缓存失效调用
- **CommentService** (server/src/comment/comment.service.ts): 评论创建，需要在回复评论后添加站内通知创建调用
- **CaptchaService** (server/src/captcha/captcha.service.ts): 人机验证服务，订阅验证码端点可复用
- **Error Codes**: 已有错误码常量文件，需扩展 RSS/音乐/通知/订阅者相关错误码

### Established Patterns
- Go 后端 RSS 用手动字符串拼接生成 XML（strings.Builder），NestJS 也手动拼接确保格式完全匹配
- Go 后端 Sitemap 用 xml.MarshalIndent 序列化，NestJS 用 XML 库序列化
- Go 后端 RSS/Sitemap 端点直接返回 XML（不经过 { code, data, message } 包装），使用 @Res() 装饰器绕过全局拦截器
- Go 后端音乐服务调用外部 metings.qjqq.cn API，支持 SSL 证书跳过
- Go 后端通知模块启动时初始化默认通知类型，为用户创建默认配置
- Go 后端订阅者模块用 Redis 存储验证码，NestJS 用内存 Map 替代
- Go 后端订阅者退订有两种方式：邮箱退订和令牌退订
- 内存 Map + TTL 缓存模式已在前几个阶段建立（D-07, D-161），RSS 缓存和验证码存储复用此模式
- Phase 06 的 Pushoo 推送框架已实现，站内通知是新的推送渠道

### Integration Points
- RssModule 需要注册到 AppModule
- MusicModule 需要注册到 AppModule
- NotificationModule 需要注册到 AppModule
- SubscriberModule 需要注册到 AppModule
- RssService 需要注入 ArticleService（获取公开文章列表）和 SettingsService（获取站点配置）
- SitemapService 需要注入 ArticleService（文章列表）、PageService（页面列表）、LinkService（友链页面）和 SettingsService（站点URL）
- MusicService 需要注入 SettingsService（音乐API配置）
- NotificationService 需要注入 NotificationTypeRepository 和 UserNotificationConfigRepository
- SubscriberService 需要注入 EmailService（邮件发送）和 CaptchaService（人机验证）
- ArticleService 的 Create/Update/Delete 方法需要调用 RssService.invalidateCache()
- CommentService 的创建评论方法需要调用 NotificationService.createNotification()
- notifications 表需要新增 Schema 文件并注册到 database/schemas/index.ts
- RSS/Sitemap 端点需要 @Res() 装饰器绕过全局拦截器（返回纯 XML）
- 音乐和订阅者公开端点需要 @Public() 装饰器
- 通知端点需要 JwtAuthGuard（用户端点）和 AdminGuard（管理端点）

</code_context>

<specifics>
## Specific Ideas

- Go 后端 RSS handler 根据请求路径设置不同 Content-Type：/rss.xml 和 /feed.xml 用 application/rss+xml，/atom.xml 用 application/atom+xml。所有路径返回相同的 RSS 2.0 XML 内容
- Go 后端 RSS handler 设置 Cache-Control: public, max-age=3600（1小时缓存）和 X-Content-Type-Options: nosniff
- Go 后端 Sitemap handler 设置 Cache-Control: public, max-age=3600 和 Last-Modified 头
- Go 后端 robots.txt 设置 Cache-Control: public, max-age=86400（24小时缓存）
- Go 后端 RSS feed 获取最近 20 篇公开文章，文章链接格式 {baseURL}/posts/{article.ID}
- Go 后端 RSS item 的 description 优先使用文章 summaries[0]，然后从 contentHtml 提取纯文本截断 200 字
- Go 后端 Sitemap 包含：主页 + 公开文章（URL 优先用 abbrlink）+ 已发布页面 + 友链页面 + 常用页面（/archives, /categories, /tags, /about）
- Go 后端 Sitemap 文章优先级基于更新时间：<24h → 0.9/daily, <7d → 0.8/weekly, <30d → 0.7/monthly, else → 0.6/yearly
- Go 后端音乐 GetPlaylist 返回 { songs: Song[], total: number }，Song 包含 id/neteaseId/name/artist/url/pic/lrc
- Go 后端音乐 GetSongResources 接收 { neteaseId: string }，返回 { audioUrl, lyricsText }
- Go 后端音乐 FetchSongResources 先尝试 exhigh 音质，失败降级 standard 音质
- Go 后端音乐播放列表 API URL: {apiBaseURL}/Playlist?id={playlistId}，歌曲资源 API URL: {apiBaseURL}/Song_V1
- Go 后端音乐 API 基础地址从 settings 读取 music.player.playlist_id 和 MUSIC_PLAYER_PLAYLIST_ID，默认 https://metings.qjqq.cn
- Go 后端音乐 Song_V1 API 请求格式：POST form-urlencoded（url={neteaseId}&level={level}&type=json）
- Go 后端通知简化版 API（notification-settings）只暴露 allowCommentReplyNotification 一个布尔开关
- Go 后端通知完整版 API（notification-configs）返回所有配置详情，每项包含 notificationType 关联信息
- Go 后端通知默认 4 种类型：comment_reply（评论回复，默认开启）、comment_new（新评论，默认开启）、system_update（系统更新，默认开启）、marketing_promo（营销推广，默认关闭）
- Go 后端订阅 Subscribe 请求体：{ email, code }，Unsubscribe 请求体：{ email }
- Go 后端订阅 SendVerificationCode 请求体：{ email, turnstile_token?, geetest_*?, image_captcha_id/answer? }
- Go 后端订阅者 token 是 64 字符的 hex 字符串（32 字节随机数编码），用于邮件退订链接
- NestJS 新增 notifications 表需要字段：id, userId, notificationTypeId, title, content, isRead, createdAt, readAt

</specifics>

<deferred>
## Deferred Ideas

- 订阅者邮件通知的实际发送 — 依赖 EmailService 的完整实现（SMTP 配置正确时才生效），未配置 SMTP 则静默跳过
- 站内通知实时推送（WebSocket/SSE）— 超出当前范围，属于新能力，留后续阶段按需实现
- 友链申请站内通知 — 当前只实现评论回复触发站内通知，友链申请通知可后续扩展
- 订阅者管理后台（管理员查看/管理订阅者列表）— Go 后端无此端点，属于新能力
- 音乐 API 基础地址配置界面 — 通过 settings 管理，无专门 UI

</deferred>

---

*Phase: 09-SEO & Music & Notifications*
*Context gathered: 2026-07-13*
