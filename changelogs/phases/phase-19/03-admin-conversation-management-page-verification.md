# Phase 19 - 管理员会话管理页 + Phase 16 Wave 3 验证

> **归属**: Phase 19 (Chat Hardening & Frontend Integration) Plan 03
> **状态**: ✅ 已完成（待人工验证 checkpoint）
> **对应需求**: AI-07
> **提交**: ab35ba0

## 目标

构建 /admin/ai-chat 管理员会话管理页（列表、查看、删除），更新管理侧边栏，并完成 Phase 16 Wave 3 遗留验证 + Phase 19 端到端验收。对应 D-387、D-393。

## 新增文件

### `frontend/src/app/admin/ai-chat/_hooks/use-ai-chat-page.ts` - 页面状态 Hook

- 状态：conversations、selectedId、messages、isLoading、分页（page/pageSize/total）、删除态
- `loadConversations(p)`: 调 `fetchConversations(p, 20)`，更新分页
- `selectConversation(id)`: 调 `fetchConversationMessages(id)`，设置 messages
- `handleDeleteClick/Confirm/Cancel`: 删除确认流程，删除后刷新列表
- `closeDetail`: 关闭详情面板
- `loadPage(p)`: 分页加载
- 导出 `AiChatPageState` 类型（供子组件 Props）

### `frontend/src/app/admin/ai-chat/_components/ConversationList.tsx` - 会话列表表格

- 列：ID（Sqids publicId 截断）、标题（或"无标题"）、消息数、创建时间、操作（查看 + 删除）
- 分页控件（上一页/下一页 + 页码）
- 点击"查看"选中会话 -> 显示详情面板
- 点击"删除"触发确认对话框

### `frontend/src/app/admin/ai-chat/_components/ConversationDetail.tsx` - 消息详情面板

- 选中会话时显示
- 头部：会话标题 + 关闭按钮
- 消息列表：role 徽章（user/assistant/system/tool）、内容、时间戳、Token 用量（如有）
- 底部删除按钮
- 可滚动面板，匹配管理详情面板样式

### `frontend/src/app/admin/ai-chat/_components/AiChatSkeleton.tsx` - 加载骨架

- 首次加载时显示，animate-pulse 骨架屏
- 表头 + 6 行占位 + 分页占位

### `frontend/src/app/admin/ai-chat/page.tsx` - 主页面

- 使用 `useAiChatPage` Hook
- 布局：桌面双列（列表左 + 详情右），移动单列（列表或详情）
- 加载时显示 AiChatSkeleton
- 遵循 comments 页模式：motion.div + adminContainerVariants + bg-card rounded-xl
- ConfirmDialog 删除确认（danger 色 + Trash2 图标）

## 修改文件

### `frontend/src/components/admin/sidebar.tsx`（或 admin-menu.ts）

- 新增"AI 对话"导航项指向 `/admin/ai-chat`
- 放在 AI/插件分区（如有）或现有导航项附近
- 使用 MessageCircle 图标

## 关键决策

| 决策 | 理由 |
|------|------|
| D-387: /admin/ai-chat 管理页 | 管理员可见所有会话，支持查看 + 删除 |
| D-393: Phase 16 Wave 3 验证 | 关闭 Phase 16 遗留验证缺口（打字机、AiModelsForm 往返、遗留回退、公钥安全） |
| 自定义 Hook 模式 | 页面组件保持精简，状态/动作集中管理 |
| 删除确认对话框 | 防止误删，destructive 操作必须二次确认 |
| 双列响应式布局 | 桌面并排高效，移动端单列可用 |

## 安全考量

| 威胁 | 类别 | 缓解 |
|------|------|------|
| /admin/ai-chat 页面访问 | 提权 | layout 中 admin 认证检查 + 端点 AdminGuard |
| 会话删除 | 篡改 | 仅管理员 + 确认对话框 |

## 人工验证 Checkpoint

本 Plan 含 `autonomous: false` 的 human-verify checkpoint（blocking gate），需验证：

### Phase 16 Wave 3 项
1. 前端 AI 摘要打字机显示迁移后仍正常
2. 管理 AiModelsForm 往返：增/改/删 profiles、设默认、保存、重载 - 值持久化
3. 遗留回退：`ai_profiles` 为空时旧 `ai_summary_*` 单配置键仍生效
4. 公钥安全：`api_key` 不在 PUBLIC_SETTING_KEYS 中（不暴露给未认证用户）

### Phase 19 端到端
5. 聊天组件打开 -> 欢迎消息 + 3 建议按钮
6. 发消息 -> 流式响应 + 工具调用（文章搜索）
7. 长对话（>20 条）触发压缩
8. 流式响应中断连 -> assistant 消息仍持久化
9. 刷新页面 -> 会话从 localStorage 恢复
10. 新对话按钮可用
11. 会话切换可用
12. /admin/ai-chat 显示会话列表，可查看 + 删除
13. 管理 AiChatForm 保存对话模型 + 欢迎语 + 推荐 + 系统提示

## 遗留项

- Drizzle 迁移（`chat_conversations.userId`）需在测试前执行 `cd server && npx drizzle-kit generate && npx drizzle-kit push`
- 管理端点响应格式需运行时验证 ResponseInterceptor 是否双重包裹
