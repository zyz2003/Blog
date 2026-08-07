/**
 * @ai-sdk/mcp/mcp-stdio 子路径类型 shim。
 *
 * 主入口 `@ai-sdk/mcp` 有顶层 types 字段，moduleResolution=node 能解析；
 * 但 `./mcp-stdio` 子路径只在 exports 字段里（moduleResolution=node 不读），
 * tsc 找不到类型。这里声明为可用类型，运行时由 Node 按 exports 解析。
 */
declare module "@ai-sdk/mcp/mcp-stdio" {
  import type { MCPTransport } from "@ai-sdk/mcp";
  export interface StdioConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
  }
  // 构造签名返回 MCPTransport（运行时 Experimental_StdioMCPTransport 实现了它）
  export const Experimental_StdioMCPTransport: new (
    server: StdioConfig,
  ) => MCPTransport & { close(): Promise<void> };
}
