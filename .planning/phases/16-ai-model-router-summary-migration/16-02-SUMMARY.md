---
phase: 16
plan: 02
subsystem: ai
tags: [frontend, settings, multi-profile, ai-models, ai-summary, nav-group, shared-type]
requires: [setting-descriptors, setting-keys, settings-nav, settings-forms]
provides: [AiModelsForm, AiSummaryForm-upgraded, AiPlaceholderForm, AI-nav-group, shared-AiProfile-type]
affects: [frontend/src/lib/settings/, frontend/src/app/admin/settings/, frontend/src/components/admin/settings/]
tech-stack:
  added: []
  patterns: [multi-profile-management, provider-presets, lazy-form-registration, shared-type-extraction]
key-files:
  created:
    - frontend/src/components/admin/settings/AiModelsForm.tsx
    - frontend/src/components/admin/settings/AiPlaceholderForm.tsx
    - frontend/src/lib/settings/ai-profile.ts
  modified:
    - frontend/src/lib/settings/setting-descriptors.ts
    - frontend/src/app/admin/settings/_config/settings-nav.ts
    - frontend/src/app/admin/settings/_config/settings-forms.ts
    - frontend/src/components/admin/settings/AiSummaryForm.tsx
decisions:
  - AiModelsForm manages profiles as JSON array via KEY_AI_PROFILES with inline card editing
  - Provider presets auto-fill api_url/model only when current values are empty or match another preset
  - AiSummaryForm reads KEY_AI_PROFILES to populate profile selector, uses KEY_AI_SUMMARY_PROFILE_ID for selection
  - Legacy keys (ai_summary_provider, api_url, api_key, model) excluded from all category descriptors
  - AiPlaceholderForm uses Bot icon and shared Spinner-free pattern for coming-soon categories
  - D-340c: Extracted shared AiProfile type to frontend/src/lib/settings/ai-profile.ts (AiModelsForm + AiSummaryForm both import)
metrics:
  duration: 3770s
  completed: 2026-07-27
  tasks: 2
  files: 7
  quality_fix_commit: 7301503
status: complete
---

# Phase 16 Plan 02: Frontend AI Settings Multi-Profile Upgrade Summary

Upgraded the frontend AI settings from a single-profile form to a multi-profile management system with 4 new category IDs, a top-level "AI 功能" nav group, and 3 form components.

## What Was Done

### Task 1: Register new AI category IDs in settings three-file system

- Added 4 new values to `SettingCategoryId` union: `ai-models`, `ai-summary`, `ai-chat`, `ai-writing`
- Removed `advanced-ai-summary` from the union type and `categoryDescriptors`
- Added `ai-models` descriptor with `KEY_AI_PROFILES` (json) + `KEY_AI_DEFAULT_PROFILE_ID` (string)
- Added `ai-summary` descriptor with `KEY_AI_SUMMARY_PROFILE_ID` (string), `KEY_AI_SUMMARY_SYSTEM_PROMPT` (string), `KEY_AI_SUMMARY_GPT_NAME` (string)
- Added `ai-chat` and `ai-writing` as empty placeholder descriptors
- Added "AI 功能" top-level nav group with 4 sub-items: AI 模型 (Bot), AI 摘要 (FileText), AI 对话 (MessageCircle), AI 写作 (PenLine)
- Removed `advanced-ai-summary` subsection from the advanced nav group
- Registered lazy form components: AiModelsForm, AiSummaryForm, AiPlaceholderForm, AiPlaceholderForm
- Imported `PenLine` from lucide-react
- All three files updated in a single commit to avoid runtime crash (Pitfall 7)

### Task 2: Build AiModelsForm, upgrade AiSummaryForm, create AiPlaceholderForm

- **AiModelsForm**: Full multi-profile management component with:
  - Parse `KEY_AI_PROFILES` JSON into profile array (with try/catch, default to empty)
  - Each profile rendered as a SettingsSection card with: name (input), provider (select), api_url (input), model (input), api_key (password), enabled (FormSwitch), purposes (checkboxes: summary/chat/writing)
  - Provider preset auto-fill: openai and deepseek auto-populate api_url and model when fields are empty or match another preset
  - "设为默认" button sets KEY_AI_DEFAULT_PROFILE_ID; default profile gets a ring highlight
  - "添加模型" button generates new profile with `p_${Date.now()}` id
  - "删除" button removes profile, reassigns default if needed
  - Auto-set first enabled as default when adding to empty config

- **AiSummaryForm** (upgraded):
  - Removed provider/api_url/api_key/model fields (now in AiModelsForm)
  - Removed KEY_AI_SUMMARY_PROVIDER, KEY_AI_SUMMARY_API_URL, KEY_AI_SUMMARY_API_KEY, KEY_AI_SUMMARY_MODEL imports
  - Added profile selector: reads `KEY_AI_PROFILES` JSON, filters to enabled profiles, allows selecting via KEY_AI_SUMMARY_PROFILE_ID
  - Shows "请先在「AI 模型」中添加模型配置" when no profiles are configured
  - Kept gpt_name (前台展示) and system_prompt (提示词配置) sections unchanged

- **AiPlaceholderForm**: Simple coming-soon component with Bot icon and "敬请期待" text, used for both ai-chat and ai-writing categories

### Quality Review Fix (commit 7301503)

- **Shared AiProfile type extraction** (D-340c): Both AiModelsForm and AiSummaryForm previously defined their own `AiProfile` interface (duplicate). Extracted to `frontend/src/lib/settings/ai-profile.ts` and both forms now import from the shared source. Also fixed `enabledProfiles` filter in AiSummaryForm to use `Record<string, unknown>` before casting to `AiProfile`, avoiding type narrowing issues with JSON.parse results.

## Verification

1. `cd frontend && npx tsc --noEmit` — no TypeScript errors in changed files (only pre-existing error in unrelated `poster-generator.test.ts`)

## Deviations from Plan

None — plan executed exactly as written. Quality fix (shared type extraction) addressed review finding post-execution.

## Self-Check: PASSED

- All 7 modified/created files exist on disk (including shared ai-profile.ts)
- Commits ef06bd0, 07b0718, 7301503 found in git log
- TypeScript compilation passes for all changed files

