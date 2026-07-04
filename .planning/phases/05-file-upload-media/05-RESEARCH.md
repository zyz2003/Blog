# Phase 5: File Upload & Media - Research

**Researched:** 2026-07-04
**Domain:** File upload, storage policy, thumbnails, direct links, file operations
**Confidence:** HIGH

## Summary

Phase 05 implements the complete file management subsystem for the anheyu-app NestJS backend. This covers chunked file upload with session lifecycle, file CRUD operations on a dual-table Entity+File model, storage policy management (local only), thumbnail generation with signed URLs, and direct link / short-link download. The Go backend uses Redis for upload sessions, an async task queue for thumbnails, and supports 7 cloud storage types. The NestJS rewrite replaces Redis with an in-memory Map, async queues with synchronous sharp generation, and restricts storage to the `local` type only -- while maintaining complete API path and response format compatibility.

**Primary recommendation:** Implement file upload, operations, storage policy, thumbnails, and direct links as separate NestJS modules (FileModule, StoragePolicyModule, ThumbnailModule, DirectLinkModule), each with controller/service/DTO layers, following the patterns established in Phases 01-04. The upload session lifecycle and file operations must exactly replicate the Go backend's behavior as documented below.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-94:** Upload sessions stored in memory Map + TTL, with 60-second cleanup scan. Process restart loses all sessions.
- **D-95:** Chunk files stored in `data/uploads/tmp/{sessionId}/`, each chunk as `chunk-0`, `chunk-1`... Merged by sequential read-concatenate. Cleanup on completion/cancel and at startup (>24h temp dirs).
- **D-96:** Full Go upload flow: create session -> upload chunks -> merge -> create file record. Supports server upload (upload_method=server) and client direct upload (upload_method=client). Local storage uses server mode.
- **D-97:** Client direct upload not applicable for local storage -- local always returns upload_method=server.
- **D-98:** FinalizeClientUpload endpoint preserved for API compatibility but rarely used in local storage scenario.
- **D-99:** Only implement `local` storage type. Other types (onedrive, aliyun_oss, etc.) return 501 or 400 on create.
- **D-100:** StoragePolicy CRUD at /api/policies. Fields: name, type (local only), server, bucket_name, is_private, access_key, secret_key, max_size, base_path, virtual_path, flag, settings (JSON), node_id.
- **D-101:** StoragePolicy flag field identifies default policies: article_image, comment_image, user_avatar. Each flag is unique among non-deleted policies.
- **D-102:** Local storage physical path = StoragePolicy.base_path + URI. Default base_path = `data/uploads`. Static files via @nestjs/serve-static.
- **D-103:** Thumbnails generated synchronously with sharp after upload (not async queue). Personal blog scenario acceptable.
- **D-104:** Thumbnail path: `data/uploads/thumbnails/{publicID}.webp`. Max 400x400, WebP format.
- **D-105:** Thumbnail signing simplified: HMAC-SHA256, 15-min expiry. GET /api/thumbnail/:publicID returns sign+expires. GET /api/t/:signedToken verifies and serves.
- **D-106:** No metadata table tracking for thumbnail status. Upload triggers immediate generation; failure logs but doesn't block. GET /api/thumbnail/:publicID triggers sync generation if missing.
- **D-107:** Direct link: POST /api/direct-links creates records. GET /api/f/:publicID/*filename serves short-link downloads. publicID uses Sqids (EntityTypeDirectLink=7), filename is URL-encoded original name.
- **D-108:** Short-link flow: decode publicID -> query direct_link+file+policy -> check is_private -> set Content-Disposition -> stream file.
- **D-109:** Direct links table (direct_links) schema already defined in Phase 01.
- **D-110:** Dual-table model: Entity (directory/file node) + File (physical file). Tree via Entity.parentID.
- **D-111:** File CRUD replicates Go backend: create empty file, rename, move, copy, batch delete, folder tree, folder size.
- **D-112:** File download uses streaming (createReadStream), not full memory load.
- **D-113:** POST /api/articles/upload completes Phase 03's 501 stub using multer, saves to article_image flag policy, generates thumbnail.
- **D-114:** @nestjs/serve-static provides data/uploads directory. Path prefix matches Go backend.

### Claude's Discretion
- UploadService chunk merge strategy (streaming vs sequential)
- Thumbnail generation parameters (width, height, format, quality)
- Signed URL implementation details (HMAC key source, algorithm)
- Folder tree recursive query optimization
- Upload session cleanup implementation (timer vs lazy check)
- Exact field mapping between Entity/File and Go model
- Download Content-Type and Content-Disposition details

### Deferred Ideas (OUT OF SCOPE)
- Cloud storage policies (OneDrive, Aliyun OSS, Tencent COS, AWS S3, Qiniu, Upyun)
- OneDrive OAuth flow
- Async thumbnail generation queue
- Image style processing (GET /api/image/*pathWithStyle)
- Upload progress notifications (WebSocket/SSE)
- File version management (detailed history)
- CDN preheat/refresh
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-01 | File upload: single file upload | CreateUploadSession (PUT) + UploadChunk (POST) + auto-merge flow documented in Section 2 |
| FILE-02 | File upload: chunked upload | Full chunked upload lifecycle with session management documented in Section 2 |
| THUMB-01 | Thumbnail: generation, management | Thumbnail generation (sharp), signing (HMAC-SHA256), serving documented in Section 5 |
| STORAGE-01 | Storage policy: CRUD | Full CRUD endpoints, model fields, flag system documented in Section 4 |
| LINK-DIRECT-01 | Direct link: CRUD, short-link access | Direct link creation, short-link download flow documented in Section 6 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File upload (chunk receive + merge) | API / Backend | — | Server-side operation: receives chunks, merges to disk |
| File operations (CRUD, move, copy) | API / Backend | — | Database + filesystem operations |
| Storage policy management | API / Backend | — | Pure database CRUD with validation |
| Thumbnail generation | API / Backend | — | Sharp processes images server-side |
| Thumbnail signing & serving | API / Backend | CDN / Static | Signed URLs serve thumbnail files |
| Direct link creation | API / Backend | — | Database record creation |
| Short-link download | API / Backend | — | Streams file from local storage |
| Static file serving | CDN / Static | API / Backend | @nestjs/serve-static for data/uploads |
| Article image upload | API / Backend | — | Multer + storage policy + thumbnail |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | v0.35.2 | Thumbnail generation | CLAUDE.md mandated; faster than ImageMagick; WebP output |
| @nestjs/serve-static | latest | Static file serving for uploads | NestJS official; serves data/uploads directory |
| sqids | v0.3.0 | Public ID encoding | Already installed; Go-compatible encoder in sqids.util.ts |
| multer | built-in | Multipart file upload | Built into @nestjs/platform-express |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-validator | v0.15.1 | Request DTO validation | All file/policy request bodies |
| class-transformer | v0.5.1 | Response DTO transformation | Excluding sensitive fields from responses |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory Map for sessions | SQLite table | Map loses on restart but matches CONTEXT.md D-94; simpler |
| Synchronous sharp | Bull queue + worker | Sync is simpler per D-103; acceptable for personal blog |
| HMAC-SHA256 signing | JWT for thumbnails | HMAC is lighter; no need for JWT payload structure |

**Installation:**
```bash
npm install sharp @nestjs/serve-static
```

**Version verification:**
```bash
npm view sharp version
npm view @nestjs/serve-static version
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| sharp | npm | ~10 yrs | ~5M/wk | github.com/lovell/sharp | OK | Approved |
| @nestjs/serve-static | npm | ~6 yrs | ~300K/wk | github.com/nestjs/serve-static | OK | Approved |
| sqids | npm | ~2 yrs | ~30K/wk | github.com/sqids/sqids-javascript | OK | Already installed |
| class-validator | npm | ~7 yrs | ~4M/wk | github.com/typestack/class-validator | OK | Already installed |
| class-transformer | npm | ~7 yrs | ~2M/wk | github.com/typestack/class-transformer | OK | Already installed |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Frontend (Next.js)
  |
  | HTTP (port 8091)
  v
NestJS API Layer
  |
  +-- FileController (/api/file/*)
  |     |-- Upload Flow: PUT /api/file/upload -> POST /:sessionId/:index -> auto-merge
  |     |-- Query: GET /api/file, GET /api/file/:id, GET preview-urls
  |     |-- Operations: POST create, PUT rename, DELETE batch, PUT content
  |     |-- Download: GET download/:id, GET download-info/:id
  |     |-- Signed Content: GET /content?sign=...
  |
  +-- FolderController (/api/folder/*)
  |     |-- PUT view, GET tree/:id, GET size/:id, POST move, POST copy
  |
  +-- StoragePolicyController (/api/policies/*)
  |     |-- CRUD: POST, GET list, GET :id, PUT :id, DELETE :id
  |
  +-- ThumbnailController (/api/thumbnail/*)
  |     |-- POST regenerate, POST regenerate/directory, GET :publicID
  |
  +-- DirectLinkController (/api/direct-links, /api/f/*, /api/t/*)
  |     |-- POST direct-links
  |     |-- GET /f/:publicID/*filename (public download)
  |     |-- GET /t/:signedToken (public thumbnail)
  |
  +-- ArticleController.uploadImage (POST /api/articles/upload)
  |
  v
Service Layer
  |-- UploadService (in-memory session Map, chunk temp dir, merge)
  |-- FileService (Entity+File dual-table operations, tree queries)
  |-- StoragePolicyService (CRUD with flag validation)
  |-- ThumbnailService (sharp generation, HMAC signing, file serving)
  |-- DirectLinkService (link creation, download preparation)
  |
  v
Data Layer
  |-- SQLite (Drizzle ORM)
  |     |-- files, entities, storage_policies, direct_links, metadatas tables
  |
  v
Filesystem
  |-- data/uploads/ (base_path for local storage)
  |-- data/uploads/tmp/{sessionId}/ (chunk temp files)
  |-- data/uploads/thumbnails/{publicID}.webp (generated thumbnails)
```

### Recommended Project Structure
```
server/src/
├── file/                          # FileModule (upload + operations + query)
│   ├── file.module.ts
│   ├── file.controller.ts
│   ├── file.service.ts
│   ├── upload.service.ts          # Upload session management
│   ├── dto/
│   │   ├── create-upload-session.dto.ts
│   │   ├── finalize-upload.dto.ts
│   │   ├── delete-upload-session.dto.ts
│   │   ├── create-file.dto.ts
│   │   ├── rename-item.dto.ts
│   │   ├── delete-items.dto.ts
│   │   ├── move-items.dto.ts
│   │   ├── copy-items.dto.ts
│   │   └── update-view-config.dto.ts
│   └── interfaces/
│       └── upload-session.interface.ts
├── storage-policy/                # StoragePolicyModule
│   ├── storage-policy.module.ts
│   ├── storage-policy.controller.ts
│   ├── storage-policy.service.ts
│   └── dto/
│       ├── create-policy.dto.ts
│       └── update-policy.dto.ts
├── thumbnail/                     # ThumbnailModule
│   ├── thumbnail.module.ts
│   ├── thumbnail.controller.ts
│   └── thumbnail.service.ts
├── direct-link/                   # DirectLinkModule
│   ├── direct-link.module.ts
│   ├── direct-link.controller.ts
│   └── direct-link.service.ts
└── common/
    └── constants/
        └── error-codes.ts         # Extended with file/policy/thumbnail errors
```

### Pattern 1: Upload Session Lifecycle
**What:** In-memory Map storing upload session state with TTL-based expiration
**When to use:** All chunked file uploads
**Example:**
```typescript
// UploadSession stored in memory Map
interface UploadSession {
  sessionId: string;        // UUID
  ownerId: number;          // Decoded from JWT
  policyId: string;         // Public ID of storage policy
  uri: string;              // Full target URI (e.g., "anzhiyu://my/images/photo.jpg")
  chunkSize: number;        // From policy settings or default 5MB
  fileSize: number;         // From CreateUploadRequest.size
  tempEntityId: number;     // DB ID of temp entity record
  uploadedChunks: Set<number>; // Set of uploaded chunk indices
  expireAt: Date;           // 24 hours from creation
}

// In-memory storage
const uploadSessions = new Map<string, UploadSession>();
```

### Pattern 2: Dual-Table File Model
**What:** `files` table for logical directory/file nodes, `entities` table for physical storage records
**When to use:** All file operations that create, read, or modify files
**Example:**
```typescript
// files table: logical node in directory tree
// - type: 1 (file) or 2 (directory)
// - parentId: nullable, references parent directory
// - primaryEntityId: nullable, references the physical entity
// - childrenCount: count of direct children
// - viewConfig: JSON for folder view preferences

// entities table: physical storage record
// - type: "file_content" or "image_content"
// - source: file path on disk
// - size: actual file size in bytes
// - policyId: references storage_policies.id
// - mimeType: MIME type of the file
// - uploadSessionId: nullable, tracks upload origin
```

### Pattern 3: Signed URL Access
**What:** HMAC-SHA256 signed URLs with expiration for thumbnail and content access
**When to use:** Thumbnail serving and signed content downloads
**Example:**
```typescript
// Generate signed URL
function generateSignedToken(publicID: string, expiresAt: number): string {
  const payload = `${publicID}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET)
    .update(payload).digest('hex');
  return `${publicID}:${expiresAt}:${signature}`;
}

// Verify signed URL
function verifySignedToken(token: string): { publicID: string; expiresAt: number } | null {
  const [publicID, expiresStr, signature] = token.split(':');
  const expectedSig = crypto.createHmac('sha256', HMAC_SECRET)
    .update(`${publicID}:${expiresStr}`).digest('hex');
  if (signature !== expectedSig) return null;
  if (Date.now() > parseInt(expiresStr)) return null;
  return { publicID, expiresAt: parseInt(expiresStr) };
}
```

### Anti-Patterns to Avoid
- **Storing upload session state in SQLite:** The Go backend uses Redis; we use in-memory Map per D-94. Database writes for each chunk upload would be too slow.
- **Loading entire files into memory for download:** Must use `createReadStream()` per D-112 for streaming. Large files would OOM the process.
- **Async thumbnail queue for local-only storage:** Per D-103, synchronous generation is sufficient. Adding Bull/BullMQ would be over-engineering.
- **Implementing cloud storage provider interfaces:** Only `local` type per D-99. Do not create abstraction layers for providers that won't be used in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resizing/formatting | Custom canvas/JIMP pipeline | sharp | Sharp is faster, handles EXIF, supports WebP, battle-tested |
| MIME type detection | Custom extension mapping | file-type package or entity.mimeType from DB | Go backend stores mimeType in entity record |
| File streaming | Read entire file then send | `fs.createReadStream()` + pipe | Memory-safe for large files |
| Public ID encoding | Custom hash/encoding | sqids.util.ts (already built) | Must match Go's GeneratePublicID exactly |
| Request validation | Manual if/else checks | class-validator DTOs | NestJS standard, consistent with Phases 01-04 |
| Response wrapping | Manual {code, data, message} | ResponseInterceptor (already built) | Global interceptor handles this |

**Key insight:** The sqids encoder in `server/src/common/utils/sqids.util.ts` is already Go-compatible. EntityTypeFile=2, EntityTypeStoragePolicy=5, EntityTypeDirectLink=7 are already defined. Do NOT rebuild ID encoding.

## Common Pitfalls

### Pitfall 1: URI Parsing Complexity
**What goes wrong:** The Go backend uses a custom URI scheme `anzhiyu://my/path/to/file` with complex parsing (protocol, host=filesystem type, user=FSID, password, path, query).
**Why it happens:** Frontend sends `uri` parameter in `anzhiyu://my/...` format for all file operations.
**How to avoid:** Implement a URI parser that extracts the path component from `anzhiyu://my/path`. For Phase 05 (single-user blog), `my` always maps to the admin user. The `resolveMyFSTarget` function in Go simply returns the current user's ID.
**Warning signs:** Frontend sends `uri: "anzhiyu://my/images/photo.jpg"` and the backend fails to extract `/images/photo.jpg`.

### Pitfall 2: Chunk Index Calculation
**What goes wrong:** Total chunks = `Math.ceil(fileSize / chunkSize)`, but Go uses `(fileSize + chunkSize - 1) / chunkSize` (integer division). Edge case: fileSize=10MB, chunkSize=5MB -> 2 chunks. But fileSize=10MB+1byte, chunkSize=5MB -> 3 chunks (last chunk has 1 byte).
**Why it happens:** Off-by-one errors in integer division.
**How to avoid:** Use `Math.ceil(fileSize / chunkSize)` which matches Go's behavior for positive integers.
**Warning signs:** Frontend reports "invalid chunk index" for the last chunk.

### Pitfall 3: Upload Session Race Conditions
**What goes wrong:** Two chunk uploads arrive simultaneously, both read the session, mark their chunk, and write back -- one overwrites the other's progress.
**Why it happens:** In-memory Map is not thread-safe in async Node.js if you do read-modify-write without locking.
**How to avoid:** Use a single async operation to update the session: read session, add chunk index to Set, write back. Since Node.js is single-threaded, the read-modify-write is atomic as long as you don't yield between read and write.
**Warning signs:** Chunks reported as uploaded by the client but not reflected in the session status.

### Pitfall 4: File Overwrite vs Conflict
**What goes wrong:** Go backend supports `overwrite` flag in CreateUploadRequest. If overwrite=false and file exists, return 409 Conflict. If overwrite=true, replace the file entity.
**Why it happens:** The overwrite semantics are subtle: it replaces the physical entity but keeps the same file record.
**How to avoid:** Implement the `CreateOrUpdate` pattern from Go: find existing file by parentId+name, if exists and overwrite=true, update the entity association; if exists and overwrite=false, return 409.
**Warning signs:** Duplicate files created instead of overwritten, or 409 when frontend expects overwrite.

### Pitfall 5: Direct Link publicID Encoding
**What goes wrong:** The direct link's publicID uses EntityTypeDirectLink (7), NOT EntityTypeFile (2). The URL `/api/f/:publicID/*filename` encodes the direct_link record's ID, not the file's ID.
**Why it happens:** Confusion between file publicID and direct link publicID.
**How to avoid:** When creating a direct link, encode `link.id` with `EntityTypeDirectLink`. When resolving `/api/f/:publicID`, decode with EntityTypeDirectLink to get the link record, then follow link.fileId to the file.
**Warning signs:** 404 errors when accessing short links because the wrong entity type was used.

### Pitfall 6: Folder Route Prefix Mismatch
**What goes wrong:** The Go backend registers folder operations under `/api/folder/*` (e.g., `/api/folder/view`, `/api/folder/tree/:id`), but the CONTEXT.md lists them as `/api/file/folder/*`.
**Why it happens:** The router.go clearly shows `folderGroup := api.Group("/folder")` NOT `filesGroup.Group("/folder")`.
**How to avoid:** Use the Go router.go as the authoritative source. Folder routes are at `/api/folder/*`, NOT `/api/file/folder/*`. This is a discrepancy between CONTEXT.md and the actual Go code.
**Warning signs:** Frontend 404s on folder operations because routes are registered at the wrong path.

## Code Examples

### Create Upload Session Request/Response
```typescript
// Request: PUT /api/file/upload
// Content-Type: application/json
{
  "uri": "anzhiyu://my/images/photo.jpg",
  "size": 10485760,
  "policy_id": "kW4mX",       // Sqids-encoded public ID of storage policy
  "overwrite": false
}

// Response (server upload - local storage):
{
  "code": 200,
  "data": {
    "expires": 1720000000,     // Unix timestamp, 24h from now
    "upload_method": "server",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "chunk_size": 5242880,     // 5MB default
    "storage_policy": {
      "id": "kW4mX",
      "name": "内置-文章图片",
      "type": "local",
      "max_size": 0            // 0 = unlimited
    }
  },
  "message": "上传会话创建成功"
}
```

### Upload Chunk Request
```typescript
// Request: POST /api/file/upload/{sessionId}/{index}
// Content-Type: application/octet-stream
// Body: raw binary chunk data

// Response:
{
  "code": 200,
  "data": null,
  "message": "文件块上传成功"
}
```

### Upload Session Status Response
```typescript
// GET /api/file/upload/session/{sessionId}
// Success:
{
  "code": 200,
  "data": {
    "session_id": "a1b2c3d4-...",
    "is_valid": true,
    "chunk_size": 5242880,
    "total_chunks": 2,
    "uploaded_chunks": [0],      // Array of uploaded chunk indices
    "expires_at": "2026-07-05T00:00:00Z"
  },
  "message": "会话有效"
}

// Session not found:
{
  "code": 404,
  "data": { "is_valid": false },
  "message": "上传会话不存在或已过期"
}
```

### StoragePolicy Response
```typescript
// GET /api/policies/:id or item in list
{
  "id": "kW4mX",               // Sqids-encoded public ID
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z",
  "name": "内置-文章图片",
  "type": "local",
  "flag": "article_image",     // Optional, one of: article_image, comment_image, user_avatar
  "server": "",
  "bucket_name": "",
  "is_private": false,
  "access_key": "",            // Masked with "********" if non-empty
  "secret_key": "",            // Masked with "********" if non-empty
  "max_size": 0,
  "base_path": "data/storage/article_image",
  "virtual_path": "",
  "settings": {}
}
```

### Direct Link Creation
```typescript
// Request: POST /api/direct-links
{ "file_ids": ["pQ8nY", "rT2mX"] }

// Response:
{
  "code": 200,
  "data": [
    {
      "link": "https://example.com/api/f/AbCdE/photo.jpg",
      "file_url": "anzhiyu://my/images/photo.jpg"
    },
    {
      "link": "https://example.com/api/f/FgHiJ/document.pdf",
      "file_url": "anzhiyu://my/docs/document.pdf"
    }
  ],
  "message": "直链获取成功"
}
```

### File List Response
```typescript
// GET /api/file?uri=anzhiyu://my/images
{
  "code": 200,
  "data": {
    "files": [
      {
        "id": "pQ8nY",
        "name": "photo.jpg",
        "type": 1,
        "size": 1048576,
        "created_at": "2026-07-01T00:00:00Z",
        "updated_at": "2026-07-01T00:00:00Z",
        "path": "anzhiyu://my/images/photo.jpg",
        "owned": true,
        "shared": false,
        "permission": null,
        "capability": "",
        "primary_entity_public_id": "xZ9wV"
      }
    ],
    "parent": { /* FileItem for parent directory */ },
    "pagination": {
      "page": 1,
      "page_size": 20,
      "is_cursor": true,
      "next_token": ""
    },
    "props": {
      "order_by_options": ["name", "size", "updated_at"],
      "order_direction_options": ["asc", "desc"]
    },
    "context_hint": "",
    "storage_policy": { "id": "kW4mX", "name": "内置-文章图片", "type": "local", "max_size": 0 },
    "view": {
      "view": "grid",
      "order": "name",
      "order_direction": "asc",
      "page_size": 20
    }
  },
  "message": "文件列表获取成功"
}
```

## 1. API Endpoint Inventory

### File Upload Endpoints

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| PUT | /api/file/upload | CreateUploadSession | JWT | `{uri, size, policy_id, overwrite?}` | UploadSessionData |
| GET | /api/file/upload/session/:sessionId | GetUploadSessionStatus | JWT | Path: sessionId | UploadSessionStatusResponse or {is_valid:false} |
| POST | /api/file/upload/:sessionId/:index | UploadChunk | JWT | Path: sessionId, index; Body: octet-stream | null |
| POST | /api/file/upload/finalize | FinalizeClientUpload | JWT | `{uri, policy_id, size}` | `{file_id, name, size}` |
| DELETE | /api/file/upload | DeleteUploadSession | JWT | `{id}` | null |

### File Query Endpoints

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | /api/file | GetFilesByPath | JWT | Query: uri, next_token | FileListResponse |
| GET | /api/file/:id | GetFileInfo | JWT | Path: id (publicID) | FileInfoResponse |
| GET | /api/file/download/:id | DownloadFile | JWT | Path: id | File stream |
| GET | /api/file/download-info/:id | GetDownloadInfo | JWT | Path: id | DownloadInfo |
| GET | /api/file/preview-urls | GetPreviewURLs | JWT | Query: id | `{urls, initialIndex}` |
| GET | /api/file/content | ServeSignedContent | Public (signed) | Query: sign | File stream |

### File Operation Endpoints

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | /api/file/create | CreateEmptyFile | JWT | `{uri, type, err_on_conflict?}` | FileItem |
| PUT | /api/file/content/:publicID | UpdateFileContentByID | JWT | Path: publicID; Query: uri; Body: octet-stream | UpdateResult |
| DELETE | /api/file | DeleteItems | JWT | `{ids: string[]}` | null |
| PUT | /api/file/rename | RenameItem | JWT | `{id, new_name}` | FileItem |

### Folder Endpoints

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| PUT | /api/folder/view | UpdateFolderView | JWT | `{folder_id, view}` | `{view}` |
| GET | /api/folder/tree/:id | GetFolderTree | JWT | Path: id (publicID) | FolderTreeResponse |
| GET | /api/folder/size/:id | GetFolderSize | JWT | Path: id (publicID) | FolderSize |
| POST | /api/folder/move | MoveItems | JWT | `{sourceIDs, destinationID}` | null |
| POST | /api/folder/copy | CopyItems | JWT | `{sourceIDs, destinationID}` | null |

### Storage Policy Endpoints

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | /api/policies | Create | JWT+Admin | CreatePolicyRequest | StoragePolicyResponse |
| GET | /api/policies | List | JWT+Admin | Query: page, pageSize | `{list, total}` |
| GET | /api/policies/:id | Get | JWT+Admin | Path: id | StoragePolicyResponse |
| PUT | /api/policies/:id | Update | JWT+Admin | Path: id; UpdatePolicyRequest | StoragePolicyResponse |
| DELETE | /api/policies/:id | Delete | JWT+Admin | Path: id | null |

### Storage Policy - Deferred (501)

| Method | Path | Handler | Auth | Note |
|--------|------|---------|------|------|
| GET | /api/policies/connect/onedrive/:id | ConnectOneDrive | JWT+Admin | Return 501 |
| POST | /api/policies/authorize/onedrive | AuthorizeOneDrive | JWT+Admin | Return 501 |

### Thumbnail Endpoints

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | /api/thumbnail/regenerate | RegenerateThumbnail | JWT | `{id}` | `{status}` (202) |
| POST | /api/thumbnail/regenerate/directory | RegenerateThumbnailsForDirectory | JWT | `{directoryId}` | `{message, filesToProcess}` (202) |
| GET | /api/thumbnail/:publicID | GetThumbnailSign | JWT | Path: publicID | `{sign, expires, obfuscated}` or `{status}` |
| GET | /api/t/:signedToken | HandleThumbnailContent | Public | Path: signedToken | Thumbnail file stream |

### Direct Link Endpoints

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | /api/direct-links | GetOrCreateDirectLinks | JWT | `{file_ids: string[]}` | DirectLinkResponseItem[] |
| GET | /api/f/:publicID/*filename | HandleDirectDownload | Public | Path: publicID, filename | File stream |

### Signed Download (cached route)

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | /needcache/download/:public_id | HandleUniversalSignedDownload | Public (signed) | Path: public_id; Query: sign | File stream |

### Article Image Upload

| Method | Path | Handler | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | /api/articles/upload | UploadImage | JWT | Multipart: file | `{file_id, name, size}` |

## 2. Upload Flow Deep Dive

### Server Upload Flow (local storage -- primary path)

1. **CreateUploadSession** (PUT /api/file/upload):
   - Validate request: URI must not end with `/`, size >= 0, policy_id required
   - Decode ownerID from JWT
   - Parse URI to extract path component
   - Look up storage policy by publicID, validate type=local
   - Validate file size against policy.max_size (0=unlimited)
   - Check allowed file extensions from settings (KeyUploadAllowedExtensions)
   - In a transaction:
     - Resolve parent directory: `findOrCreatePath` -- creates missing intermediate directories
     - If overwrite=false, check for existing file at same parentId+name -> 409 if exists
     - Generate UUID session ID
     - Create temp entity record in `entities` table with: size, policyId, createdBy, uploadSessionId, type="file_content"
   - Determine chunk size from policy.settings.chunk_size (default 5MB)
   - Store UploadSession in memory Map with 24h TTL
   - Return `{expires, upload_method:"server", session_id, chunk_size, storage_policy}`

2. **UploadChunk** (POST /api/file/upload/:sessionId/:index):
   - Validate session exists in Map and ownerID matches
   - Calculate totalChunks = ceil(fileSize / chunkSize)
   - Validate index in [0, totalChunks)
   - Create temp directory `data/uploads/tmp/{sessionId}/` if not exists
   - Write chunk to `data/uploads/tmp/{sessionId}/{index}` (raw binary)
   - Update session: add index to uploadedChunks Set
   - Check if ALL chunks uploaded:
     - If yes: call `completeFileUpload` (merge + finalize)
     - If no: return success, wait for more chunks
   - Return `{code:200, data:null}`

3. **completeFileUpload** (internal, triggered automatically):
   - Merge chunks: create `merged_file`, sequentially read each chunk file and append
   - For local storage: determine destination path from policy.base_path + URI path
   - Move/copy merged file to final destination path
   - In a transaction:
     - Update temp entity: set source, mimeType, dimension, size; clear uploadSessionId
     - Find parent directory
     - CreateOrUpdate file record: ownerId, parentId, name, size, type=1(file), primaryEntityId
     - Store physical_name metadata
     - Create file version record
     - Delete session from cache
   - Generate thumbnail (synchronous with sharp)
   - Clean up temp directory

4. **GetUploadSessionStatus** (GET /api/file/upload/session/:sessionId):
   - Look up session in Map
   - If not found: return 404 with `{is_valid: false}`
   - If ownerID mismatch: return 403 with `{is_valid: false}`
   - Return `{session_id, is_valid:true, chunk_size, total_chunks, uploaded_chunks:[...], expires_at}`

5. **DeleteUploadSession** (DELETE /api/file/upload):
   - Look up session in Map
   - If ownerID mismatch: 403
   - Clean up temp directory on disk
   - Hard-delete temp entity from DB
   - Delete session from Map
   - Return success

### Client Direct Upload Flow (not used for local, but API-compatible)

1. **CreateUploadSession** returns `upload_method:"client"` + `upload_url` + `content_type`
2. Client uploads directly to cloud storage using the presigned URL
3. **FinalizeClientUpload** (POST /api/file/upload/finalize):
   - Parse URI, get policy
   - Verify file exists in cloud storage (for local: verify file on disk)
   - Create entity record + file record + version record
   - Return `{file_id, name, size}`

### Key Differences from Go Backend
- Go stores sessions in Redis; NestJS uses in-memory Map
- Go uses async task queue for thumbnail generation after upload; NestJS generates synchronously
- Go uses storage provider abstraction; NestJS only has local filesystem
- Go default temp dir is `./data/temp/uploads`; NestJS uses `data/uploads/tmp/` per D-95
- Go default storage base paths are `data/storage/{flag_name}`; NestJS uses `data/uploads` per D-102

## 3. File Operations Detail

### Create Empty File (POST /api/file/create)
- Request: `{uri: "anzhiyu://my/new_folder", type: 2, err_on_conflict: false}`
- type=1 creates an empty file, type=2 creates a directory
- Parse URI, resolve parent path
- If err_on_conflict=true and item exists at same parentId+name -> 409
- Create entity record (for file: zero-size entity; for directory: no entity)
- Create file record with type matching request
- Return FileItem

### Rename Item (PUT /api/file/rename)
- Request: `{id: "publicID", new_name: "renamed.txt"}`
- Decode publicID to get file DB ID
- Verify ownership
- Check for name conflict at same parent level -> 409 if exists
- Update file.name
- Return updated FileItem

### Delete Items (DELETE /api/file)
- Request: `{ids: ["publicID1", "publicID2"]}`
- Decode each publicID
- For each item:
  - If directory: recursively delete all children (files + subdirectories)
  - Delete associated entity record
  - Delete file record (soft delete if supported)
  - Delete physical file from disk
- Return null

### Move Items (POST /api/folder/move)
- Request: `{sourceIDs: ["id1", "id2"], destinationID: "destId"}`
- Verify all source files and destination folder exist and are owned by user
- Check for name conflicts at destination -> 409
- Update parentId of source files to destination folder ID
- Update childrenCount on old and new parent directories
- Return null

### Copy Items (POST /api/folder/copy)
- Request: `{sourceIDs: ["id1"], destinationID: "destId"}`
- Similar to Move but:
  - Create new entity records (copy physical files on disk)
  - Create new file records with new ownerId/parentId
  - Original files remain unchanged
- Return null

### Folder Tree (GET /api/folder/tree/:id)
- Returns flat list of all files in a directory tree for browser-side zip packaging
- Response: `{folder_name, files: [{url, relative_path, size}], expires}`
- Each file URL is a signed download URL
- The `expires` is the signed URL expiration time

### Folder Size (GET /api/folder/size/:id)
- Recursively computes folder statistics
- Response: `{logicalSize, storageConsumption, fileCount}`
- logicalSize: sum of all file sizes
- storageConsumption: sum of unique physical entity sizes (deduplicated)
- fileCount: total number of files (not directories)

### Update Folder View (PUT /api/folder/view)
- Request: `{folder_id: "publicID", view: {view, order, page_size, order_direction, columns?}}`
- View can be "list" or "grid"
- Store as JSON in file.viewConfig
- Return `{view: FolderViewConfig}`

### Get File Info (GET /api/file/:id)
- Response: `{file: FileItem, storagePolicy: StoragePolicyInfo}`
- Includes the storage policy associated with the file's primary entity

### Get Download Info (GET /api/file/download-info/:id)
- Response: `{type: "local"|"cloud", url?, storage_type, file_name, file_size}`
- For local storage: type="local", no url (client downloads via /api/file/download/:id)
- For cloud storage: type="cloud", url=presigned download URL

### Get Preview URLs (GET /api/file/preview-urls?id=publicID)
- Returns signed URLs for all image files in the same directory as the requested file
- Response: `{urls: [{url, file_id, file_name, file_size}], initialIndex}`
- initialIndex is the position of the requested file in the URL list

### Update File Content (PUT /api/file/content/:publicID?uri=...)
- Receives raw binary body (Content-Type: application/octet-stream)
- Verifies the file exists and the URI matches (detects move/rename conflicts -> 409)
- Writes new content to disk, updates entity size/mimeType
- Response: `{id, size, updated}`

### Serve Signed Content (GET /api/file/content?sign=...)
- Public endpoint (no JWT required, but needs valid signed token)
- Verifies HMAC-SHA256 signature and expiration
- Streams the file content

## 4. Storage Policy Detail

### Model Fields (from Go schema + NestJS schema)

| Field | Go Type | NestJS Type | Required | Description |
|-------|---------|-------------|----------|-------------|
| id | uint | integer PK | auto | Database ID |
| created_at | time.Time | integer (timestamp) | auto | Creation time |
| updated_at | time.Time | integer (timestamp) | auto | Last update |
| deleted_at | *time.Time | integer (timestamp) | nullable | Soft delete |
| name | string(255) | text | yes | Policy name, unique among non-deleted |
| type | StoragePolicyType | text | yes | "local" only in Phase 05 |
| flag | string(255) | text | nullable, unique | "article_image", "comment_image", "user_avatar" |
| server | string(255) | text | nullable | S3 endpoint (not used for local) |
| bucket_name | string(255) | text | nullable | Bucket name (not used for local) |
| is_private | bool | integer (boolean) | default false | Whether storage is private |
| access_key | text | text | nullable | Access key (masked in response) |
| secret_key | text | text | nullable | Secret key (masked in response) |
| max_size | int64 | integer | default 0 | Max file size in bytes, 0=unlimited |
| base_path | string(255) | text | nullable | Physical base path, e.g., "data/uploads" |
| virtual_path | string(255) | text | nullable | Virtual mount path |
| settings | StoragePolicySettings | text (json) | nullable | JSON: chunk_size, upload_method, etc. |
| node_id | *uint | integer | nullable | Mount point ID |

### CRUD Operations

**Create (POST /api/policies):**
- Validate type is "local" (reject others with 400 or 501)
- Validate name uniqueness among non-deleted policies
- If flag is set, validate uniqueness among non-deleted policies
- Store access_key and secret_key in plaintext (masked in response as "********")
- Return StoragePolicyResponse with public ID

**List (GET /api/policies):**
- Pagination: page (default 1), pageSize (default 10, max 100)
- Return `{list: StoragePolicyResponse[], total: number}`
- Include all policies including those without flag

**Get (GET /api/policies/:id):**
- Decode publicID with EntityTypeStoragePolicy
- Return single StoragePolicyResponse

**Update (PUT /api/policies/:id):**
- Decode publicID with EntityTypeStoragePolicy
- If virtual_path is empty in request, keep existing value (Go behavior)
- Validate flag uniqueness if changed
- Re-fetch after update for response

**Delete (DELETE /api/policies/:id):**
- Soft delete (set deleted_at)
- Verify no files are using this policy -> reject with error if in use

### Flag System
- `article_image`: Default policy for article image uploads
- `comment_image`: Default policy for comment image uploads
- `user_avatar`: Default policy for user avatar uploads
- Each flag must be unique among non-deleted policies
- When creating a policy with a flag, check no other non-deleted policy has the same flag

### Response Masking
- Access key and secret key are masked as "********" in responses if they have a value
- Empty strings remain empty in responses
- This matches Go's `maskStoragePolicySecret` function using `constant.SecretValueMask`

## 5. Thumbnail System Detail

### Generation Flow (simplified from Go async to sync)

1. **Trigger:** After file upload completes (in completeFileUpload) OR on-demand when GET /api/thumbnail/:publicID is called
2. **Eligibility check:** File must have a thumbnailable extension (.jpg, .jpeg, .png, .gif, .webp, .bmp, .svg, .mp4, .mov, .avi, .mkv, .webm, .pdf)
3. **Generation:** Use sharp to resize image to max 400x400, output WebP
4. **Storage:** Save to `data/uploads/thumbnails/{publicID}.webp`
5. **Error handling:** If generation fails, log error but don't block the upload. The thumbnail endpoint will try again on next access.

### Thumbnail Sign Flow

**GET /api/thumbnail/:publicID:**
- Decode publicID with EntityTypeFile
- Verify file access (JWT user owns or can access the file)
- Check if thumbnail file exists on disk:
  - If exists: generate HMAC-SHA256 signed token with 15-min expiry
  - If not exists: synchronously generate thumbnail, then return signed token
- Return `{sign, expires, obfuscated: true}`

**GET /api/t/:signedToken:**
- Public endpoint (no JWT required)
- Parse signedToken: `{publicID}:{expiresAt}:{signature}`
- Verify HMAC-SHA256 signature
- Verify not expired
- Decode publicID to get file ID
- Stream the thumbnail file from `data/uploads/thumbnails/{publicID}.webp`

### Regenerate Thumbnail (POST /api/thumbnail/regenerate)
- Request: `{id: "publicID"}`
- Verify file access
- Delete existing thumbnail from disk
- Synchronously regenerate with sharp
- Return `{status: "ready"}` with HTTP 200 (Go returns 202 with "processing" because async; we return 200 because sync)

### Regenerate Directory Thumbnails (POST /api/thumbnail/regenerate/directory)
- Request: `{directoryId: "publicID"}`
- Verify directory exists and user has access
- List all descendant files (recursively)
- For each file: delete old thumbnail, regenerate synchronously
- Return `{message: "...", filesToProcess: N}` with HTTP 200

### Key Simplifications from Go Backend
- Go uses metadata table to track thumb_status (not_available, processing, ready, failed, ready_direct)
- Go uses async task broker with retry counts and error tracking
- NestJS: no metadata tracking, sync generation, no retry mechanism
- Go returns 202 Accepted for thumbnails being processed; NestJS returns 200 immediately after sync generation

## 6. Direct Link Detail

### Create Direct Links (POST /api/direct-links)
- Request: `{file_ids: ["publicID1", "publicID2"]}`
- Decode each publicID with EntityTypeFile
- Get user's group ID from JWT for speed limit calculation
- Batch lookup files in DB
- For each file:
  - Check if direct link already exists for this fileID (unique constraint)
  - If not, create new direct_links record with: fileId, fileName (snapshot), speedLimit (from user group)
- For each created/found link:
  - Encode link ID with EntityTypeDirectLink to get publicID
  - Build full URL: `{siteURL}/api/f/{publicID}/{urlEncodedFileName}`
  - Compute virtual URI by walking ancestor path: `anzhiyu://my/{ancestor1}/{ancestor2}/{fileName}`
