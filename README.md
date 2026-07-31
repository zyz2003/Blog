<p align="center"><strong>一个现代化的个人博客与内容管理平台</strong></p>

<p align="center">
  <a title="Node.js" target="_blank" href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node-%3E%3D%2022-339933?style=flat&logo=node.js"></a>
  <a title="NestJS" target="_blank" href="https://nestjs.com/"><img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat&logo=nestjs"></a>
  <a title="Next.js" target="_blank" href="https://nextjs.org/"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?style=flat&logo=next.js"></a>
  <a title="SQLite" target="_blank" href="https://www.sqlite.org/"><img alt="SQLite" src="https://img.shields.io/badge/SQLite-WAL-003B57?style=flat&logo=sqlite"></a>
  <a title="License" target="_blank" href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat"></a>
</p>

---

一个基于 **NestJS + Next.js + SQLite** 构建的个人博客系统，零外部依赖本地运行。后端使用 NestJS + Drizzle ORM + SQLite 替代原 Go + PostgreSQL + Redis 架构，前端 Next.js 保持不变，新后端与原 API 完全兼容。

## ✨ 功能特性

### 📝 内容管理

- **Markdown 编辑器** — 基于 Tiptap 的富文本编辑器，所见即所得，支持代码块高亮、LaTeX 数学公式、Mermaid 流程图、脚注、表格、图片画廊等
- **分类与标签** — 多级分类体系，灵活的标签管理，支持按分类/标签筛选文章
- **文章系列** — 将相关文章组织为系列，按序阅读
- **草稿与定时发布** — 保存草稿，支持定时发布文章
- **文章加密** — 支持密码保护文章，仅输入正确密码可查看
- **双栏布局** — 可选文章双栏排版，提升阅读效率

### 🤖 AI 能力

- **AI 摘要** — 自动生成文章摘要，打字机效果逐字呈现，支持一键重新生成
- **AI 对话** — 内置聊天窗口，访客可与 AI 实时对话，流式响应，支持多轮对话与上下文保持
- **多模型支持** — 后台可配置多个 AI 模型，支持 OpenAI / DeepSeek / 智谱 / 魔搭 / OpenRouter 等服务商，一键切换
- **连接测试** — 后台测试 API 连接，自动识别思考模型（如 DeepSeek-R1），支持关闭思考模式
- **工具调用** — AI 对话可调用文章查询等工具，实现智能问答

### 💬 评论系统

- **多级评论** — 支持嵌套回复，评论层级清晰
- **评论弹幕** — 前台弹幕式展示评论，增加互动趣味
- **邮件通知** — 新评论/回复自动发送邮件通知博主和被回复者，支持自定义 HTML 模板
- **验证码** — 支持多种验证码服务，防止垃圾评论
- **评论管理** — 后台审核、删除、回复评论

### 🎨 视觉与交互

- **一图流** — 全屏背景图/视频横幅，支持按页面（首页/分类/标签/归档等）独立配置，移动端可单独设置背景
- **打字机效果** — 副标题打字机循环（打字→停留→删除→停留→重复），打字/删除/停留节奏均可后台配置，支持一言 API 随机句子
- **暗色模式** — 跟随系统或手动切换，全站配色统一切换
- **沉浸式状态栏** — 阅读时自动沉浸，沉浸式体验
- **右键菜单** — 自定义右键菜单，替代浏览器默认菜单
- **快捷键** — 全局快捷键支持，快速操作
- **图片大图查看** — 点击图片放大查看，支持缩放拖拽
- **主色调跟随** — 文章主色调随封面图片颜色变化，每篇文章独特视觉

### 📊 数据统计

- **访客统计** — 访问量、UV/PV 统计
- **访问趋势** — 按日/周/月查看访问趋势
- **访客来源** — 来源页面分析
- **设备分析** — 浏览器、操作系统、设备类型分布
- **文章统计** — 文章阅读量排行

### 🔍 搜索与 SEO

- **全文搜索** — 基于 SQLite FTS5 的中文分词搜索，支持中英文混合索引
- **SEO 优化** — Next.js SSR + 流式渲染，结构化数据，Open Graph / Twitter Card 元标签
- **站点地图** — 自动生成 sitemap
- **RSS 订阅** — 支持 RSS 订阅

### 📁 文件管理

- **图片上传** — 拖拽上传，批量上传，自动压缩
- **缩略图生成** — Sharp 自动生成多尺寸缩略图，按需加载
- **存储配置** — 灵活配置文件存储路径与访问方式
- **媒体库** — 后台图片管理，预览、分类、删除

### ⚙️ 后台管理

- **可视化配置** — 后台管理面板，无需修改配置文件即可调整站点设置
- **系统设置** — 站点名称、副标题、关键词、描述、ICP 备案等
- **外观设置** — 一图流配置、自定义 CSS/JS/HTML 注入、外部链接提醒、右键菜单开关
- **AI 模型管理** — 添加/编辑/删除 AI 模型，配置服务商、API 地址、模型选择、用途标记
- **邮件设置** — SMTP 配置，邮件模板编辑，测试发送
- **评论设置** — 验证码配置，评论审核策略
- **友链管理** — 添加/编辑/排序友链，支持分组
- **数据管理** — AI 对话记录管理，数据库备份

### 🏗️ 架构特性

