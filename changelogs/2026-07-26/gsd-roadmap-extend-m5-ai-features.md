# GSD Roadmap 扩展：M5 AI Features（Phase 16-19）

## 目的

将 AI 助手功能纳入 GSD 工作流管理。原 ROADMAP 的 M1-M4（Phase 01-15）已全部完成，AI 助手作为 M5 新 milestone，包含 4 个 phase。

## 修改文件

### `.planning/ROADMAP.md`

**1. 新增 M5 milestone**

```diff
+### M5: AI Features
+
+Phases 16-19 (planned). AI assistant with streaming + tool calling + RAG, unified multi-model dispatching. Architecture designed with swappable framework (AI SDK now, LangGraph later). See `.planning/ai-assistant-architecture.md` for full design.
```

**2. Phase Overview 表新增 AI Features 分区**

| Phase | Name | Goal | Status | Dependencies |
|-------|------|------|--------|--------------|
| 16 | AI Model Router & Summary Migration | ModelResolver + ai_profiles config, migrate raw-fetch summary to AI SDK generateText | Planned | - |
| 17 | AI Tools & Chat History Storage | Framework-agnostic ToolDef + article-tools, Drizzle chat tables + ChatHistoryService | Planned | 16 |
| 18 | Streaming Chat Endpoint | ChatService (streamText + tools + RAG) + POST /api/ai/chat with SSE | Planned | 17 |
| 19 | Chat Hardening & Frontend Integration | Token compression, disconnect handling, auth, useChat frontend + ai_profiles admin UI | Planned | 18 |

**3. 新增 Phase 16-19 详细说明**

每个 phase 含 Goal、Architecture、Key deliverables。

**4. Requirement Traceability 表新增 AI 需求项**

| Requirement ID | Phase | Description |
|----------------|-------|-------------|
| AI-01 | 16 | AI model router (ModelResolver) + ai_profiles multi-profile config |
| AI-02 | 16 | Migrate summary generation from raw fetch to AI SDK generateText |
| AI-03 | 17 | Framework-agnostic tool definitions (search_articles, get_article) |
| AI-04 | 17 | Chat history storage (Drizzle tables + ChatHistoryService) |
| AI-05 | 18 | Streaming chat endpoint with tool calling and RAG |
| AI-06 | 19 | Chat hardening (token compression, disconnect, auth timing) |
| AI-07 | 19 | Frontend chat widget (useChat) + ai_profiles admin config UI |

**5. 更新日期**：2026-07-21 -> 2026-07-26

### `.planning/STATE.md`

更新 GSD 状态：
- `milestone`: v1.0 -> M5
- `milestone_name`: milestone -> AI Features
- `current_phase`: null -> 16
- `status`: complete -> planning
- `stopped_at`: 更新为 M5 规划说明
- `total_phases`: 15 -> 19
- `last_updated` / `last_activity`: 2026-07-23 -> 2026-07-26

## 设计依据

AI 助手架构设计见 `.planning/ai-assistant-architecture.md`（基于 4 维度联网调研 + 综合 agent 输出）。

核心决策：
- 框架选型：Vercel AI SDK 7（不引入 LangGraph）
- 架构模式：端口适配器（Hexagonal）做防腐层，不预抽象统一接口
- 可切换性：工具定义/历史存储/端口契约为框架无关资产，迁移 LangGraph 时 0 修改

## 后续步骤

1. 调用 `/gsd-plan-phase 16` 生成 Phase 16 的可执行 PLAN.md
2. 调用 `/gsd-execute-phase 16` 按 wave 并行执行
3. 每个 plan 完成后记录修改日志到 `changelogs/phases/phase-NN/`

## Changelog 结构（两层）

```
changelogs/
├── 2026-07-26/                          # 日期目录（跨 phase 零散改动）
│   ├── page-background-image.md         # 页面背景图（独立功能）
│   └── gsd-roadmap-extend-m5-ai-features.md  # 本文件
└── phases/                              # GSD phase 维度
    ├── phase-16/                        # Phase 16 改动
    │   ├── 01-ai-summary-backend-and-admin.md   # 已做：后端+后台表单+编辑器按钮
    │   ├── 02-ai-summary-frontend-typewriter.md # 已做：前台打字机展示
    │   ├── 03-model-resolver.md          # 待做：ModelResolver（plan 执行后产生）
    │   └── ...
    ├── phase-17/
    ├── phase-18/
    └── phase-19/
```

**规则**：
- 每个 GSD plan（一个 wave 任务）对应 `phases/phase-NN/` 下一个文件
- 文件名 = plan 编号 + 简短描述
- 日期目录用于跨 phase 的零散改动（如 roadmap 扩展、页面背景图等非 GSD 工作）
- 已做的 AI 摘要工作归入 phase-16/，标注"已完成"状态