- Return array of `{link, file_url}`

### Short-Link Download Flow (GET /api/f/:publicID/*filename)
1. Decode publicID with EntityTypeDirectLink -> get link DB ID
2. Look up direct_links record by ID
3. Increment downloads counter (async, non-blocking)
4. Follow link.fileId to get file record
5. Follow file.primaryEntityId to get entity record
6. Get entity.policyId -> look up storage policy
7. For local storage:
   - Set Content-Disposition: `attachment; filename*=UTF-8''{urlEncodedFileName}`
   - Set Content-Type from entity.mimeType (fallback to extension-based inference)
   - Set Content-Length from file.size
   - Stream file from entity.source path
8. For cloud storage (not implemented): redirect to presigned URL

### DirectLink Schema (already in NestJS)
```typescript
// direct_links table
{
  id: integer PK,
  createdAt: integer (timestamp),
  updatedAt: integer (timestamp),
  deletedAt: integer (timestamp),   // soft delete
  fileId: integer (unique, FK -> files.id),
  fileName: text,                   // snapshot of file name at creation time
  speedLimit: integer (default 0),  // bytes/second, 0=unlimited
  downloads: integer (default 0),   // download counter
}
```

### URL Construction
- Site URL comes from settings service (constant.KeySiteURL)
- Full link format: `{siteURL}/api/f/{directLinkPublicID}/{urlEncodedFileName}`
- The `*filename` in the route is a wildcard that captures the rest of the path
- Filename is URL-encoded using `url.PathEscape` (Go) / `encodeURIComponent` (Node)

