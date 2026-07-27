# ROADMAP: anheyu-app NestJS + SQLite Backend

## Project Goal

Rewrite the anheyu-app Go backend (Go + PostgreSQL + Redis) as NestJS + Drizzle + SQLite. The Next.js frontend must switch to the new backend with zero code changes -- API compatibility is the core constraint.

## Milestones

### M1: Core CMS Operational ✓

Phases 01-04 complete. Admin can log in, manage articles/pages/categories/tags, configure site settings. Visitors can browse public content.

### M2: Full Feature Parity ✓

Phases 05-09 complete. All P0, P1, P2 features operational. File uploads, comments, search, statistics, albums, RSS, notifications all working.

### M3: Production Ready ✓

Phases 10-11 complete. Scheduled tasks running, migration tool available, end-to-end testing passed. Ready for cutover from Go backend.

### M4: Frontend Integration Verified

Phases 12-15 complete. Every frontend API call verified against Go backend source code. All compatibility issues found and fixed. Frontend runs on new backend with zero modifications.

### M5: AI Features

Phases 16-19 (planned). AI assistant with streaming + tool calling + RAG, unified multi-model dispatching. Architecture designed with swappable framework (AI SDK now, LangGraph later). See `.planning/ai-assistant-architecture.md` for full design.

---

## Phase Overview

### Development (Complete)

| Phase | Name | Goal | Status | Last Updated |
|-------|------|------|--------|--------------|
| 01 | Infrastructure | NestJS scaffold, Drizzle, schemas, interceptor, guards, Sqids | Complete | 2026-06-28 |
| 02 | Auth & Settings | JWT auth, user management, site settings, captcha | Complete | 2026-06-29 |
| 03 | Article & Category & Tag | Article CRUD, categories, tags, public articles | Complete | 2026-07-03 |
| 04 | Page & Public API | Page CRUD, public aggregation, version info | Complete | 2026-07-04 |
| 05 | File Upload & Media | Upload, chunked upload, thumbnails, storage policies, direct links | Complete | 2026-07-05 |
| 06 | Comment & Search | Comments with nesting, FTS5 search | Complete | 2026-07-10 |
| 07 | Statistics & Links | Visitor tracking, analytics, friend links | Complete | 2026-07-11 |
| 08 | Album & Doc Series | Albums with categories, document series | Complete | 2026-07-12 |
| 09 | SEO & Music & Notifications | RSS, sitemap, music proxy, notifications, subscribers | Complete | 2026-07-14 |
| 10 | Scheduled Tasks | Cron jobs, backup, view sync, cleanup | Complete | 2026-07-16 |
| 11 | Migration & Integration | Migration tool, API compat tests (292 tests) | Complete | 2026-07-18 |

### Verification (Pending)

| Phase | Name | Goal | Priority | Dependencies |
|-------|------|------|----------|--------------|
| 12 | API Inventory & Auth & Settings Verification | 4/5 | Complete|  |
| 13 | Content Verification | 1/6 | Complete    | 2026-07-20 |
| 14 | Features Verification | 7/7 | Complete    | 2026-07-22 |
| 15 | Final Integration & Cutover | 3/3 | Complete    | 2026-07-23 |

### AI Features (M5 - Planned)

| Phase | Name | Goal | Status | Dependencies |
|-------|------|------|--------|--------------|
| 16 | AI Model Router & Summary Migration | ModelResolver + ai_profiles config, migrate raw-fetch summary to AI SDK generateText | Planned | - |
| 17 | AI Tools & Chat History Storage | Framework-agnostic ToolDef + article-tools (search/get), Drizzle chat tables + ChatHistoryService | Planned | 16 |
| 18 | Streaming Chat Endpoint | ChatService (streamText + tools + RAG) + POST /api/ai/chat with SSE streaming | Planned | 17 |
| 19 | Chat Hardening & Frontend Integration | Token compression, disconnect handling, auth timing, useChat frontend + ai_profiles admin UI | Planned | 18 |

---

### Phase 12: API Inventory & Auth & Settings Verification

**Goal:** Systematically collect all API calls made by the frontend; verify auth and settings endpoints work correctly with the frontend

**Verification Method:** Three-layer verification (D-260)

1. Scan frontend source code for all API calls → build complete endpoint inventory
2. For each endpoint, read Go handler source code → document expected request/response format
3. Browser walkthrough with NestJS backend → confirm functionality

**Plans:** 4/5 plans executed

Plans:

- [ ] PLAN.md
- [x] 12-01-PLAN.md — Build complete frontend API endpoint inventory (188 endpoints, Markdown table, cross-reference NestJS)
- [x] 12-02-PLAN.md — Auth verification (login field-by-field, token refresh dual-channel, captcha flow, 501 format)
- [x] 12-03-PLAN.md — Settings verification (unflatten, non-admin filtering, flat update format, site-config, 501 format)
- [x] 12-04-PLAN.md — Go comparison risk marking (per-endpoint risk levels, prioritized summary for Phases 13-15)

