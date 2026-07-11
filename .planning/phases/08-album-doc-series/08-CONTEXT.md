# Phase 08: Album & Doc Series - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

相册图片 CRUD 与分类管理；文档系列 CRUD 用于有序文章集合。百分百复刻 Go 后端的相册和文档系列功能，不留后续阶段。

**交付物：**

相册管理端点：
- GET /api/albums/get — 获取相册图片列表（分页+筛选）
- POST /api/albums/add — 添加相册图片
- POST /api/albums/batch-import — URL 批量导入图片
- PUT /api/albums/update/:id — 更新相册图片
- DELETE /api/albums/delete/:id — 删除相册图片
- DELETE /api/albums/batch-delete — 批量删除相册图片
- POST /api/albums/export — 导出相册（JSON）
- POST /api/albums/import — 导入相册（JSON）

相册分类端点：
- POST /api/album-categories — 创建分类
- GET /api/album-categories — 获取分类列表
- GET /api/album-categories/:id — 获取分类详情
- PUT /api/album-categories/:id — 更新分类
- DELETE /api/album-categories/:id — 删除分类

相册公开端点：
- GET /api/public/albums — 获取公开相册列表
- GET /api/public/album-categories — 获取公开相册分类
- PUT /api/public/stat/:id — 更新相册统计（浏览/下载计数）

文档系列管理端点：
- POST /api/doc-series — 创建文档系列
- GET /api/doc-series — 获取文档系列列表
- GET /api/doc-series/:id — 获取文档系列详情
- PUT /api/doc-series/:id — 更新文档系列
- DELETE /api/doc-series/:id — 删除文档系列

文档系列公开端点：
- GET /api/public/doc-series — 获取公开文档系列列表
- GET /api/public/doc-series/:id — 获取公开文档系列详情
- GET /api/public/doc-series/:id/articles — 获取文档系列及其文章列表

</domain>

<decisions>
## Implementation Decisions

### 相册 ID 编码方式
- **D-183:** 相册和相册分类使用整数 ID（与 Go 后端一致），不使用 Sqids 编码。Go 后端相册 handler 使用 `strconv.ParseUint(c.Param("id"), 10, 32)` 直接解析整数 ID，分类 handler 同样使用整数 ID。DocSeries 使用 Sqids 公共 ID（与 Go 后端一致，DocSeries handler 使用字符串 ID + DecodePublicID）

### 相册批量导入与导出
- **D-184:** 完整实现相册 BatchImport（URL 批量导入图片，含下载远程图片+去重+缩略图生成）+ Import/Export（JSON 导入导出），百分百复刻 Go 后端。BatchImport 端点 POST /api/albums/batch-import 接收 URL 列表，逐个下载图片、计算 fileHash 去重、生成缩略图、创建相册记录。Import/Export 端点与 Go 后端 JSON 格式完全一致

### DocSeries 文章关联方式
- **D-185:** DocSeries 与 Article 使用 article 表加 `doc_series_id` + `doc_sort` 字段关联（一对多），与 Go 后端 ent schema 的 edge.To("articles", Article.Type) 语义一致。一篇文章只能属于一个文档系列，doc_sort 控制文章在系列中的排序。需要在现有 article.schema.ts 中新增这两个字段

### 相册浏览/下载统计
- **D-186:** 完整复刻 Go 后端相册统计：PUT /api/public/stat/:id 端点更新 view_count/download_count。使用内存 Map 计数 + 直接写库更新（与 Phase 07 统计模块的内存去重模式一致）。Phase 10 定时任务可优化为批量持久化

### 相册图片数据模型
- **D-187:** 相册使用 Phase 01 已定义的 `albums` 表 Schema（album.schema.ts），包含完整字段：id, created_at, updated_at, deleted_at, image_url, big_image_url, download_url, thumb_param, big_param, tags, view_count, download_count, width, height, file_size, format, aspect_ratio, file_hash(unique), display_order, category_id, title, description, location, published_at。无需修改 Schema

### 相册分类数据模型
- **D-188:** 相册分类使用 Phase 01 已定义的 `album_categories` 表 Schema（album-category.schema.ts），包含字段：id, created_at, updated_at, name, description, cover_url, sort, password。Go 后端 AlbumCategory DTO 包含 id/name/description/cover_url/sort/password + 关联相册数量 album_count

### DocSeries 数据模型
- **D-189:** DocSeries 使用 Phase 01 已定义的 `doc_series` 表 Schema（doc-series.schema.ts），包含字段：id, created_at, updated_at, name, description, cover_url, sort, doc_count。DocSeries ID 使用 Sqids 编码（需新增 EntityTypeDocSeries 常量）。doc_count 在文章关联/取消关联时同步更新