## 7. Entity-File Model

### Files Table (logical nodes)
```
files:
  id              INTEGER PK AUTOINCREMENT
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
  deleted_at      INTEGER                  -- soft delete
  type            INTEGER NOT NULL          -- 1=file, 2=directory
  owner_id        INTEGER NOT NULL          -- user who owns this file
  parent_id       INTEGER                   -- parent directory's file ID (NULL for root)
  name            TEXT NOT NULL              -- display name
  size            INTEGER NOT NULL DEFAULT 0
  primary_entity_id INTEGER                 -- FK to entities.id (NULL for directories)
  children_count  INTEGER NOT NULL DEFAULT 0
  view_config     TEXT (JSON)               -- folder view preferences
  UNIQUE(parent_id, name, owner_id)         -- prevent duplicate names in same directory
```

### Entities Table (physical storage records)
```
entities:
  id              INTEGER PK AUTOINCREMENT
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
  type            TEXT NOT NULL              -- "file_content", "image_content"
  source          TEXT                       -- file path on disk
  size            INTEGER NOT NULL
  upload_session_id TEXT                     -- temp entity tracking
  recycle_options TEXT (JSON)
  policy_id       INTEGER NOT NULL           -- FK to storage_policies.id
  created_by      INTEGER                    -- user ID who uploaded
  etag            TEXT
  mime_type       TEXT
  dimension       TEXT                       -- e.g., "1920x1080"
  storage_metadata TEXT (JSON)
```

