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
import { ExternalToolService } from './external/external-tool.service';
import { McpClientManager } from './external/mcp-client-manager';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private tools: Map<string, ToolDef> = new Map();

  constructor(
    private externalToolService: ExternalToolService,
    private mcpClientManager: McpClientManager,
  ) {
    // 注册内置工具
    for (const tool of articleTools) {
      this.tools.set(tool.name, tool);
    }
    this.logger.log(`Registered ${this.tools.size} built-in tools`);
  }

  /** 内置 + HTTP 外部工具的 ToolDef（MCP 是 ToolSet，单独合并） */
  private getBuiltinAndHttpDefs(): ToolDef[] {
    const seen = new Set<string>();
    const result: ToolDef[] = [];
    for (const t of this.tools.values()) {
      if (!seen.has(t.name)) {
        seen.add(t.name);
        result.push(t);
      }
    }
    for (const t of this.externalToolService.getAllToolDefs()) {
      if (!seen.has(t.name)) {
        seen.add(t.name);
        result.push(t);
      } else {
        this.logger.warn(`External tool "${t.name}" name collides, skipped`);
      }
    }
    return result;
  }

  /** MCP 工具 ToolSet（已命名空间 mcp_，由 @ai-sdk/mcp 产出） */
  private getMcpToolSet(): ToolSet {
    return this.mcpClientManager.getToolSet();
  }

  /** 注册一个外部工具（运行时动态注册，一般走 ExternalToolService 从设置加载） */
  registerTool(tool: ToolDef): void {
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name}`);
  }

  /** 注销一个工具 */
  unregisterTool(name: string): void {
    this.tools.delete(name);
    this.logger.log(`Tool unregistered: ${name}`);
  }

  /** 列出所有工具的元信息（给 UI 用）：内置 + HTTP + MCP */
  listTools(): { name: string; description: string }[] {
    const defs = this.getBuiltinAndHttpDefs().map((t) => ({
      name: t.name,
      description: t.description,
    }));
    return [...defs, ...this.mcpClientManager.getToolMeta()];
  }

  /** 列出所有工具的 ID（给 resolveEnabledToolIds 用） */
  listToolIds(): string[] {
    return [
      ...this.getBuiltinAndHttpDefs().map((t) => t.name),
      ...Object.keys(this.getMcpToolSet()),
    ];
  }

  /**
   * 获取指定工具的 ToolSet（给 streamText 用）。
   * @param toolIds 启用的工具 ID 列表，undefined 或空数组 = 不启用任何工具
   * @param ctx 工具执行上下文
   */
  getTools(toolIds: string[] | undefined, ctx?: ToolContext): ToolSet {
    if (!toolIds || toolIds.length === 0 || !ctx) return {};
    const selected = this.getBuiltinAndHttpDefs().filter((t) =>
      toolIds.includes(t.name),
    );
    const baseToolSet = selected.length ? toAiSdkTools(selected, ctx) : {};
    // 合并启用的 MCP 工具（ToolSet 级）
    const mcpToolSet: ToolSet = {};
    for (const [name, tool] of Object.entries(this.getMcpToolSet())) {
      if (toolIds.includes(name)) mcpToolSet[name] = tool;
    }
    return { ...baseToolSet, ...mcpToolSet };
  }

  /** 获取所有工具的 ToolSet（内置 + HTTP + MCP） */
  getAllTools(ctx: ToolContext): ToolSet {
    return {
      ...toAiSdkTools(this.getBuiltinAndHttpDefs(), ctx),
      ...this.getMcpToolSet(),
    };
  }
}

/**
 * 解析"启用工具 ID 列表"设置项。
 * - `""`/undefined/非法 -> emptyMeansAll ? allToolIds : []（默认值：对话全开/写作全关）
 * - `"[]"` -> []（显式不用任何工具）
 * - `'["x"]'` -> 过滤到已知 id
 */
export function resolveEnabledToolIds(
  raw: string | undefined,
  allToolIds: string[],
  emptyMeansAll: boolean,
): string[] {
  const fallback = emptyMeansAll ? allToolIds : [];
  if (!raw || !raw.trim()) return fallback;
  try {
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return fallback;
    return ids.filter(
      (id): id is string => typeof id === 'string' && allToolIds.includes(id),
    );
  } catch {
    return fallback;
  }
}
