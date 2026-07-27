# Phase 16 - 质量审查修复：DomainError + normalizePurposes + 共享 AiProfile 类型

> **归属**: Phase 16 (AI Model Router & Summary Migration) 质量审查修复
> **状态**: ✅ 已完成
> **对应需求**: AI-01, AI-02 (质量加固)
> **提交**: 7301503

## 目标

修复 Phase 16 完成质量审查中发现的 4 个问题，提升代码健壮性和类型一致性。

## 修复清单

### 1. DomainError 自定义错误类（D-340a）🟡 中等

**问题**: SummaryAdapter catch 块用 `error.message?.includes('文章')` 等字符串匹配判断是否 re-throw 域错误。如果 LLM 返回的错误消息恰好包含这些关键词（如 "文章内容过长"），会被误判为域错误而跳过通用错误包装，可能导致 API key 泄露。

**修复**:
- 新建 `server/src/ai/domain-error.ts` — `DomainError extends Error`
- `ModelResolver.resolve()` 抛 '未配置可用的 AI 模型' 改用 `new DomainError()`
- `SummaryAdapter.summarizeArticle()` 所有业务错误改用 `new DomainError()`
- catch 块改用 `error instanceof DomainError` 判断，不再依赖字符串匹配
- 测试断言改用 `toBeInstanceOf(DomainError)`

**修改文件**:
- `server/src/ai/domain-error.ts` — 新建
- `server/src/ai/model/model-resolver.service.ts` — import DomainError, throw DomainError
- `server/src/ai/adapters/summary.adapter.ts` — import DomainError, 所有 throw Error → throw DomainError, catch 用 instanceof
- `server/src/ai/adapters/summary.adapter.spec.ts` — 断言改 DomainError, 修复双调用模式
- `server/src/ai/model/model-resolver.service.spec.ts` — 断言加 DomainError

### 2. normalizePurposes 前后端格式兼容（D-340b）🟡 中等

**问题**: 前端 `AiModelsForm` 存储 purposes 为对象 `{ summary: true, chat: false }`，后端 `AiProfile.purposes` 期望 `string[]`。两者通过 `ai_profiles` JSON 键传递，格式不兼容。Phase 18/19 chat 功能用 `purposes` 筛选 profile 时会出错。

**修复**:
- 在 `resolveProfiles()` 中新增 `normalizePurposes()` 和 `normalizeProfile()` 函数
- `normalizePurposes(unknown)`: 对象格式 → `Object.entries().filter(v => v).map(k)` 得 `string[]`；数组格式 → 直接返回；其他 → 默认 `['summary']`
- `normalizeProfile(raw)`: 逐字段规范化，确保 `AiProfile` 所有字段类型正确
- `resolveProfiles()` 解析 JSON 后对每个 profile 调用 `normalizeProfile()`
- 新增 3 个测试用例覆盖

**修改文件**:
- `server/src/ai/model/ai-profile.ts` — 新增 normalizePurposes + normalizeProfile, resolveProfiles 调用
- `server/src/ai/model/ai-profile.spec.ts` — 新增 3 个测试

### 3. 共享 AiProfile 类型提取（D-340c）🟢 低

**问题**: `AiModelsForm.tsx` 和 `AiSummaryForm.tsx` 各自定义了 `AiProfile` 接口，重复且可能漂移。

**修复**:
- 新建 `frontend/src/lib/settings/ai-profile.ts` — 共享 AiProfile 接口
- `AiModelsForm.tsx` — 删除内联 AiProfile, import from shared
- `AiSummaryForm.tsx` — 删除内联 AiProfile, import from shared; enabledProfiles filter 用 `Record<string, unknown>` 避免类型窄化问题

**修改文件**:
- `frontend/src/lib/settings/ai-profile.ts` — 新建
- `frontend/src/components/admin/settings/AiModelsForm.tsx` — import shared type
- `frontend/src/components/admin/settings/AiSummaryForm.tsx` — import shared type, fix filter cast

### 4. 测试双调用模式修复 🟢 低

**问题**: 部分测试用 `await expect(...).rejects.toThrow()` 调用两次 `adapter.summarizeArticle()`，第二次消耗的是默认 mock 而非 `mockResolvedValueOnce` 设置的值，导致断言失败。

**修复**: 改用 `const err = await adapter.summarizeArticle(...).catch(e => e)` 单次调用 + 断言 `err` 实例和 `err.message`。

**修改文件**:
- `server/src/ai/adapters/summary.adapter.spec.ts` — 所有错误测试改用 catch 模式

## 验证

- `npx nest build` — clean
- `npx vitest run src/ai/` — 37/37 pass (原 34, +3 normalizePurposes 测试)
- `npx tsc --noEmit` — clean (无新增错误)

## 影响范围

| 区域 | 变更 | 风险 |
|------|------|------|
| 错误处理 | Error → DomainError | 低：外部行为不变，错误消息相同 |
| 数据解析 | resolveProfiles 加 normalize | 低：对合法数据无影响，只修格式不一致 |
| 类型定义 | 提取共享 AiProfile | 无：纯类型提取，运行时不变 |
| 测试 | 断言方式变更 | 无：只改测试代码 |