### 相册 CreateOrRestore 去重逻辑
- **D-190:** 完整复刻 Go 后端相册 CreateOrRestore 去重逻辑：1) 根据 fileHash 查找已有记录 → 2) 如果存在且未删除（StatusExisted），返回"图片已存在"错误 → 3) 如果存在且已软删除（StatusRestored），恢复记录并更新字段 → 4) 如果不存在（StatusCreated），创建新记录。fileHash 是唯一约束

### 相册默认值填充
- **D-191:** 完整复刻 Go 后端 applyDefaultAlbumParams：1) 如果 image_url 为空但 big_image_url 不为空，image_url = big_image_url → 2) 如果 big_image_url 为空但 image_url 不为空，big_image_url = image_url → 3) 如果 download_url 为空，download_url = image_url → 4) 如果 published_at 为空，published_at = created_at → 5) 计算 aspect_ratio（宽高比简化字符串）

### 相册查询筛选
- **D-192:** 完整复刻 Go 后端 FindAlbums 查询参数：page, pageSize, categoryId, tag, start(开始日期), end(结束日期), sort(排序方式)。支持按分类筛选、按标签筛选、按时间范围筛选、按排序字段排序

### DocSeries 公开端点
- **D-193:** DocSeries 公开端点与 Go 后端一致：GET /api/public/doc-series 返回系列列表（分页），GET /api/public/doc-series/:id 返回系列详情，GET /api/public/doc-series/:id/articles 返回系列+文章列表（DocSeriesWithArticles 结构，包含 articles 数组，每项有 id/title/abbrlink/doc_sort/created_at）

### DocSeries 文章关联管理
- **D-194:** DocSeries 文章关联通过 article 表的 doc_series_id + doc_sort 字段管理。创建/更新系列时可以指定关联文章列表（文章 ID + doc_sort），DocSeriesService 负责更新 article 表的 doc_series_id 和 doc_sort 字段。删除系列时清空关联文章的 doc_series_id 和 doc_sort

### Module 组织
- **D-195:** AlbumModule 单模块组织：包含 AlbumController（管理端点）、AlbumCategoryController（分类端点）、AlbumService、AlbumCategoryService、AlbumRepository、AlbumCategoryRepository。公开端点在 PublicController 中（与 Go 后端 public handler 一致）
- **D-196:** DocSeriesModule 单模块组织：包含 DocSeriesController（管理端点 + 公开端点）、DocSeriesService、DocSeriesRepository。公开端点用 @Public()，管理员端点用 AdminGuard

### Claude's Discretion
- AlbumRepository 的具体查询方法设计（Drizzle 查询构建方式）
- AlbumService 中 BatchImport 的图片下载实现（并发控制、超时、重试）
- AlbumService 中 Import/Export 的 JSON 解析和去重逻辑
- AlbumCategoryService 中分类删除时关联相册的处理策略
- DocSeriesRepository 的具体查询方法设计
- DocSeriesService 中文章关联/取消关联的 doc_count 同步逻辑
- 相册统计内存 Map 的具体实现（TTL 管理、清理策略）
- aspect_ratio 计算的具体实现（getSimplifiedAspectRatioString）
- 相册图片缩略图参数（thumb_param/big_param）的处理逻辑

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Go 后端相册源码（API 兼容性的权威参考）
- `pkg/handler/album/handler.go` — AlbumHandler：GetAlbums、AddAlbum、BatchImportAlbums、UpdateAlbum、DeleteAlbum、BatchDeleteAlbums、ExportAlbums、ImportAlbums
- `pkg/service/album/service.go` — AlbumService：CreateAlbum（含 CreateOrRestore 去重逻辑）、DeleteAlbum、BatchDeleteAlbums、UpdateAlbum、FindAlbums、IncrementAlbumStat、applyDefaultAlbumParams、getSimplifiedAspectRatioString
- `pkg/domain/model/album.go` — Album、CreateAlbumParams、UpdateAlbumParams、FindAlbumsParams、BatchImportResult 等数据模型
- `ent/schema/album.go` — Album 表 Schema 定义（20+ 字段 + edges + SoftDeleteMixin）

### Go 后端相册分类源码
- `pkg/handler/album_category/handler.go` — AlbumCategoryHandler：CreateCategory、ListCategories、GetCategory、UpdateCategory、DeleteCategory
- `pkg/service/album_category/service.go` — AlbumCategoryService：CreateCategory、ListCategories、GetCategory、UpdateCategory、DeleteCategory
- `pkg/domain/model/album_category.go` — AlbumCategoryDTO、CreateAlbumCategoryRequest、UpdateAlbumCategoryRequest 等数据模型
- `ent/schema/album_category.go` — AlbumCategory 表 Schema 定义

