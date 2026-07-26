# Phase 16: AI Model Router & Summary Migration - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

构建 AI 基础设施底座——ModelResolver 读取 `ai_profiles` 配置返回 AI SDK model 实例；把现有 raw-fetch 摘要生成迁移到 AI SDK `generateText`；建立干净的 `ports/adapters/tools/model` 目录骨架，框架无关边界清晰。同时升级后台 AiSummaryForm 为多 profile 管理 + 新建"AI 功能"导航分组。

**先期工作（已做，归入本 phase 验收）：**
- 后端 `POST /api/ai/generate-summary/:id` + JwtAuthGuard/AdminGuard
- 后台 AiSummaryForm 表单（单 profile：provider/api_url/key/model/prompt/gpt_name）
- 编辑器"AI 生成"按钮（EditorSidebar + ArticleEditorPage）
- 前台 ArticleLeadSummary 打字机效果 + 进入视口 + AI 名字

**Phase 16 交付物（待补）：**
- 后端 `ports/adapters/tools/model` 目录骨架（全新重建，删旧 ai.controller.ts/ai.service.ts）
- `model/ai-profile.ts` — AiProfile 类型 + resolveProfiles（含 legacy 回退）
- `model/model-resolver.service.ts` — 从 profiles 返回 AI SDK model 实例
- `adapters/summary.adapter.ts` — ArticleAiPort 的 AI SDK generateText 实现
- `ports/ai.port.ts` — ArticleAiPort 契约
- `ai-summary.controller.ts` — 重构后的干净 controller
- raw fetch → AI SDK generateText，签名不变 `summarizeArticle(publicId): Promise<{summary}>`
- 加 `ai` + `@ai-sdk/openai-compatible` + `zod` 依赖
- 后台前端：升级 AiSummaryForm 为 ai_profiles 多 profile 管理表单
- 后台前端：新建"AI 功能"顶级导航分组（AI 模型 / AI 摘要 / AI 对话 / AI 写作 四子项，对话/写作占位）
- 前台验收：AI 摘要打字机展示在迁移后仍正常工作
- ai_profiles 配置可切换模型（OpenAI / DeepSeek / 自定义）

**不在 Phase 16 范围：**
- ToolDef / article-tools（Phase 17）
- chat.schema.ts / chat-history.service.ts（Phase 17）
- chat.service.ts / ai-chat.controller.ts / 流式端点（Phase 18）
- 对话/写作卡片的实际功能（Phase 18/19）—— Phase 16 只做占位卡片
- LangGraph adapter（YAGNI，架构文档明确不预写）

</domain>

<decisions>
## Implementation Decisions

### ai_profiles 迁移策略
- **D-330:** 从 `ai_summary_*` 单键迁移到 `ai_profiles` JSON 数组采用**回退兼容**策略。后端 `resolveProfiles()` 读 `ai_profiles` JSON，如果为空就回退读 `ai_summary_*` 6 个键合成一个 legacy profile（id='legacy'）。前端保存时统一写 `ai_profiles` JSON，旧键不再使用。旧配置自动兼容，无需手动迁移脚本。— **Reversibility:** reversible — 回退兼容是单向降级保护，去掉 fallback 逻辑即可撤销
- **D-331:** `ai_summary_system_prompt` 和 `ai_summary_gpt_name` 两个键**保留不动**，不并入 ai_profiles。理由：它们是摘要业务设置（prompt 风格、前台 AI 名字），不属于模型 profile（profile 只存 provider/api_url/api_key/model/enabled/purposes）。AiSummaryForm 上半部分管 profile 选择，下半部分管这两个摘要业务字段。
- **D-332:** `ai_default_profile_id` 通过 UI"设为默认"按钮设置。每个 profile 卡片有一个"设为默认"按钮，点击写 `ai_default_profile_id`。第一次保存时如果还没有默认，自动把第一个 enabled profile 设为默认。`resolveProfiles()` 找 profile 时：优先 profileId 匹配 → 其次 defaultId 匹配且 enabled → 最后第一个 enabled。

### Profile 用途标记
- **D-333:** AiProfile 加 `purposes: string[]` 字段（值如 `['summary','chat']`）。一个 profile 可用于多个用途。AiProfile 类型：`{ id, name, provider, api_url, model, enabled, api_key, purposes }`。Phase 16 只填 `'summary'`；Phase 19 的 chat 表单复用同一套 profiles 勾选 `'chat'`。— **Reversibility:** reversible — 加字段是兼容性扩展，旧数据无该字段时默认 `['summary']`

