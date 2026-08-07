/**
 * HTTP Webhook 工具构建器：把 HttpToolConfig 转成框架无关的 ToolDef。
 *
 * - inputs -> Zod schema
 * - execute: {{param}} 插值 url/headers/body -> fetch -> 截断返回
 *
 * 框架无关（不导入 'ai'），由 tool-bridge 转 AI SDK ToolSet。
 */
import { z } from "zod";
import type { ToolDef, ToolContext } from "../tool-def";
import type { HttpToolConfig, HttpToolInput } from "./types";

/** 从输入参数定义构建 Zod schema */
function buildInputSchema(inputs: HttpToolInput[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const inp of inputs) {
    let s: z.ZodTypeAny;
    if (inp.type === "number") s = z.number();
    else if (inp.type === "boolean") s = z.boolean();
    else s = z.string();
    if (inp.description) s = s.describe(inp.description);
    shape[inp.name] = inp.required ? s : s.optional();
  }
  return z.object(shape);
}

/** {{param}} 插值：用 input 的值替换 */
function interpolate(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    input[key] != null ? String(input[key]) : "",
  );
}

const RESPONSE_LIMIT = 4000;

/** 截断超长内容 */
function truncate(s: string): string {
  return s.length > RESPONSE_LIMIT ? s.slice(0, RESPONSE_LIMIT) + "\n...(已截断)" : s;
}

/** 点分路径取值（如 "data.items" -> obj.data.items）；路径不存在返回原 obj */
function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** 解析 HTTP 工具的执行结果：优先 JSON；responsePath 提取子字段；超长截断 */
function formatResponse(
  text: string,
  status: number,
  responsePath?: string,
): { content: string; status: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // 非 JSON，保留原文
    return { content: truncate(text), status };
  }
  const target = responsePath ? getByPath(parsed, responsePath) : parsed;
  const content =
    target === undefined
      ? `(路径 ${responsePath} 不存在)\n${truncate(JSON.stringify(parsed, null, 2))}`
      : truncate(
          typeof target === "string"
            ? target
            : JSON.stringify(target, null, 2),
        );
  return { content, status };
}

/**
 * 把一个 HTTP 工具配置构建成 ToolDef。
 * 配置非法（如 url 为空）返回 null。
 */
export function buildHttpTool(config: HttpToolConfig): ToolDef | null {
  if (!config.name || !config.url) return null;

  return {
    name: config.name,
    description: config.description || `HTTP ${config.method} 工具：${config.url}`,
    inputSchema: buildInputSchema(config.inputs),
    execute: async (input: Record<string, unknown>, _ctx: ToolContext) => {
      const url = interpolate(config.url, input);

      // headers 键值对，值插值
      const headers: Record<string, string> = {};
      if (config.headers) {
        for (const [k, v] of Object.entries(config.headers)) {
          headers[k] = interpolate(v, input);
        }
      }

      const init: RequestInit = { method: config.method, headers };
      if (config.method === "POST") {
        init.body = interpolate(config.body || "", input);
        if (headers["Content-Type"] === undefined && headers["content-type"] === undefined) {
          headers["Content-Type"] = "application/json";
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeout || 10000);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        const text = await res.text();
        return formatResponse(text, res.status, config.responsePath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: `HTTP 工具调用失败: ${msg}`, status: 0 };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
