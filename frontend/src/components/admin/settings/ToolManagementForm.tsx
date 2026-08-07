"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addToast } from "@heroui/react";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import { Wrench, Plus, Upload } from "lucide-react";
import { FormTextarea } from "@/components/ui/form-textarea";
import { aiToolsApi, type HttpToolConfig, type McpServerConfig } from "@/lib/api/ai-tools";
import { KEY_AI_EXTERNAL_TOOLS, KEY_AI_MCP_SERVERS } from "@/lib/settings/setting-keys";
import {
  ExternalHttpToolEditor,
  createEmptyHttpTool,
} from "./ExternalHttpToolEditor";
import {
  ExternalMcpServerEditor,
  createEmptyMcpServer,
} from "./ExternalMcpServerEditor";

interface ToolManagementFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

/** 解析标准 mcpServers JSON（兼容 { mcpServers: {...} } / 裸对象 / 经典推断式 / 现代 type 式） */
function parseMcpServersJson(text: string): {
  servers: McpServerConfig[];
  error?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { servers: [], error: "JSON 解析失败" };
  }
  const obj = (parsed as { mcpServers?: Record<string, unknown> })?.mcpServers ?? parsed;
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { servers: [], error: "需要 { mcpServers: {...} } 或服务器对象" };
  }
  const servers: McpServerConfig[] = [];
  for (const [name, cfgRaw] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof cfgRaw !== "object" || cfgRaw === null) continue;
    const c = cfgRaw as Record<string, unknown>;
    let type: McpServerConfig["type"] = "http";
    if (c.type === "stdio" || c.type === "sse") type = c.type;
    else if (c.type === "streamableHttp" || c.type === "http") type = "http";
    else if (typeof c.command === "string") type = "stdio";
    const stringRec = (v: unknown): Record<string, string> | undefined => {
      if (!v || typeof v !== "object") return undefined;
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          out[k] = String(val);
        }
      }
      return Object.keys(out).length ? out : undefined;
    };
    servers.push({
      id: `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      enabled: c.disabled !== true,
      type,
      command: typeof c.command === "string" ? c.command : undefined,
      args: Array.isArray(c.args)
        ? c.args.filter((a): a is string => typeof a === "string")
        : undefined,
      env: stringRec(c.env),
      cwd: typeof c.cwd === "string" ? c.cwd : undefined,
      url: typeof c.url === "string" ? c.url : undefined,
      headers: stringRec(c.headers),
    });
  }
  return { servers };
}

export function ToolManagementForm({ values, onChange, loading }: ToolManagementFormProps) {
  const { data: tools, isLoading } = useQuery({
    queryKey: ["ai-tools"],
    queryFn: () => aiToolsApi.list(),
    staleTime: 1000 * 60 * 10,
  });

  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const httpTools: HttpToolConfig[] = useMemo(() => {
    try {
      const raw = values[KEY_AI_EXTERNAL_TOOLS];
      if (!raw?.trim()) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (t): t is HttpToolConfig => typeof t === "object" && t !== null,
      );
    } catch {
      return [];
    }
  }, [values[KEY_AI_EXTERNAL_TOOLS]]);

  const mcpServers: McpServerConfig[] = useMemo(() => {
    try {
      const raw = values[KEY_AI_MCP_SERVERS];
      if (!raw?.trim()) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (s): s is McpServerConfig => typeof s === "object" && s !== null,
      );
    } catch {
      return [];
    }
  }, [values[KEY_AI_MCP_SERVERS]]);

  const updateHttpTools = (list: HttpToolConfig[]) =>
    onChange(KEY_AI_EXTERNAL_TOOLS, JSON.stringify(list));
  const addHttpTool = () => updateHttpTools([...httpTools, createEmptyHttpTool()]);
  const updateHttpTool = (id: string, patch: Partial<HttpToolConfig>) =>
    updateHttpTools(httpTools.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const deleteHttpTool = (id: string) =>
    updateHttpTools(httpTools.filter((t) => t.id !== id));

  const updateMcpServers = (list: McpServerConfig[]) =>
    onChange(KEY_AI_MCP_SERVERS, JSON.stringify(list));
  const addMcpServer = () => updateMcpServers([...mcpServers, createEmptyMcpServer()]);
  const updateMcpServer = (id: string, patch: Partial<McpServerConfig>) =>
    updateMcpServers(mcpServers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const deleteMcpServer = (id: string) =>
    updateMcpServers(mcpServers.filter((s) => s.id !== id));

  const handleImport = () => {
    const { servers, error } = parseMcpServersJson(importText);
    if (error) {
      addToast({ title: "导入失败", description: error, color: "danger" });
      return;
    }
    if (servers.length === 0) {
      addToast({ title: "未发现服务器", color: "warning" });
      return;
    }
    updateMcpServers([...mcpServers, ...servers]);
    setImportText("");
    setImportOpen(false);
    addToast({
      title: `已导入 ${servers.length} 个 MCP 服务器`,
      color: "success",
    });
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const toolCount = (tools ?? []).length;

  return (
    <div className="space-y-8">
      {/* 已注册工具（可折叠，折叠时显示数量摘要） */}
      <SettingsSection
        collapsible
        defaultCollapsed
        title="已注册工具"
        subtitle={`${toolCount} 个工具可用（内置 + 已启用的外部）`}
        description="系统当前可用的 AI 工具（内置 + 已启用的 HTTP/MCP 外部工具）。AI 对话和写作在各自设置页选择启用哪些。"
      >
        <div className="space-y-2">
          {(tools ?? []).map((tool) => (
            <div
              key={tool.name}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/60 bg-muted/30"
            >
              <Wrench className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <code className="text-xs font-mono text-primary">{tool.name}</code>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {tool.description}
                </p>
              </div>
            </div>
          ))}
          {toolCount === 0 && (
            <p className="text-sm text-muted-foreground py-2">暂无已注册工具。</p>
          )}
        </div>
      </SettingsSection>

      {/* HTTP Webhook 工具 */}
      <SettingsSection
        collapsible
        title="HTTP 工具"
        subtitle={`${httpTools.length} 个 HTTP 工具`}
        description="配置自定义 HTTP 工具：AI 调用时后端按配置发 HTTP 请求并返回结果。支持 {{param}} 插值、响应路径提取。"
      >
        <div className="space-y-3">
          {httpTools.map((tool) => (
            <ExternalHttpToolEditor
              key={tool.id}
              tool={tool}
              onChange={(patch) => updateHttpTool(tool.id, patch)}
              onDelete={() => deleteHttpTool(tool.id)}
            />
          ))}
          {httpTools.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              暂无 HTTP 工具。点击下方添加。
            </p>
          )}
          <button
            type="button"
            onClick={addHttpTool}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/40 text-primary hover:bg-primary/10"
          >
            <Plus className="w-3.5 h-3.5" />
            添加 HTTP 工具
          </button>
        </div>
      </SettingsSection>

      {/* MCP 服务器 */}
      <SettingsSection
        collapsible
        title="MCP 服务器"
        subtitle={`${mcpServers.length} 个 MCP 服务器`}
        description="连接 MCP 服务器（stdio / http / sse），自动发现并代理工具。标准 mcpServers 格式，支持 JSON 导入。配置后下一个请求生效。"
      >
        <div className="space-y-3">
          {/* JSON 导入 */}
          <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
            <button
              type="button"
              onClick={() => setImportOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/10 px-2 py-1 rounded"
            >
              <Upload className="w-3.5 h-3.5" />
              导入 mcpServers JSON（Claude Desktop / Cursor 配置）
            </button>
            {importOpen && (
              <>
                <FormTextarea
                  value={importText}
                  onValueChange={setImportText}
                  placeholder={'{\n  "mcpServers": {\n    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "..." } },\n    "remote": { "type": "http", "url": "https://..." }\n  }\n}'}
                  minRows={6}
                />
                <button
                  type="button"
                  onClick={handleImport}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  追加导入
                </button>
              </>
            )}
          </div>

          {mcpServers.map((server) => (
            <ExternalMcpServerEditor
              key={server.id}
              server={server}
              onChange={(patch) => updateMcpServer(server.id, patch)}
              onDelete={() => deleteMcpServer(server.id)}
            />
          ))}
          {mcpServers.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              暂无 MCP 服务器。可导入 JSON 或点击下方添加。
            </p>
          )}
          <button
            type="button"
            onClick={addMcpServer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/40 text-primary hover:bg-primary/10"
          >
            <Plus className="w-3.5 h-3.5" />
            添加 MCP 服务器
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