### Relationship
- `files.primaryEntityId` -> `entities.id` (many-to-one: multiple files can reference the same entity for dedup)
- `files.parentId` -> `files.id` (self-referential tree structure)
- `entities.policyId` -> `storage_policies.id`
- `direct_links.fileId` -> `files.id` (one-to-one: unique constraint)

### Directory Tree Structure
- Root directory: parentId=NULL, type=2, ownerId={userId}
- Sub-directories: parentId=parentDirectoryId, type=2
- Files: parentId=directoryId, type=1, primaryEntityId=entityId
- The `findOrCreatePath` function ensures all intermediate directories exist

## 8. Go vs NestJS Differences

| Aspect | Go Backend | NestJS Rewrite | Impact |
|--------|-----------|----------------|--------|
| Upload session storage | Redis | In-memory Map | Sessions lost on restart; acceptable per D-94 |
| Thumbnail generation | Async task queue (broker) | Synchronous (sharp) | Slight upload delay but simpler code |
| Thumbnail status tracking | Metadata table (5 states) | None; check file existence | Simpler; regenerate on demand |
| Storage providers | 7 types with provider interface | Local only | Much simpler; no provider abstraction needed |
| Temp upload directory | `./data/temp/uploads` | `data/uploads/tmp/` | Different path; configurable |
| Default base paths | `data/storage/{flag_name}` | `data/uploads` | Different default; configurable per policy |
| File version tracking | file_storage_versions table | Basic version number only | Phase 05 implements basic; detailed history deferred |
| Cloud storage redirect | 302 redirect to presigned URL | N/A (local only) | Direct streaming instead |
| Image style processing | ImageStyleService + cache | Not implemented (deferred) | Local downloads return original file |
| Speed limiting | ThrottledWriter | Not critical for personal blog | Can be added later if needed |
| Event bus | Go event bus + FileCreated event | Direct method call | Simpler; call thumbnail generation directly |
| Signed download cache | `/needcache/download/:id` with CDN headers | Same path, simpler headers | Keep path for compatibility |

