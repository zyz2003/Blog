# Architecture Research: anheyu-app NestJS + SQLite Backend

**Research Date:** 2026-06-28
**Confidence:** HIGH (基于源码直接分析)

## 原始 Go 后端架构

### 项目结构

```
anheyu-app/
├── cmd/                    # 入口点
├── ent/                    # Ent ORM 生成的代码
│   └── schema/             # 数据库模型定义（30+ 个表）
├── internal/
│   ├── app/
│   │   ├── bootstrap/      # 应用启动
│   │   ├── listener/       # 事件监听器
│   │   ├── middleware/      # 中间件（auth, cors, rate_limit, statistics, ssr_proxy）
│   │   └── task/           # 定时任务（10+ 个后台 job）
│   ├── configdef/          # 配置定义
│   ├── frontend/           # 前端资源嵌入
│   └── infra/
│       └── persistence/    # 数据持久层
│           ├── database/   # 数据库连接 + 迁移 + Redis
│           └── ent/        # Repository 实现（20+ 个 repo）
├── pkg/
│   └── handler/            # API 处理器（25+ 个 handler）
│       ├── album/
│       ├── album_category/
│       ├── article/
│       ├── article_history/
│       ├── auth/
│       ├── captcha/
│       ├── comment/
│       ├── config/
│       ├── direct_link/
│       ├── doc_series/
│       ├── file/
│       ├── image/
│       ├── link/
│       ├── music/
│       ├── notification/
│       ├── page/
│       ├── post_category/
│       ├── post_tag/
│       ├── proxy/
│       ├── public/
│       ├── rss/
│       ├── search/
│       ├── setting/
│       ├── sitemap/
│       ├── ssrtheme/
│       ├── statistics/
│       ├── storage_policy/
│       ├── subscriber/
│       ├── theme/
│       ├── thumbnail/
│       ├── user/
│       └── version/
└── server/                 # HTTP 服务器设置
```

### 分层架构

```
Router (Gin) → Handler → Service → Repository → Ent ORM → PostgreSQL
                                         ↕
                                       Redis
```

### 数据模型（30 个表）

| 模型 | 说明 | 优先级 |
|------|------|--------|
| User | 用户（含用户组、通知配置） | P0 |
| Article | 文章 | P0 |
| ArticleHistory | 文章历史版本 | P1 |
| PostCategory | 文章分类 | P0 |
| PostTag | 文章标签 | P0 |
| Tag | 标签 | P0 |
| Page | 页面 | P0 |
| Comment | 评论 | P0 |
| File | 文件 | P0 |
| FileEntity | 文件实体 | P0 |
| Setting | 站点设置 | P0 |
| VisitorLog | 访客日志 | P1 |
| VisitorStat | 访客统计 | P1 |
| Link | 友链 | P1 |
| LinkCategory | 友链分类 | P1 |
| LinkTag | 友链标签 | P2 |
| Album | 相册 | P2 |
| AlbumCategory | 相册分类 | P2 |
| DocSeries | 文档系列 | P2 |
| DirectLink | 直链 | P1 |
| StoragePolicy | 存储策略 | P1 |
| Subscriber | 订阅者 | P2 |
| NotificationType | 通知类型 | P2 |
| UserInstalledTheme | 用户安装的主题 | P2 |
| Metadata | 元数据 | P1 |
| Entity | 通用实体 | P1 |

### API 模块（25+ 个）

