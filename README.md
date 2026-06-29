<p align="center">
  <a href="https://github.com/anzhiyu-c/anheyu-app" target="_blank" title="访问项目仓库">
    <img src="https://upload-bbs.miyoushe.com/upload/2025/08/27/125766904/445bc304fe1a5edf8c0250beac0731b5_953439680145318785.png" height="400" width="600" alt="Logo" />
  </a>
</p>

<p align="center"><strong>一个现代化的内容管理与分享平台</strong></p>

<p align="center">
  <a title="Go Version" target="_blank" href="https://go.dev/"><img alt="Go Version" src="https://img.shields.io/badge/Go-%3E%3D%201.24.4-91DEFA?style=flat"></a>
  <a title="Node.js Version" target="_blank" href="https://nodejs.org/"><img alt="Node Version" src="https://img.shields.io/badge/Node-%3E%3D%2020.19.4-yellowgreen?style=flat"></a>
  <a title="License" target="_blank" href="https://github.com/anzhiyu-c/anheyu-app/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/anzhiyu-c/anheyu-app.svg?style=flat"></a>
  <br>
  <a title="GitHub Release" target="_blank" href="https://github.com/anzhiyu-c/anheyu-app/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/anzhiyu-c/anheyu-app?style=flat"></a>
  <a title="Docker Pulls" target="_blank" href="https://hub.docker.com/r/anheyu/anheyu-backend"><img alt="Docker Pull" src="https://img.shields.io/docker/pulls/anheyu/anheyu-backend?color=red&label=Docker%20Pull"></a>
  <a title="GitHub Commits" target="_blank" href="https://github.com/anzhiyu-c/anheyu-app/commits/main"><img alt="GitHub Commits" src="https://img.shields.io/github/commit-activity/m/anzhiyu-c/anheyu-app.svg?style=flat&color=brightgreen&label=commits"></a>
  <br><br>
  <a title="GitHub Watchers" target="_blank" href="https://github.com/anzhiyu-c/anheyu-app/watchers"><img alt="GitHub Watchers" src="https://img.shields.io/github/watchers/anzhiyu-c/anheyu-app.svg?label=Watchers&style=social"></a>  
  <a title="GitHub Stars" target="_blank" href="https://github.com/anzhiyu-c/anheyu-app/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/anzhiyu-c/anheyu-app.svg?label=Stars&style=social"></a>  
  <a title="GitHub Forks" target="_blank" href="https://github.com/anzhiyu-c/anheyu-app/network/members"><img alt="GitHub Forks" src="https://img.shields.io/github/forks/anzhiyu-c/anheyu-app.svg?label=Forks&style=social"></a>  
</p>