**Success Criteria:**

- Complete inventory of all frontend API calls (endpoint, method, params, response fields used)
- Auth login returns correct token structure and user info matching Go handler
- Token refresh works via both header and body channels
- Unimplemented auth endpoints return correct 501 format
- Captcha flow end-to-end verified (config → image → login)
- GET /api/public/site-config returns all public keys (290+) with correct nesting
- POST /api/settings/update accepts flat key-value pairs and persists correctly
- POST /api/settings/get-by-keys returns correct values for admin and non-admin
- Version endpoint returns correct format
- Go comparison risk marking complete for all 188 endpoints

---

### Phase 13: Content Verification

**Goal:** Verify all content-related endpoints match Go backend behavior — articles, categories, tags, pages, file upload, comments, search

**Plans:** 1/6 plans complete

Plans:
**Wave 1**

- [x] 13-01-PLAN.md — CCP-1 schema audit + Article/Category/Tag field-by-field verification
- [x] 13-02-PLAN.md — Page module field-by-field verification

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-03-PLAN.md — File module fixes (pagination, toFileItem) + File field-by-field verification
- [x] 13-04-PLAN.md — Comment module field-by-field verification

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-05-PLAN.md — Search verification + drizzle-kit push

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 13-06-PLAN.md — Full regression + Phase 13 test suite validation

**Success Criteria:**

- Article CRUD works from frontend admin panel
- Public article list renders correctly with pagination, filters, sorting
- Article detail page loads with correct content, prev/next, related articles
- Category and tag management works in admin panel
- Page CRUD works from admin panel
- Single file upload works from frontend
- Chunked upload works for large files
- Thumbnails generate and display correctly
- File manager folder tree works
- Direct links work
- Visitors can post comments from frontend
- Nested replies display correctly
- Comment moderation (approve/reject) works in admin
- Full-text search returns relevant results
- All response fields match Go backend (field names, types, nesting)

---

### Phase 14: Features Verification

**Goal:** Verify all auxiliary feature endpoints — statistics, friend links, albums, doc series, SEO, music, notifications, scheduled tasks, backup

**Plans:** 7/7 plans complete

Plans:

**Wave 1** (MEDIUM risk fixes + verification)

- [x] 14-01-PLAN.md — Fix Link.id to raw int + verify 25 link endpoints field-by-field
- [x] 14-02-PLAN.md — Add Album.fileHash + verify 15 album endpoints field-by-field

**Wave 2** (MEDIUM risk verification, blocked on Wave 1)

- [x] 14-03-PLAN.md — Verify Doc-series (Sqids encoding) + Statistics (structures, dates) field-by-field
- [x] 14-04-PLAN.md — Fix storage-policy date serialization + UserGroup.description nullability + verify structures

**Wave 3** (LOW/NONE risk verification, blocked on Wave 2)

- [x] 14-05-PLAN.md — Verify Music, Notification/Subscriber, Backup response structures
- [x] 14-06-PLAN.md — Verify SEO (RSS/Sitemap/robots.txt) XML formats and headers

**Wave 4** (Schedule + Regression, blocked on Wave 3)

- [x] 14-07-PLAN.md — Schedule/Cron job verification + full Phase 14 regression test suite (completed 2026-07-22)

**Success Criteria:**

- Visitor tracking records visits correctly
- Admin statistics dashboard displays data
- Friend link CRUD works
- Friend link apply/review workflow works
- Public friend links display correctly
- Album CRUD with categories works
- Album batch import/export works
- Public albums display correctly
- Document series CRUD works
- Series article ordering works
- RSS feed valid and accessible
- Sitemap XML valid and accessible
- robots.txt correct
- Music playlist loads
- Notification management works
- Subscriber subscribe/unsubscribe works
- All cron jobs trigger and execute correctly
- Backup creates and restores correctly
- No startup log spam (D-264)

---

### Phase 15: Final Integration & Cutover

**Goal:** Full regression test and production cutover

**Plans:** 3/3 plans complete

Plans:

**Wave 1** (Fix pre-existing test failures)

- [x] 15-01-PLAN.md — Fix 5 pre-existing test failures (PostCategory.description null, comment export/import stale 404, auth refresh-token isolation)

**Wave 2** (Full regression + cross-module integration, blocked on Wave 1)

- [x] 15-02-PLAN.md — Run full regression (561 tests) + add cross-module integration tests in phase15-verification/

**Wave 3** (Browser walkthrough + deployment docs, blocked on Wave 2)

