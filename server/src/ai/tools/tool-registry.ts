/**
 * ToolRegistry - 全局 AI 工具注册中心。
 *
 * 三个 AI 功能（对话/写作/摘要）共享此注册中心。
 * 每个功能按设置项（ai_chat_enabled_tools / ai_writing_enabled_tools）
 * 选择启用哪些工具。
 *
 * 内置工具：articleTools（搜索文章、获取文章等）。
 * 外部工具：预留 registerTool 接口，后续支持类似 MCP 的自定义工具。
 */
import { Injectable, Logger } from '@nestjs/common';
import type { ToolSet } from 'ai';
import { articleTools } from './article-tools';
import { toAiSdkTools } from './tool-bridge';
import type { ToolDef, ToolContext } from './tool-def';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private tools: Map<string, ToolDef> = new Map();

  constructor() {
    // 注册内置工具
    for (const tool of articleTools) {
      this.tools.set(tool.name, tool);
    }
    this.logger.log(`Registered ${this.tools.size} built-in tools`);
  }

  /** 注册一个外部工具（预留 MCP 式接口） */
  registerTool(tool: ToolDef): void {
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name}`);
  }

  /** 注销一个工具 */
  unregisterTool(name: string): void {
    this.tools.delete(name);
    this.logger.log(`Tool unregistered: ${name}`);
  }

  /** 列出所有已注册工具的元信息（给 UI 用） */
  listTools(): { name: string; description: string }[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  /**
   * 获取指定工具的 ToolSet（给 streamText 用）。
   * @param toolIds 启用的工具 ID 列表，undefined 或空数组 = 不启用任何工具
   * @param ctx 工具执行上下文
   */
  getTools(toolIds: string[] | undefined, ctx?: ToolContext): ToolSet {
    if (!toolIds || toolIds.length === 0 || !ctx) return {};
    const selected = Array.from(this.tools.values()).filter((t) =>
      toolIds.includes(t.name),
    );
    if (selected.length === 0) return {};
    return toAiSdkTools(selected, ctx);
  }

  /** 获取所有工具的 ToolSet */
  getAllTools(ctx: ToolContext): ToolSet {
    return toAiSdkTools(Array.from(this.tools.values()), ctx);
  }
}