![](https://upload-bbs.miyoushe.com/upload/2025/10/28/125766904/04eea66306f81b76b4e3623ee098bf40_3240315038986097575.png?x-oss-process=image/format,avif)

如果能给我一个**star**那将是对我莫大的鼓励。使用这个应用之前，你应该明白它是一个完全独立的应用，它需要`服务器`才能进行搭建，推荐使用 docker 部署，能够极大的削弱环境配置带来的问题。

由 [安知鱼](https://github.com/anzhiyu-c) 负责开发与维护。

GitHub: https://github.com/anzhiyu-c/anheyu-app

预览: 👍 [AnZhiYu](https://blog.anheyu.com/) || 🤞 [AnZhiYu](https://index.anheyu.com/)

文档: 📖 [AnHeYu Docs](https://dev.anheyu.com)

### 从源码克隆（开发者）

Next.js 前台位于仓库内 **`frontend` Git 子模块**，克隆时必须递归拉取子模块，否则 `frontend` 目录为空：

```bash
git clone --recurse-submodules https://github.com/anzhiyu-c/anheyu-app.git
cd anheyu-app
```

若此前已克隆、未包含子模块，在仓库根目录执行：

```bash
git submodule update --init --recursive
```

## 🚀 快速开始

`安和鱼应用系统`是一个基于 **[Go](https://go.dev/) + [Next.js](https://nextjs.org/)（[React](https://react.dev/) + TypeScript）** 构建的现代化内容管理与分享平台。前台为 Next.js SSR/应用路由，后端使用 Go 提供高性能 API，二者通过反向代理协同部署。

[Anheyu](https://github.com/anzhiyu-c/anheyu-app) 可以让你快速的搭建一个属于自己的内容网站，你可以用它来记录你的生活、学习、工作、娱乐等任意内容，并且随时查看，它支持公网部署，也支持本地私有部署。

如果你有开发经验，或者你是一名想学习前端的同学，那么这个项目非常的适合你进行学习，你可以学习 React、Next.js、TypeScript 等技术来自定义专属于你的主题，如果你愿意，也可以通过邮箱联系我提交到主题商城，我会将其集成到项目中，通过审核后，所有的 Anheyu 用户都可以自由下载并使用您的主题。

### 系统要求

在开始之前，请确保您的系统满足以下要求：

- 内存大于等于 512MB
- 硬盘大于等于 1GB
- CPU 大于等于 1 核

## ✨ 主要功能

- ✅ 支持 Markdown 编辑，富文本预览，分类标签管理
- ✅ 图片上传、分类、预览和管理
- ✅ 外部链接收集、分类和分享
- ✅ 页面组件懒加载
- ✅ 图片懒加载
- ✅ 内置优秀的评论系统，用户互动和内容讨论
- ✅ 优秀的文件管理，自动缩略图生成和优化
- ✅ 灵活的存储配置管理，支持多种文件格式
- ✅ 内置专业的网页访问统计
- ✅ 支持暗色模式
- ✅ 支持脚注语法
- ✅ 丰富多样化的标签选项快速构建你想要的功能
- ✅ 支持定制化的主色调随封面图片颜色变化
- ✅ 支持沉浸式状态栏
- ✅ 支持高度自定义的 inject
- ✅ 支持广告挂载
- ✅ 支持图片大图查看
- ✅ 支持优秀的相册集
- ✅ 支持高速缓存的渐进式 Web 应用
- ✅ 优秀的隐私协议支持
- ✅ 支持 LaTeX 数学公式
- ✅ 支持 mermaid 流程图
- ✅ 支持 中文分词、英文分词索引搜索引擎
- ✅ 支持访客统计
- ✅ 支持访客趋势
- ✅ 支持访客分析
- ✅ 支持访客来源
- ✅ 支持访客设备
- ✅ 支持访客浏览器
- ✅ 支持访客操作系统
- ✅ 支持优秀的右键菜单
- ✅ 支持全局中控台
- ✅ 支持快捷键选项
- ✅ 支持付费文章内容 (PRO)
- ✅ 支持密码文章内容 (PRO)
- ✅ 支持登录保护内容 (PRO)
- ✅ 支持即刻说说 (PRO)
- ✅ 支持多用户共创 (PRO)
- ✅ 支持微信、支付宝、易支付、虎皮椒等多种支付方式 (PRO)
- ✅ 支持 QQ,微信，GitHub,自定义 OIDC 等多种登录方式 (PRO)
- ✅ 支持 AI 播客 (PRO)
- ✅ 支持 AI 写作 (PRO)

## 部分功能展示

**沉浸式状态栏** 沉浸阅读。

![沉浸式状态栏](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/bf586849d38243f9d62ffd10aaac9c92_3495839897391648835.png?x-oss-process=image/format,avif)

**在线编辑器** Markdown 编辑

![在线编辑器](https://upload-bbs.miyoushe.com/upload/2025/09/15/125766904/d48ebac100429fe8dce19e48ec3b40a3_3855955480928949790.png?x-oss-process=image/format,avif)

**优秀方便的右键菜单**

<img
  src="https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/ab037790230c2a67f7c8e426cd8ce677_4442694850992921405.png?x-oss-process=image/format,avif"
  alt="优秀方便的右键菜单"
  className="w-[50%]"
/>

**AI 摘要** 迅速读取文章内容。

![AI摘要](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/3e4d676c64930e1c573393420dc2cba5_2848259665925430.png?x-oss-process=image/format,avif)

**订单管理(PRO)**

![付费文章内容](https://upload-bbs.miyoushe.com/upload/2025/09/17/125766904/4410b49e38af24bef72e6ae555495e09_6600710485516302903.png?x-oss-process=image/format,avif)

**密码文章内容(PRO)**

![密码文章内容](https://upload-bbs.miyoushe.com/upload/2025/09/17/125766904/8baeeafcb2cf9caf72c84b89f2c69d67_5541575116482903287.png?x-oss-process=image/format,avif)

**让人眼前一亮的清爽界面**

![](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/22019d7c234b154ae6745ae8960188c4_4555570664614593804.png?x-oss-process=image/format,avif)

**评论弹幕**

![评论弹幕](https://upload-bbs.miyoushe.com/upload/2025/09/14/125766904/9ad29d18db96115f483ddf15b8af9b57_7214154697962036777.png?x-oss-process=image/format,avif)

**自带 icon**

可前往[iconfont](https://www.iconfont.cn/collections/detail?cid=44481)查看所有自带图标

## 🏗️ 技术架构

Go + Next.js（React）+ Ent

### 为什么选择这些技术？

**为什么使用 Go 作为后端？**

- Go 语言的性能和效率非常出色，适合构建高性能的 API 服务
- 运行时仅需 10MB 左右，非常轻量级
- 编译速度快，支持多平台编译，支持静态编译，开箱即用
- 支持多线程、并发、异步、协程
- 相比 Java 内存占用更小，相比 Rust 生态更成熟

**为什么选择 Next.js（React）作为前端？**

- App Router 与 SSR/流式渲染有利于 SEO 与首屏体验
- React 生态成熟，便于集成富文本（Tiptap）、数据请求（TanStack Query）等能力
- 与 Go 后端通过反向代理统一部署，生产环境可使用 `standalone` 输出
- TypeScript 覆盖全栈类型，利于主题与二次开发维护

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

> **注意事项**  
> 在提交 Pull Request 之前，请确保所有测试都通过，并遵循项目的代码规范。

## 📄 许可证

本项目采用 [GPL-3.0 license](https://github.com/anzhiyu-c/anheyu-app?tab=GPL-3.0-1-ov-file#readme) 许可证。

## 👨‍💻 贡献者

<img src="https://opencollective.com/anheyu-app-frontend/contributors.svg?width=890&button=false" alt="contributors" />

**[陈志伟 Anzhiyu](https://github.com/anzhiyu-c)** - 项目维护者

**[张洪 Heo](https://github.com/zhheo)** - UI/UX

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

## 交流群

QQ 群组：[464636182](https://jq.qq.com/?_wv=1027&k=v7NK7ELr)

![QQ群组](https://upload-bbs.miyoushe.com/upload/2025/07/09/125766904/1e8ea817c197fb98e4dbd9ed2500d923_6382092418395407285.webp)
