# Phase 18 - 后端流式聊天端点：tool-bridge + ChatService + AiChatController

> **归属**: Phase 18 (Streaming Chat Endpoint) Plan 01
> **状态**: ✅ 已完成
> **对应需求**: AI-05
> **提交**: 1c5572c, 759ce01

## 目标

构建 ONE 端到端流式聊天路径：ToolDef[] → AI SDK tool() 转换 → streamText + 工具调用 + 持久化 → POST /api/ai/chat SSE 流式输出。

## 新增文件

### `server/src/ai/tools/tool-bridge.ts` — 框架无关→AI SDK 适配器

```typescript
export function toAiSdkTools(defs: ToolDef[], ctx: ToolContext): ToolSet {
  const tools: ToolSet = {};
  for (const def of defs) {
    if (tools[def.name]) throw new Error(`Duplicate tool name: "${def.name}"`); // D-376
    tools[def.name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (input) => def.execute(input, ctx),
    });
  }
  return tools;
}
```

- **D-363**: 唯一导入 `tool` from `ai` 的文件 — 框架无关转换层
- **D-376**: 重复工具名抛错而非静默覆盖

### `server/src/ai/chat.service.ts` — 核心流式聊天服务

```typescript
@Injectable()
export class ChatService {
  async chat(messages: UIMessage[], options?: { conversationId?, profileId?, abortSignal? }) {
    // 1. 解析模型 (DomainError 向上传播)
    const model = this.modelResolver.resolve(options?.profileId);
    // 2. 解析/创建 conversationId — decodePublicID 校验 (D-375)
    // 3. 用户消息在 streamText 前持久化 (D-371)
    // 4. streamText + tools + stepCountIs(5) + toolChoice 'auto'
    // 5. onFinish 持久化 assistant 消息 — try-catch 防吞错 (D-374)
    // 6. 返回 UIMessageStream
  }
}
```

- **D-365**: 工具调用步数上限 5（stepCountIs(5)）
- **D-371**: 用户消息在 streamText 之前持久化，assistant 消息在 onFinish 中持久化
- **D-374**: onFinish 中 appendMessage 包裹 try-catch + logger.error，DB 写入失败可观测
- **D-375**: conversationId 经 decodePublicID + EntityType.ChatConversation 校验，无效 ID 返回 DomainError

### `server/src/ai/ai-chat.controller.ts` — SSE 流式聊天端点

```typescript
@Public()
@Controller('ai')
export class AiChatController {
  @Throttle({ default: { ttl: 6000, limit: 1 } })
  @Post('chat')
  async chat(@Body() body, @Res() res: Response) {
    // 空消息 → 400 { code, data, message }
    // ChatService.chat → pipeUIMessageStreamToResponse
    // DomainError → 500 { code, data, message }
  }
}
```

- **D-360**: @Public() — 匿名访客可聊天
- **D-369**: 流式前验证返回标准 JSON 错误格式
- @Res() 绕过 ResponseInterceptor（流式响应必须手动处理）

## 修改文件

### `server/src/ai/ports/ai.port.ts`

新增 `ChatService` 接口（`messages: unknown[]` 避免导入 AI SDK 类型）。

### `server/src/ai/ai.module.ts`

注册 ChatService + AiChatController，imports 增加 SearchModule + ArticleModule。

### `server/src/main.ts`

CORS `exposedHeaders` 增加 `Cache-Control` + `X-Accel-Buffering`（流式代理支持）。

## 关键决策

| 决策 | 理由 |
|------|------|
| D-363: tool-bridge 唯一导入 `tool` | 框架无关层保持纯净，LangGraph 迁移只改此文件 |
| D-364: ToolContext.getService via moduleRef.get | 懒加载服务实例，避免循环依赖 |
| D-365: stepCountIs(5) | 防止无限工具调用循环 |
| D-369: 流式前验证 | 错误在流开始前返回标准 JSON，而非 SSE 错误帧 |
| D-371: 用户消息先持久化 | 保证消息顺序，即使 streamText 失败用户消息也不丢 |
| D-374: onFinish try-catch | 流已发送，appendMessage 失败无法传播到客户端，必须 log |
| D-375: conversationId decodePublicID 校验 | 无效/错误类型 ID 返回 DomainError 而非未处理异常 |
| D-376: 重复工具名抛错 | 防止新增工具时静默覆盖，fail-fast |
