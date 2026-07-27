# AI 摘要功能方案设计

## 目标

在后台文章编辑器加"AI 生成摘要"按钮，调用 LLM 生成摘要填入 `summaries[0]`；前台文章详情页原样展示已生成的摘要。

## 现状分析

### 前台（已完成，无需改动）

- `ArticleLeadSummary` 组件已渲染 `article.summaries[0]`（[ArticleLeadSummary.tsx](frontend/src/components/post/ArticleLeadSummary.tsx)）
- 后端 `Article.summaries` 字段已支持存取（JSON 数组，[article.schema.ts:37](server/src/database/schemas/article.schema.ts#L37)）
- 前台只读已生成的摘要，不触发 AI 调用 ✅（符合主流做法）

### 后台编辑器（已有基础）

- `EditorSidebar` 的"摘要 & SEO"区块已有"取自正文前300字"按钮（[EditorSidebar.tsx:1071](frontend/src/components/admin/article-editor/EditorSidebar.tsx#L1071)）
- props 已预留 `getCompleteHtmlForAISummary?: () => string`（[EditorSidebar.tsx:67](frontend/src/components/admin/article-editor/EditorSidebar.tsx#L67)）- 为 AI 摘要准备的钩子，但还未实现/使用
- 缺少"AI 生成"按钮

### 配置层（key 已定义，无 UI）

- `ai_summary_provider` / `ai_summary_api_key` / `ai_summary_api_url` / `ai_summary_model` / `ai_summary_system_prompt` 已在 [setting-keys.ts:487-491](frontend/src/lib/settings/setting-keys.ts#L487) 定义
- 后端 settings 表可存取任意 key（JSON 字符串自然存取）
- **缺少设置表单卡片** - 后台没有配置入口

### 后端（完全缺失）

- 没有 AI service，没有生成摘要的 endpoint
- 现有模式：`@Controller('xxx')` + `xxxService` + `xxxModule`（参考 [article.module.ts](server/src/article/article.module.ts)）
- Settings 通过 `SettingsService.get(key)` 读取（[settings.service.ts](server/src/settings/settings.service.ts)）

## 实现方案

### 现状：后端已完成 ✅

`server/src/ai/` 目录已有完整实现（之前会话留下）：

- [ai.module.ts](server/src/ai/ai.module.ts) - 已注册到 [app.module.ts:99](server/src/app.module.ts#L99)
- [ai.controller.ts](server/src/ai/ai.controller.ts) - `POST /api/ai/generate-summary/:id`，按文章 ID 从数据库取正文
- [ai.service.ts](server/src/ai/ai.service.ts) - 调用 OpenAI 兼容 API，30s 超时，正文截断 4000 字，错误处理完善

**接口签名**：`POST /api/ai/generate-summary/:id` -> `{ summary: string }`
- 不写数据库，只返回结果，前端拿到后填入编辑器保存
- 后端自己查文章正文，前端不需要传 title/content

### 第 1 步：前端 API 客户端

新建 [frontend/src/lib/api/ai.ts](frontend/src/lib/api/ai.ts)：

```typescript
export const aiApi = {
  async generateSummary(articleId: string): Promise<string> {
    const response = await apiClient.post<{ summary: string }>(
      `/api/ai/generate-summary/${articleId}`
    );
    if (response.code === 200 && response.data) return response.data.summary;
    throw new Error(response.message || "AI 摘要生成失败");
  },
};
```

在 [index.ts](frontend/src/lib/api/index.ts) 导出。

### 第 2 步：后台设置卡片

新建 [frontend/src/components/admin/settings/AiSummaryForm.tsx](frontend/src/components/admin/settings/AiSummaryForm.tsx)：

- 使用现有 `FormInput` / `FormSelect` / `FormCodeEditor` 组件（参考 [PostSettingsForm.tsx](frontend/src/components/admin/settings/PostSettingsForm.tsx) 模式）
- 字段：
  - 服务商（FormSelect）：openai / deepseek / 自定义
  - API 地址（FormInput）：默认 `https://api.openai.com/v1`
  - API Key（FormInput，password 类型）
  - 模型（FormInput）：默认 `gpt-4o-mini`
  - System Prompt（FormCodeEditor）：默认 "请用中文为以下文章生成一段200字以内的摘要，突出文章核心内容和要点。"

**注册到设置系统**（3 处改动）：
1. [setting-descriptors.ts](frontend/src/lib/settings/setting-descriptors.ts) - `SettingCategoryId` 加 `"advanced-ai-summary"`
2. [settings-nav.ts](frontend/src/app/admin/settings/_config/settings-nav.ts) - "高级功能"分组加子项
3. [settings-forms.ts](frontend/src/app/admin/settings/_config/settings-forms.ts) - 注册 lazy 组件

### 第 3 步：编辑器 AI 生成按钮

在 [EditorSidebar.tsx](frontend/src/components/admin/article-editor/EditorSidebar.tsx) 的"摘要 & SEO"区块，"取自正文前300字"按钮旁加"AI 生成"按钮：

- 点击后：
  1. 需要 `articleId`（编辑模式才有；新建模式禁用按钮，tooltip 提示"需先保存文章"）
  2. 调用 `aiApi.generateSummary(articleId)`
  3. 生成中显示 loading 状态（按钮 disabled + spinner）
  4. 成功后 `onUpdateField("summaries", [summary])`，toast 提示成功
  5. 失败 toast 提示错误信息
- 后端自己查正文，前端不需要 `getCompleteHtmlForAISummary`

**改动**：
- `EditorSidebar.tsx` - props 加 `articleId?`，加按钮 + 调用逻辑
- `ArticleEditorPage.tsx` - 把 `articleId` 传给 `EditorSidebar`（已有 `articleId` 变量）

## 改动文件清单

| 层 | 文件 | 改动 |
|----|------|------|
| 后端 | `server/src/ai/*` | ✅ 已完成 |
| 后端 | `server/src/app.module.ts` | ✅ 已注册 |
| 前端 API | `frontend/src/lib/api/ai.ts` | 新建 |
| 前端 API | `frontend/src/lib/api/index.ts` | 导出 aiApi |
| 前端设置 | `frontend/src/components/admin/settings/AiSummaryForm.tsx` | 新建 |
| 前端设置 | `frontend/src/lib/settings/setting-descriptors.ts` | 加 SettingCategoryId |
| 前端设置 | `frontend/src/app/admin/settings/_config/settings-nav.ts` | 加导航项 |
| 前端设置 | `frontend/src/app/admin/settings/_config/settings-forms.ts` | 注册表单 |
| 前端编辑器 | `frontend/src/components/admin/article-editor/EditorSidebar.tsx` | 加 AI 生成按钮 + articleId prop |
| 前端编辑器 | `frontend/src/components/admin/article-editor/ArticleEditorPage.tsx` | 传入 articleId |

## 不做的事

- **不做发布时自动生成** - 先做手动触发，自动生成后续可加
- **不做前台触发** - 符合主流做法，前台只读
- **不做多条摘要** - 社区版 1 条足够（PRO 版本逻辑不动）
- **不碰 ai_writing/ai_podcast/ai_assistant** - 本次只做 ai_summary

## 风险点

1. **API Key 安全** - 后端调用 LLM，key 不暴露给前端；设置表单 password 类型脱敏
2. **正文长度** - LLM 有 token 限制，后端需截断正文（如前 8000 字）
3. **超时** - LLM 响应慢，fetch 设 30s 超时
4. **错误处理** - 未配置 key / API 失败 / 余额不足，都要友好提示
