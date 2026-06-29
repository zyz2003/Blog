# Phase 2: Auth & Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 2-Auth & Settings
**Areas discussed:** JWT Token 生命周期, 认证流程范围, Settings 存储与公开, 用户管理范围

---

## JWT Token 生命周期

### JWT Secret 来源

| Option | Description | Selected |
|--------|-------------|----------|
| 从 settings 表读取 | 与 Go 后端完全一致：JWT_SECRET 存在 settings 表中，应用启动时加载。迁移后现有 Token 不失效 | ✓ |
| 从环境变量读取 | JWT_SECRET 从 .env 文件读取，与 Phase 01 当前实现一致。更简单但与 Go 不兼容 | |
| Settings 优先 + env fallback | 优先从 settings 表读取，如果不存在则 fallback 到 env var | |

**User's choice:** 从 settings 表读取
**Notes:** 与 Go 后端保持 API 兼容，迁移后现有 Token 不失效

### Token 过期时间

| Option | Description | Selected |
|--------|-------------|----------|
| 硬编码 15min/30d | 与 Go 后端完全一致，Go 后端也是硬编码 | ✓ |
| 存入 settings 表可配置 | 允许管理员调整过期时间，Go 后端目前没有这个功能 | |

**User's choice:** 硬编码 15min/30d

### Captcha 处理

| Option | Description | Selected |
|--------|-------------|----------|
| 架构就绪 + Image/none | 实现 captcha 架构（/api/public/captcha/config 端点、provider 选择逻辑），只实现 Image captcha + none | ✓ |
| 跳过 captcha | 登录接口不验证 captcha，前端 captcha 字段会被忽略 | |
| 全部实现 | 完整实现 Turnstile/Geetest/Image 三种验证方式 | |

**User's choice:** 架构就绪 + Image/none
**Notes:** 用户先询问了外部服务依赖，了解后选择了推荐方案

### Refresh Token 输入方式

| Option | Description | Selected |
|--------|-------------|----------|
| Header + Body 双支持 | 与 Go 后端完全一致 | ✓ |
| 仅 Header | 更简洁但可能破坏前端现有刷新逻辑 | |

**User's choice:** Header + Body 双支持

### 登录响应格式

| Option | Description | Selected |
|--------|-------------|----------|
| 完全复制 Go 格式 | { userInfo, roles, accessToken, refreshToken, expires }，expires 为毫秒时间戳 | ✓ |
| 调整格式 | 结构调整但保留所有字段，更符合 REST 规范但与 Go 不兼容 | |

**User's choice:** 完全复制 Go 格式

### JWT 动态读取方式

| Option | Description | Selected |
|--------|-------------|----------|
| 每次查询 settings 表 | 简单直接，SQLite 读取很快 | ✓ |
| 启动加载 + 缓存 | 减少数据库查询但增加缓存失效复杂度 | |
| 启动加载 + 事件刷新 | 最复杂但缓存一致性最好 | |

**User's choice:** 每次查询 settings 表

---

## 认证流程范围

### 实现范围

| Option | Description | Selected |
|--------|-------------|----------|
| 只做 login + refresh | 注册、激活、忘记/重置密码等留待后续 | ✓ |
| login + register + refresh | 注册功能对个人博客有用，但不依赖邮件服务 | |
| 全部实现 | 完整认证端点，需要 SMTP 服务 | |

**User's choice:** 只做 login + refresh

### 未实现端点处理

| Option | Description | Selected |
|--------|-------------|----------|
| 返回 501 | 前端调用时会收到明确的错误信息 | ✓ |
| 不注册路由 | 前端调用时收到 404 | |

**User's choice:** 返回 501

### 密码哈希

| Option | Description | Selected |
|--------|-------------|----------|
| bcrypt | 与 Go 后端兼容，迁移后现有密码可正常验证 | ✓ |
| argon2 | 更安全但与 Go 后端不兼容 | |

**User's choice:** bcrypt

### 登录限流

| Option | Description | Selected |
|--------|-------------|----------|
| 简单限流 | @nestjs/throttler 实现 IP 限流 | ✓ |
| 跳过限流 | 个人博客场景下攻击风险低 | |
| 完整限流 | IP + 用户级别的限流，复杂度高 | |

**User's choice:** 简单限流

---

## Settings 存储与公开

### 存储方式

| Option | Description | Selected |
|--------|-------------|----------|
| Key-value + 内存缓存 | 启动时加载到内存，更新时刷新缓存 | ✓ |
| Key-value 无缓存 | 每次读取都查询数据库 | |
| JSON 列类型 | 用 Drizzle JSON 列类型存储复杂配置 | |

**User's choice:** Key-value + 内存缓存

### 公开/私有 key 区分

| Option | Description | Selected |
|--------|-------------|----------|
| 硬编码公开 key 列表 | 与 Go 后端 IsPublicSetting() 一致 | ✓ |
| 数据库字段标记 | 在 settings 表增加 is_public 字段 | |

**User's choice:** 硬编码公开 key 列表

### Site Config 响应

| Option | Description | Selected |
|--------|-------------|----------|
| 预定义公开配置集合 | 与 Go 后端 GetSiteConfig() 一致 | ✓ |
| 返回全部公开 key | 更通用但可能暴露过多信息 | |

**User's choice:** 预定义公开配置集合

### 配置版本号

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过配置版本号 | 返回固定值，简化实现 | |
| 实现配置版本号 | 毫秒时间戳，每次配置更新时刷新 | ✓ |

**User's choice:** 实现配置版本号

### 高级功能

| Option | Description | Selected |
|--------|-------------|----------|
| 跳过高级功能 | 个人博客场景不急需 | |
| 只做 AI profiles 脱敏 | 中等复杂度 | |
| 全部实现 | AI profiles 脱敏、CDN 缓存清除、配置备份 | ✓ |

**User's choice:** 全部实现

---

## 用户管理范围

### 实现范围

| Option | Description | Selected |
|--------|-------------|----------|
| 当前用户 CRUD | info、update-password、profile | |
| 全部实现 | 当前用户 + 管理员用户管理 CRUD + user-groups | ✓ |
| 只做 user/info | 最简单但前端设置页面修改密码等功能不可用 | |

**User's choice:** 全部实现

### 头像上传

| Option | Description | Selected |
|--------|-------------|----------|
| 完整头像上传 | 依赖 Phase 05 文件服务 | |
| 跳过头像上传 | 返回 501，等 Phase 05 完成后补充 | ✓ |
| 简化版头像上传 | 直接存目录，不走文件服务 | |

**User's choice:** 跳过头像上传

---

## Claude's Discretion

- JwtStrategy validate() 方法扩展
- AuthService/TokenService 类设计和方法签名
- SettingsService 内存缓存实现细节
- AI profiles 脱敏具体实现
- CDN 缓存清除服务接口设计
- 配置备份服务实现方式
- 管理员用户管理 DTO 设计

## Deferred Ideas

- Turnstile/Geetest captcha 实现 — 留待后续阶段
- 用户注册/激活/忘记密码/重置密码 — 留待后续阶段（需要 SMTP 邮件服务）
- 头像上传 — 留待 Phase 05（依赖文件服务、存储策略、直链服务）
