"use client";

import { useState } from "react";
import { Trash2, FlaskConical } from "lucide-react";
import { Switch } from "@heroui/react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { KeyValueEditor } from "./KeyValueEditor";
import { aiToolsApi, type McpServerConfig } from "@/lib/api/ai-tools";

interface ExternalMcpServerEditorProps {
  server: McpServerConfig;
  onChange: (patch: Partial<McpServerConfig>) => void;
  onDelete: () => void;
}

export function newMcpServerId(): string {
  return `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createEmptyMcpServer(): McpServerConfig {
  return {
    id: newMcpServerId(),
    name: "",
    type: "http",
    url: "",
    enabled: true,
  };
}

export function ExternalMcpServerEditor({
  server,
  onChange,
  onDelete,
}: ExternalMcpServerEditorProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const isStdio = server.type === "stdio";

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await aiToolsApi.testMcpServer(
        server as unknown as Record<string, unknown>,
      );
      if ("error" in res) {
        setResult(`错误：${res.error}`);
      } else {
        setResult(
          res.tools.length === 0
            ? "连接成功，但未发现工具"
            : `发现 ${res.tools.length} 个工具：\n${res.tools
                .map((t) => `- ${t.name}：${t.description}`)
                .join("\n")}`,
        );
      }
    } catch (err) {
      setResult(`请求失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  const argsText = (server.args ?? []).join("\n");
  const setArgs = (text: string) => {
    const args = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ args: args.length ? args : undefined });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Switch
          size="sm"
          isSelected={server.enabled}
          onValueChange={(v) => onChange({ enabled: v })}
          aria-label="启用服务器"
        />
        <span className="text-xs font-mono text-primary flex-1 truncate">
          {server.name || "(未命名)"}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {server.type}
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-muted-foreground hover:text-danger rounded"
          aria-label="删除服务器"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        <FormInput
          label="名称"
          value={server.name}
          onValueChange={(v) => onChange({ name: v })}
          placeholder="如 my-mcp-server"
          description="= mcpServers 的 key"
        />
        <FormSelect
          label="传输类型"
          value={server.type}
          onValueChange={(v) => onChange({ type: v as McpServerConfig["type"] })}
          description="http 轻量推荐；stdio 会起子进程（需环境内有可执行文件）"
        >
          <FormSelectItem>http（推荐）</FormSelectItem>
          <FormSelectItem>sse</FormSelectItem>
          <FormSelectItem>stdio（重·子进程）</FormSelectItem>
        </FormSelect>
      </div>

      {isStdio ? (
        <>
          <FormInput
            label="command"
            value={server.command ?? ""}
            onValueChange={(v) => onChange({ command: v || undefined })}
            placeholder="npx / node / python"
          />
          <FormTextarea
            label="args（每行一个）"
            value={argsText}
            onValueChange={setArgs}
            placeholder={"-y\n@modelcontextprotocol/server-github"}
            minRows={2}
          />
          <KeyValueEditor
            label="env"
            value={server.env}
            onChange={(v) => onChange({ env: v })}
            keyPlaceholder="ENV_VAR"
            valuePlaceholder="value"
          />
          <FormInput
            label="cwd（可选）"
            value={server.cwd ?? ""}
            onValueChange={(v) => onChange({ cwd: v || undefined })}
            placeholder="工作目录"
          />
        </>
      ) : (
        <>
          <FormInput
            label="URL"
            value={server.url ?? ""}
            onValueChange={(v) => onChange({ url: v || undefined })}
            placeholder="https://example.com/mcp"
          />
          <KeyValueEditor
            label="headers"
            value={server.headers}
            onChange={(v) => onChange({ headers: v })}
            keyPlaceholder="Authorization"
            valuePlaceholder="Bearer ..."
          />
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runTest}
          disabled={testing || (isStdio ? !server.command : !server.url)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          {testing ? "测试中..." : "测试连接"}
        </button>
        {result && (
          <pre className="flex-1 text-xs text-muted-foreground bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}