### AI 设置导航重构
- **D-334:** 新建顶级导航分组"**AI 功能**"，与"高级功能"并列。下分 4 个子项：AI 模型、AI 摘要、AI 对话、AI 写作。— **Reversibility:** costly — 改 nav 结构影响 settings-nav.ts / setting-descriptors.ts / settings-forms.ts 三处映射，撤销需回滚三处
- **D-335:** "AI 模型"卡片管多 profile（增删改、设默认、enabled 开关、purposes 勾选）；"AI 摘要"卡片管 system_prompt + gpt_name + 选哪个 profile 用于摘要；"AI 对话"/"AI 写作"卡片显示"敬请期待"占位（Phase 18/19 填充）。从旧的 `advanced-ai-summary` category 迁移数据到新的 `ai-models` + `ai-summary` 两个 category。— **Reversibility:** reversible — 占位卡片是纯前端展示，后续替换即可
- **D-336:** `ai_profiles` 和 `ai_default_profile_id` 两个键归到 `ai-models` category；`ai_summary_system_prompt` 和 `ai_summary_gpt_name` 归到 `ai-summary` category。旧的 `ai_summary_provider/api_url/api_key/model` 4 个键不再暴露到 UI（resolveProfiles 内部读，作为 legacy fallback）。

### Controller 重构范围
- **D-337:** **全新重建** `server/src/ai/` 目录。删除 `ai.controller.ts` + `ai.service.ts`，按架构文档新建全部文件：`ports/ai.port.ts`、`model/ai-profile.ts`、`model/model-resolver.service.ts`、`adapters/summary.adapter.ts`、`ai-summary.controller.ts`（重命名）。从零建立干净结构，不留旧文件。— **Reversibility:** reversible — git 可恢复旧文件，但重构是 phase 目标本身
- **D-338:** `htmlToPlainText` 函数放在 `adapters/` 下（`adapters/summary.adapter.ts` 内或 `adapters/html-to-text.ts`）。它是摘要业务逻辑（准备文章正文给 LLM），框架无关，迁移时不动。**不**放 `common/utils/`——它只服务于 AI 摘要 adapter。
- **D-339:** `AiModule` 装配用 NestJS DI：`ModelResolver` 作为 provider，`ArticleAiPort` token 用 `{ provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter }` 绑定。Controller 注入 `'ARTICLE_AI_PORT'` token 调 `summarizeArticle(publicId)`。这样将来切 LangGraph 时只改 useClass 绑定。
- **D-340:** `ai-summary.controller.ts` 端点路径不变：`POST /api/ai/generate-summary/:id`，仍是 `@UseGuards(JwtAuthGuard, AdminGuard)`，仍返回 `{ summary: string }`，不写库。前端 `aiApi.generateSummary()` 签名不变。

### Claude's Discretion
- ai_profiles JSON 的具体 schema 验证方式（Zod schema 校验 vs 手动校验）——架构文档建议用 zod，具体校验强度由 planner 决定
- profile ID 生成规则（nanoid / uuid / 用户可编辑 slug）——只要稳定唯一即可
- "AI 模型"卡片的具体 UI 布局（单卡片列表 vs 折叠面板）——参考现有 settings form 模式
- "敬请期待"占位卡片的具体文案和样式
- ModelResolver 单元测试的覆盖范围
- legacy fallback 何时移除（Phase 19 chat 上线后？还是永久保留）——建议永久保留，成本低

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 架构设计文档（最重要——所有目录结构、接口定义、迁移路径都来自这里）
- `.planning/ai-assistant-architecture.md` — AI 助手完整架构设计。包含：框架选型理由（AI SDK 7 over LangGraph）、目录结构、模块依赖关系图、ArticleAiPort/ChatService 接口定义、ToolDef 类型、ModelResolver 实现、chat.schema.ts、抽象层设计原则（该抽象/不该抽象）、LangGraph 迁移路径、11 个风险点、调研来源链接。**planner 必须严格遵循此文档的目录结构和接口签名。**

### AI 摘要功能方案设计（先期工作的设计记录）
- `.planning/ai-summary-design.md` — 已完成的后端摘要接口 + 前端 AiSummaryForm + 编辑器按钮的设计文档。记录了"现状：后端已完成"的实现细节和改动文件清单。