| 模块 | 路由前缀 | 公开/认证 | 优先级 |
|------|---------|----------|--------|
| Auth | /api/auth | 混合 | P0 |
| Article | /api/articles, /api/public/articles | 混合 | P0 |
| Page | /api/pages, /api/public/pages | 混合 | P0 |
| Comment | /api/comments, /api/public/comments | 混合 | P0 |
| File | /api/file | JWT | P0 |
| Setting | /api/settings, /api/public/site-config | 混合 | P0 |
| PostTag | /api/post-tags | 混合 | P0 |
| PostCategory | /api/post-categories | 混合 | P0 |
| Search | /api/search | 公开 | P0 |
| Version | /api/version | 公开 | P0 |
| Public | /api/public/* | 公开 | P0 |
| User | /api/user, /api/admin/users | 混合 | P1 |
| Statistics | /api/statistics, /api/public/statistics | 混合 | P1 |
| Thumbnail | /api/thumbnail | JWT | P1 |
| DirectLink | /api/direct-links, /api/f/:id | 混合 | P1 |
| Link | /api/links, /api/public/links | 混合 | P1 |
| StoragePolicy | /api/policies | Admin | P1 |
| DocSeries | /api/doc-series, /api/public/doc-series | 混合 | P2 |
| Album | /api/albums, /api/public/albums | 混合 | P2 |
| AlbumCategory | /api/album-categories | Admin | P2 |
| Theme | /api/theme, /api/public/theme | 混合 | P2 |
| Music | /api/public/music | 公开 | P2 |
| RSS | /rss.xml, /feed.xml, /atom.xml | 公开 | P2 |
| Sitemap | /sitemap.xml, /robots.txt | 公开 | P2 |
| Notification | /api/user/notification-* | JWT | P2 |
| Config | /api/config/backup, /api/config/export | Admin | P2 |
| Subscriber | /api/public/subscribe | 公开 | P2 |
| Captcha | /api/public/captcha | 公开 | P2 |
| SSRTheme | /api/admin/ssr-theme | Admin | P3 |
| Proxy | /api/proxy/download | 公开 | P3 |

### 中间件

1. **NoCache** — 全局反缓存，公开 GET 允许 10s 缓存
2. **JWTAuth** — JWT 认证
3. **JWTAuthOptional** — 可选 JWT（公开接口携带 token 时识别身份）
4. **AdminAuth** — 管理员权限
5. **CORS** — 跨域配置
6. **RateLimit** — 限流（自定义 + Gin 默认）
7. **Statistics** — 访客统计记录
8. **SSRProxy** — SSR 主题代理

### 定时任务（10+）

- 文章历史清理
- 临时数据清理
- 评论通知
- 友链健康检查
- 定时备份
- 定时发布
- 统计聚合
- 浏览量同步
- 缩略图生成

## NestJS 对应架构

### 项目结构

```
backend/
├── src/
│   ├── main.ts                     # 入口
│   ├── app.module.ts               # 根模块
│   ├── common/                     # 共享
│   │   ├── interceptors/           # 响应格式拦截器 { code, data, message }
│   │   ├── guards/                 # JWT Auth, Admin Auth
│   │   ├── decorators/             # 自定义装饰器
│   │   ├── filters/                # 异常过滤器
│   │   ├── pipes/                  # 验证管道
│   │   └── utils/                  # Sqids 编解码等
│   ├── config/                     # 配置模块
│   │   └── config.module.ts
│   ├── database/                   # Drizzle + SQLite
│   │   ├── database.module.ts
│   │   ├── schema/                 # Drizzle 表定义
│   │   └── migrations/             # 迁移文件
│   ├── modules/
│   │   ├── auth/                   # 认证
│   │   ├── article/                # 文章
│   │   ├── page/                   # 页面
│   │   ├── comment/                # 评论
│   │   ├── file/                   # 文件
│   │   ├── setting/                # 设置
│   │   ├── tag/                    # 标签
│   │   ├── category/               # 分类
│   │   ├── search/                 # 搜索
│   │   ├── user/                   # 用户
│   │   ├── statistics/             # 统计
│   │   ├── link/                   # 友链
│   │   ├── album/                  # 相册
│   │   ├── theme/                  # 主题
│   │   ├── rss/                    # RSS
│   │   ├── sitemap/               # 站点地图
│   │   └── ...                     # 其他模块
│   └── tasks/                      # 定时任务
├── data/                           # SQLite 数据文件
├── drizzle.config.ts               # Drizzle 配置
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### NestJS 分层映射

| Go 层 | NestJS 对应 | 说明 |
|-------|------------|------|
| Router (Gin) | Controller | 路由定义 |
| Handler | Controller + Service | 请求处理 + 业务逻辑 |
| Repository | Service → Drizzle | 数据访问 |
| Ent Schema | Drizzle Schema | 数据模型 |
| Middleware | Guard / Interceptor / Middleware | 请求管道 |
| Task (Scheduler) | @nestjs/schedule | 定时任务 |

## 构建顺序（依赖关系）

```
Phase 0: 基础设施
├── NestJS 项目脚手架
├── Drizzle + SQLite 连接（WAL 模式）
├── 响应格式拦截器 { code, data, message }
├── 全局异常过滤器
├── Sqids 编解码工具
└── Drizzle Schema 定义（所有表）

Phase 1: 核心认证 + 内容
├── Auth 模块（依赖 User 表）
├── User 模块
├── Setting 模块
├── Article + Category + Tag 模块
├── Page 模块
└── Public 聚合模块

Phase 2: 文件 + 评论 + 搜索
├── File 模块（分块上传、缩略图）
├── Comment 模块
├── Search 模块（FTS5）
└── Version API

Phase 3: 统计 + 友链 + 辅助
├── Statistics 模块
├── Link 模块
├── Thumbnail 模块
├── DirectLink 模块
└── StoragePolicy 模块

Phase 4: 相册 + 主题 + 高级
├── Album 模块
├── DocSeries 模块
├── Theme 模块
├── RSS / Sitemap
├── Music 模块
├── Notification 模块
├── Subscriber 模块
└── 定时任务

Phase 5: 迁移 + 集成
├── PostgreSQL → SQLite 迁移工具
├── 前后端联调测试
└── 生产部署配置
```

## 关键架构决策

1. **响应格式**: 全局拦截器确保所有响应都是 `{ code, data, message }` 格式
2. **ID 编码**: 使用 Sqids 保持与 Go 后端的 ID 编解码兼容
3. **缓存**: 内存 Map + TTL 替代 Redis，个人博客场景足够
4. **文件上传**: 分块上传机制需要完整复现（session + chunk + finalize）
5. **搜索**: SQLite FTS5 替代 PostgreSQL tsvector，需要迁移索引逻辑
6. **并发**: SQLite WAL + busy_timeout，写操作串行化

---
*Architecture research completed: 2026-06-28*