- **零依赖部署** — SQLite 文件级存储，无需安装 PostgreSQL / Redis，`npm run dev` 一键启动
- **API 兼容** — 后端与原 Go 后端保持相同路径和响应格式，前端零改动即可切换
- **全栈 TypeScript** — 前后端统一语言，共享类型定义，开发体验一致
- **WAL 模式** — SQLite 启用 WAL 日志模式，支持并发读写，配合 busy_timeout 防止写锁超时
- **内存缓存** — 替代 Redis，基于 Map + TTL 的轻量缓存，个人博客场景足够
- **Sqids 编码** — 文章 ID 编码，与原后端兼容，避免暴露自增 ID

## 🛠️ 技术栈

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 后端框架 | NestJS | v11 | 模块化、装饰器、依赖注入 |
| ORM | Drizzle ORM | v0.45 | 轻量、类型安全、SQL-like 语法 |
| 数据库 | SQLite (better-sqlite3) | v12 | WAL 模式，零安装零配置，同步 API |
| 前端框架 | Next.js | v15 | App Router + SSR + 流式渲染 |
| UI 组件 | React + HeroUI | — | 组件库 + Tailwind CSS |
| 认证 | JWT + Passport | — | 本地策略，Token 认证 |
| 图片处理 | Sharp | v0.35 | 缩略图生成，比 imagick 更快更轻 |
| ID 编码 | Sqids | v0.3 | 短 ID 编码，与原后端兼容 |
| 验证 | class-validator | — | 请求参数校验 |
| 搜索 | SQLite FTS5 | 内置 | 全文搜索，替代 PostgreSQL tsvector |

## 🚀 快速开始

### 环境要求

- Node.js >= 22
- npm >= 9

### 安装与启动

```bash
# 克隆仓库
git clone https://github.com/zyz2003/Blog.git
cd Blog

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..

# 启动后端（端口 8091）
cd server && npm run start:dev

# 启动前端（端口 3000）
cd frontend && npm run dev
```

访问 `http://localhost:3000` 查看前台，`http://localhost:8091` 为后端 API。

### 默认管理员

首次启动后通过后端种子数据创建管理员账户，可在后台修改。

## 📁 项目结构

```
Blog/
├── server/                    # NestJS 后端
│   ├── src/
│   │   ├── settings/          # 系统配置（KV 存储 + 公开/私有分组）
│   │   ├── article/           # 文章 CRUD + 分类 + 标签
│   │   ├── comment/           # 评论系统 + 邮件通知
│   │   ├── link/              # 友链管理
│   │   ├── file/              # 文件上传与缩略图生成
│   │   ├── ai/                # AI 摘要 + 对话 + 多模型管理
│   │   ├── auth/              # JWT 认证 + 登录
│   │   ├── statistics/        # 访客统计
│   │   ├── search/            # 全文搜索 (FTS5)
│   │   ├── subscribe/         # RSS + 邮件订阅
│   │   ├── scheduled/         # 定时任务
│   │   └── migration/         # PostgreSQL → SQLite 迁移工具
│   └── data/                  # SQLite 数据库文件（已 gitignore）
├── frontend/                  # Next.js 前端
│   ├── src/
│   │   ├── app/               # App Router 页面
│   │   │   ├── (frontend)/    # 前台页面（首页/文章/分类/标签/归档...）
│   │   │   ├── (admin)/       # 后台管理页面
│   │   │   └── (music)/       # 音乐播放器页面
│   │   ├── components/        # UI 组件
│   │   │   ├── admin/         # 后台管理组件
│   │   │   ├── chat/          # AI 对话组件
│   │   │   ├── layout/        # 布局组件（横幅/导航/侧边栏）
│   │   │   ├── post/          # 文章相关组件
│   │   │   └── home/          # 首页组件
│   │   ├── lib/               # 工具函数与配置
│   │   ├── store/             # 状态管理（Zustand）
│   │   └── types/             # TypeScript 类型定义
│   └── public/                # 静态资源
├── scripts/                   # 迁移与工具脚本
└── .planning/                 # 开发规划文档
```

## 📸 功能展示

**沉浸式状态栏** — 沉浸阅读体验

![沉浸式状态栏](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/bf586849d38243f9d62ffd10aaac9c92_3495839897391648835.png?x-oss-process=image/format,avif)

**在线编辑器** — Markdown 富文本编辑

![在线编辑器](https://upload-bbs.miyoushe.com/upload/2025/09/15/125766904/d48ebac100429fe8dce19e48ec3b40a3_3855955480928949790.png?x-oss-process=image/format,avif)

**AI 摘要** — 自动生成文章摘要

![AI摘要](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/3e4d676c64930e1c573393420dc2cba5_2848259665925430.png?x-oss-process=image/format,avif)

**清爽界面** — 现代化设计

![](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/22019d7c234b154ae6745ae8960188c4_4555570664614593804.png?x-oss-process=image/format,avif)

**评论弹幕** — 互动式评论展示

![评论弹幕](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/9ad29d18db96115f483ddf15b8af9b57_7214154697962036777.png?x-oss-process=image/format,avif)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

> 在提交 Pull Request 之前，请确保所有测试通过，并遵循项目的代码规范。

## 📄 许可证

[GPL-3.0](LICENSE)