- [x] 15-03-PLAN.md — Browser critical path walkthrough + deployment README + migration tool verification

**Success Criteria:**

- All frontend pages work without errors
- All admin panel functions work
- No console errors in browser
- Performance acceptable (page load < 3s)
- Production-ready deployment documented

---

### Phase 16: AI Model Router & Summary Migration

**Goal:** Build the AI infrastructure foundation - ModelResolver that reads `ai_profiles` config and returns AI SDK model instances. Migrate the existing raw-fetch summary generation (`server/src/ai/ai.service.ts`) to AI SDK `generateText`. Establish clean `ports/adapters/tools/model` directory skeleton with framework-agnostic boundaries.

**Architecture:** See `.planning/ai-assistant-architecture.md` - ports/adapters (Hexagonal) pattern. Domain layer zero AI framework dependency. Only `adapters/`, `chat.service.ts`, `model-resolver.service.ts`, and controllers touch `ai`/`@ai-sdk/*`.

**Requirements:** AI-01, AI-02, AI-02F, AI-02A

**Already done (先期工作，归入本 phase 验收):**

- 后端 AI 摘要接口 `POST /api/ai/generate-summary/:id` + 权限守卫
- 后台 AiSummaryForm 表单（服务商/API地址/Key/模型/Prompt/AI名字）
- 编辑器 "AI 生成" 按钮
- 前台 ArticleLeadSummary 打字机效果 + 进入视口 + AI名字

**Plans:** 2/3 plans executed

Plans:

**Wave 1** (Backend core — no dependencies)

- [x] 16-01-PLAN.md — Rebuild server/src/ai/ with ports/adapters/model architecture + AI SDK 7 generateText migration + unit tests (AI-01, AI-02)

**Wave 2** (Frontend settings — depends on 16-01)

- [x] 16-02-PLAN.md — New "AI 功能" nav group + AiModelsForm multi-profile management + upgraded AiSummaryForm + placeholder forms (AI-02A, AI-01)

**Wave 3** (End-to-end verification — depends on 16-01 + 16-02)

- [ ] 16-03-PLAN.md — Verify typewriter display + admin form round-trip + legacy fallback + public key security (AI-02F, AI-01, AI-02, AI-02A)

### Phase 17: AI Tools & Chat History Storage

**Goal:** Build framework-agnostic assets that survive a future LangGraph migration unchanged - tool definitions and chat history storage.

**Key deliverables:**

- `server/src/ai/tools/tool-def.ts` - ToolDef type (Zod schema + pure execute), framework-agnostic
- `server/src/ai/tools/article-tools.ts` - search_articles (calls SearchService.search FTS5) + get_article (calls ArticleService.getPublic). Zero AI library imports
- `server/src/ai/chat.schema.ts` - Drizzle tables: chat_conversations, chat_messages
- `server/src/ai/chat-history.service.ts` - CRUD + history truncation, pure DB ops, framework-agnostic
- Drizzle migration for chat tables

**Critical:** These files must NOT import `ai` or `@langchain/*`. They are the migration-protected assets.

### Phase 18: Streaming Chat Endpoint

**Goal:** Implement the streaming chat assistant endpoint with tool calling and RAG. Build the frontend chat widget.

**Key deliverables:**

- `server/src/ai/chat.service.ts` - ChatService.chat(): streamText + articleTools + stopWhen:stepCountIs(5) + toolChoice:auto + onFinish persistence + onError logging. Returns UIMessageStream ReadableStream
- `server/src/ai/ports/ai.port.ts` - add ChatService contract (UIMessage[] in, ReadableStream<Uint8Array> out)
- `server/src/ai/ai-chat.controller.ts` - POST /api/ai/chat, @Res() + pipeUIMessageStreamToResponse, pre-stream sync auth/validation, user message persisted before stream starts
- Ensure CORS streaming headers in main.ts
- **前台前端**: 聊天组件 - 右下角浮动按钮 + 对话窗口（useChat + DefaultChatTransport 指向 /api/ai/chat），流式渲染 token
- **前台前端**: 对话历史展示、工具调用结果（文章链接）渲染
- Verify: frontend useChat consumes stream, tokens arrive incrementally, tool calls return article results, history saved

**Key risks:** @Res() bypasses Nest enhancers; streamText doesn't throw (errors go into stream); CORS buffering.

### Phase 19: Chat Hardening & Frontend Integration

**Goal:** Production-harden the chat and wire up the admin config UI + final frontend polish.

**Key deliverables:**

