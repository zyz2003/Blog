# Phase 09: SEO & Music & Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 09-SEO & Music & Notifications
**Areas discussed:** 订阅验证码与邮件, 音乐API代理策略, RSS/Sitemap缓存策略, 通知模块范围

---

## 订阅验证码与邮件

### 验证码存储方式

| Option | Description | Selected |
|--------|-------------|----------|
| 内存 Map + TTL（推荐） | 与项目其他模块一致（D-07, D-161），key 格式 subscribe:code:{email}，TTL 5分钟。进程重启时验证码丢失，但验证码本身是短时效的，影响极小 | ✓ |
| SQLite 存储 | 存在 SQLite subscribers 表或新建 verification_codes 表。进程重启不丢失，但增加 DB 写入压力 | |
| 你决定 | 与 D-07 一致，内存 Map 替代 Redis | |

**User's choice:** 内存 Map + TTL（推荐）
**Notes:** 验证码是短时效数据，进程重启丢失可接受

### 邮件服务实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| nodemailer + SMTP（推荐） | 安装 nodemailer，支持 SMTP 发送。从 settings 读取 SMTP 配置（host/port/user/pass）。Go 后端也用 SMTP 发邮件 | ✓ |
| 接口 stub + 日志 | 只实现接口和调用点，不实际发送邮件。日志记录邮件内容 | |
| 你决定 | 与 Go 后端一致，用 nodemailer 实现 SMTP 邮件发送 | |

**User's choice:** nodemailer + SMTP（推荐）
**Notes:** 完整复刻 Go 后端邮件功能

### 人机验证方式

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 CaptchaService（推荐） | Go 后端支持 Turnstile/极验/系统验证码三种。NestJS 已有 CaptchaService（Phase 02 实现），可直接复用 | ✓ |
| 跳过人机验证 | 订阅发送验证码时不做人机验证，直接发邮件验证码。简单但容易被滥用 | |
| 你决定 | 与 Go 后端一致，复用 Phase 02 的 CaptchaService | |

**User's choice:** 复用 CaptchaService（推荐）

### 订阅/退订端点范围

| Option | Description | Selected |
|--------|-------------|----------|
| 完整复刻 3 个端点（推荐） | Go 后端有 3 个退订端点：1) POST /api/public/unsubscribe（邮箱退订）2) GET /api/public/unsubscribe/:token（令牌退订）3) Subscribe 时如果邮箱已存在但 isActive=false 则重新激活 | ✓ |
| 简化：只实现令牌退订 | 只实现令牌退订（邮件链接点击），邮箱退订可以省略 | |
| 你决定 | 与 Go 后端一致，完整复刻所有订阅/退订端点 | |

**User's choice:** 完整复刻 3 个端点（推荐）

---

## 音乐API代理策略

### 音乐服务实现范围

| Option | Description | Selected |
|--------|-------------|----------|
| 完整复刻核心逻辑（推荐） | 完整复刻 FetchPlaylist + FetchSongResources + 图片URL优化 + 音质降级逻辑。日志简化为 NestJS Logger 标准格式 | ✓ |
| 简化：跳过图片优化 | 只实现 FetchPlaylist 和 FetchSongResources，跳过图片URL优化 | |
| 你决定 | 与 Go 后端一致，完整复刻所有音乐服务逻辑 | |

**User's choice:** 完整复刻核心逻辑（推荐）

### SSL 证书验证

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过 SSL 验证（与 Go 一致）（推荐） | Go 后端用 InsecureSkipVerify: true 跳过 SSL 验证，因为 metings.qjqq.cn 证书有问题 | ✓ |
| 严格 SSL 验证 | 正常验证 SSL 证书。如果外部 API 证书有问题会报错 | |
| 你决定 | 与 Go 后端一致，跳过 SSL 验证以兼容外部 API | |

**User's choice:** 跳过 SSL 验证（与 Go 一致）（推荐）

### 音乐 API 响应缓存

| Option | Description | Selected |
|--------|-------------|----------|
| 不缓存（与 Go 一致） | Go 后端音乐服务无缓存，每次请求都调用外部 API | |
| 播放列表缓存 5min（推荐） | 播放列表缓存 5 分钟，歌曲资源不缓存（音频 URL 有时效性）。减少外部 API 调用 | ✓ |
| 你决定 | 与 Go 后端一致，不缓存音乐数据 | |

**User's choice:** 播放列表缓存 5min（推荐）
**Notes:** NestJS 在 Go 后端基础上新增了播放列表缓存，减少外部 API 调用

### 音乐服务日志级别

| Option | Description | Selected |
|--------|-------------|----------|
| 简化日志（推荐） | 用 NestJS Logger 标准格式记录关键信息，不复制 Go 的详细日志分析 | |
| 完整复刻日志 | 完整复刻 Go 后端的所有日志逻辑，包括 JSON 结构分析、性能评级等 | ✓ |
| 你决定 | 用 NestJS Logger 标准格式记录关键信息 | |

