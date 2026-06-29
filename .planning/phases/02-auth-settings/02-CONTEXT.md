# Phase 2: Auth & Settings - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

管理员可以通过 JWT 登录后台、管理用户资料、配置站点设置；访客可以读取公开站点配置。所有 API 响应格式必须与原 Go 后端完全兼容。

**交付物：**
- POST /api/auth/login 返回 JWT（HS256，Go 兼容 payload）
- POST /api/auth/refresh-token 刷新 access token
- 现有 Go 签发的 JWT token 可被 NestJS guards 接受
- GET /api/user/info 获取当前用户信息
- POST /api/user/update-password 修改密码
- PUT /api/user/profile 更新用户基本信息
- /api/admin/users CRUD + /api/admin/user-groups 管理员用户管理
- POST /api/settings/get-by-keys 批量获取配置（区分公开/私有）
- POST /api/settings/update 批量更新配置（管理员）
- GET /api/public/site-config 公开站点配置
- GET /api/public/site-config/version 配置版本号
- GET /api/public/captcha/config 验证码配置
- GET /api/public/captcha/image 图片验证码生成
- 密码使用 bcrypt 哈希（与 Go 后端兼容）
- Token 刷新端点正常工作
- 简单 IP 限流防止暴力破解

**未实现但保留路由（返回 501）：**
- POST /api/auth/register
- POST /api/auth/activate
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- GET /api/auth/check-email
- POST /api/user/avatar（依赖 Phase 05 文件服务）

</domain>

<decisions>
## Implementation Decisions

### JWT Token 生命周期
- **D-30:** JWT_SECRET 从 settings 表动态读取（config_key = "JWT_SECRET"），每次签发/验证 Token 时查询 settings 表。与 Go 后端 SettingService.Get("JWT_SECRET") 行为一致
- **D-31:** Access token 过期时间硬编码 15 分钟，refresh token 硬编码 30 天。与 Go 后端 `time.Minute * 15` 和 `time.Hour * 24 * 30` 一致
- **D-32:** Refresh token 支持两种输入方式：Authorization header（Bearer token）或 request body 的 refreshToken 字段。与 Go 后端 RefreshToken handler 一致
- **D-33:** 登录成功响应格式完全复制 Go 后端：`{ userInfo, roles, accessToken, refreshToken, expires }`，expires 为毫秒时间戳
- **D-34:** Captcha 架构实现：/api/public/captcha/config 端点返回 provider 类型，实现 Image captcha + none 两种模式。Turnstile/Geetest 留待后续阶段

### 认证流程范围
- **D-35:** Phase 02 只实现 login + refresh-token。Register、activate、forgot-password、reset-password、check-email 端点保留路由但返回 501 Not Implemented
- **D-36:** 密码哈希使用 bcrypt（bcryptjs 库），与 Go 后端 golang.org/x/crypto/bcrypt 兼容。迁移后现有密码可正常验证
- **D-37:** 使用 @nestjs/throttler 实现简单 IP 限流，登录接口 10 秒内最多 5 次请求。与 Go CustomRateLimit(10, 5) 一致

### Settings 存储与公开
- **D-38:** Settings 用 key-value 存储（config_key + value text），启动时全部加载到内存缓存（Map），更新时同步刷新缓存。与 Go 后端 SettingService 行为一致
- **D-39:** 公开/私有 key 区分用硬编码列表（public-setting-keys.ts），与 Go 后端 IsPublicSetting() 一致。普通用户通过 /api/settings/get-by-keys 只能获取公开 key，管理员获取全部
- **D-40:** /api/public/site-config 返回预定义公开配置集合（站点名、描述、logo、公告、外观等），不是全部公开 key。与 Go 后端 GetSiteConfig() 一致
- **D-41:** 实现配置版本号（/api/public/site-config/version），返回毫秒时间戳，每次配置更新时刷新。与 Go 后端 GetConfigVersion() 一致
- **D-42:** Settings 高级功能全部实现：AI profiles 敏感数据脱敏（API Key 掩码显示）、CDN 缓存清除（检测 HTML 渲染配置变更）、配置更新前自动备份

### 用户管理范围
- **D-43:** 实现全部用户接口：当前用户操作（info、update-password、profile）+ 管理员用户管理（/api/admin/users CRUD + /api/admin/user-groups + /api/admin/users/:id/reset-password + /api/admin/users/:id/status）
- **D-44:** 头像上传（/api/user/avatar）返回 501，因为依赖 Phase 05 的文件服务、存储策略和直链服务。头像默认使用 Gravatar URL

### Claude's Discretion
- JwtStrategy 的 validate() 方法如何扩展以支持完整的 CustomClaims（当前只验证 user_id 和 user_group_id，需要添加 permissions）
- AuthService 和 TokenService 的具体类设计和方法签名
- SettingsService 内存缓存的具体实现（启动加载、定时刷新、还是仅在更新时刷新）
- AI profiles 脱敏的具体实现细节（哪些字段需要掩码、掩码格式）
- CDN 缓存清除服务的接口设计（Phase 02 只定义接口，具体 CDN 提供商集成留待后续）
- 配置备份服务的实现方式（JSON 导出 + 文件存储）
- 管理员用户管理接口的 DTO 设计（与 Go 后端 AdminUserDTO 对齐）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端认证源码（API 兼容性的权威参考）
- `internal/pkg/auth/jwt.go` — JWT token 生成和解析逻辑，HS256 签名，CustomClaims 结构体
- `internal/pkg/auth/types.go` — CustomClaims 定义：UserID(string), UserGroupID(string), Permissions([]byte)
- `internal/app/middleware/auth.go` — JWTAuth/JWTAuthOptional/AdminAuth 三层认证中间件实现
- `pkg/handler/auth/handler.go` — AuthHandler：Login、RefreshToken、Register、Activate 等全部认证接口
- `pkg/service/auth/auth_service.go` — AuthService：Login、Register、ActivateUser 等业务逻辑
- `pkg/service/auth/token_service.go` — TokenService：GenerateSessionTokens、RefreshAccessToken、GenerateSignedToken、VerifySignedToken