## 9. Frontend Contract

### Frontend Type Definitions (from file-manager.ts)

**FileItem:** The frontend expects exactly these fields in file list responses:
```typescript
interface FileItem {
  id: string;                    // Sqids-encoded public ID
  name: string;
  type: number;                  // 1=file, 2=directory
  size: number;
  created_at: string;            // ISO date string
  updated_at: string;
  etag?: string;
  path: string;                  // Full "anzhiyu://my/..." URI
  owned: boolean;
  shared: boolean;
  permission: Record<string, unknown> | null;
  capability: string;
  primary_entity_public_id: string;
  ext?: string;
  metadata?: Record<string, unknown>;
  url?: string;
  relative_path?: string;
}
```

**UploadSessionData:**
```typescript
interface UploadSessionData {
  session_id: string;
  chunk_size: number;
  expires?: number;               // Unix timestamp
  storage_policy?: {id, name, type, max_size};
  upload_method?: "client" | "server";
  upload_url?: string;            // Client direct upload only
  content_type?: string;          // Client direct upload only
}
```

**FolderSizeData:** Frontend expects camelCase field names:
```typescript
interface FolderSizeData {
  logicalSize: number;
  storageConsumption: number;
  fileCount: number;
}
```

**DirectLinkItem:**
```typescript
interface DirectLinkItem {
  link: string;          // Full URL like https://example.com/api/f/{publicID}/{filename}
  file_url: string;      // Virtual URI like anzhiyu://my/images/photo.jpg
}
```