### Go 后端文档系列源码
- `pkg/handler/doc_series/handler.go` — DocSeriesHandler：Create、List、Get、GetWithArticles、Update、Delete
- `pkg/service/doc_series/service.go` — DocSeriesService：Create、List、GetByID、GetByIDWithArticles、Update、Delete
- `pkg/domain/model/docseries.go` — DocSeries、CreateDocSeriesRequest、UpdateDocSeriesRequest、DocSeriesResponse、DocSeriesListResponse、DocSeriesWithArticles、DocArticleItem、ListDocSeriesOptions 等数据模型
- `ent/schema/docseries.go` — DocSeries 表 Schema 定义（7 字段 + edge.To("articles", Article.Type)）

### Go 后端路由
- `internal/infra/router/router.go` — 全部路由注册，相册/分类/文档系列端点的路径和中间件组合：
  - albums: GET /api/albums/get, POST /api/albums/add, POST /api/albums/batch-import, PUT /api/albums/update/:id, DELETE /api/albums/delete/:id, DELETE /api/albums/batch-delete, POST /api/albums/export, POST /api/albums/import（全部 JWTAuth + AdminAuth）
  - albumCategories: CRUD /api/album-categories（全部 JWTAuth + AdminAuth）
  - docSeriesPublic: GET /api/public/doc-series, GET /api/public/doc-series/:id, GET /api/public/doc-series/:id/articles
  - docSeriesAdmin: CRUD /api/doc-series（JWTAuth + AdminAuth）
  - publicAlbums: GET /api/public/albums, GET /api/public/album-categories, PUT /api/public/stat/:id

### 现有 NestJS 代码（Phase 01-07 产出）
- `server/src/album/album.module.ts` — AlbumModule 空占位
- `server/src/doc-series/doc-series.module.ts` — DocSeriesModule 空占位
- `server/src/database/schemas/album.schema.ts` — albums 表 Schema（完整字段 + 索引）
- `server/src/database/schemas/album-category.schema.ts` — album_categories 表 Schema
- `server/src/database/schemas/doc-series.schema.ts` — doc_series 表 Schema
- `server/src/database/schemas/article.schema.ts` — articles 表 Schema（需新增 doc_series_id + doc_sort 字段）
- `server/src/common/guards/` — JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard
- `server/src/common/decorators/public.decorator.ts` — @Public() 装饰器
- `server/src/common/interceptors/response.interceptor.ts` — 全局 { code, data, message } 拦截器
- `server/src/common/utils/sqids.ts` — Sqids 编解码器（需新增 EntityTypeDocSeries 常量）
- `server/src/common/constants/error-codes.ts` — 错误码常量文件（需扩展相册/文档系列相关错误码）
- `server/src/settings/settings.service.ts` — SettingsService（内存缓存 + 动态配置读取）
- `server/src/file/upload.service.ts` — UploadService（相册图片上传可复用）
- `server/src/thumbnail/thumbnail.service.ts` — ThumbnailService（相册缩略图生成可复用）

### 前端类型定义
- `frontend/src/types/doc-series.ts` — DocSeries、DocSeriesForm、DocSeriesListResponse、DocSeriesListParams、DocArticleItem、DocSeriesWithArticles 类型定义
- `frontend/src/components/admin/doc-series/DocSeriesTableColumns.tsx` — 文档系列管理前端表格列定义