### 路线图与状态
- `.planning/ROADMAP.md` §Phase 16 — phase 定义、先期工作清单、待补 deliverables、AI-01/AI-02/AI-02F/AI-02A 需求 ID
- `.planning/STATE.md` — 活跃决策记录（D-01 到 D-312），M5 AI Features milestone 状态

### 现有 AI 代码（重构目标，planner/executor 必须读以理解当前实现）
- `server/src/ai/ai.module.ts` — 当前模块装配（DatabaseModule + SettingsModule imports，AiController + AiService providers）
- `server/src/ai/ai.controller.ts` — 当前 controller（POST /api/ai/generate-summary/:id，@UseGuards(JwtAuthGuard, AdminGuard)，@HttpCode(200)）
- `server/src/ai/ai.service.ts` — 当前 service（raw fetch LLM 调用 + htmlToPlainText + 30s 超时 + 4000 字截断 + legacy ai_summary_* 配置读取）

### 前端 AI 设置代码（升级目标）
- `frontend/src/components/admin/settings/AiSummaryForm.tsx` — 当前单 profile 表单（FormSelect 服务商 + FormInput api_url/model/key + FormCodeEditor system_prompt + FormInput gpt_name）
- `frontend/src/lib/api/ai.ts` — 当前前端 API 客户端（aiApi.generateSummary(articleId)）
- `frontend/src/lib/settings/setting-keys.ts` — KEY_AI_PROFILES / KEY_AI_DEFAULT_PROFILE_ID / KEY_AI_SUMMARY_* 键定义（485-493 行）
- `frontend/src/lib/settings/setting-descriptors.ts` — `advanced-ai-summary` category 定义（834-841 行，6 个键）
- `frontend/src/app/admin/settings/_config/settings-nav.ts` — 当前 nav 结构（advanced-ai-summary 在"高级功能"分组下，120-124 行）
- `frontend/src/app/admin/settings/_config/settings-forms.ts` — AiSummaryForm lazy 注册（62-64 行）

### 前端 AI 摘要展示代码（迁移后需验收仍正常）
- `frontend/src/components/post/ArticleLeadSummary.tsx` — 前台打字机摘要组件（读 ai_summary_gpt_name + article.summaries[0]）
- `frontend/src/components/admin/article-editor/EditorSidebar.tsx` — 编辑器侧边栏（handleGenerateAiSummary 调 aiApi.generateSummary，1108-1121 行按钮）

### 参考模式（settings 表单 + NestJS 模块结构）
- `frontend/src/components/admin/settings/PostSettingsForm.tsx` — 现有 settings form 模式参考
- `frontend/src/components/admin/settings/SettingsSection.tsx` — SettingsSection + SettingsFieldGroup 容器组件
- `server/src/article/article.module.ts` — NestJS 模块装配参考模式

### 项目约束
- `.claude/CLAUDE.md` — 项目核心约束：API 兼容性是核心底线，技术栈 NestJS + Drizzle + SQLite，端口 8091
- `~/CLAUDE.md` — CodeGraph MCP 使用指南（codegraph_explore 优先于 grep/read）+ Karpathy 简洁原则

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **SettingsService.get(key)** — 后端设置读取，resolveProfiles 直接用，读 `ai_profiles` / `ai_default_profile_id` / legacy `ai_summary_*`
- **decodePublicID + EntityType.Article** — 文章公开 ID 解码（当前 ai.service.ts 已用），重构后 adapter 复用
- **articles schema (article.schema.ts)** — contentHtml + title 字段查询，adapter 取正文复用
- **FormInput / FormSelect / FormCodeEditor / SettingsSection / SettingsFieldGroup** — 前端表单组件，AiSummaryForm 升级复用
- **apiClient.post + 响应格式 {code,data,message}** — 前端 API 客户端模式，aiApi 已用
- **setting-descriptors / settings-nav / settings-forms 三处映射** — settings 注册体系，新增 category/子项需同步改这三处

