# Phase 16: AI Model Router & Summary Migration - Research

**Researched:** 2026-07-26
**Domain:** Vercel AI SDK 7 integration, NestJS DI, frontend settings system
**Confidence:** HIGH

## Summary

Phase 16 introduces Vercel AI SDK 7 as a new framework dependency and migrates the existing raw-fetch LLM call to `generateText`. The research confirms that AI SDK 7 (v7.0.37, latest stable) has significant API name changes from v4/v5/v6 that the architecture document does not account for. The most critical changes are: `system` renamed to `instructions`, `maxTokens` renamed to `maxOutputTokens`, `maxSteps` renamed to `stopWhen` with `isStepCount()` helper, and system messages in the `messages` array are **rejected by default**. The `createOpenAICompatible` factory from `@ai-sdk/openai-compatible` (v3.0.14) is confirmed to work as the architecture doc describes, with one important difference: the `name` parameter is **required**, not optional. The NestJS cookbook confirms the streaming pattern uses `@Res()` + `pipeUIMessageStreamToResponse`, but Phase 16 only needs non-streaming `generateText` which works with standard NestJS async/await patterns. The frontend settings system follows a strict three-file registration pattern (setting-descriptors.ts + settings-nav.ts + settings-forms.ts) that must be updated in sync. No database migration is needed for Phase 16.

**Primary recommendation:** Use AI SDK 7 with the v7 API names (`instructions`, `maxOutputTokens`, `stopWhen`/`isStepCount`), not the deprecated v6 aliases. Install `ai@^7.0.37`, `@ai-sdk/openai-compatible@^3.0.14`, and `zod@^4.4.3`. The `createOpenAICompatible` factory requires a `name` parameter that the architecture doc's code snippets omit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-330:** Fallback compat — resolveProfiles() reads ai_profiles JSON, falls back to legacy ai_summary_* 6 keys
- **D-331:** ai_summary_system_prompt and ai_summary_gpt_name stay as separate keys (not in profile)
- **D-332:** ai_default_profile_id set via UI "设为默认" button
- **D-333:** AiProfile has purposes: string[] field (e.g. ['summary','chat'])
- **D-334:** New top-level "AI 功能" nav group with 4 sub-items (AI 模型/AI 摘要/AI 对话/AI 写作)
- **D-335:** AI 模型 card manages multi-profile; AI 摘要 card manages prompt+gpt_name+profile selection; chat/writing are placeholder cards
- **D-337:** Full rebuild of server/src/ai/ — delete ai.controller.ts + ai.service.ts, create new ports/adapters/tools/model structure
- **D-338:** htmlToPlainText goes in adapters/ (framework-agnostic)
- **D-339:** NestJS DI with ARTICLE_AI_PORT token + useClass SummaryAdapter
- **D-340:** POST /api/ai/generate-summary/:id endpoint path and signature unchanged

### Claude's Discretion
- ai_profiles JSON schema validation (Zod vs manual)
- Profile ID generation rule (nanoid / uuid / slug)
- "AI 模型" card UI layout
- "敬请期待" placeholder card text/style
- ModelResolver unit test coverage
- Legacy fallback removal timing

