"use client";

import { useState } from "react";
import { Trash2, Plus, ChevronDown, FlaskConical } from "lucide-react";
import { Switch } from "@heroui/react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { KeyValueEditor } from "./KeyValueEditor";
import { cn } from "@/lib/utils";
import { aiToolsApi, type HttpToolConfig, type HttpToolInput } from "@/lib/api/ai-tools";

interface ExternalHttpToolEditorProps {
  tool: HttpToolConfig;
  onChange: (patch: Partial<HttpToolConfig>) => void;
  onDelete: () => void;
}

/** 生成新工具 ID */
export function newHttpToolId(): string {
  return `http_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 默认空工具配置 */
export function createEmptyHttpTool(): HttpToolConfig {
  return {
    id: newHttpToolId(),
    name: "",
    description: "",
    enabled: true,
    inputs: [],
    method: "GET",
    url: "",
    body: "",
    timeout: 10000,
  };
}

export function ExternalHttpToolEditor({ tool, onChange, onDelete }: ExternalHttpToolEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [testInput, setTestInput] = useState("{}");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const updateInput = (idx: number, patch: Partial<HttpToolInput>) => {
    const inputs = tool.inputs.map((inp, i) => (i === idx ? { ...inp, ...patch } : inp));
    onChange({ inputs });
  };
  const addInput = () => {
    onChange({ inputs: [...tool.inputs, { name: "", type: "string", description: "", required: false }] });
  };
  const removeInput = (idx: number) => {
    onChange({ inputs: tool.inputs.filter((_, i) => i !== idx) });
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(testInput || "{}");
      } catch {
        setTestResult("测试输入不是合法 JSON");
        return;
      }
      const res = await aiToolsApi.testHttpTool(tool as unknown as Record<string, unknown>, input);
      if ("error" in res) setTestResult(`错误：${res.error}`);
      else setTestResult(`状态 ${res.status}\n\n${res.content}`);
    } catch (err) {
      setTestResult(`请求失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      {/* 头部：工具名 + 启用 + 展开 + 删除 */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
        >
          <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", !expanded && "-rotate-90")} />
          <code className="text-xs font-mono text-primary truncate">
            {tool.name || "(未命名)"}
          </code>
          <span className="text-xs text-muted-foreground truncate">
            {tool.method} {tool.url || "(未设置 URL)"}
          </span>
        </button>
        <Switch
          size="sm"
          isSelected={tool.enabled}
          onValueChange={(v) => onChange({ enabled: v })}
          aria-label="启用工具"
        />
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-muted-foreground hover:text-danger rounded"
          aria-label="删除工具"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 展开后的编辑区 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-4 border-t border-border/40 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <FormInput
              label="工具名"
              value={tool.name}
              onValueChange={(v) => onChange({ name: v })}
              placeholder="如 get_weather"
              description="唯一标识，建议小写+下划线"
            />
            <FormInput
              label="描述"
              value={tool.description}
              onValueChange={(v) => onChange({ description: v })}
              placeholder="告诉 AI 这个工具做什么、何时用"
            />
            <FormSelect
              label="请求方法"
              value={tool.method}
              onValueChange={(v) => onChange({ method: v as "GET" | "POST" })}
            >
              <FormSelectItem>GET</FormSelectItem>
              <FormSelectItem>POST</FormSelectItem>
            </FormSelect>
            <FormInput
              label="超时(ms)"
              type="number"
              value={String(tool.timeout)}
              onValueChange={(v) => onChange({ timeout: parseInt(v || "10000", 10) || 10000 })}
              description="请求超时时间"
            />
          </div>

          <FormInput
            label="URL"
            value={tool.url}
            onValueChange={(v) => onChange({ url: v })}
            placeholder="https://api.example.com/data?q={{keyword}}"
            description="支持 {{param}} 插值（param 对应输入参数名）"
          />

          <KeyValueEditor
            label="Headers"
            value={tool.headers}
            onChange={(v) => onChange({ headers: v })}
            keyPlaceholder="Authorization"
            valuePlaceholder="Bearer {{token}}"
            description="值支持 {{param}} 插值"
          />

          {tool.method === "POST" && (
            <FormTextarea
              label="Body 模板"
              value={tool.body}
              onValueChange={(v) => onChange({ body: v })}
              placeholder={"{\"query\": \"{{keyword}}\"}"}
              description="POST 请求体，支持 {{param}} 插值"
              minRows={3}
            />
          )}

          <FormInput
            label="响应提取路径（可选）"
            value={tool.responsePath ?? ""}
            onValueChange={(v) => onChange({ responsePath: v || undefined })}
            placeholder="data.items"
            description="点分路径，从 JSON 响应提取子字段；留空返回整个响应"
          />

          {/* 输入参数 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground/80">输入参数</span>
              <button
                type="button"
                onClick={addInput}
                className="flex items-center gap-1 text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded"
              >
                <Plus className="w-3 h-3" />
                添加参数
              </button>
            </div>
            {tool.inputs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">无参数。工具无输入时可不加。</p>
            ) : (
              <div className="space-y-2">
                {tool.inputs.map((inp, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormInput
                        label={idx === 0 ? "参数名" : undefined}
                        value={inp.name}
                        onValueChange={(v) => updateInput(idx, { name: v })}
                        placeholder="keyword"
                      />
                    </div>
                    <div className="w-28">
                      <FormSelect
                        label={idx === 0 ? "类型" : undefined}
                        value={inp.type}
                        onValueChange={(v) => updateInput(idx, { type: v as HttpToolInput["type"] })}
                      >
                        <FormSelectItem>string</FormSelectItem>
                        <FormSelectItem>number</FormSelectItem>
                        <FormSelectItem>boolean</FormSelectItem>
                      </FormSelect>
                    </div>
                    <div className="flex-1">
                      <FormInput
                        label={idx === 0 ? "描述" : undefined}
                        value={inp.description}
                        onValueChange={(v) => updateInput(idx, { description: v })}
                        placeholder="搜索关键词"
                      />
                    </div>
                    <div className="flex flex-col items-center pb-2">
                      {idx === 0 && <span className="text-[10px] text-muted-foreground mb-1">必填</span>}
                      <Switch
                        size="sm"
                        isSelected={inp.required}
                        onValueChange={(v) => updateInput(idx, { required: v })}
                        aria-label="必填"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeInput(idx)}
                      className="p-1 pb-2 text-muted-foreground hover:text-danger"
                      aria-label="删除参数"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 测试 */}
          <div className="rounded-md border border-border/40 bg-background/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">测试工具</span>
            </div>
            <FormTextarea
              label="测试输入（JSON）"
              value={testInput}
              onValueChange={setTestInput}
              placeholder={"{\"keyword\": \"hello\"}"}
              minRows={2}
            />
            <button
              type="button"
              onClick={runTest}
              disabled={testing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {testing ? "测试中..." : "执行测试"}
            </button>
            {testResult && (
              <pre className="text-xs text-muted-foreground bg-muted/40 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                {testResult}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
