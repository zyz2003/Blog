# Requirements: anheyu-app NestJS + SQLite Backend

## Problem Statement

原 anheyu-app Go 后端需要 Go runtime + PostgreSQL 17 + Redis 才能运行，部署门槛高。个人博客场景不需要分布式架构，SQLite 足以支撑。重写为 NestJS + SQLite 后端，实现零依赖本地运行，前端代码不做任何修改。

## User Stories

### P0 — 核心功能（第一版必须）

- 作为博客管理员，我可以用 JWT 登录后台，管理文章、页面、分类、标签
- 作为访客，我可以浏览文章列表、文章详情、页面内容，无需登录
- 作为博客管理员，我可以上传图片和文件，系统自动生成缩略图
- 作为访客，我可以搜索文章（全文搜索）
- 作为博客管理员，我可以配置站点设置（标题、描述、SEO 等）
- 作为访客，我可以查看公开的站点配置和主题信息
- 作为系统，所有 API 响应格式与原 Go 后端完全一致，前端零改动即可运行

### P1 — 重要功能（第二版）

- 作为博客管理员，我可以查看访客统计（趋势、来源、设备、浏览器、OS）
- 作为访客，我可以发表评论
- 作为博客管理员，我可以管理友链
- 作为博客管理员，我可以管理存储策略（本地/远程）
- 作为博客管理员，我可以管理直链
- 作为博客管理员，我可以管理缩略图

### P2 — 增强功能（后续）

- 作为访客，我可以浏览相册
- 作为博客管理员，我可以管理文档系列
- 作为访客，我可以订阅 RSS
- 作为系统，自动生成 Sitemap
- 作为访客，我可以收听音乐
- 作为博客管理员，我可以管理通知和订阅者
- 作为系统，执行定时任务（清理、备份、统计聚合等）

## Acceptance Criteria

### API 兼容性（核心底线）

- [ ] API-COMPAT-01: 所有 `/api/*` 端点的请求路径与原 Go 后端一致
- [ ] API-COMPAT-02: 所有 API 响应格式为 `{ code: number, data: any, message: string }`
- [ ] API-COMPAT-03: ID 编解码与原 Go 后端完全一致（Sqids + 相同 seed）
- [ ] API-COMPAT-04: JWT Token 结构与原 Go 后端兼容（前端现有 Token 可正常使用）
- [ ] API-COMPAT-05: 分页参数和响应格式与原 Go 后端一致
- [ ] API-COMPAT-06: 错误码和错误消息与原 Go 后端一致

### 基础设施

- [x] INFRA-01: 后端监听端口 8091
- [x] INFRA-02: SQLite 数据库文件存放在 `data/` 目录
- [x] INFRA-03: WAL 模式已启用，busy_timeout 已设置
- [x] INFRA-04: `npm run dev` 一键启动后端
- [x] INFRA-05: 数据库迁移使用 drizzle-kit
- [x] INFRA-06: Drizzle Schema 定义所有 30 个表

### P0 功能

- [ ] AUTH-01: 认证：管理员登录、JWT 签发和验证
- [ ] AUTH-02: 认证：Token 刷新
- [ ] AUTH-03: 认证：JWT 与 Go 后端兼容
- [ ] USER-01: 用户：个人资料管理
- [ ] SETTING-01: 设置：读取/更新站点配置
- [ ] SETTING-02: 设置：公开配置查询
- [x] ARTICLE-01: 文章：CRUD、公开/私密
- [x] ARTICLE-02: 文章：列表分页、分类筛选、标签筛选
- [x] ARTICLE-03: 文章：公开文章浏览
- [x] CATEGORY-01: 分类：CRUD、排序
- [x] TAG-01: 标签：CRUD、与文章关联
- [ ] PAGE-01: 页面：CRUD、公开/私密
- [ ] PUBLIC-01: 公开：聚合端点
- [x] VERSION-01: 版本：版本信息 API
- [ ] FILE-01: 文件上传：单文件上传
- [ ] FILE-02: 文件上传：分块上传
- [ ] THUMB-01: 缩略图：生成、管理
- [ ] SEARCH-01: 搜索：全文搜索（FTS5）

### P1 功能

- [ ] STATS-01: 统计：访客记录、趋势统计
- [ ] STATS-02: 统计：来源分析、设备分析
- [ ] COMMENT-01: 评论：CRUD、审核、嵌套回复
- [ ] LINK-FRIEND-01: 友链：CRUD、分类、健康检查
- [ ] STORAGE-01: 存储策略：CRUD
- [ ] LINK-DIRECT-01: 直链：CRUD、短链访问

### P2 功能

- [ ] ALBUM-01: 相册：CRUD、分类
- [ ] DOCSERIES-01: 文档系列：CRUD
- [ ] RSS-01: RSS：XML 生成
- [ ] SITEMAP-01: Sitemap：XML 生成
- [ ] MUSIC-01: 音乐：数据接口
- [ ] NOTIF-01: 通知：CRUD、类型管理
- [ ] SUBSCRIBER-01: 订阅者：订阅/退订
- [ ] CRON-01: 定时任务：文章历史清理、临时数据清理、统计聚合、备份等

### 迁移与集成

- [ ] MIGRATION-01: 迁移工具：从 PostgreSQL 导入数据到 SQLite
- [ ] INTEGRATION-01: 集成测试：端到端 API 兼容性测试

## Out of Scope

- PRO 功能（付费文章、密码保护、登录可见、即刻说说）
- 多用户协作
- 支付集成（微信支付、支付宝等）
- OAuth/SSO 登录（QQ、微信、GitHub、OIDC）
- AI 播客生成、AI 写作辅助
- SSR 主题代理
- 前端代码修改

## Definition of Done

- [ ] 所有 P0 验收标准通过
- [ ] 前端连接新后端后所有 P0 功能正常工作（无前端修改）
- [ ] API 兼容性测试通过（对比原 Go 后端的响应格式）
- [ ] SQLite WAL 模式 + busy_timeout 已配置
- [ ] 数据库迁移可重复执行
- [ ] `npm run dev` 一键启动
- [ ] MIGRATION-01: PostgreSQL → SQLite 迁移工具可用
- [ ] INTEGRATION-01: 端到端 API 兼容性测试套件通过

---
*Last updated: 2026-06-28*
