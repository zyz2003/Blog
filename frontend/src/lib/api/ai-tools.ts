/**
 * AI 工具 API -- 拉取已注册的 AI 工具列表 + 测试外部 HTTP 工具。
 */
import { apiClient } from "./client";

export interface AiTool {
  name: string;
  description: string;
}

/** HTTP 工具的单个输入参数 */
export interface HttpToolInput {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

/** HTTP Webhook 工具配置（与后端 external/types.ts 一致） */
export interface HttpToolConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  inputs: HttpToolInput[];
  method: "GET" | "POST";
  url: string;
  /** headers 键值对，值支持 {{param}} 插值 */
  headers?: Record<string, string>;
  /** body 模板（POST），支持 {{param}} 插值 */
  body: string;
  /** 响应提取路径（点分，如 data.items），留空返回整个响应 */
  responsePath?: string;
  /** 超时 ms */
  timeout: number;
}

/** MCP 服务器配置（对齐市面 mcpServers 标准） */
export interface McpServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  /** 传输类型：stdio=本地命令（重），http=StreamableHTTP（推荐），sse=SSE（旧） */
  type: "stdio" | "sse" | "http";
  // stdio 字段
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // 远程字段
  url?: string;
  headers?: Record<string, string>;
}

export interface HttpToolTestResult {
  content: string;
  status: number;
}

export interface McpTestResult {
  tools: { name: string; description: string }[];
}

export const aiToolsApi = {
  list(): Promise<AiTool[]> {
    return apiClient.get<AiTool[]>("/api/ai/tools").then((res) => res.data);
  },
  /** 测试一个 HTTP 工具配置（用示例输入执行一次） */
  testHttpTool(
    config: Record<string, unknown>,
    input: Record<string, unknown>,
  ): Promise<HttpToolTestResult | { error: string }> {
    return apiClient
      .post<HttpToolTestResult | { error: string }>("/api/ai/tools/http/test", {
        config,
        input,
      })
      .then((res) => res.data);
  },
  /** 测试一个 MCP 服务器配置（连接 + 列出工具） */
  testMcpServer(
    config: Record<string, unknown>,
  ): Promise<McpTestResult | { error: string }> {
    return apiClient
      .post<McpTestResult | { error: string }>("/api/ai/tools/mcp/test", { config })
      .then((res) => res.data);
  },
};
