/**
 * 外部工具配置类型（存 settings JSON，与 ai_profiles 同模式）。
 *
 * 两类：
 * - HTTP Webhook 工具：配置 URL/方法/参数/headers/body，AI 调用时后端发 HTTP。
 * - MCP 服务器：对齐市面 mcpServers 标准（stdio command/args/env 或 远程 type/url/headers）。
 */

/** HTTP 工具的单个输入参数 */
export interface HttpToolInput {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

/** HTTP Webhook 工具配置 */
export interface HttpToolConfig {
  id: string;
  /** 工具名（唯一，作为 tool id；建议小写+下划线） */
  name: string;
  description: string;
  enabled: boolean;
  inputs: HttpToolInput[];
  method: "GET" | "POST";
  /** URL，支持 {{param}} 插值 */
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

/** 归一化 Record<string,string>（headers/env 用），空对象返回 undefined */
function normalizeStringRecord(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      result[k] = String(v);
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** 归一化解析 HTTP 工具配置（容错：字段缺失给默认值） */
export function normalizeHttpToolConfig(raw: Record<string, unknown>): HttpToolConfig {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    enabled: raw.enabled !== false,
    inputs: Array.isArray(raw.inputs)
      ? raw.inputs
          .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
          .map((i) => ({
            name: String(i.name ?? ""),
            type: (i.type === "number" || i.type === "boolean" ? i.type : "string") as
              | "string"
              | "number"
              | "boolean",
            description: String(i.description ?? ""),
            required: i.required === true,
          }))
      : [],
    method: raw.method === "POST" ? "POST" : "GET",
    url: String(raw.url ?? ""),
    headers: normalizeStringRecord(raw.headers),
    body: typeof raw.body === "string" ? raw.body : "",
    responsePath:
      typeof raw.responsePath === "string" && raw.responsePath.trim()
        ? raw.responsePath.trim()
        : undefined,
    timeout: typeof raw.timeout === "number" ? raw.timeout : 10000,
  };
}

/** 归一化解析 MCP 服务器配置 */
export function normalizeMcpServerConfig(raw: Record<string, unknown>): McpServerConfig {
  const type = raw.type === "stdio" || raw.type === "sse" ? raw.type : "http";
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    enabled: raw.enabled !== false,
    type,
    command: typeof raw.command === "string" ? raw.command : undefined,
    args: Array.isArray(raw.args)
      ? raw.args.filter((a): a is string => typeof a === "string")
      : undefined,
    env: normalizeStringRecord(raw.env),
    cwd: typeof raw.cwd === "string" ? raw.cwd : undefined,
    url: typeof raw.url === "string" ? raw.url : undefined,
    headers: normalizeStringRecord(raw.headers),
  };
}