**MoveItemsRequest:** Frontend sends `sourceIDs` (camelCase), NOT `source_ids`:
```typescript
{ sourceIDs: string[], destinationID: string }
```

**CopyItemsRequest:** Same as MoveItemsRequest format.

**DeleteItemsRequest:** Frontend sends `{ids: string[]}`.

**CreateFileRequest:** Frontend sends `{type: 1|2, uri: "anzhiyu://...", err_on_conflict: boolean}`.

**DownloadInfo:** Frontend expects:
```typescript
interface DownloadInfo {
  type: "local" | "cloud";
  url?: string;
  storage_type: string;
  file_name: string;
  file_size: number;
}
```

### Frontend API Calls (from file-manager.ts)
Key observations from the frontend API client:
- `createUploadSessionApi` sends `{uri, size, policy_id, overwrite}` via PUT
- `uploadChunkApi` sends raw Blob with `Content-Type: application/octet-stream`
- `deleteUploadSessionApi` sends `{id, uri}` via DELETE (Note: Go handler only reads `id` from DeleteUploadRequest, not `uri`)
- `finalizeClientUploadApi` sends `{uri, policy_id, size}` via POST
- `moveFilesApi` sends `{sourceIDs, destinationID}` -- camelCase field names
- `copyFilesApi` sends `{sourceIDs, destinationID}` -- camelCase field names
- `updateFileContentByPublicIdApi` sends raw content with `Content-Type: application/octet-stream` and `?uri=` query param
- `regenerateThumbnailApi` sends `{id}` via POST
- `regenerateDirectoryThumbnailsApi` sends `{directoryId}` via POST

