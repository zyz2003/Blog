"use client";

import { Plus, Trash2 } from "lucide-react";

interface KeyValueEditorProps {
  label?: string;
  value: Record<string, string> | undefined;
  onChange: (v: Record<string, string> | undefined) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  description?: string;
}

/** 键值对编辑器（headers/env 用），空时存 undefined */
export function KeyValueEditor({
  label,
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  description,
}: KeyValueEditorProps) {
  const entries = Object.entries(value ?? {});

  const commit = (list: [string, string][]) => {
    const obj: Record<string, string> = {};
    for (const [k, v] of list) {
      const key = k.trim();
      if (key) obj[key] = v;
    }
    onChange(Object.keys(obj).length ? obj : undefined);
  };

  const update = (idx: number, patch: Partial<{ k: string; v: string }>) => {
    commit(
      entries.map(([k, v], i) =>
        i === idx ? [patch.k ?? k, patch.v ?? v] : [k, v],
      ) as [string, string][],
    );
  };

  return (
    <div>
      {label && (
        <label className="text-xs font-medium text-foreground/80 mb-1.5 block">
          {label}
        </label>
      )}
      {description && (
        <p className="text-[11px] text-muted-foreground mb-1.5">{description}</p>
      )}
      <div className="space-y-1.5">
        {entries.map(([k, v], idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              type="text"
              value={k}
              onChange={(e) => update(idx, { k: e.target.value })}
              placeholder={keyPlaceholder}
              className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-border bg-background"
            />
            <input
              type="text"
              value={v}
              onChange={(e) => update(idx, { v: e.target.value })}
              placeholder={valuePlaceholder}
              className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-border bg-background"
            />
            <button
              type="button"
              onClick={() => commit(entries.filter((_, i) => i !== idx) as [string, string][])}
              className="p-1 text-muted-foreground hover:text-danger"
              aria-label="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => commit([...entries, ["", ""]])}
        className="flex items-center gap-1 mt-1.5 text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded"
      >
        <Plus className="w-3 h-3" />
        添加
      </button>
    </div>
  );
}