### Established Patterns
- NestJS 模块：`@Module({ imports, controllers, providers, exports })` + DI 注入
- Controller 端点：`@Controller('xxx')` + `@UseGuards(JwtAuthGuard, AdminGuard)` + `@HttpCode(HttpStatus.OK)`
- 全局响应拦截器：`{ code, data, message }` 格式（D-04）
- Settings 存储：任意 key 存 JSON 字符串（DB settings 表）
- 前端 settings 三处注册：setting-descriptors.ts（category → keys）+ settings-nav.ts（分组/子项）+ settings-forms.ts（lazy 组件）
- 端口 8091，前端 next.config.ts rewrites 代理 /api/*

### Integration Points
- `AiModule` 已在 `server/src/app.module.ts:99` 注册，重构后保持注册不变
- `POST /api/ai/generate-summary/:id` 路径不变，前端 aiApi.generateSummary 不变
- 前台 ArticleLeadSummary 读 `ai_summary_gpt_name`（设置 store）+ `article.summaries[0]`（文章字段），迁移后这两者都不变
- 编辑器 EditorSidebar.handleGenerateAiSummary 调 aiApi.generateSummary，迁移后接口契约不变
- SettingsService 在 SettingsModule 导出，AiModule imports SettingsModule（当前已如此）

</code_context>

<specifics>
## Specific Ideas

- `resolveProfiles()` legacy fallback 实现细节（来自架构文档 §三.2）：
  ```typescript
  // 旧配置兜底：合成单个 profile
  const key = settings.get('ai_summary_api_key');
  const url = settings.get('ai_summary_api_url');
  if (key && url) return [{ id: 'legacy', name: '默认', provider: 'custom',
    api_url: url, model: settings.get('ai_summary_model') || '',
    enabled: true, api_key: key, purposes: ['summary'] }];
  ```

- ModelResolver.resolve() 实现（来自架构文档 §二）：
  ```typescript
  resolve(profileId?: string): LanguageModelV1 {
    const profiles = resolveProfiles(this.settings);
    const defaultId = this.settings.get('ai_default_profile_id');
    const profile = profiles.find(p => p.id === (profileId ?? defaultId) && p.enabled)
                 || profiles.find(p => p.enabled);
    if (!profile) throw new Error('未配置可用的 AI 模型');
    return createOpenAICompatible({ baseURL: profile.api_url, apiKey: profile.api_key })(profile.model);
  }
  ```

- ArticleAiPort 契约（来自架构文档 §二）：
  ```typescript
  export interface ArticleAiPort {
    summarizeArticle(publicId: string): Promise<{ summary: string }>;
  }
  ```

- AiProfile 类型（基于架构文档 §三.2 扩展 purposes 字段）：
  ```typescript
  export interface AiProfile {
    id: string;
    name: string;
    provider: string;          // 'openai' | 'deepseek' | 'custom'
    api_url: string;           // OpenAI 兼容 baseURL
    model: string;
    enabled: boolean;
    api_key: string;
    purposes: string[];        // ['summary'] | ['summary','chat'] 等
  }
  ```

- 前端"AI 功能"导航分组结构：
  - AI 模型（`ai-models` category）：多 profile 管理表单（增删改 + 设默认 + enabled + purposes 勾选）
  - AI 摘要（`ai-summary` category）：system_prompt + gpt_name + 选摘要用的 profile
  - AI 对话（`ai-chat` category，占位）："敬请期待"卡片
  - AI 写作（`ai-writing` category，占位）："敬请期待"卡片

- 依赖添加：`ai`（AI SDK 7）+ `@ai-sdk/openai-compatible` + `zod`。注意 AI SDK 7 是 2026-06-25 发布的新版，API 名可能与 v4/v5 示例不同（stopWhen vs maxSteps、pipeUIMessageStreamToResponse 等），planner 需用 context7 查最新文档。

</specifics>

<deferred>
## Deferred Ideas

- LangGraph adapter 预写——架构文档明确 YAGNI，需要时再写第二个 ArticleAiPort 实现
- chat.schema.ts / chat-history.service.ts——Phase 17
- chat.service.ts / ai-chat.controller.ts / 流式 SSE 端点——Phase 18
- "AI 对话"/"AI 写作"卡片实际功能——Phase 18/19
- legacy ai_summary_* fallback 何时移除——建议永久保留（成本低），planner 可决定
- Context 压缩 / token 用量记录 / 断连处理——Phase 19
- 发布文章时自动生成摘要（当前只做手动触发）——未来阶段

</deferred>

---

*Phase: 16-AI Model Router & Summary Migration*
*Context gathered: 2026-07-26*
