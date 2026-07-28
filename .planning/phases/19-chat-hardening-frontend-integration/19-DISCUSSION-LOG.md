# Phase 19: Chat Hardening & Frontend Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 19-Chat Hardening & Frontend Integration
**Areas discussed:** Token 压缩与用量, 断连与认证时序, 后台 AI 对话管理, 前台聊天打磨, 遗留项

---

## Token 压缩与用量

### 长对话上下文压缩策略

| Option | Description | Selected |
|--------|-------------|----------|
| 滑动窗口 + 摘要 | 保留 system prompt + 最近 N 条 + 1 条摘要替代旧消息。prepareStep 回调实现 | ✓ |
| 硬截断 | 只保留最近 N 条，直接丢弃旧消息 | |
| LLM 摘要压缩 | 用 LLM 生成对话摘要替换旧消息，上下文保留最好但额外消耗 token | |

**User's choice:** 滑动窗口 + 摘要
**Notes:** 简单有效，个人博客场景足够

### 压缩触发阈值

| Option | Description | Selected |
|--------|-------------|----------|
| 20 条消息 | 约 20 条消息后触发，保留最近 10 条 + 1 条摘要 | ✓ |
| 30 条消息 | 更宽松，允许更长对话不压缩 | |
| 10 条消息 | 最保守，token 消耗最低 | |

**User's choice:** 20 条消息
**Notes:** 个人博客场景对话通常不会太长，20 条足够覆盖大多数对话

### Token 用量记录位置

| Option | Description | Selected |
|--------|-------------|----------|
| 每步记录到 chat_messages | onStepFinish 写入 input_tokens/output_tokens（已有 schema 字段） | ✓ |
| 累加到 conversation 级别 | chat_conversations 加 total 字段，需 migration | |
| 两者都做 | 最完整但复杂度稍高 | |

**User's choice:** 每步记录到 chat_messages
**Notes:** 简单直接，每步记录，onFinish 汇总

---

## 断连与认证时序

### 客户端断连处理

| Option | Description | Selected |
|--------|-------------|----------|
| consumeStream 保护 | 确保流被完整消费，onFinish 正常持久化，断连不影响后端状态 | ✓ |
| 立即取消 + 丢弃 | abortSignal 取消 LLM 调用，不持久化不完整消息 | |
| consumeStream + 断连标记 | 加 last_disconnect_at 字段标记断连 | |

**User's choice:** consumeStream 保护
**Notes:** 断连只影响客户端不再收到数据，不影响后端状态

### 认证时序

| Option | Description | Selected |
|--------|-------------|----------|
| 保持 @Public() 匿名访问 | D-360 不变，匿名访客可直接聊天 | ✓ |
| 改为需要登录 | 去掉 @Public()，加 JwtAuthGuard | |
| 匿名 + 登录分级限流 | 匿名限流更严，登录限流更宽 | |

**User's choice:** 保持 @Public() 匿名访问
**Notes:** 未来需要登录时改装饰器即可

### conversationId 恢复机制

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage + 历史端点 | 前端存 Sqids ID，刷新后用 GET /api/ai/conversations/:id/messages 恢复 | ✓ |
| 不恢复，每次新对话 | 最简单但用户体验差 | |
| localStorage 存完整消息 | 离线可用但有 5MB 限制 | |

**User's choice:** localStorage + 历史端点
**Notes:** 需要后端新增历史消息端点

---

## 后台 AI 对话管理

### "AI 对话"卡片功能范围

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 AiModelsForm + 加 chat 配置 | AiModelsForm 加 'chat' purposes 勾选，"AI 对话"卡片配 profile + 欢迎语 + 建议问题 | ✓ |
| 独立 AiChatForm 管理 chat profile | 完全分离但数据重复管理 | |
| AiModelsForm 勾选 + 对话卡片只配业务 | 配置分散在两个卡片 | |

**User's choice:** 复用 AiModelsForm + 加 chat 配置
**Notes:** 最简洁，不重复造轮子

### "AI 对话"卡片配置字段

| Option | Description | Selected |
|--------|-------------|----------|
| Profile 选择 + 欢迎语 + 建议问题 | 完整配置，存 settings 表 ai_chat_* 前缀 | ✓ |
| Profile + 欢迎语（建议问题硬编码） | 更简单但不够灵活 | |
| 只 Profile 选择 | 最简单但最不灵活 | |

