# Phase 16: AI Model Router & Summary Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 16-AI Model Router & Summary Migration
**Areas discussed:** ai_profiles 迁移策略, Profile 用途标记, AI 设置导航重构, Controller 重构范围

---

## ai_profiles 迁移策略

| Option | Description | Selected |
|--------|-------------|----------|
| 回退兼容（推荐） | 后端 resolveProfiles() 读 ai_profiles JSON，空则回退读 ai_summary_* 6 键合成 legacy profile。前端统一写 ai_profiles JSON。 | ✓ |
| 一次性自动迁移 | 启动时检测旧键，自动生成 ai_profiles 记录写回。之后只读 ai_profiles。 | |
| 不迁移，直接切 | 直接改成写 ai_profiles JSON，旧配置丢失。 | |

**User's choice:** 回退兼容（推荐）
**Notes:** 匹配架构文档 §三.2 的 resolveProfiles() fallback 设计。

---

### 旧键去留（sub-question）

| Option | Description | Selected |
|--------|-------------|----------|
| system_prompt/gpt_name 留在旧键（推荐） | profile 只存模型配置；prompt 和 gpt_name 是摘要业务设置，留在 ai_summary_* 旧键。AiSummaryForm 上半管 profile，下半管这两个字段。 | ✓ |
| prompt 跟 profile 走，gpt_name 单留 | 每个 profile 带 summary_system_prompt，gpt_name 单独留。不同 profile 可有不同 prompt。 | |
| 全部塞进 profile JSON | profile 带 prompt+gpt_name。gpt_name 重复且不随模型变化。 | |

**User's choice:** system_prompt/gpt_name 留在旧键（推荐）

---

### 默认 profile（sub-question）

| Option | Description | Selected |
|--------|-------------|----------|
| UI 按钮设默认（推荐） | 每个 profile 卡片有"设为默认"按钮，写 ai_default_profile_id。首次保存自动设第一个为默认。 | ✓ |
| 不存，用第一个 enabled | 不存 defaultId，resolveProfiles 用第一个 enabled。 | |
| 调用方显式传 profileId | resolve(profileId?) 接受显式 ID，不传用第一个 enabled。 | |

**User's choice:** UI 按钮设默认（推荐）

---

## Profile 用途标记

| Option | Description | Selected |
|--------|-------------|----------|
| profile 带 purposes 数组（推荐） | AiProfile 加 purposes: string[]，一个 profile 可多用途。摘要页只列含 'summary' 的。Phase 19 chat 复用同一套勾 'chat'。 | ✓ |
| 不加用途，每用途单独存 profile id | 摘要用 ai_summary_profile_id，chat 用 ai_chat_profile_id。简单但重复配置。 | |
| 单用途字段 | usage: 'summary'|'chat'|'writing'，每 profile 只能一用途。 | |

**User's choice:** profile 带 purposes 数组（推荐）

---

## AI 设置导航重构

| Option | Description | Selected |
|--------|-------------|----------|
| 拆成模型配置 + 摘要设置两卡片（推荐） | 上方"AI 模型配置"（多 profile 共享）+ 下方"摘要生成"（prompt+gpt_name+选 profile）。保持单 nav 项。 | |
| 加全部 nav 项 + 占位卡片 | 现在加 4 个 nav 项（模型/摘要/对话/写作），对话/写作显示"敬请期待"。Phase 18/19 填充。 | ✓ |
| 不动导航，内部重组 | 保持单"AI 摘要"卡片，内部上下分区。Phase 18 再重构导航。 | |

**User's choice:** 加全部 nav 项 + 占位卡片

---

### 导航结构（sub-question）

| Option | Description | Selected |
|--------|-------------|----------|
| 4 个子项在高级功能下（推荐） | 高级功能分组下加 4 个 AI 子项。 | |
| 新顶级分组"AI 功能" | 新建顶级分组，与"高级功能"并列，下分 4 子项。AI 设置更独立。 | ✓ |

**User's choice:** 新顶级分组"AI 功能"

---

## Controller 重构范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全新重建（推荐） | 删 ai.controller.ts + ai.service.ts，按架构文档新建全部文件。从零建立干净结构。 | ✓ |
| 新建 + 旧文件最后删 | 保留旧文件作参考，新建 ports/+model/+adapters/，最后替换注册。 | |

**User's choice:** 全新重建（推荐）

---

### htmlToText 位置（sub-question）

| Option | Description | Selected |
|--------|-------------|----------|
| 放 adapters/ 里（推荐） | 是摘要业务逻辑，框架无关。放 adapters/summary.adapter.ts 或 adapters/html-to-text.ts。迁移时不动。 | ✓ |
| 放 common/utils/ 里 | 纯文本处理工具，放通用工具目录。 | |

**User's choice:** 放 adapters/ 里（推荐）

---

## Claude's Discretion

- ai_profiles JSON schema 验证方式（Zod vs 手动校验）
- profile ID 生成规则（nanoid / uuid / slug）
- "AI 模型"卡片 UI 布局（卡片列表 vs 折叠面板）
- "敬请期待"占位卡片文案和样式
- ModelResolver 单元测试覆盖范围
- legacy fallback 何时移除（建议永久保留）

## Deferred Ideas

- LangGraph adapter 预写（YAGNI）
- chat.schema.ts / chat-history.service.ts（Phase 17）
- chat.service.ts / 流式端点（Phase 18）
- "AI 对话"/"AI 写作"卡片实际功能（Phase 18/19）
- legacy fallback 移除时机
- Context 压缩 / token 记录 / 断连处理（Phase 19）
- 发布时自动生成摘要（未来阶段）
