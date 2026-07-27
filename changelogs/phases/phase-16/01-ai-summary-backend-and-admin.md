# Phase 16 - AI 摘要：后端接口 + 后台表单 + 编辑器按钮

> **归属**: Phase 16 (AI Model Router & Summary Migration) 已完成部分
> **状态**: ✅ 已完成（在 roadmap 扩展前做的，现归入 Phase 16）
> **对应需求**: AI-01(部分), AI-02(部分)

## 目标

在后台文章编辑器加"AI 生成"按钮，调用 LLM 生成摘要填入 `summaries[0]`；前台文章详情页原样展示已生成的摘要。

符合主流博客系统的做法：**后台编辑/发布时调用 AI，前台只读已生成的摘要**。

## Phase 16 待补部分

本文件记录的是 Phase 16 的先期工作。Phase 16 还需补：
- ModelResolver + ai_profiles 多模型配置（替换当前单一 ai_summary_* 配置）
- 把 raw fetch 迁移到 AI SDK generateText
- 后台 ai_profiles 多 profile 管理表单（升级当前 AiSummaryForm）
- 前台 AI 摘要展示验收（打字机效果见 02 号日志）

## 后端（已完成 + 安全修复）

### `server/src/ai/ai.controller.ts` - 安全修复

给 AI 接口补上权限守卫，防止未授权调用消耗 API 额度：

```diff
+import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
+import { AdminGuard } from '../common/guards/admin.guard';
+
 @Controller('ai')
+@UseGuards(JwtAuthGuard, AdminGuard)
 export class AiController {
```

### 已有实现（之前会话完成）

- `server/src/ai/ai.module.ts` - 模块定义，已注册到 `app.module.ts`
- `server/src/ai/ai.service.ts` - 调用 OpenAI 兼容 API
  - `POST /api/ai/generate-summary/:id` - 按文章 ID 从数据库取正文
  - 30s 超时，正文截断 4000 字，HTML 转纯文本
  - 完善错误处理（未配置 key / API 失败 / 超时 / 空结果）

## 前端

### 1. `frontend/src/lib/api/ai.ts` - 新建 API 客户端

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

### 2. `frontend/src/lib/api/index.ts` - 导出 aiApi

### 3. `frontend/src/components/admin/settings/AiSummaryForm.tsx` - 新建设置表单

字段：
- 服务商预设（FormSelect）：OpenAI / DeepSeek / 自定义 - 切换时自动填充 API 地址和模型
- API 地址（FormInput）
- API Key（FormInput，password 类型）
- 模型名称（FormInput）
- System Prompt（FormCodeEditor）- 留空使用默认值

### 4. 注册设置卡片（3 处改动）

- `frontend/src/lib/settings/setting-descriptors.ts` - `SettingCategoryId` 加 `"advanced-ai-summary"`，`categoryDescriptors` 加 5 个 key
- `frontend/src/app/admin/settings/_config/settings-nav.ts` - "高级功能"分组加"AI 摘要"子项（Bot 图标）
- `frontend/src/app/admin/settings/_config/settings-forms.ts` - 注册 lazy 组件

### 5. `frontend/src/components/admin/article-editor/EditorSidebar.tsx` - 加 AI 生成按钮

- props 加 `articleId?: string`
- `SettingsContentProps` 加 `articleId`
- 主入口接收 `articleId` 并传给 `SettingsContent`
- 新增 `isGeneratingAiSummary` 状态 + `handleGenerateAiSummary` 回调
- "取自正文前300字"按钮旁加"AI 生成"按钮（Sparkles 图标）
- 新建模式（无 articleId）禁用按钮，tooltip 提示"请先保存文章"
- 生成中显示 loading 状态，成功 toast 提示，失败 toast 显示错误

### 6. `frontend/src/components/admin/article-editor/ArticleEditorPage.tsx`

把已有的 `articleId` 变量传给 `EditorSidebar`。

## 前台（无需改动）

`ArticleLeadSummary` 组件已渲染 `article.summaries[0]`，前台只读已生成的摘要。

## 接口设计

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/api/ai/generate-summary/:id` | POST | 管理员 | 按文章 ID 生成摘要，不写库，返回 `{ summary }` |

## 不做的事

- 不做发布时自动生成（先手动触发）
- 不做前台触发（符合主流做法）
- 不碰 ai_writing/ai_podcast/ai_assistant（本次只做 ai_summary）

## 使用方式

1. 管理员在 **设置 -> 高级功能 -> AI 摘要** 配置 API 地址、Key、模型
2. 编辑文章时在"摘要 & SEO"区块点"AI 生成"按钮
3. 生成结果填入摘要框，保存文章即可
4. 前台文章详情页自动展示摘要
