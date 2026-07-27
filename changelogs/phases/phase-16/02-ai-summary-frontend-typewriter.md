# Phase 16 - AI 摘要前台展示：打字机效果 + 进入视口触发 + AI 名字

> **归属**: Phase 16 (AI Model Router & Summary Migration) 已完成部分
> **状态**: ✅ 已完成（前台展示增强，Phase 16 验收项之一）
> **对应需求**: AI-02(前台展示部分)

## 目标

给文章详情页的 AI 摘要加打字机逐字输出效果，提升"AI 实时生成"的体验感。
符合 ChatGPT 风格：进入视口才开始打字，带闪烁光标和"正在生成…"状态。

## 修改文件

### 1. 配置层 - 新增 AI 名字配置

**`frontend/src/lib/settings/setting-keys.ts`** - 新增 key

```diff
 export const KEY_AI_SUMMARY_SYSTEM_PROMPT = "ai_summary_system_prompt";
+/** 前台展示的 AI 名字（如 AnZhiYu / 小助手） */
+export const KEY_AI_SUMMARY_GPT_NAME = "ai_summary_gpt_name";
```

**`server/src/settings/public-setting-keys.ts`** - 加入 public keys

重要：`ai_summary_*` 这些 key 之前不在 public keys 里，前台 `/api/public/site-config` 拿不到。
`gptName` 是前台展示用的，必须 public。

```diff
   // ─── Auth/registration ───
   'ENABLE_REGISTRATION',
+
+  // ─── AI summary display (frontend reads these to render) ───
+  'ai_summary_gpt_name',
 ]);
```

**`frontend/src/types/site-config.ts`** - 加类型字段

```diff
   article?: {
     showRelated?: boolean | string;
     [key: string]: unknown;
   };

+  // AI 摘要展示配置（前台读取）
+  ai_summary_gpt_name?: string;
+
   copyright?: {
```

**`frontend/src/lib/settings/setting-descriptors.ts`** - descriptor 加新 key

```diff
 "advanced-ai-summary": [
   ...
   { backendKey: K.KEY_AI_SUMMARY_SYSTEM_PROMPT, type: "string" },
+  { backendKey: K.KEY_AI_SUMMARY_GPT_NAME, type: "string" },
 ],
```

### 2. 设置表单 - 加 AI 名字输入

**`frontend/src/components/admin/settings/AiSummaryForm.tsx`**

新增"前台展示"区块，含"AI 名字"输入框：
- placeholder: `AnZhiYu`
- 留空时前台默认显示"文章摘要"
- 与接口配置分离，明确区分"生成端配置"和"展示端配置"

### 3. 前台组件 - 重写 ArticleLeadSummary

**`frontend/src/components/post/ArticleLeadSummary.tsx`**

原实现：直接 `dangerouslySetInnerHTML` 静态渲染第一条摘要。

新实现：
- **打字机逐字输出**：30ms/字，参考 `OneImageBanner` 的 `typeWriter` 实现
- **进入视口触发**：`IntersectionObserver`（threshold 0.2），滚到摘要位置才开始打字，避免一进页面就跑完。不支持 IO 的浏览器兜底直接触发
- **AI 名字**：从 `useSiteConfigStore` 读 `ai_summary_gpt_name`，留空回退"文章摘要"
- **图标**：从 B站图标（`SiBilibili`）改为 `Bot` 图标（lucide），更贴合 AI 主题
- **状态提示**：打字中显示"正在生成…"，旁边带闪烁光标 `|`
- **HTML 转 纯文本**：打字机基于纯文本逐字输出，用 `DOMParser` strip HTML 标签（AI 摘要本身就是纯文本）
- **清理**：组件卸载时 clearTimeout，避免内存泄漏

### 4. CSS - 新增样式

**`frontend/src/components/post/PostDetail.module.css`**

新增：
- `.articleLeadStatus` - "正在生成…"状态文字样式
- `.articleLeadCursor` - 闪烁光标，`@keyframes articleLeadBlink` 1s 循环

## 安全性

- `ai_summary_gpt_name` 是展示用字符串，加入 public keys 无安全风险
- `ai_summary_api_key` 等敏感 key 仍然不在 public keys 里，前台拿不到

## 未做的项（留待后续）

以下功能本次未实现，记录备查：

### ChatGPT 风格 UI 改造
- 当前仍是普通卡片样式，未改成 AI 头像 + 对话气泡
- 需要新增 `ai_summary_avatar` 配置项（头像 URL）
- 中等工作量

### 多条摘要切换
- `summaries` 数组本来就支持多条（PRO 版编辑器能配 3 条）
- 当前只取 `summaries[0]`，未加切换按钮
- 需要加 `switchBtn` + `randomNum` 配置项，前台加切换 UI
- 中等工作量

### 配置化开关
- 未加全局开关 `post_head_ai_description.enable`
- 当前行为：有 `summaries` 就显示，没有就不显示
- 如需全局关闭可后续加

### 最低字数门槛
- 未加 `basicWordCount`（文章正文不足 N 字时不显示摘要）
- 低优先级

### 打字速度可配
- 当前写死 30ms/字
- 可复用一图流的 `typing_speed` 或单独加配置
- 低优先级

### 重新生成按钮（前台）
- 前台读者可点"换一条"看不同摘要（配合多条切换）
- 依赖多条摘要功能
- 低优先级

### Markdown 渲染
- 当前打字机走纯文本，不渲染 markdown
- 如 AI 生成 markdown 摘要，可用 `react-markdown` 渲染
- 但和打字机逐字输出冲突，需权衡
- 低优先级

## 使用方式

1. 管理员在 **设置 -> 高级功能 -> AI 摘要 -> 前台展示** 填 AI 名字（如 "AnZhiYu"）
2. 文章有 `summaries` 时，前台文章详情页展示摘要卡片
3. 滚动到摘要位置自动触发打字机效果
4. 打字中显示"正在生成…"和闪烁光标