**User's choice:** 完整复刻日志
**Notes:** 用户选择完整复刻 Go 后端的音乐日志逻辑

---

## RSS/Sitemap缓存策略

### RSS feed 缓存策略

| Option | Description | Selected |
|--------|-------------|----------|
| 内存 Map 缓存 1h（推荐） | 与 Go 后端一致，用内存 Map 缓存 RSS feed（key: rss:feed:latest，TTL 1小时）。文章更新时清除缓存 | ✓ |
| 不缓存 | 每次请求都重新生成 RSS feed | |
| 你决定 | 与 Go 后端一致，内存 Map 缓存 + 文章更新时失效 | |

**User's choice:** 内存 Map 缓存 1h（推荐）

### Sitemap 缓存策略

| Option | Description | Selected |
|--------|-------------|----------|
| 不缓存（与 Go 一致）（推荐） | 与 Go 后端一致，每次请求都重新生成。Sitemap 请求频率低，不值得缓存 | ✓ |
| 缓存 1h | 缓存 1 小时，减少数据库查询 | |
| 你决定 | 与 Go 后端一致，不缓存 Sitemap | |

**User's choice:** 不缓存（与 Go 一致）（推荐）

### RSS 缓存失效时机

| Option | Description | Selected |
|--------|-------------|----------|
| 文章 CRUD 时显式失效（推荐） | Go 后端 RSS 缓存失效通过显式调用 InvalidateCache。NestJS 在 ArticleService 的 Create/Update/Delete 方法中调用 RssService.invalidateCache() | ✓ |
| 仅 TTL 过期 | 只依赖 TTL 自然过期，不主动失效。文章发布后最多 1 小时 RSS 才更新 | |
| 你决定 | 与 Go 后端一致，文章 CRUD 时显式调用失效 | |

**User's choice:** 文章 CRUD 时显式失效（推荐）

### XML 生成方式

| Option | Description | Selected |
|--------|-------------|----------|
| RSS 手动拼接 + Sitemap XML库（推荐） | Go 后端 RSS 用手动字符串拼接，Sitemap 用 xml.MarshalIndent。NestJS 也手动拼接 RSS，Sitemap 用 XML 库 | ✓ |
| 统一用 XML 库 | RSS 和 Sitemap 都用 XML 库生成。更规范但输出格式可能与 Go 不完全一致 | |
| 你决定 | 与 Go 后端一致，RSS 手动拼接，Sitemap 用 XML 序列化 | |

**User's choice:** RSS 手动拼接 + Sitemap XML库（推荐）

---

## 通知模块范围

### 通知模块功能范围

| Option | Description | Selected |
|--------|-------------|----------|
| 仅复刻 Go 已有功能（推荐） | 只实现 Go 后端已有的功能：通知类型管理 + 用户通知配置 + 简化版/完整版 API | |
| 新增站内通知存储+推送 | 在 Go 后端基础上新增站内通知表（notifications）和推送机制。这是新能力，超出 Phase 09 范围 | ✓ |
| 你决定 | 与 Go 后端一致，只实现通知类型管理和用户配置 | |

**User's choice:** 新增站内通知存储+推送
**Notes:** 用户选择在 Go 后端基础上扩展，新增站内通知功能

### 站内通知实现范围

| Option | Description | Selected |
|--------|-------------|----------|
| 基础站内通知（推荐） | 新建 notifications 表存储通知记录。提供 GET /api/user/notifications（列表）+ PUT /api/user/notifications/:id/read + PUT /api/user/notifications/read-all + GET /api/user/notifications/unread-count。评论回复时自动创建通知记录 | ✓ |
| 站内通知 + 实时推送 | 基础站内通知 + WebSocket/SSE 实时推送。复杂度显著增加 | |
| 你决定 | 基础站内通知表 + CRUD 端点 + 评论回复时自动创建通知 | |

**User's choice:** 基础站内通知（推荐）

### 站内通知触发场景

| Option | Description | Selected |
|--------|-------------|----------|
| 评论回复触发（推荐） | 评论回复时自动创建站内通知（调用 NotificationService.createNotification）。与 Phase 06 评论模块集成 | ✓ |
| 所有场景触发 | 所有 Phase 06/07 延迟的通知场景都实现：评论回复 + 友链申请 + 文章发布（订阅者邮件） | |
| 你决定 | 评论回复时创建站内通知 | |

**User's choice:** 评论回复触发（推荐）

---

## Claude's Discretion

无 — 所有决策都是用户明确选择的

## Deferred Ideas

- 站内通知实时推送（WebSocket/SSE）— 超出当前范围，属于新能力，留后续阶段按需实现
- 友链申请站内通知 — 当前只实现评论回复触发站内通知，友链申请通知可后续扩展
- 订阅者管理后台（管理员查看/管理订阅者列表）— Go 后端无此端点，属于新能力
