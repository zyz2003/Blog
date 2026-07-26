# Phase 16: Validation Strategy

**Phase:** 16 - AI Model Router & Summary Migration
**Created:** 2026-07-26
**Status:** Active

## Validation Architecture

### Layer 1: Unit Tests

**Target:** `server/test/ai/` (new directory)

| Component | Test File | Key Scenarios |
|-----------|-----------|---------------|
| resolveProfiles | `ai-profile.spec.ts` | Valid JSON parse → correct AiProfile[]; Empty/undefined → legacy fallback from 6 keys; Malformed JSON → legacy fallback; No config → empty array; Legacy profile has purposes=['summary'] |
| ModelResolver | `model-resolver.service.spec.ts` | resolve(profileId) → matching profile; resolve(undefined) → ai_default_profile_id → first enabled; resolve(disabledId) → fallback to first enabled; No enabled profiles → throws '未配置可用的 AI 模型'; resolve(ai_summary_profile_id) → summary-specific profile |
| SummaryAdapter | `summary.adapter.spec.ts` | summarizeArticle(validId) → calls generateText with `instructions` + `maxOutputTokens: 500`; Reads ai_summary_profile_id for profile selection; Invalid publicId → throws; Empty content → throws; generateText error → throws with message |

### Layer 2: Integration Tests

**Target:** `server/test/phase16-verification/` or `server/test/api-compat/ai.spec.ts`

| Endpoint | Scenarios |
|----------|-----------|
| POST /api/ai/generate-summary/:id | Valid request with mock LLM → { summary: string }; Unconfigured (no profiles, no legacy) → error; Invalid article ID → 404; Unauthenticated → 401; Non-admin → 403 |

### Layer 3: Frontend Verification (Manual)

| Area | Test |
|------|------|
| AiModelsForm | CRUD profiles, set default, toggle enabled, mark purposes |
| AiSummaryForm | Profile selector reads ai_profiles, prompt + gpt_name editable |
| Placeholder cards | "敬请期待" shown for AI 对话 / AI 写作 |
| Nav structure | "AI 功能" top-level group with 4 sub-items |
| ArticleLeadSummary | Typewriter effect still works with ai_summary_gpt_name |
| Editor AI button | "AI 生成" still calls POST /api/ai/generate-summary/:id |

### Layer 4: Regression

| Check | Method |
|-------|--------|
| Full server test suite | `cd server && npx vitest run` |
| Frontend type check | `cd frontend && npx tsc --noEmit` |
| Legacy fallback | Admin with only ai_summary_* keys can still generate summary |

### Dimension Coverage

| Dimension | Validation Method |
|-----------|-------------------|
| 1. Completeness | Unit tests verify AiProfile type + purposes field + ai_summary_profile_id |
| 2. Correctness | Unit tests verify generateText params (instructions, maxOutputTokens) |
| 3. Robustness | Unit tests for JSON parse failure, empty profiles, disabled profiles |
| 4. Compatibility | Integration test verifies POST /api/ai/generate-summary/:id response unchanged |
| 5. Security | API key not in PUBLIC_SETTING_KEYS; endpoint guarded by JwtAuthGuard + AdminGuard |
| 6. Performance | 30s timeout on generateText; 4000 char content truncation |
| 7. Observability | Logger on success/failure in SummaryAdapter |

---
