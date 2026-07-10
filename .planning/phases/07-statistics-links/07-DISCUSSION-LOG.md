# Phase 07: Statistics & Links - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 07-Statistics & Links
**Areas discussed:** 访客记录方式, 统计聚合策略, 友链审核与健康检查, 友链导入导出与边缘功能, visitor_logs Schema, 统计查询实现方式, 友链申请通知与截图, 分类/标签响应格式

---

## 访客记录方式

| Option | Description | Selected |
|--------|-------------|----------|
| 前端上报 + 异步写库 | 前端 POST /public/statistics/visit 上报，后端异步处理（Go 后端模式） | ✓ |
| 前端上报 + 同步写库 | 前端上报，后端同步写库后再响应 | |
| 中间件自动采集 | NestJS 中间件自动采集 IP/UA/路径 | |

**User's choice:** 前端上报 + 异步写库
**Notes:** 百分百复刻 Go 后端模式

### 访客去重策略

| Option | Description | Selected |
|--------|-------------|----------|
| 内存 Map 去重 | 用内存 Map 替代 Redis SETNX，key 格式 stat:uv:{ip}:{date} | ✓ |
| SQL 查询时去重 | 每次访问都写库，查询时用 SQL DISTINCT 去重 | |
| SQLite 约束去重 | 用 UNIQUE 约束 + INSERT OR IGNORE | |

**User's choice:** 内存 Map 去重
**Notes:** 与 Phase 01 D-07 内存缓存替代 Redis 决策一致

### 统计数据三层结构

| Option | Description | Selected |
|--------|-------------|----------|
| 完整三层 | visitor_stats + url_stats + visitor_logs | ✓ |
| 两层（无原始日志） | 只保留 visitor_stats + url_stats | |
| 仅日聚合表 | 只保留 visitor_stats | |

**User's choice:** 完整三层
**Notes:** 需新增 visitor_logs Schema 文件

### RecordVisit 流程

| Option | Description | Selected |
|--------|-------------|----------|
| 完整复刻 | IP 地理位置查询 + UA 解析 + 内存去重 + 异步写入三层 | ✓ |
| 简化流程 | 只记录核心字段，跳过 UA 解析和 IP 地理位置查询 | |

**User's choice:** 完整复刻
**Notes:** 复用 Phase 06 GeoIPService，新增 ua-parser-js

---

## 统计聚合策略

| Option | Description | Selected |
|--------|-------------|----------|
| 实时增量 + Phase 10 定时修正 | Phase 07 实时 +1 更新，Phase 10 定时全量聚合修正 | ✓ |
| Phase 07 就实现定时聚合 | 使用 @nestjs/schedule | |
| 仅实时增量 | 不做定时聚合 | |

**User's choice:** 实时增量 + Phase 10 定时修正
**Notes:** Phase 10 才是定时任务阶段，Phase 07 不提前引入 @nestjs/schedule

### UA 解析库

| Option | Description | Selected |
|--------|-------------|----------|
| ua-parser-js | 最成熟的 Node.js UA 解析库 | ✓ |
| 轻量解析器/手写正则 | 更轻量但精度低 | |
| 不解析，只存原始 UA | 与 Go 后端不兼容 | |

**User's choice:** ua-parser-js

### 统计查询端点范围

| Option | Description | Selected |
|--------|-------------|----------|
| 完整复刻 6 端点 | basic/analytics/top-pages/trend/summary/visitor-logs | ✓ |
| 部分实现 | 只实现核心端点 | |

**User's choice:** 完整复刻 6 端点

### StatisticsModule 组织

| Option | Description | Selected |
|--------|-------------|----------|
| 单模块 | 一个 Controller 包含公开+管理员端点 | ✓ |
| 拆分两个 Controller | PublicStatisticsController + AdminStatisticsController | |

**User's choice:** 单模块

---

## 友链审核与健康检查

### 审核工作流

| Option | Description | Selected |
|--------|-------------|----------|
| 完整审核工作流 | PENDING/APPROVED/REJECTED/UPDATED 四种状态 | ✓ |
| 简化审核流程 | PENDING/APPROVED 两种状态 | |

**User's choice:** 完整审核工作流

### 健康检查