### Deferred Ideas (OUT OF SCOPE)
- LangGraph adapter pre-write (YAGNI)
- chat.schema.ts / chat-history.service.ts (Phase 17)
- chat.service.ts / ai-chat.controller.ts / streaming SSE endpoint (Phase 18)
- "AI 对话"/"AI 写作" card actual functionality (Phase 18/19)
- Legacy ai_summary_* fallback removal timing
- Context compression / token usage recording / disconnect handling (Phase 19)
- Auto-generate summary on publish (future)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | ModelResolver + ai_profiles multi-profile config | AI SDK 7 createOpenAICompatible verified; resolveProfiles pattern validated; SettingsService.get() returns string \| undefined |
| AI-02 | Migrate summary from raw fetch to AI SDK generateText | generateText API verified: import from 'ai', use `instructions` (not `system`), `maxOutputTokens` (not `maxTokens`), return `{ text }` |
| AI-02F | Frontend AI summary typewriter verification | ArticleLeadSummary reads ai_summary_gpt_name (public key) + article.summaries[0]; migration does not change these |
| AI-02A | Admin ai_profiles multi-profile form + AI settings nav group | Three-file registration pattern documented; new SettingCategoryId values needed; AiSummaryForm upgrade to multi-profile management |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI model resolution (ModelResolver) | API / Backend | — | Reads settings, creates AI SDK model instances — pure backend concern |
| Summary generation (generateText) | API / Backend | — | LLM call happens server-side; no browser involvement |
| AI profile configuration UI | Browser / Client | — | Admin form for managing ai_profiles JSON |
| AI summary display (typewriter) | Browser / Client | — | Reads public setting + article data, renders client-side |
| Settings persistence | Database / Storage | — | Settings table stores ai_profiles as JSON string |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai | ^7.0.37 | AI SDK core — generateText, streamText, tool | Vercel AI SDK 7, official NestJS cookbook, covers all AI needs [VERIFIED: npm registry] |
| @ai-sdk/openai-compatible | ^3.0.14 | OpenAI-compatible provider factory | Single package covers OpenAI/DeepSeek/Ollama/custom; bypasses Vercel Gateway [VERIFIED: npm registry] |
| zod | ^4.4.3 | Schema validation for ai_profiles + tool definitions | AI SDK 7 peer dependency (zod ^3.25.76 \|\| ^4.1.8); use v4 for latest features [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/common | 11.1.27 | DI decorators, Injectable, Inject | Already in project — DI token pattern for ARTICLE_AI_PORT |
| @nestjs/testing | ^11.1.28 | Test module creation | Unit tests for ModelResolver, SummaryAdapter |
| vitest | 4.1.9 | Test runner | Already in project — test AI service logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @ai-sdk/openai-compatible | @ai-sdk/openai | openai package is OpenAI-specific; openai-compatible covers all providers with one package |
| zod v4 | zod v3.25.76 | v3 is also supported by AI SDK 7 peer dep, but v4 is the current major and has better TypeScript inference |
| AI SDK generateText | Keep raw fetch | Raw fetch works but requires manual error handling, no timeout abstraction, no provider abstraction; generateText is 1:1 replacement with better DX |

**Installation:**
```bash
cd server && npm install ai@^7.0.37 @ai-sdk/openai-compatible@^3.0.14 zod@^4.4.3
```

**Version verification:**
```bash
npm view ai version          # 7.0.37 (verified 2026-07-26)
npm view @ai-sdk/openai-compatible version  # 3.0.14 (verified 2026-07-26)
npm view zod version         # 4.4.3 (verified 2026-07-26)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| ai | npm | ~1 month (v7) | 18.7M/wk | github.com/vercel/ai | SUS (too-new) | Flagged — legitimate Vercel package, "too-new" is expected for v7 major release |
| @ai-sdk/openai-compatible | npm | ~1 month (v3) | 4.9M/wk | github.com/vercel/ai | SUS (too-new) | Flagged — same repo as ai, legitimate |
| zod | npm | 8+ years | 240M/wk | github.com/colinhacks/zod | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** ai, @ai-sdk/openai-compatible — both are from the official Vercel AI SDK monorepo (github.com/vercel/ai), the "too-new" flag is expected for a recent major version bump. No postinstall scripts detected. Planner should proceed with installation but pin exact versions.

*All three packages verified via npm registry (versions confirmed), context7 (API docs confirmed), and official ai-sdk.dev website (API reference confirmed).*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  HTTP Layer (NestJS controllers)                                │
│  ai-summary.controller.ts                                       │
│    POST /api/ai/generate-summary/:id                            │
│         │                                                       │
│         ▼ injects ARTICLE_AI_PORT token                         │
├─────────────────────────────────────────────────────────────────┤
│  Port (framework-agnostic contract)                             │
│  ports/ai.port.ts — ArticleAiPort { summarizeArticle(id) }     │
│         │                                                       │
│         ▼ useClass SummaryAdapter                               │
├─────────────────────────────────────────────────────────────────┤
│  Adapter (framework-specific, touches AI SDK)                   │
│  adapters/summary.adapter.ts                                    │
│    generateText({ model, instructions, messages, ... })         │
│         │                                                       │
│         ▼ injects ModelResolver                                 │
├─────────────────────────────────────────────────────────────────┤
│  Model Resolution (framework-specific factory)                  │
│  model/model-resolver.service.ts                                │
│    resolve(profileId?) → LanguageModel                          │
│    uses createOpenAICompatible({ name, baseURL, apiKey })       │
│         │                                                       │
│         ▼ reads SettingsService                                 │
├─────────────────────────────────────────────────────────────────┤
│  Framework-agnostic data layer                                  │
│  model/ai-profile.ts — AiProfile type + resolveProfiles()      │
│    reads ai_profiles JSON → AiProfile[] (legacy fallback)       │
│  adapters/html-to-text.ts — htmlToPlainText (pure function)     │
├─────────────────────────────────────────────────────────────────┤
│  Domain services (existing, no changes)                         │
│  SettingsService.get(key) → string | undefined                  │
│  ArticleService / decodePublicID / articles schema              │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
server/src/ai/
├── ai.module.ts                      # Module assembly, DI bindings
├── ports/
│   └── ai.port.ts                    # ArticleAiPort contract
├── model/
│   ├── ai-profile.ts                 # AiProfile type + resolveProfiles (framework-agnostic)
│   └── model-resolver.service.ts     # SettingsService → AI SDK model instance
├── adapters/
│   ├── summary.adapter.ts            # ArticleAiPort impl using generateText
│   └── html-to-text.ts               # htmlToPlainText pure function
└── ai-summary.controller.ts          # POST /api/ai/generate-summary/:id
```

### Pattern 1: AI SDK 7 generateText for Non-Streaming Summary
**What:** Replace raw fetch with AI SDK generateText for one-shot text generation
**When to use:** Any non-streaming LLM call (summary generation, classification, etc.)
**Example:**
```typescript
// Source: [CITED: ai-sdk.dev/docs/reference/ai-sdk-core/generate-text] + [CITED: ai-sdk.dev/docs/ai-sdk-core/generating-text]
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// Create provider (in ModelResolver)
const provider = createOpenAICompatible({
  name: profile.provider,  // REQUIRED in v7 — architecture doc omitted this
  baseURL: profile.api_url,
  apiKey: profile.api_key,
});

// Generate text (in SummaryAdapter)
const { text } = await generateText({
  model: provider(profile.model),  // provider() returns LanguageModel
  instructions: systemPrompt,      // NOT 'system' — renamed in v7
  messages: [{ role: 'user', content: userContent }],
  maxOutputTokens: 500,            // NOT 'maxTokens' — renamed in v7
  temperature: 0.3,
  abortSignal: controller.signal,  // AbortSignal for timeout
  timeout: { totalMs: 30000 },     // AI SDK 7 timeout config
});
```

### Pattern 2: NestJS DI with Port/Adapter Token
**What:** Use string token DI to decouple controller from adapter implementation
**When to use:** When you want swappable implementations (AI SDK now, LangGraph later)
**Example:**
```typescript
// ai.module.ts
@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [AiSummaryController],
  providers: [
    ModelResolver,
    { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
  ],
  exports: ['ARTICLE_AI_PORT'],
})
export class AiModule {}

// ai-summary.controller.ts
@Controller('ai')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AiSummaryController {
  constructor(
    @Inject('ARTICLE_AI_PORT') private readonly articleAi: ArticleAiPort,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('generate-summary/:id')
  async generateSummary(@Param('id') id: string): Promise<{ summary: string }> {
    return this.articleAi.summarizeArticle(id);
  }
}
```

### Pattern 3: Frontend Settings Three-File Registration
**What:** Adding a new settings category requires synchronized changes in 3 files
**When to use:** Any new settings form/category
**Example:**
```typescript
// 1. setting-descriptors.ts — add category ID to union type + key mapping
export type SettingCategoryId =
  | ... // existing
  | "ai-models"        // NEW
  | "ai-summary"       // NEW (replaces advanced-ai-summary)
  | "ai-chat"          // NEW (placeholder)
  | "ai-writing";      // NEW (placeholder)

// 2. settings-nav.ts — add top-level group
{
  id: "ai",
  label: "AI 功能",
  icon: Bot,
  children: [
    { id: "ai-models", label: "AI 模型", icon: Bot },
    { id: "ai-summary", label: "AI 摘要", icon: FileText },
    { id: "ai-chat", label: "AI 对话", icon: MessageCircle },
    { id: "ai-writing", label: "AI 写作", icon: PenLine },
  ],
}

// 3. settings-forms.ts — register lazy components
"ai-models": lazy(() => import("...").then(m => ({ default: m.AiModelsForm }))) as LazyForm,
"ai-summary": lazy(() => import("...").then(m => ({ default: m.AiSummaryForm }))) as LazyForm,
"ai-chat": lazy(() => import("...").then(m => ({ default: m.AiPlaceholderForm }))) as LazyForm,
"ai-writing": lazy(() => import("...").then(m => ({ default: m.AiPlaceholderForm }))) as LazyForm,
```

### Anti-Patterns to Avoid
- **Using `system` parameter in generateText:** Deprecated in v7, use `instructions`. System messages in `messages` array are **rejected by default** in v7 — must use top-level `instructions` or set `allowSystemInMessages: true` (security risk). [CITED: ai-sdk.dev/docs/migration-guides/migration-guide-7-0]
- **Using `maxTokens` parameter:** Deprecated in v7, use `maxOutputTokens`. [CITED: ai-sdk.dev/docs/reference/ai-sdk-core/generate-text]
- **Using `maxSteps` parameter:** Removed in v7, use `stopWhen: isStepCount(N)`. Not needed for Phase 16 (no tool loop), but critical for Phase 18. [CITED: ai-sdk.dev/docs/migration-guides/migration-guide-7-0]
- **Omitting `name` in createOpenAICompatible:** The `name` parameter is **required** in v7, not optional. The architecture doc's code snippet omits it. [CITED: ai-sdk.dev/providers/ai-sdk-providers/openai-compatible]
- **Using model ID strings like 'openai/gpt-4o':** These route through the Vercel AI Gateway (paid service). Use `createOpenAICompatible` with explicit `baseURL` + `apiKey` to bypass the gateway. [CITED: architecture doc risk #7]
- **Putting AI SDK imports in framework-agnostic files:** `ports/ai.port.ts`, `model/ai-profile.ts`, `adapters/html-to-text.ts` must NOT import from `ai` or `@ai-sdk/*`. Only `model-resolver.service.ts`, `adapters/summary.adapter.ts`, and controllers touch AI SDK.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM API call with error handling | Raw fetch + manual JSON parsing + timeout | AI SDK `generateText` | Handles streaming, tool calls, retries, timeout, abort signal, provider abstraction |
| OpenAI-compatible provider setup | Custom HTTP client per provider | `@ai-sdk/openai-compatible` `createOpenAICompatible` | One factory covers all OpenAI-compatible APIs (OpenAI, DeepSeek, Ollama, custom) |
| Timeout handling | Manual AbortController + setTimeout | AI SDK `timeout: { totalMs: 30000 }` | Built-in timeout with proper cleanup, no manual clearTimeout needed |
| Schema validation for ai_profiles | Manual type guards / instanceof checks | Zod schema `z.object({...})` | Type-safe validation, AI SDK peer dependency already requires zod |

**Key insight:** The existing `ai.service.ts` is 162 lines of hand-rolled fetch + error handling + timeout. The AI SDK `generateText` replacement will be ~20 lines. The raw fetch code is exactly the kind of thing AI SDK eliminates.

## Common Pitfalls

### Pitfall 1: AI SDK 7 API Name Mismatches
**What goes wrong:** Using v4/v5/v6 parameter names (`system`, `maxTokens`, `maxSteps`) that are deprecated or removed in v7
**Why it happens:** Most blog posts and community examples are for v4/v5. The architecture doc was written referencing v6 names.
**How to avoid:** Use v7 names exclusively: `instructions` (not `system`), `maxOutputTokens` (not `maxTokens`), `stopWhen: isStepCount(N)` (not `maxSteps`). The deprecated aliases still work but will be removed in future versions.
**Warning signs:** TypeScript deprecation warnings, `system` in messages array causing runtime errors

### Pitfall 2: System Messages Rejected in messages Array
**What goes wrong:** `{ role: 'system', content: '...' }` in the `messages` array throws an error in AI SDK 7
**Why it happens:** v7 rejects system messages in `messages` by default for security reasons
**How to avoid:** Use top-level `instructions` parameter for system prompts. Only use `allowSystemInMessages: true` for trusted persisted messages.
**Warning signs:** Runtime error "System messages are not allowed in messages"

### Pitfall 3: Missing `name` Parameter in createOpenAICompatible
**What goes wrong:** `createOpenAICompatible({ baseURL, apiKey })` throws — `name is required
**Why it happens:** The architecture doc's code snippet omits `name`, but it's required in v7
**How to avoid:** Always pass `name: profile.provider` or `name: profile.name`
**Warning signs:** TypeScript compile error or runtime validation error

### Pitfall 4: Vercel AI Gateway Routing
**What goes wrong:** Model IDs like `'openai/gpt-4o'` route through Vercel's paid AI Gateway
**Why it happens:** AI SDK 7's default model registry uses gateway-prefixed IDs
**How to avoid:** Always use `createOpenAICompatible` with explicit `baseURL` + `apiKey` to go direct to provider. Never use bare model ID strings.
**Warning signs:** Unexpected billing from Vercel, requests failing with 402

### Pitfall 5: SettingsService.get() Returns string | undefined
**What goes wrong:** Calling `JSON.parse(settings.get('ai_profiles'))` when the value is undefined throws
**Why it happens:** `SettingsService.get()` returns `string | undefined`, not `string`
**How to avoid:** Always null-check before JSON.parse: `const raw = settings.get('ai_profiles'); if (raw) try { return JSON.parse(raw); } catch {}`
**Warning signs:** "Unexpected token u in JSON" runtime error

### Pitfall 6: ESM-Only AI SDK 7
**What goes wrong:** `require()` calls fail because AI SDK 7 is ESM-only
**Why it happens:** AI SDK 7 dropped CommonJS support
**How to avoid:** Use `import` syntax everywhere. NestJS with TypeScript already uses ESM-style imports. Ensure tsconfig has `"module": "commonjs"` or `"module": "NodeNext"` — NestJS default `commonjs` works because TypeScript compiles imports to require, and AI SDK 7 provides ESM exports that Node.js 22 can handle.
**Warning signs:** "require() of ES Module" error at runtime

### Pitfall 7: Frontend Settings Three-File Sync
**What goes wrong:** Adding a category ID to `setting-descriptors.ts` but forgetting `settings-nav.ts` or `settings-forms.ts` causes runtime crash
**Why it happens:** The three files must be kept in sync — each category ID must appear in all three
**How to avoid:** When adding `ai-models`, `ai-summary`, `ai-chat`, `ai-writing` to `SettingCategoryId`, immediately add them to `settings-nav.ts` children and `settings-forms.ts` registry in the same commit
**Warning signs:** "No form registered for category" error in admin settings page

## Code Examples

### generateText for Summary (AI SDK 7 — Verified)
```typescript
// Source: [CITED: ai-sdk.dev/docs/reference/ai-sdk-core/generate-text] + [CITED: ai-sdk.dev/docs/ai-sdk-core/generating-text]
import { generateText } from 'ai';

const { text } = await generateText({
  model: modelInstance,           // from ModelResolver.resolve()
  instructions: systemPrompt,     // v7: NOT 'system'
  messages: [
    { role: 'user', content: `文章标题：${title}\n\n文章正文：\n${truncated}` },
  ],
  maxOutputTokens: 500,           // v7: NOT 'maxTokens'
  temperature: 0.3,
  timeout: { totalMs: 30000 },    // AI SDK 7 timeout object
});
// text is the generated summary string
```

### createOpenAICompatible + ModelResolver (AI SDK 7 — Verified)
```typescript
// Source: [CITED: ai-sdk.dev/providers/ai-sdk-providers/openai-compatible]
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

@Injectable()
export class ModelResolver {
  constructor(private settings: SettingsService) {}

  resolve(profileId?: string): LanguageModel {
    const profiles = resolveProfiles(this.settings);
    const defaultId = this.settings.get('ai_default_profile_id');
    const profile = profiles.find(p => p.id === (profileId ?? defaultId) && p.enabled)
                 || profiles.find(p => p.enabled);
    if (!profile) throw new Error('未配置可用的 AI 模型');

    const provider = createOpenAICompatible({
      name: profile.provider,      // REQUIRED — architecture doc omitted this
      baseURL: profile.api_url,
      apiKey: profile.api_key,
    });
    return provider(profile.model); // returns LanguageModel instance
  }
}
```

### resolveProfiles with Legacy Fallback
```typescript
// Source: [CITED: architecture doc §三.2] + verified against SettingsService.get() signature
export interface AiProfile {
  id: string;
  name: string;
  provider: string;
  api_url: string;
  model: string;
  enabled: boolean;
  api_key: string;
  purposes: string[];  // D-333
}

export function resolveProfiles(settings: SettingsService): AiProfile[] {
  const raw = settings.get('ai_profiles');  // returns string | undefined
  if (raw) {
    try {
      const profiles = JSON.parse(raw);
      if (Array.isArray(profiles) && profiles.length > 0) return profiles;
    } catch { /* fall through to legacy */ }
  }
  // Legacy fallback (D-330)
  const key = settings.get('ai_summary_api_key');
  const url = settings.get('ai_summary_api_url');
  if (key && url) {
    return [{
      id: 'legacy',
      name: '默认',
      provider: 'custom',
      api_url: url,
      model: settings.get('ai_summary_model') || '',
      enabled: true,
      api_key: key,
      purposes: ['summary'],
    }];
  }
  return [];
}
```

### ArticleAiPort Contract
```typescript
// Source: [CITED: architecture doc §二]
export interface ArticleAiPort {
  summarizeArticle(publicId: string): Promise<{ summary: string }>;
}
```

### NestJS Module Assembly (D-339)
```typescript
// Source: [CITED: architecture doc §二] + verified against existing ai.module.ts pattern
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { AiSummaryController } from './ai-summary.controller';
import { ModelResolver } from './model/model-resolver.service';
import { SummaryAdapter } from './adapters/summary.adapter';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [AiSummaryController],
  providers: [
    ModelResolver,
    { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
  ],
  exports: ['ARTICLE_AI_PORT'],
})
export class AiModule {}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw fetch + manual JSON parsing | AI SDK `generateText` | AI SDK 7 (2026-06-25) | Eliminates 100+ lines of boilerplate per LLM call |
| `system` parameter | `instructions` parameter | AI SDK 7 | Must use new name; old name deprecated |
| `maxTokens` parameter | `maxOutputTokens` parameter | AI SDK 7 | Must use new name |
| `maxSteps` parameter | `stopWhen: isStepCount(N)` | AI SDK 7 | New condition-based API; not needed in Phase 16 |
| `stepCountIs()` helper | `isStepCount()` helper | AI SDK 7 | Import name change |
| `onFinish` callback | `onEnd` callback | AI SDK 7 | Deprecated alias still works |
| `fullStream` property | `stream` property | AI SDK 7 | Deprecated alias still works |
| `experimental_*` prefixes | Stable names | AI SDK 7 | All experimental APIs graduated |
| System messages in messages array | Rejected by default | AI SDK 7 | Must use `instructions` or `allowSystemInMessages: true` |
| `createOpenAI` (OpenAI-specific) | `createOpenAICompatible` (generic) | AI SDK 6+ | One factory for all OpenAI-compatible providers |

**Deprecated/outdated:**
- `system` parameter: Use `instructions` instead (deprecated but still works in v7)
- `maxTokens` parameter: Use `maxOutputTokens` instead
- `maxSteps` parameter: Use `stopWhen` instead
- `onFinish` callback: Use `onEnd` instead
- `fullStream` property: Use `stream` instead
- All `experimental_*` prefixed APIs: Use stable names instead

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AI SDK 7 ESM-only works with NestJS commonjs compilation (Node.js 22 handles ESM imports from commonjs) | Pitfall 6 | Runtime "require() of ES Module" error — would need tsconfig module resolution change |
| A2 | `createOpenAICompatible` provider instance can be created per-request without performance penalty (no connection pooling needed) | Pattern 2 | If provider creation is expensive, would need caching in ModelResolver |
| A3 | zod v4 is compatible with all existing project code (project currently has no zod dependency) | Standard Stack | If zod v4 has breaking changes from v3 that AI SDK doesn't handle, would need to pin zod v3.25.76 |
| A4 | The `ai_profiles` JSON stored in settings table can be arbitrarily large (no SQLite TEXT column size limit concern for a few profiles) | Schema/Migration | If profiles array grows very large, might hit SQLite limits — unlikely for personal blog |
| A5 | `SettingsService.get()` cache is populated before AI module methods are called (onModuleInit runs before HTTP requests) | Pattern 2 | If cache is empty on first request, resolveProfiles returns empty array — but this matches current behavior |

## Open Questions

1. **zod v3 vs v4 for AI SDK 7**
   - What we know: AI SDK 7 peer dep accepts `^3.25.76 || ^4.1.8`. Project has no existing zod.
   - What's unclear: Whether zod v4 has any subtle incompatibilities with AI SDK 7's `inputSchema` consumption that v3 doesn't.
   - Recommendation: Use zod v4 (^4.4.3) — it's the current major, AI SDK explicitly supports it, and the project has no existing zod to conflict with.

2. **Provider instance caching in ModelResolver**
   - What we know: `createOpenAICompatible` creates a new provider object each call. The architecture doc creates it inline in `resolve()`.
   - What's unclear: Whether creating a provider per request has any overhead (HTTP connection setup, etc.).
   - Recommendation: Create provider per-request for now (matches architecture doc). AI SDK providers are lightweight factory objects — the actual HTTP connection is per-request anyway. If profiling shows overhead, add a Map cache keyed by profile ID.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22 | AI SDK 7 (engine requirement) | ✓ | v22.14.0 | — |
| npm | Package installation | ✓ | — | — |
| vitest | Test runner | ✓ | 4.1.9 | — |
| @nestjs/testing | Unit test module | ✓ | ^11.1.28 | — |
| TypeScript 5+ | Project language | ✓ | 5.8.3 | — |

**Missing dependencies with no fallback:**
- None — all required tools are available

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | server/vitest.config.ts |
| Quick run command | `cd server && npx vitest run src/ai/` |
| Full suite command | `cd server && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | resolveProfiles reads ai_profiles JSON, falls back to legacy keys | unit | `cd server && npx vitest run src/ai/model/ai-profile.spec.ts` | ❌ Wave 0 |
| AI-01 | ModelResolver.resolve() returns LanguageModel from profile config | unit | `cd server && npx vitest run src/ai/model/model-resolver.service.spec.ts` | ❌ Wave 0 |
| AI-01 | ModelResolver.resolve() throws when no enabled profile | unit | `cd server && npx vitest run src/ai/model/model-resolver.service.spec.ts` | ❌ Wave 0 |
| AI-02 | SummaryAdapter.summarizeArticle() calls generateText with correct params | unit | `cd server && npx vitest run src/ai/adapters/summary.adapter.spec.ts` | ❌ Wave 0 |
| AI-02 | SummaryAdapter handles LLM errors gracefully | unit | `cd server && npx vitest run src/ai/adapters/summary.adapter.spec.ts` | ❌ Wave 0 |
| AI-02 | POST /api/ai/generate-summary/:id returns { summary } | integration | `cd server && npx vitest run src/ai/ai-summary.controller.spec.ts` | ❌ Wave 0 |
| AI-02F | ArticleLeadSummary renders typewriter with ai_summary_gpt_name | manual | Browser walkthrough | N/A |
| AI-02A | AiModelsForm manages ai_profiles JSON array | unit | `cd frontend && npx vitest run AiModelsForm.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && npx vitest run src/ai/`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/ai/model/ai-profile.spec.ts` — covers resolveProfiles + legacy fallback
- [ ] `server/src/ai/model/model-resolver.service.spec.ts` — covers ModelResolver.resolve()
- [ ] `server/src/ai/adapters/summary.adapter.spec.ts` — covers generateText integration
- [ ] `server/src/ai/ai-summary.controller.spec.ts` — covers POST endpoint
- [ ] Frontend component tests for AiModelsForm (if applicable)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JwtAuthGuard + AdminGuard on endpoint (existing) |
| V3 Session Management | no | — |
| V4 Access Control | yes | @UseGuards(JwtAuthGuard, AdminGuard) — only admin can generate summary |
| V5 Input Validation | yes | Zod schema for ai_profiles JSON; publicId validated via decodePublicID |
| V6 Cryptography | yes | API keys stored in settings table (encrypted at rest if DB encryption enabled) |

### Known Threat Patterns for AI SDK + NestJS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure via /public/site-config | Information Disclosure | ai_profiles and ai_summary_api_key are NOT in PUBLIC_SETTING_KEYS — verified |
| Prompt injection via article content | Tampering | htmlToPlainText strips HTML; 4000 char truncation limits attack surface |
| Unauthenticated AI endpoint abuse | Denial of Service | JwtAuthGuard + AdminGuard restrict to admin only |
| LLM API key leakage in error messages | Information Disclosure | Catch LLM errors, return generic messages (existing pattern in ai.service.ts) |
| System message injection via persisted messages | Tampering | AI SDK 7 rejects system messages in messages array by default |

## Sources

### Primary (HIGH confidence)
- Context7 /vercel/ai — generateText API, createOpenAICompatible API, tool() definition, v7 migration guide
- ai-sdk.dev/docs/reference/ai-sdk-core/generate-text — generateText parameter reference (v7)
- ai-sdk.dev/providers/ai-sdk-providers/openai-compatible — createOpenAICompatible reference
- ai-sdk.dev/cookbook/api-servers/nest — NestJS integration cookbook
- ai-sdk.dev/docs/migration-guides/migration-guide-7-0 — v7 migration guide with all renames
- npm registry — ai@7.0.37, @ai-sdk/openai-compatible@3.0.14, zod@4.4.3 versions verified

### Secondary (MEDIUM confidence)
- Architecture doc (.planning/ai-assistant-architecture.md) — directory structure, interface definitions, risk points
- Existing codebase (ai.service.ts, ai.controller.ts, ai.module.ts) — current implementation patterns
- Frontend settings system (setting-descriptors.ts, settings-nav.ts, settings-forms.ts) — registration pattern

### Tertiary (LOW confidence)
- None — all findings verified via context7, npm registry, or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry, APIs confirmed via context7 + official docs
- Architecture: HIGH — patterns verified against AI SDK 7 official docs and NestJS cookbook
- Pitfalls: HIGH — all pitfalls discovered from official migration guide and API reference
- Frontend patterns: HIGH — verified by reading existing code

**Research date:** 2026-07-26
**Valid until:** 2026-08-26 (AI SDK 7 is actively releasing — check for minor version updates)