- Context compression (prepareStep truncates when messages.length > threshold)
- Token usage recording (onStepFinish)
- Disconnect handling (consumeStream before persist, avoid state corruption)
- Auth timing (JwtAuthGuard runs before stream starts, 401 not SSE error frame)
- **后台前端**: ai_profiles 多 profile 管理表单（增删改、设默认、按用途 summary/chat/writing 标记）- 与 Phase 16 的基础表单衔接
- **后台前端**: 对话历史查看页（管理员可查看用户对话）
- **前台前端**: 聊天组件打磨（建议问题、欢迎语、断线重连提示、错误状态）
- Verify: long conversations don't blow token budget, disconnect doesn't corrupt state, unauthorized returns 401, end-to-end usable

---

## Requirement Traceability

| Requirement ID | Phase | Verification Phase | Description |
|---------------|-------|--------------------|-------------|
| INFRA-01 | 01 | — | NestJS project scaffold on port 8091 |
| INFRA-02 | 01 | — | Drizzle ORM + SQLite connection |
| INFRA-03 | 01 | — | SQLite WAL mode + busy_timeout |
| INFRA-04 | 01 | — | Global response format interceptor |
| INFRA-05 | 01 | — | Sqids ID encode/decode with Go-compatible seed |
| INFRA-06 | 01 | — | Drizzle schema definitions for all 30 tables |
| AUTH-01 | 02 | 12 | Admin login with JWT |
| AUTH-02 | 02 | 12 | JWT token refresh |
| AUTH-03 | 02 | 12 | JWT compatible with Go backend tokens |
| USER-01 | 02 | 12 | User profile management |
| SETTING-01 | 02 | 12 | Site settings read/update |
| SETTING-02 | 02 | 12 | Public site config query |
| ARTICLE-01 | 03 | 13 | Article CRUD with draft/published/archived |
| ARTICLE-02 | 03 | 13 | Article list with pagination and filters |
| ARTICLE-03 | 03 | 13 | Public article browsing |
| CATEGORY-01 | 03 | 13 | Category CRUD with sorting |
| TAG-01 | 03 | 13 | Tag CRUD with article association |
| PAGE-01 | 04 | 13 | Page CRUD with public/private |
| PUBLIC-01 | 04 | 12 | Public aggregation endpoints |
| VERSION-01 | 04 | 12 | Version info API |
| FILE-01 | 05 | 13 | Single file upload |
| FILE-02 | 05 | 13 | Chunked upload with session management |
| THUMB-01 | 05 | 13 | Thumbnail generation |
| STORAGE-01 | 05 | 13 | Storage policy CRUD (local) |
| LINK-DIRECT-01 | 05 | 13 | Direct link CRUD and short-link access |
| COMMENT-01 | 06 | 13 | Comment CRUD with nested replies and moderation |
| SEARCH-01 | 06 | 13 | Full-text search via FTS5 |
| STATS-01 | 07 | 14 | Visitor tracking and logging |
| STATS-02 | 07 | 14 | Statistics analytics (trends, devices, sources) |
| LINK-FRIEND-01 | 07 | 14 | Friend link CRUD with health check |
| ALBUM-01 | 08 | 14 | Album CRUD with categories |
| DOCSERIES-01 | 08 | 14 | Document series CRUD |
| RSS-01 | 09 | 14 | RSS/Atom feed generation |
| SITEMAP-01 | 09 | 14 | Sitemap XML generation |
| MUSIC-01 | 09 | 14 | Music playlist data API |
| NOTIF-01 | 09 | 14 | Notification management |
| SUBSCRIBER-01 | 09 | 14 | Subscriber subscribe/unsubscribe |
| CRON-01 | 10 | 14 | Scheduled tasks (8 job types) |
| MIGRATION-01 | 11 | — | SQLite to SQLite migration tool |
| INTEGRATION-01 | 11 | 15 | End-to-end API compatibility testing |
| AI-01 | 16 | - | AI model router (ModelResolver) + ai_profiles multi-profile config |
| AI-02 | 16 | - | Migrate summary generation from raw fetch to AI SDK generateText |
| AI-02F | 16 | - | 前台 AI 摘要打字机展示验收（已做，归入 Phase 16 验收） |
| AI-02A | 16 | - | 后台 ai_profiles 多 profile 管理表单 + AI 设置导航分组 |
| AI-03 | 17 | - | Framework-agnostic tool definitions (search_articles, get_article) |
| AI-04 | 17 | - | Chat history storage (Drizzle tables + ChatHistoryService) |
| AI-05 | 18 | - | Streaming chat endpoint with tool calling and RAG |
| AI-05F | 18 | - | 前台聊天组件（useChat + 浮动按钮 + 对话窗口） |
| AI-06 | 19 | - | Chat hardening (token compression, disconnect, auth timing) |
| AI-07 | 19 | - | 后台 ai_profiles 管理 UI + 对话历史查看 + 前台聊天打磨 |

---

*Last updated: 2026-07-26*
