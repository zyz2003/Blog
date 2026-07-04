# Phase 5: File Upload & Media - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

管理员可以上传文件（单文件 + 分块上传），管理存储策略，生成缩略图，管理直链和短链下载。访客可以通过直链/短链下载文件。

**交付物：**
- PUT /api/file/upload — 创建上传会话（服务端分块上传或客户端直传）
- GET /api/file/upload/session/:sessionId — 获取上传会话状态
- POST /api/file/upload/:sessionId/:index — 上传文件分块
- POST /api/file/upload/finalize — 客户端直传完成回调
- DELETE /api/file/upload — 删除上传会话
- GET /api/file — 按路径获取文件列表
- GET /api/file/:id — 获取文件信息
- GET /api/file/download/:id — 下载文件
- GET /api/file/download-info/:id — 获取下载信息
- POST /api/file/create — 创建空文件/文件夹
- PUT /api/file/content/:publicID — 更新文件内容
- DELETE /api/file — 批量删除文件/文件夹
- PUT /api/file/rename — 重命名文件/文件夹
- GET /api/file/preview-urls — 获取文件预览 URL
- GET /api/file/content — 签名内容访问（公开）
- PUT /api/file/folder/view — 更新文件夹视图
- GET /api/file/folder/tree/:id — 获取文件夹树
- GET /api/file/folder/size/:id — 获取文件夹大小
- POST /api/file/folder/move — 移动文件
- POST /api/file/folder/copy — 复制文件
- POST /api/policies — 创建存储策略
- GET /api/policies — 列出存储策略
- GET /api/policies/:id — 获取存储策略
- PUT /api/policies/:id — 更新存储策略
- DELETE /api/policies/:id — 删除存储策略
- POST /api/direct-links — 创建直链
- GET /api/f/:publicID/*filename — 短链下载（公开）
- GET /api/thumbnail/regenerate — 重新生成缩略图（管理员）
- GET /api/thumbnail/regenerate/directory — 批量重新生成缩略图（管理员）
- GET /api/thumbnail/:publicID — 获取缩略图签名（管理员）
- GET /api/t/:signedToken — 缩略图内容访问（公开）
- POST /api/articles/upload — 文章图片上传（补全 Phase 03 的 501 stub）

**不实现但保留路由（返回 501）：**
- 云端存储策略（OneDrive、阿里云 OSS、腾讯云 COS、AWS S3、七牛、又拍云）— 仅实现 local 类型
- POST /api/policies/connect/onedrive/:id — OneDrive OAuth 授权
- POST /api/policies/authorize/onedrive — OneDrive 回调

</domain>

<decisions>
## Implementation Decisions

### 分块上传会话存储
- **D-94:** 分块上传会话使用内存 Map + TTL 存储，与 Phase 01 的缓存模式一致。会话数据结构包含：sessionId、ownerId、policyId、uri、chunkSize、fileSize、uploadedChunks（Set<number>）、expireAt。内存 Map 定期清理过期会话（每 60 秒扫描一次）。进程重启时所有进行中的上传会话丢失，用户需要重新上传 — 个人博客场景可接受
- **D-95:** 分块文件存储在 `data/uploads/tmp/{sessionId}/` 临时目录中，每个分块存为一个独立文件（`chunk-0`、`chunk-1`...）。合并时按序读取拼接到目标文件。上传完成或取消后清理临时目录。进程重启时 `data/uploads/tmp/` 下残留的临时目录在启动时扫描并清理（超过 24 小时的临时目录视为过期清理）

### 上传流程
- **D-96:** 上传流程完整复刻 Go 后端：1) 创建上传会话 → 2) 逐块上传 → 3) 合并文件 → 4) 创建文件记录。支持服务端上传（upload_method=server）和客户端直传（upload_method=client）两种模式。本地存储策略使用 server 模式
- **D-97:** 客户端直传（upload_method=client）在本地存储策略下不适用 — 本地存储只能通过服务端上传。当存储策略为 local 时，CreateUploadSession 返回 upload_method=server + session_id + chunk_size，前端走分块上传流程
- **D-98:** FinalizeClientUpload 端点在本地存储场景下不常用，但保留以保持 API 兼容性。当收到 finalize 请求时，验证文件已在磁盘上存在，然后创建文件记录

### 存储策略范围
- **D-99:** Phase 05 只实现 local（本机存储）存储类型。其他云存储类型（onedrive、aliyun_oss、tencent_cos、aws_s3、qiniu_kodo、upyun）的 CRUD 端点保留，但创建时验证 type 必须为 local，非 local 类型返回 501 或 400。与项目目标"零依赖本地运行"一致
- **D-100:** StoragePolicy CRUD 端点路径与 Go 后端一致：POST/GET/PUT/DELETE /api/policies。字段包括 name、type（只允许 local）、server、bucket_name、is_private、access_key、secret_key、max_size、base_path、virtual_path、flag、settings（JSON）、node_id。前端 StoragePolicy 类型定义确认了这些字段名
- **D-101:** 存储策略的 flag 字段用于标识默认策略：article_image、comment_image、user_avatar。每个 flag 在未删除的策略中唯一。创建/更新时验证唯一性
- **D-102:** 本地存储的文件物理路径由 StoragePolicy.base_path + URI 拼接。默认 base_path 为 `data/uploads`。静态文件通过 @nestjs/serve-static 提供访问

### 缩略图生成策略
- **D-103:** 缩略图使用 sharp 库同步生成（在文件上传完成后立即生成），替代 Go 后端的异步任务队列模式。个人博客场景不需要异步队列 — 同步生成即可，上传等待时间可接受
- **D-104:** 缩略图存储路径：`data/uploads/thumbnails/{publicID}.webp`。生成时将原图调整为最大宽度 400px、高度 400px，输出 WebP 格式（比 JPEG 更小）。与 Go 后端的缩略图目录结构一致
- **D-105:** 缩略图签名 URL 机制简化：不再实现 Go 后端的复杂签名/模糊化流程。GET /api/thumbnail/:publicID 直接返回缩略图的签名访问信息（sign + expires），GET /api/t/:signedToken 验证签名后返回缩略图文件。签名使用 HMAC-SHA256，有效期 15 分钟。这保持了 API 路径兼容性，但简化了内部实现
- **D-106:** 缩略图状态跟踪简化：不在 metadata 表中跟踪缩略图生成状态。上传完成后立即生成，生成失败则记录日志但不阻止文件上传。GET /api/thumbnail/:publicID 如果缩略图不存在，同步触发生成后返回。RegenerateThumbnail 端点删除旧缩略图后重新生成

### 直链与短链设计
- **D-107:** 直链功能完整复刻 Go 后端：POST /api/direct-links 创建直链记录，GET /api/f/:publicID/*filename 作为短链下载路径。publicID 使用 Sqids 编码（EntityTypeFile），filename 为模糊化文件名（保持原始扩展名，但文件名部分用 Sqids 编码或随机字符串替代）
- **D-108:** 短链下载流程：1) 解码 publicID 得到文件 ID → 2) 查询文件和存储策略 → 3) 检查访问权限（is_private 需要登录） → 4) 设置 Content-Disposition 响应头 → 5) 流式返回文件内容。与 Go 后端 HandleDirectDownload 行为一致
- **D-109:** 直链表（direct_links）已在 Phase 01 定义 Schema。字段包括 id、name、url、publicID、fileId、isEnabled、createdAt、updatedAt。直接使用已有 Schema

### 文件管理与目录树
- **D-110:** 文件管理采用实体（Entity）+ 文件（File）双表模型，与 Go 后端一致。Entity 代表目录或文件逻辑节点，File 代表物理文件。目录结构通过 Entity 的 parentID 实现树形组织
- **D-111:** 文件/文件夹 CRUD 操作复刻 Go 后端：创建空文件、重命名、移动、复制、批量删除、获取文件夹树、计算文件夹大小。文件夹树使用递归查询 Entity 表构建
- **D-112:** 文件下载使用流式传输（stream），不将整个文件加载到内存。大文件使用 Node.js 的 createReadStream 分块传输

### 文章图片上传补全
- **D-113:** POST /api/articles/upload 补全 Phase 03 的 501 stub。使用 multer 中间件接收单文件上传，保存到默认存储策略（article_image flag）的路径下，生成缩略图，返回文件信息（与 Go 后端 UploadImage 响应格式一致）

### 静态文件服务
- **D-114:** 使用 @nestjs/serve-static 提供 data/uploads 目录的静态文件访问。配置路径前缀与 Go 后端一致。缩略图目录 data/uploads/thumbnails 也通过静态文件服务提供访问

### Claude's Discretion
- UploadService 的具体分块合并策略（是否使用流式合并）
- 缩略图生成的具体参数（宽度、高度、格式、质量）
- 签名 URL 的具体实现（HMAC 密钥来源、签名算法细节）
- 文件夹树的递归查询优化策略
- 上传会话清理的具体实现（定时器 vs 惰性检查）
- 文件实体（Entity）和文件记录（File）的精确字段映射
- 下载接口的 Content-Type 和 Content-Disposition 设置细节

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端文件上传源码（API 兼容性的权威参考）
- `pkg/handler/file/handler.go` — FileHandler 结构定义
- `pkg/handler/file/upload.go` — 上传相关：CreateUploadSession、GetUploadSessionStatus、UploadChunk、DeleteUploadSession、FinalizeClientUpload
- `pkg/handler/file/operation.go` — 文件操作：CreateEmptyFile、UpdateFileContentByID、DeleteItems、RenameItem、MoveItems、CopyItems
- `pkg/handler/file/query.go` — 文件查询：GetFilesByPath、GetFileInfo、DownloadFile、GetDownloadInfo、GetPreviewURLs、ServeSignedContent、GetFolderTree、GetFolderSize、UpdateFolderView
- `pkg/handler/file/download.go` — 下载相关：HandleUniversalSignedDownload
- `pkg/domain/model/upload.go` — 上传数据模型：CreateUploadRequest、FinalizeUploadRequest、DeleteUploadRequest、UploadSessionData、UploadSessionStatusResponse、UploadSessionInvalidResponse、UploadSession
- `pkg/handler/storage_policy/handler.go` — StoragePolicyHandler：Create、List、Get、Update、Delete、ConnectOneDrive、AuthorizeOneDrive
- `pkg/handler/thumbnail/handler.go` — ThumbnailHandler：RegenerateThumbnail、RegenerateThumbnailsForDirectory、GetThumbnailSign、HandleThumbnailContent
- `pkg/handler/direct_link/handler.go` — DirectLinkHandler：GetOrCreateDirectLinks、HandleDirectDownload
- `pkg/handler/image/handler.go` — ImageHandler：ServeStyled（图片样式路由）
- `ent/schema/storagepolicy.go` — StoragePolicy 表 Schema 定义
- `ent/schema/directlink.go` — DirectLink 表 Schema 定义
- `pkg/domain/model/storage_policy.go` — StoragePolicy 模型定义（StoragePolicyType、StoragePolicySettings、CLOUD_STORAGE_TYPES 等）

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，文件/存储/缩略图/直链端点的路径和中间件组合：
  - filesGroup: GET/POST/PUT/DELETE /api/file/*
  - uploadGroup: PUT/GET/POST/DELETE /api/file/upload/*
  - folderGroup: PUT/GET/POST /api/file/folder/*
  - policies: POST/GET/PUT/DELETE /api/policies/*
  - thumbnail: POST/GET /api/thumbnail/*
  - directLinks: POST /api/direct-links
  - apiGroup: GET /api/f/:publicID/*filename, GET /api/t/:signedToken

### 现有 NestJS 代码（Phase 01-04 产出）
- `server/src/database/schemas/file.schema.ts` — files 表 Schema
- `server/src/database/schemas/entity.schema.ts` — entities 表 Schema
- `server/src/database/schemas/direct-link.schema.ts` — direct_links 表 Schema
- `server/src/database/schemas/storage-policy.schema.ts` — storage_policies 表 Schema
- `server/src/database/schemas/metadata.schema.ts` — metadata 表 Schema（缩略图状态可用）
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器（EntityTypeFile 已定义）
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/constants/error-codes.ts` — 错误码常量文件
- `server/src/settings/settings.service.ts` — SettingsService（内存缓存）
- `server/src/article/article.controller.ts` — ArticleController（/upload 501 stub 需补全）

### 前端文件上传类型定义
- `frontend/src/types/storage-policy.ts` — StoragePolicy、StoragePolicyType、StoragePolicySettings 类型定义
- `frontend/src/types/file-management.ts` — 文件管理相关类型定义
- `frontend/src/lib/api/file-management.ts` — 文件管理 API 调用

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-93）
- `.planning/REQUIREMENTS.md` — 完整验收标准（FILE-01, FILE-02, THUMB-01, STORAGE-01, LINK-DIRECT-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **File/Entity/DirectLink/StoragePolicy Schemas**: Drizzle Schema 文件已定义所有数据库表字段，可直接使用
- **Metadata Schema**: 可用于存储缩略图生成状态（MetaKeyThumbStatus 等键），Phase 05 可选择性使用
- **Sqids Encoder** (server/src/common/utils/sqids.ts): EntityTypeFile 已定义，文件 ID 编解码可直接使用
- **Guards + @Public()**: 文件管理端点需要 JWT + Admin，下载/短链/缩略图访问端点需要 @Public()
- **SettingsService**: 内存缓存，可用于存储上传策略配置（chunk_size、max_size 等）
- **ResponseInterceptor**: 全局 { code, data, message } 包装，Controller 直接返回 data 即可
- **Error Codes**: 已有错误码常量文件，需扩展文件相关错误码

### Established Patterns
- Go 后端文件系统采用 Entity（目录/文件节点）+ File（物理文件）双表模型，Entity 有 parentID 实现树形结构
- Go 后端上传流程：创建会话 → 上传分块 → 合并 → 创建文件记录。会话存储在 Redis（NestJS 用内存 Map 替代）
- Go 后端缩略图使用异步任务队列 + 签名 URL + 元数据状态跟踪。NestJS 简化为同步生成 + 签名 URL
- Go 后端直链使用 Sqids 编码 publicID + 模糊化文件名。NestJS 复刻此模式
- Go 后端存储策略支持 7 种存储类型，NestJS 只实现 local
- Go 后端短链路径 /api/f/:publicID/*filename 使用通配符匹配模糊化文件名

### Integration Points
- FileModule 需要注册到 AppModule
- StoragePolicyModule 需要注册到 AppModule
- ThumbnailModule 需要注册到 AppModule
- DirectLinkModule 需要注册到 AppModule
- ArticleController.uploadImage (POST /api/articles/upload) 需要从 501 stub 补全为实际实现
- @nestjs/serve-static 需要配置提供 data/uploads 目录的静态文件服务
- 上传会话内存 Map 需要在启动时清理过期临时目录

</code_context>

<specifics>
## Specific Ideas

- Go 后端 UploadSession 存储在 Redis 中，包含 sessionId、ownerId、policyId、uri、chunkSize、fileSize、tempEntityID、uploadedChunks（map[int]bool）、expireAt。NestJS 用内存 Map 存储，uploadedChunks 用 Set<number> 替代 map[int]bool
- Go 后端 CreateUploadSession 返回 UploadSessionData 结构：{ expires, upload_method, session_id, chunk_size, storage_policy }。本地存储策略返回 upload_method=server
- Go 后端 GetUploadSessionStatus 返回 { session_id, is_valid, chunk_size, total_chunks, uploaded_chunks, expires_at }。会话不存在时返回 { is_valid: false }
- Go 后端 UploadChunk 接收 application/octet-stream body，写入临时文件。NestJS 使用 multer 的 memoryStorage 或直接流式写入临时文件
- Go 后端 FinalizeClientUpload 返回 { file_id, name, size }，file_id 是 Sqids 编码的公共 ID
- Go 后端 GetThumbnailSign 返回 { sign, expires, obfuscated: true } 或 { status: "processing" }。NestJS 简化为：缩略图存在返回签名，不存在则同步生成后返回签名
- Go 后端 HandleThumbnailContent (GET /api/t/:signedToken) 验证签名后返回缩略图文件
- Go 后端 HandleDirectDownload (GET /api/f/:publicID/*filename) 解码 publicID、查询文件、检查权限、设置 Content-Disposition 后流式返回文件
- 前端 storage-policy.ts 定义了 7 种存储类型标签，但 NestJS 只需实现 local
- 前端 POLICY_FLAGS 定义了 article_image、comment_image、user_avatar 三种策略标志

</specifics>

<deferred>
## Deferred Ideas

- 云端存储策略实现（OneDrive、阿里云 OSS、腾讯云 COS、AWS S3、七牛、又拍云）— 后续阶段按需实现，Phase 05 只实现 local 类型
- OneDrive OAuth 授权流程 — 依赖云端存储，Phase 05 返回 501
- 异步缩略图生成队列 — Phase 05 使用同步生成，如果性能不足再引入异步队列（Phase 10 定时任务可包含缩略图批量处理）
- 图片样式处理（GET /api/image/*pathWithStyle）— Go 后端的 image handler 支持实时裁剪/水印，Phase 05 不实现，后续阶段按需添加
- 上传进度通知（WebSocket/SSE）— Go 后端无此功能，属于新能力
- 文件版本管理 — Go 后端 FileEntity 有 version 字段，Phase 05 实现基础版本号，详细版本历史留后续
- CDN 预热/刷新 — 依赖云端存储策略，Phase 05 不实现

</deferred>

---

*Phase: 5-File Upload & Media*
*Context gathered: 2026-07-04*
