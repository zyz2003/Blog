<p align="center">
  <img src="https://upload-bbs.miyoushe.com/upload/2025/08/27/125766904/445bc304fe1a5edf8c0250beac0731b5_953439680145318785.png" height="400" width="600" alt="Logo" />
</p>

<p align="center"><strong>一个现代化的个人博客与内容管理平台</strong></p>

<p align="center">
  <a title="Node.js" target="_blank" href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node-%3E%3D%2022-339933?style=flat&logo=node.js"></a>
  <a title="NestJS" target="_blank" href="https://nestjs.com/"><img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat&logo=nestjs"></a>
  <a title="Next.js" target="_blank" href="https://nextjs.org/"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?style=flat&logo=next.js"></a>
  <a title="SQLite" target="_blank" href="https://www.sqlite.org/"><img alt="SQLite" src="https://img.shields.io/badge/SQLite-WAL-003B57?style=flat&logo=sqlite"></a>
  <a title="License" target="_blank" href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat"></a>
</p>

![](https://upload-bbs.miyoushe.com/upload/2025/10/28/125766904/04eea66306f81b76b4e3623ee098bf40_3240315038986097575.png?x-oss-process=image/format,avif)

一个基于 **NestJS + Next.js + SQLite** 构建的个人博客系统，零外部依赖本地运行。后端使用 NestJS + Drizzle ORM + SQLite 替代原 Go + PostgreSQL + Redis 架构，前端 Next.js 保持不变，新后端与原 API 完全兼容。

## 特性

- **零依赖部署** — SQLite 文件级存储，无需安装 PostgreSQL / Redis，`npm run dev` 一键启动
- **API 兼容** — 新后端与原 Go 后端保持相同路径和响应格式，前端零改动即可切换
- **全栈 TypeScript** — 前后端统一语言，共享类型定义
- **后台管理** — 可视化配置站点、主题、AI 模型、评论、邮件等
- **AI 能力** — 内置 AI 摘要、AI 对话，支持多模型配置（OpenAI / DeepSeek / 智谱 / 魔搭等）
- **Markdown 编辑** — Tiptap 富文本编辑器，支持代码高亮、LaTeX、Mermaid 流程图
- **评论系统** — 多级评论、弹幕、邮件通知、验证码
- **一图流** — 全屏背景图/视频横幅，打字机效果，一言 API
- **暗色模式** — 跟随系统或手动切换
- **访客统计** — 访问量、趋势、来源、设备分析
- **全文搜索** — SQLite FTS5 中文分词搜索
- **文件管理** — 图片上传、缩略图自动生成、存储配置
- **SEO 友好** — Next.js SSR + 流式渲染，结构化数据

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 后端框架 | NestJS v11 | 模块化、装饰器、依赖注入 |
| ORM | Drizzle ORM | 轻量、类型安全、SQL-like |
| 数据库 | SQLite (better-sqlite3) | WAL 模式，零安装零配置 |
| 前端框架 | Next.js v15 | App Router + SSR |
| UI | React + HeroUI + Tailwind CSS | — |
| 认证 | JWT + Passport | 本地策略 |
| 图片处理 | Sharp | 缩略图生成 |
| ID 编码 | Sqids | 与原后端兼容 |

## 快速开始

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

## 项目结构

```
Blog/
├── server/              # NestJS 后端
│   ├── src/
│   │   ├── settings/    # 系统配置（KV 存储 + 公开/私有分组）
│   │   ├── article/     # 文章 CRUD
│   │   ├── comment/     # 评论系统
│   │   ├── category/    # 分类管理
│   │   ├── tag/         # 标签管理
│   │   ├── link/        # 友链管理
│   │   ├── file/        # 文件上传与缩略图
│   │   ├── ai/          # AI 摘要 + 对话
│   │   ├── auth/        # JWT 认证
│   │   └── ...
│   └── data/            # SQLite 数据库文件（已 gitignore）
├── frontend/            # Next.js 前端
│   ├── src/
│   │   ├── app/         # App Router 页面
│   │   ├── components/  # UI 组件
│   │   ├── lib/         # 工具函数与配置
│   │   ├── store/       # 状态管理
│   │   └── types/       # TypeScript 类型
│   └── public/          # 静态资源
├── scripts/             # 迁移与工具脚本
└── .planning/           # 开发规划文档
```

## 部分功能展示

**沉浸式状态栏** — 沉浸阅读

![沉浸式状态栏](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/bf586849d38243f9d62ffd10aaac9c92_3495839897391648835.png?x-oss-process=image/format,avif)

**在线编辑器** — Markdown 编辑

![在线编辑器](https://upload-bbs.miyoushe.com/upload/2025/09/15/125766904/d48ebac100429fe8dce19e48ec3b40a3_3855955480928949790.png?x-oss-process=image/format,avif)

**AI 摘要** — 迅速读取文章内容

![AI摘要](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/3e4d676c64930e1c573393420dc2cba5_2848259665925430.png?x-oss-process=image/format,avif)

**清爽界面**

![](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/22019d7c234b154ae6745ae8960188c4_4555570664614593804.png?x-oss-process=image/format,avif)

**评论弹幕**

![评论弹幕](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/9ad29d18db96115f483ddf15b8af9b57_7214154697962036777.png?x-oss-process=image/format,avif)

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[GPL-3.0](LICENSE)