### Frontend Storage Policy Types (from storage-policy.ts)
```typescript
const STORAGE_TYPES = ["local", "onedrive", "tencent_cos", "aliyun_oss", "aws_s3", "qiniu_kodo", "upyun"];
const POLICY_FLAGS = ["article_image", "comment_image", "user_avatar"];
```

The frontend defines all 7 types but the NestJS backend only implements `local`. The create/update request must validate type="local" and reject others.

## 10. Open Questions

1. **Route path discrepancy:** CONTEXT.md lists folder routes as `/api/file/folder/*` but Go router.go clearly shows `folderGroup := api.Group("/folder")` which means `/api/folder/*`. The frontend API client uses `/folder/view`, `/folder/tree/:id`, `/folder/size/:id`, `/folder/move`, `/folder/copy` -- confirming `/api/folder/*` is correct. **Resolution: Use `/api/folder/*` matching Go router.go and frontend API client.**

2. **DeleteUploadRequest.uri field:** The frontend sends `{id, uri}` when deleting an upload session, but the Go DeleteUploadRequest model only has `ID string`. The Go handler only uses `req.ID`. **Recommendation: Accept `uri` in the DTO for compatibility but ignore it in service logic.**

3. **Default storage policy creation:** The Go backend defines default policies (article_image, comment_image, user_avatar) with paths `data/storage/{flag_name}`. Phase 05 needs to decide: create these on first startup? Or require admin to create them? **Recommendation: Create default policies on module init if they don't exist, matching Go behavior.**

4. **/needcache/download route:** The Go backend registers this route outside the `/api` group at `/needcache/download/:public_id`. The CONTEXT.md does not list this route. Does the frontend use it? **Recommendation: Register it for API compatibility but it's likely unused in the new backend since we don't have CDN caching.**

5. **Entity type field values:** The Go entity model uses EntityType strings like "file_content", "image_content". The NestJS entity schema has `type: text('type').notNull()`. What values should populate this? **Recommendation: Use "file_content" for regular files, matching Go.**

