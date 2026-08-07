/**
 * ExternalToolService - HTTP Webhook 外部工具。
 *
 * 每次 getAllToolDefs() 都从设置实时构建（chat/writing 每请求调用，变更即时生效）。
 * MCP 工具由 McpClientManager 直接产出 ToolSet，在 ToolRegistry 层合并（不经过这里）。
 */
import { Injectable, Logger } from "@nestjs/common";
import { SettingsService } from "../../../settings/settings.service";
import type { ToolDef, ToolContext } from "../tool-def";
import { normalizeHttpToolConfig } from "./types";
import { buildHttpTool } from "./http-tool-builder";

@Injectable()
export class ExternalToolService {
  private readonly logger = new Logger(ExternalToolService.name);

  constructor(private settings: SettingsService) {}

  /** HTTP Webhook 工具的 ToolDef（从 ai_external_tools 设置构建） */
  getAllToolDefs(): ToolDef[] {
    const raw = this.settings.get("ai_external_tools");
    if (!raw || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const defs: ToolDef[] = [];
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) continue;
        const config = normalizeHttpToolConfig(item as Record<string, unknown>);
        if (!config.enabled || !config.name) continue;
        const def = buildHttpTool(config);
        if (def) defs.push(def);
      }
      return defs;
    } catch {
      return [];
    }
  }

  /** 测试一个 HTTP 工具配置（用示例输入执行一次），给后台 UI 验证用 */
  async testHttpTool(
    rawConfig: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<{ content: string; status: number } | { error: string }> {
    const config = normalizeHttpToolConfig(rawConfig);
    const def = buildHttpTool(config);
    if (!def) return { error: "工具配置无效：缺少 name 或 url" };
    try {
      return (await def.execute(input, {} as ToolContext)) as {
        content: string;
        status: number;
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