| Option | Description | Selected |
|--------|-------------|----------|
| 异步健康检查 | POST 触发异步 HTTP HEAD，GET 查询进度 | ✓ |
| 同步健康检查 | 请求阻塞直到所有检查完成 | |
| 延迟到 Phase 10 | 不在 Phase 07 实现 | |

**User's choice:** 异步健康检查

### 友链申请速率限制

| Option | Description | Selected |
|--------|-------------|----------|
| 内存 Map 速率限制 | 记录 IP 维度申请频率，与 Go 后端等效 | ✓ |
| 复用 ThrottlerModule | 全局限频，不适合友链特定规则 | |
| 不限制 | 与 Go 后端不兼容 | |

**User's choice:** 内存 Map 速率限制

### LinkModule 组织

| Option | Description | Selected |
|--------|-------------|----------|
| 单模块 | 友链+分类+标签+健康检查在同一 Controller | ✓ |
| 拆分三个模块 | LinkModule + LinkCategoryModule + LinkTagModule | |

**User's choice:** 单模块

---

## 友链导入导出与边缘功能

### 导入/导出

| Option | Description | Selected |
|--------|-------------|----------|
| 完整实现 | POST /links/import + GET /links/export | ✓ |
| 延迟实现 | 留后续阶段 | |

**User's choice:** 完整实现

### 边缘端点

| Option | Description | Selected |
|--------|-------------|----------|
| 全部实现 | random/check-exists/applications/sort | ✓ |
| 部分实现 | 只实现核心 CRUD + 审核 | |

**User's choice:** 全部实现

### 友链 ID 编码

| Option | Description | Selected |
|--------|-------------|----------|
| Sqids 编码 | 新增 EntityTypeLink 常量 | ✓ |
| 原始数字 ID | 与 Go 后端不一致 | |

**User's choice:** Sqids 编码

---

## visitor_logs Schema

| Option | Description | Selected |
|--------|-------------|----------|
| 完整复刻 | id, created_at, ip_address, user_agent, city, region, country, url_path, referrer, duration, browser, os, device | ✓ |
| 精简字段 | 只保留核心字段 | |

**User's choice:** 完整复刻
**Notes:** 需新增 visitor-log.schema.ts

---

## 统计查询实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| 混合模式 | 复杂聚合用 sql 模板标签，简单查询用 Drizzle 构建器 | ✓ |
| 纯 Drizzle 查询 | 类型安全但复杂聚合写法笨重 | |
| 纯原始 SQL | 灵活但失去类型安全 | |

**User's choice:** 混合模式

---

## 友链申请通知与截图

### 通知

| Option | Description | Selected |
|--------|-------------|----------|
| Pushoo 推送 | 复用 Phase 06 推送框架 | ✓ |
| 延迟到 Phase 09 | 不实现任何通知 | |
| Pushoo + 邮件 | 复杂度高 | |

**User's choice:** Pushoo 推送

### 网站截图

| Option | Description | Selected |
|--------|-------------|----------|
| 外部截图 API | 从 settings 读取 API key，异步获取 | ✓ |
| 本地 Puppeteer 截图 | 需要安装浏览器，与零依赖目标不符 | |
| 不自动截图 | 与 Go 后端不兼容 | |

**User's choice:** 外部截图 API

---

## 分类/标签响应格式

| Option | Description | Selected |
|--------|-------------|----------|
| 精确复制 Go DTO | 分类含关联友链列表，标签含关联友链数量 | ✓ |
| 简化响应 | 只返回基本信息，不含关联数据 | |

**User's choice:** 精确复制 Go DTO

---

## Claude's Discretion

- StatisticsRepository 的具体查询方法设计
- 内存去重 Map 的 TTL 管理和清理策略
- visitor_logs 表的索引设计
- LinkRepository 的具体查询方法设计
- 健康检查 HTTP HEAD 请求的超时/重试/并发控制
- 友链导入 JSON 的解析和去重逻辑
- 外部截图 API 的具体调用实现
- 统计查询原始 SQL 的具体语句
- Pushoo 推送消息格式
- ua-parser-js 的初始化和配置

## Deferred Ideas

- 统计全量聚合定时任务 — Phase 10（CRON-01）
- 友链健康检查定时任务 — Phase 10（CRON-01）
- 友链邮件通知 — Phase 09（NOTIF-01）
- 统计数据缓存优化 — 后续阶段按需
- 友链申请验证码/CAPTCHA — 新能力，不属于复刻范围