### 项目配置
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-182）
- `.planning/REQUIREMENTS.md` — 完整验收标准（ALBUM-01, DOCSERIES-01）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **albums Schema** (server/src/database/schemas/album.schema.ts): 完整字段已定义（20+ 字段 + fileHash unique 索引 + categoryId FK + deletedAt 软删除），可直接使用
- **album_categories Schema** (server/src/database/schemas/album-category.schema.ts): 完整字段已定义（name, description, cover_url, sort, password），可直接使用
- **doc_series Schema** (server/src/database/schemas/doc-series.schema.ts): 完整字段已定义（name, description, cover_url, sort, doc_count），可直接使用
- **AlbumModule** (server/src/album/album.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **DocSeriesModule** (server/src/doc-series/doc-series.module.ts): 空模块占位，需要添加 Controller/Service/Repository
- **Guards**: JwtAuthGuard、JwtAuthOptionalGuard、AdminGuard 已实现，可直接用于路由保护
- **@Public() decorator**: 公开路由跳过认证
- **ResponseInterceptor**: 全局 { code, data, message } 包装，Controller 直接返回 data 即可
- **Sqids Encoder** (server/src/common/utils/sqids.ts): 需新增 EntityTypeDocSeries 常量
- **SettingsService**: 内存缓存 + 动态配置读取，用于读取相册配置
- **UploadService** (server/src/file/upload.service.ts): 相册图片上传可复用
- **ThumbnailService** (server/src/thumbnail/thumbnail.service.ts): 相册缩略图生成可复用
- **Error Codes**: 已有错误码常量文件，需扩展相册/文档系列相关错误码

### Established Patterns
- Go 后端相册使用整数 ID（非 Sqids），分类也使用整数 ID
- Go 后端 DocSeries 使用 Sqids 公共 ID（字符串 ID + DecodePublicID）
- Go 后端相册有 CreateOrRestore 去重逻辑：根据 fileHash 判断图片是否已存在
- Go 后端相册有三种状态：StatusCreated（新建）、StatusRestored（恢复已删除记录）、StatusExisted（已存在拒绝）
- Go 后端相册有 applyDefaultAlbumParams 默认值填充：image_url/big_image_url/download_url 互相同步、published_at 默认 created_at、计算 aspect_ratio
- Go 后端相册查询支持多维度筛选：categoryId、tag、时间范围、排序
- Go 后端相册统计使用 PUT /api/public/stat/:id 端点更新 view_count/download_count
- Go 后端 DocSeries 与 Article 是一对多关系（edge.To），文章通过 doc_series_id + doc_sort 关联到系列
- Go 后端 DocSeriesWithArticles 包含系列信息 + articles 数组（每项有 id/title/abbrlink/doc_sort/created_at）
- Go 后端相册批量导入（BatchImport）接收 URL 列表，逐个下载图片、计算 fileHash 去重、生成缩略图
- Go 后端相册导入/导出使用 JSON 格式
- Go 后端相册分类删除时检查是否有关联相册在使用

### Integration Points
- AlbumModule 需要注册到 AppModule
- DocSeriesModule 需要注册到 AppModule
- article.schema.ts 需要新增 doc_series_id + doc_sort 字段
- Sqids 编解码器需要新增 EntityTypeDocSeries 常量
- Error codes 需要扩展相册/文档系列相关错误码
- AlbumService 需要注入 ThumbnailService（缩略图生成）
- AlbumService 需要注入 UploadService 或 FileService（图片下载和存储）
- DocSeriesService 需要注入 ArticleService 或直接查询 article 表（文章关联管理）
- 相册统计端点 PUT /api/public/stat/:id 需要在 PublicController 或 AlbumController 中注册

</code_context>

<specifics>
## Specific Ideas

- Go 后端相册 AddAlbum 请求体包含：categoryId, imageUrl(required), bigImageUrl, downloadUrl, thumbParam, bigParam, tags([]string), width, height, fileSize, format, fileHash(required), displayOrder, title, description, location, created_at, published_at。fileHash 是必填字段，用于去重
- Go 后端相册 GetAlbums 查询参数：page, pageSize, categoryId, tag, start, end, sort。返回分页结果 { list, total, page, pageSize }
- Go 后端相册 BatchDeleteAlbums 请求体：{ ids: []uint }，返回 { deleted: count }
- Go 后端相册 UpdateAlbum 请求体与 AddAlbum 类似但字段可选（partial update）
- Go 后端相册 BatchImport 接收 URL 列表，对每个 URL：1) 下载图片 → 2) 计算 fileHash → 3) 检查去重 → 4) 生成缩略图 → 5) 创建相册记录。返回批量导入结果
- Go 后端相册 Export 导出所有相册+分类为 JSON 格式，Import 导入 JSON 数据（含去重处理）
- Go 后端 AlbumCategory DTO 包含：id, name, description, cover_url, sort, password, album_count（关联相册数量）
- Go 后端 DocSeries Response 包含：id(Sqids), created_at, updated_at, name, description, cover_url, sort, doc_count
- Go 后端 DocSeriesWithArticles 在 DocSeriesResponse 基础上增加 articles 数组，每项包含：id(Sqids), title, abbrlink, doc_sort, created_at
- Go 后端 DocSeries List 返回分页结果 { list, total, page, pageSize }，默认 pageSize=20
- Go 后端 DocSeries Create 请求体：name(required), description, cover_url, sort
- Go 后端 DocSeries Update 请求体：name, description, cover_url, sort（全部可选，partial update）
- Go 后端相册统计端点 PUT /api/public/stat/:id 接收 { type: "view" | "download" }，更新对应计数
- Go 后端 getSimplifiedAspectRatioString 将宽高比简化为字符串（如 "16:9", "4:3", "1:1"），用于 aspect_ratio 字段

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-Album & Doc Series*
*Context gathered: 2026-07-11*