6. **File version tracking:** The Go backend has a `file_storage_versions` table not present in the NestJS schema. For Phase 05, this is deferred. But the upload flow creates version records. **Recommendation: Skip version record creation for Phase 05; it's not required for basic upload/download functionality.**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Folder routes are at `/api/folder/*` not `/api/file/folder/*` | Section 1, 10 | Frontend 404 on folder operations |
| A2 | DeleteUploadRequest ignores the `uri` field sent by frontend | Section 10 | No functional impact; frontend sends it but backend ignores |
| A3 | File version tracking (file_storage_versions) is not needed for basic upload | Section 8, 10 | If frontend checks version data, it might break |
| A4 | The /needcache/download route is unused by the frontend | Section 10 | Missing route if frontend actually uses it |
| A5 | Sharp can handle all image types that Go's VIPS/ImageMagick handles | Section 5 | Some formats (AVIF input, TIFF) may not be supported |
| A6 | The `findOrCreatePath` behavior (auto-creating parent directories) is needed for uploads | Section 2 | Uploads to non-existent directories would fail |
| A7 | The `speedLimit` field in direct links is informational; NestJS won't implement actual throttling | Section 6 | If throttling is expected, downloads would be unthrottled |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis for upload sessions | In-memory Map | Phase 05 (D-94) | Simpler but sessions lost on restart |
| Async thumbnail queue | Sync sharp generation | Phase 05 (D-103) | Simpler code; slight upload delay |
| Multi-cloud storage providers | Local-only storage | Phase 05 (D-99) | Vastly simpler; no provider abstraction |
| Metadata table for thumb status | Check file existence | Phase 05 (D-106) | Less tracking overhead; regenerate on demand |
| Go event bus for FileCreated | Direct method call | Phase 05 | Simpler; no event infrastructure needed |

**Deprecated/outdated:**
- Cloud storage provider interface pattern: Only local storage is implemented in Phase 05
- Async task broker for thumbnails: Replaced by synchronous generation
- Redis cache service dependency: Replaced by in-memory Map

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS default) |
| Config file | jest.config.ts or package.json jest config |
| Quick run command | `npm test -- --testPathPattern=file` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | Single file upload creates session, receives chunks, merges | unit+integration | `npm test -- --testPathPattern=upload` | Wave 0 |
| FILE-02 | Chunked upload with session lifecycle | unit | `npm test -- --testPathPattern=upload` | Wave 0 |
| THUMB-01 | Thumbnail generation, signing, serving | unit | `npm test -- --testPathPattern=thumbnail` | Wave 0 |
| STORAGE-01 | Storage policy CRUD with flag validation | unit | `npm test -- --testPathPattern=storage-policy` | Wave 0 |
| LINK-DIRECT-01 | Direct link creation and short-link download | unit+integration | `npm test -- --testPathPattern=direct-link` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern={module}`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/file/file.service.spec.ts` -- covers FILE-01, FILE-02
- [ ] `server/src/file/upload.service.spec.ts` -- covers upload session lifecycle
- [ ] `server/src/storage-policy/storage-policy.service.spec.ts` -- covers STORAGE-01
- [ ] `server/src/thumbnail/thumbnail.service.spec.ts` -- covers THUMB-01
- [ ] `server/src/direct-link/direct-link.service.spec.ts` -- covers LINK-DIRECT-01
- [ ] Framework install: already present (Jest via NestJS CLI)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | @nestjs/passport + JWT guards |
| V3 Session Management | yes | Upload session Map with TTL expiration |
| V4 Access Control | yes | OwnerID verification on all file operations |
| V5 Input Validation | yes | class-validator DTOs + file extension whitelist |
| V6 Cryptography | yes | HMAC-SHA256 for signed URLs |
| V8 Data Protection | yes | Secret key masking in API responses |

### Known Threat Patterns for File Upload

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file upload (web shell) | Tampering | File extension whitelist from settings; store outside web root |
| Path traversal in URI | Tampering | Validate URI path doesn't contain `../` or absolute paths |
| Unrestricted file size | Denial of Service | Storage policy max_size enforcement; chunk size limits |
| Signed URL forgery | Spoofing | HMAC-SHA256 with server-side secret key |
| Direct link enumeration | Information Disclosure | Sqids encoding obscures sequential IDs; signed download tokens |
| Upload session hijacking | Elevation of Privilege | OwnerID verification on all session operations |

## Sources

### Primary (HIGH confidence)
- `pkg/handler/file/upload.go` -- Upload handler implementation [VERIFIED: codebase]
- `pkg/handler/file/operation.go` -- File operations handler [VERIFIED: codebase]
- `pkg/handler/file/query.go` -- File query handler [VERIFIED: codebase]
- `pkg/handler/file/download.go` -- Download handler [VERIFIED: codebase]
- `pkg/handler/storage_policy/handler.go` -- Storage policy handler [VERIFIED: codebase]
- `pkg/handler/thumbnail/handler.go` -- Thumbnail handler [VERIFIED: codebase]
- `pkg/handler/direct_link/handler.go` -- Direct link handler [VERIFIED: codebase]
- `pkg/domain/model/upload.go` -- Upload data models [VERIFIED: codebase]
- `pkg/domain/model/file.go` -- File data models [VERIFIED: codebase]
- `pkg/domain/model/storage_policy.go` -- Storage policy models [VERIFIED: codebase]
- `pkg/domain/model/direct_link.go` -- Direct link model [VERIFIED: codebase]
- `pkg/domain/model/metadata.go` -- Metadata key constants [VERIFIED: codebase]
- `pkg/constant/storage_policy.go` -- Storage policy type constants [VERIFIED: codebase]
- `pkg/service/file/upload.go` -- Upload service implementation [VERIFIED: codebase]
- `pkg/service/direct_link/service.go` -- Direct link service [VERIFIED: codebase]
- `internal/infra/router/router.go` -- Route registration [VERIFIED: codebase]
- `ent/schema/storagepolicy.go` -- Storage policy DB schema [VERIFIED: codebase]
- `ent/schema/directlink.go` -- Direct link DB schema [VERIFIED: codebase]
- `server/src/database/schemas/file.schema.ts` -- NestJS file schema [VERIFIED: codebase]
- `server/src/database/schemas/entity.schema.ts` -- NestJS entity schema [VERIFIED: codebase]
- `server/src/database/schemas/direct-link.schema.ts` -- NestJS direct link schema [VERIFIED: codebase]
- `server/src/database/schemas/storage-policy.schema.ts` -- NestJS storage policy schema [VERIFIED: codebase]
- `server/src/common/utils/sqids.util.ts` -- Sqids encoder/decoder [VERIFIED: codebase]
- `frontend/src/types/file-manager.ts` -- Frontend file management types [VERIFIED: codebase]
- `frontend/src/types/storage-policy.ts` -- Frontend storage policy types [VERIFIED: codebase]
- `frontend/src/lib/api/file-manager.ts` -- Frontend API calls [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions (D-94 through D-114) -- User-locked decisions

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project or CLAUDE.md-mandated
- Architecture: HIGH - Directly read from Go source code and NestJS schemas
- Pitfalls: HIGH - Identified from actual code discrepancies (route paths, field naming)
- API compatibility: HIGH - Verified against both Go handler code and frontend type definitions

**Research date:** 2026-07-04
**Valid until:** 2026-08-04 (30 days - stable codebase)
