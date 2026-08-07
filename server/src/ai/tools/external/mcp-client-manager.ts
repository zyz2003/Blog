/**
 * McpClientManager - 用官方 @ai-sdk/mcp 的 createMCPClient 管理 MCP 服务器连接。
 *
 * - 传输：{ type: 'sse' | 'http', url } 配置式，由 @ai-sdk/mcp 内部处理（无需直接用 @modelcontextprotocol/sdk）。
 * - .tools() 返回 AI SDK ToolSet，schema 转换/代理 callTool 全由官方处理。
 * - 连接持久化，配置变更时后台重连；getToolSet() 同步返回缓存的 ToolSet（已命名空间 mcp_<id>_<name>）。
 */
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { SettingsService } from "../../../settings/settings.service";
import { normalizeMcpServerConfig, type McpServerConfig } from "./types";

interface McpConnection {
  client: import("@ai-sdk/mcp").MCPClient;
  toolSet: ToolSet; // 已命名空间
  hash: string;
}

@Injectable()
export class McpClientManager implements OnModuleDestroy {
  private readonly logger = new Logger(McpClientManager.name);
  private connections = new Map<string, McpConnection>();
  private cachedToolSet: ToolSet = {};
  private cachedToolMeta: { name: string; description: string }[] = [];
  private lastConfigRaw = "";
  private syncing = false;

  constructor(private settings: SettingsService) {}

  /** 同步返回缓存的 MCP 工具 ToolSet（已命名空间 mcp_）；配置变化时后台重连 */
  getToolSet(): ToolSet {
    const raw = this.settings.get("ai_mcp_servers") || "";
    if (raw !== this.lastConfigRaw) {
      this.lastConfigRaw = raw;
      void this.syncConnections();
    }
    return this.cachedToolSet;
  }

  /** 同步返回缓存的 MCP 工具元信息（name + description） */
  getToolMeta(): { name: string; description: string }[] {
    return this.cachedToolMeta;
  }

  /** 测试一个 MCP 服务器配置：连接、列出工具、关闭 */
  async testConnection(
    rawConfig: Record<string, unknown>,
  ): Promise<{ tools: { name: string; description: string }[] } | { error: string }> {
    const config = normalizeMcpServerConfig(rawConfig);
    const client = await this.createClient(config);
    if (!client) return { error: this.configError(config) };
    try {
      const { tools } = await client.listTools();
      return {
        tools: (tools || []).map((t: { name: string; description?: string }) => ({
          name: t.name,
          description: t.description || "",
        })),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    } finally {
      await client.close();
    }
  }

  private parseConfigs(): McpServerConfig[] {
    const raw = this.settings.get("ai_mcp_servers");
    if (!raw || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
        .map(normalizeMcpServerConfig)
        .filter((c) => c.enabled && c.url);
    } catch {
      return [];
    }
  }

  private async syncConnections(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const configs = this.parseConfigs();
      const enabledIds = new Set(configs.map((c) => c.id));

      for (const id of [...this.connections.keys()]) {
        if (!enabledIds.has(id)) await this.disconnect(id);
      }
      for (const config of configs) {
        const hash = JSON.stringify(config);
        const existing = this.connections.get(config.id);
        if (existing && existing.hash === hash) continue;
        if (existing) await this.disconnect(config.id);
        const conn = await this.connectOne(config);
        if (conn) {
          this.connections.set(config.id, { ...conn, hash });
          this.logger.log(
            `MCP "${config.name}" connected: ${Object.keys(conn.toolSet).length} tools`,
          );
        }
      }
      this.rebuildCache();
    } finally {
      this.syncing = false;
    }
  }

  /** 配置校验错误信息（无错误返回空串） */
  private configError(config: McpServerConfig): string {
    if (config.type === "stdio") return config.command ? "" : "stdio 缺少 command";
    return config.url ? "" : "缺少 url";
  }

  /** 按 type 创建 MCPClient：stdio 用 Experimental_StdioMCPTransport，远程用 config 形式 */
  private async createClient(config: McpServerConfig): Promise<McpConnection["client"] | null> {
    if (this.configError(config)) return null;
    try {
      if (config.type === "stdio") {
        const { Experimental_StdioMCPTransport } = await import("@ai-sdk/mcp/mcp-stdio");
        const transport = new Experimental_StdioMCPTransport({
          command: config.command!,
          args: config.args,
          env: config.env,
          cwd: config.cwd,
        });
        return await createMCPClient({ transport });
      }
      return await createMCPClient({
        transport: {
          type: config.type,
          url: config.url!,
          headers: config.headers,
        },
      });
    } catch (err) {
      this.logger.warn(
        `MCP create "${config.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async connectOne(
    config: McpServerConfig,
  ): Promise<{ client: McpConnection["client"]; toolSet: ToolSet } | null> {
    const client = await this.createClient(config);
    if (!client) return null;
    try {
      const rawToolSet = (await client.tools()) as unknown as ToolSet;
      // 命名空间：mcp_<safeId>_<toolName>，避免与内置/HTTP/其他 MCP 服务器重名
      const safeId = config.id.replace(/[^a-zA-Z0-9_]/g, "_");
      const toolSet: ToolSet = {};
      for (const [name, tool] of Object.entries(rawToolSet)) {
        toolSet[`mcp_${safeId}_${name}`] = tool;
      }
      return { client, toolSet };
    } catch (err) {
      this.logger.warn(
        `MCP tools "${config.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      return null;
    }
  }

  private async disconnect(id: string): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) return;
    try {
      await conn.client.close();
    } catch {
      /* ignore */
    }
    this.connections.delete(id);
  }

  private rebuildCache(): void {
    const toolSet: ToolSet = {};
    const meta: { name: string; description: string }[] = [];
    for (const conn of this.connections.values()) {
      for (const [name, tool] of Object.entries(conn.toolSet)) {
        toolSet[name] = tool;
        meta.push({
          name,
          description: (tool as { description?: string }).description || "",
        });
      }
    }
    this.cachedToolSet = toolSet;
    this.cachedToolMeta = meta;
  }

  async onModuleDestroy(): Promise<void> {
    for (const id of [...this.connections.keys()]) {
      await this.disconnect(id);
    }
  }
}