**User's choice:** Profile 选择 + 欢迎语 + 建议问题
**Notes:** 加 system prompt 配置（D-392 遗留项讨论中确认）

### 对话历史查看

| Option | Description | Selected |
|--------|-------------|----------|
| 独立对话管理页 | /admin/ai-chat，列表 + 详情 + 删除 | ✓ |
| 设置卡片内嵌列表 | 只显示最近 5 条，功能有限 | |
| 只做后端端点，不做 UI | 前端 UI 留后续阶段 | |

**User's choice:** 独立对话管理页
**Notes:** 需要后端端点 + 前端页面

---

## 前台聊天打磨

### 欢迎语与建议问题

| Option | Description | Selected |
|--------|-------------|----------|
| 欢迎语 + 建议问题按钮 | 从后台配置读取，点击建议问题直接发送 | ✓ |
| 只欢迎语 | 更简洁但缺少引导 | |
| 不显示（保持现状） | 最简单 | |

**User's choice:** 欢迎语 + 建议问题按钮
**Notes:** 从后台 ai_chat_welcome_message + ai_chat_suggested_questions 读取

### 断线重连

| Option | Description | Selected |
|--------|-------------|----------|
| 提示条 + 手动重试 | "连接中断，点击重试"，简单实用 | ✓ |
| 自动重连（指数退避） | 用户体验更好但实现复杂 | |
| 只显示错误，不重连 | 最简单 | |

**User's choice:** 提示条 + 手动重试
**Notes:** 个人博客场景足够

### 新对话与会话切换

| Option | Description | Selected |
|--------|-------------|----------|
| 新对话按钮 + 会话切换 | 头部加 + 按钮 + 历史对话列表 | ✓ |
| 只新对话按钮 | 更简单，用户只能有一个活跃对话 | |
| 不加（关闭重开即新对话） | 最简单但用户体验差 | |

**User's choice:** 新对话按钮 + 会话切换
**Notes:** 历史对话列表从 GET /api/ai/conversations 加载

---

## 遗留项

### chat_conversations.userId

| Option | Description | Selected |
|--------|-------------|----------|
| 加 userId (nullable) | 匿名=null，登录=DB ID，需 migration | ✓ |
| 不加 userId | 所有对话匿名，无法按用户筛选 | |

**User's choice:** 加 userId (nullable)
**Notes:** 对话管理页可按用户筛选，未来可扩展为登录才能聊天

### System prompt 可配置

| Option | Description | Selected |
|--------|-------------|----------|
| 后台可配置 | ai_chat_system_prompt，默认当前硬编码提示词 | ✓ |
| 保持硬编码 | 最简单但不够灵活 | |

**User's choice:** 后台可配置
**Notes:** ChatService.chat() 从 settings 读取

### Phase 16 Wave 3 验收

| Option | Description | Selected |
|--------|-------------|----------|
| 纳入 Phase 19 验收任务 | 作为 Phase 19 的一个 plan 任务 | ✓ |
| 单独执行 Phase 16 Wave 3 | 不纳入 Phase 19 | |

**User's choice:** 纳入 Phase 19 验收任务
**Notes:** 验收内容：打字机展示 + admin 表单 round-trip + legacy fallback + 公钥安全

### Phase 18 遗留 discretion 项

| Option | Description | Selected |
|--------|-------------|----------|
| Planner 自行决定，不确认 | 实现细节不影响 Phase 19 功能 | ✓ |
| 逐项确认 | 确保不冲突 | |

**User's choice:** Planner 自行决定，不确认
**Notes:** 打字机实现方式、浮动按钮样式、ThrottlerGuard TTL 等由 planner 决定

---

## Claude's Discretion

- 摘要生成的具体实现（generateText 参数、prompt 模板）
- prepareStep 回调的具体实现方式
- consumeStream 的具体调用位置
- 对话管理页的具体 UI 布局
- 建议问题的默认值
- 会话切换的 UI 形式
- 断线重试的具体实现
- /admin/ai-chat 页面的路由注册方式
- ChatHistoryService 新增方法的签名
- userId 字段在 ChatService.chat() 中的传递方式

## Deferred Ideas

- LangGraph adapter——YAGNI
- AI 写作功能——未来阶段
- 登录才能聊天的认证策略——未来按需
- 匿名 + 登录分级限流——未来按需
- conversation 级别 token 用量累加——未来按需
- 自动重连（指数退避）——未来按需