### Go 后端设置源码
- `pkg/handler/setting/handler.go` — SettingHandler：GetSiteConfig、GetConfigVersion、GetSettingsByKeys、UpdateSettings、AI profiles 脱敏
- `pkg/constant/setting.go` — 全部配置 key 常量定义（公开/私有 key 列表）

### Go 后端用户源码
- `pkg/handler/user/handler.go` — UserHandler：GetUserInfo、UpdateUserPassword、UpdateUserProfile、UploadAvatar、AdminListUsers、AdminCreateUser、AdminUpdateUser、AdminDeleteUser、GetUserGroups

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，认证/用户/设置/公开端点的路径和中间件组合

### 现有 NestJS 代码（Phase 01 产出）
- `server/src/auth/auth.module.ts` — AuthModule 已创建，包含 JwtModule 和 JwtStrategy
- `server/src/auth/jwt.strategy.ts` — JwtStrategy 已实现，验证 user_id 和 user_group_id
- `server/src/settings/settings.module.ts` — SettingsModule 占位
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器已实现
- `server/src/common/decorators/current-user.decorator.ts` — @CurrentUser() 装饰器已实现
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器已实现
- `server/src/common/filters/http-exception.filter.ts` — 全局异常过滤器已实现
- `server/src/database/schemas/user.schema.ts` — users 表 Schema 已定义
- `server/src/database/schemas/user-group.schema.ts` — user_groups 表 Schema 已定义
- `server/src/database/schemas/setting.schema.ts` — settings 表 Schema 已定义
- `server/src/app.module.ts` — AppModule 已注册全局 Guard/Interceptor/Filter

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-29）
- `.planning/REQUIREMENTS.md` — 完整验收标准

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **JwtStrategy** (server/src/auth/jwt.strategy.ts): 已实现基本 JWT 验证，需要扩展 validate() 方法以支持完整 CustomClaims
- **AuthModule** (server/src/auth/auth.module.ts): 已配置 JwtModule + PassportModule，需要添加 AuthService、TokenService、AuthController
- **Guards**: JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现，可直接用于路由保护
- **@Public() decorator**: 公开路由跳过认证，用于 /api/auth/login、/api/public/* 等端点
- **@CurrentUser() decorator**: 从 request 中提取用户信息，可用于 Controller 层
- **ResponseInterceptor**: 全局包装 { code, data, message }，Controller 直接返回 data 即可
- **Settings Schema**: settings 表已定义（config_key + value + comment），可直接使用
- **Users/UserGroups Schema**: users 和 user_groups 表已定义，含所有必要字段

### Established Patterns
- Go 后端 JWT payload 使用公共 ID 字符串（Sqids 编码），不是数据库整数 ID
- Go 后端登录响应中 userInfo.ID 是公共 ID，但 userInfo.userGroupID 是数据库原始 ID（数字类型）
- Go 后端所有 ID 参数（URL path、request body）都使用公共 ID，Controller 层解码为数据库 ID 后传给 Service
- Go 后端 Avatar URL 处理：非 http 开头的头像路径拼接 Gravatar URL
- Go 后端时间格式化使用中国时区（UTC+8），格式为 "2006-01-02 15:04:05"

### Integration Points
- JwtModule 注册在 AuthModule 中，JwtStrategy 需要从 SettingsService 动态获取 secret（而非 ConfigService）
- SettingsService 需要在 AppModule 启动时初始化，加载所有 settings 到内存缓存
- Sqids 编解码器（Phase 01 实现）用于 User/UserGroup 公共 ID 生成
- 内存缓存（Phase 01 实现）可用于 Settings 缓存

</code_context>

<specifics>
## Specific Ideas

- JWT_SECRET 存储在 settings 表中，与 Go 后端完全一致。这意味着 NestJS 的 JwtModule 不能用静态 secret 配置，需要在每次签发/验证时动态获取
- Go 后端 GenerateSessionTokens 内部调用 auth.GenerateToken 传入数据库 uint ID，函数内部再转为公共 ID。NestJS 的 TokenService 需要复制这个流程
- Go 后端 AdminGuard 通过解码 UserGroupID 的公共 ID，判断数据库 ID 是否为 1 来确定管理员身份。NestJS 的 AdminGuard 已实现这个逻辑
- AI profiles 是一个 JSON 字符串存在 settings value 中，脱敏逻辑需要解析 JSON、掩码 API Key、序列化回字符串

</specifics>

<deferred>
## Deferred Ideas

- Turnstile/Geetest captcha 实现 — 留待后续阶段，Phase 02 只做 Image captcha + none
- 用户注册/激活/忘记密码/重置密码 — 留待后续阶段，需要 SMTP 邮件服务
- 头像上传（/api/user/avatar）— 留待 Phase 05 文件上传完成后实现，依赖文件服务、存储策略、直链服务

</deferred>

---

*Phase: 2-Auth & Settings*
*Context gathered: 2026-06-29*
