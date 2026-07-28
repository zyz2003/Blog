# Phase 18 - 代码审查修复：conversationId 校验 + onFinish 防吞错 + mock 修正 + 重复工具名检测

> **归属**: Phase 18 (Streaming Chat Endpoint) 代码审查修复
> **状态**: ✅ 已完成
> **对应需求**: AI-05, AI-05F (质量加固)
> **提交**: ef2f52f

## 目标

修复 Phase 18 完成质量审查中发现的 5 个问题，其中 1 个为运行时致命 bug。

## 修复清单

### 1. conversationId UUID vs Sqids 不匹配 🔴 致命

**问题**: 前端 `ChatWindow.tsx` 用 `crypto.randomUUID()` 生成 conversationId，发送到后端后 `ChatHistoryService.appendMessage()` 调用 `decodePublicID()` 解码——Sqids 解码 UUID 直接抛异常，导致新对话 500。

**根因**: 前端不应生成后端需要 decode 的 ID。Sqids 编码格式与 UUID 完全不同。

**修复**:
- 移除前端 `getOrCreateConversationId()` + `localStorage` 持久化逻辑
- `ChatWindow.tsx` 不再发送 `body: { conversationId }` — 后端创建 Sqids ID
- 后端 `ChatService.chat()` 新增 conversationId 校验 (D-375)

**修改文件**:
- `frontend/src/components/chat/ChatWindow.tsx` — 移除 UUID 生成，不传 conversationId
- `server/src/ai/chat.service.ts` — 新增 decodePublicID + EntityType 校验

### 2. onFinish appendMessage 静默吞错 🟡 高

**问题**: `streamText` 的 `onFinish` 回调中 `await this.chatHistory.appendMessage(...)` 如果 DB 写入失败，异常被静默吞掉（onFinish 在 streamText 内部，异常无法传播到客户端）。助手消息丢失无感知。

**修复**:
- `onFinish` 内 appendMessage 包裹 try-catch + `this.logger.error()`
- 日志包含 conversationId 和完整错误信息 + stack trace
- 流已发送，失败不影响客户端响应，但可观测

**修改文件**:
- `server/src/ai/chat.service.ts` — onFinish try-catch + logger.error

### 3. decodePublicID 异常未捕获 🟡 高

**问题**: 当前端传入无效的 conversationId（非法 Sqids 或错误 entity type），`ChatService.chat()` 中 `decodePublicID()` 直接抛出未处理异常，走到控制器通用 500 错误路径，返回"内部服务器错误"而非有意义的错误信息。

**修复**:
- `ChatService.chat()` 中 conversationId 解析包裹 try-catch
- `decodePublicID` 异常 → `new DomainError('无效的会话 ID')`
- `entityType !== EntityType.ChatConversation` → `new DomainError('无效的会话 ID')`
- 控制器 `instanceof DomainError` 返回 500 + 具体错误消息

**修改文件**:
- `server/src/ai/chat.service.ts` — 新增 decodePublicID + EntityType 校验
- `server/src/ai/chat.service.spec.ts` — 新增 2 个测试（无效 ID + 错误 entity type）

### 4. ModuleRef mock token 不匹配 🟡 中

**问题**: `chat.service.spec.ts` 用 `{ provide: 'ModuleRef', ... }` 字符串 token，但 NestJS 的 `ModuleRef` 是类 token。DI 容器无法匹配，实际注入的是真实的 ModuleRef 而非 mock。测试能通过是因为工具执行未在测试中被触发。

**修复**: 改为 `{ provide: ModuleRef, ... }`，使用类作为 injection token。

**修改文件**:
- `server/src/ai/chat.service.spec.ts` — import ModuleRef + provide: ModuleRef

### 5. tool-bridge 重复工具名静默覆盖 🟢 低

**问题**: `toAiSdkTools` 中两个 ToolDef 同名时后者静默覆盖前者，无任何警告。未来添加工具时可能产生难以排查的 bug。

**修复**: `toAiSdkTools` 添加重复名检测，发现时抛出 `Error('Duplicate tool name: "xxx"')`。

**修改文件**:
- `server/src/ai/tools/tool-bridge.ts` — 添加重复名检测
- `server/src/ai/tools/tool-bridge.spec.ts` — 新增 1 个测试

## 新增测试用例

| 测试 | 文件 | 覆盖 |
|------|------|------|
| 无效 conversationId → DomainError | chat.service.spec.ts | decodePublicID 抛错 → DomainError('无效的会话 ID') |
| 错误 entity type → DomainError | chat.service.spec.ts | 非 ChatConversation type → DomainError |
| onFinish appendMessage 失败 → 日志不抛 | chat.service.spec.ts | DB 写入失败不抛错，但 logger.error 记录 |
| 重复工具名 → 抛 Error | tool-bridge.spec.ts | toAiSdkTools 发现同名 → throw |

## 验证

- `npx vitest run src/ai/` — 109/109 pass (原 105, +4 新测试)
- `npx tsc --noEmit` (frontend) — ChatWindow.tsx 无编译错误

## 影响范围

| 区域 | 变更 | 风险 |
|------|------|------|
| conversationId | 前端不再发送，后端校验 | 低：新对话正常创建，旧对话无 localStorage 缓存 |
| onFinish | 添加 try-catch | 低：正常路径不变，异常路径从静默变为可观测 |
| decodePublicID | 校验包裹 | 低：合法 ID 无影响，非法 ID 返回 DomainError 而非 500 |
| ModuleRef mock | 类 token | 无：测试行为更正确 |
| tool-bridge | 重复名检测 | 无：当前无重复名，新增工具时保护 |

## 遗留问题（Phase 19）

- `article-tools.ts` 的 `any` 类型过多 — 需定义 SearchHit/PublicArticle 接口
- `MessageList` 硬编码 `tool-search_articles` / `tool-get_article` — 新增工具需改组件
- 无 Markdown 渲染 — 助手回复显示原始 Markdown 语法
- 自动滚动在流式场景下可能干扰用户回看 — 需智能滚动检测
- @Public() + 宽松节流 — 公网部署有 LLM 费用滥用风险
