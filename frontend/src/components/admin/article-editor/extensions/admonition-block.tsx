"use client";

/**
 * AdmonitionBlock 扩展
 * 块级警告/提示框（note/tip/warning/danger），使用 React NodeView
 * 前台渲染 HTML: <div class="admonition {type}"><div class="admonition-title">{title}</div>...</div>
 * 导出 Markdown 使用 !!!type ... !!!（见 turndown-rules / marked-extensions）
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";

type AdmonitionType = "note" | "info" | "tip" | "success" | "warning" | "danger";

interface TypeOption {
  value: AdmonitionType;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { value: "note", label: "注释", icon: "📝", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)" },
  { value: "info", label: "信息", icon: "ℹ️", color: "#6366f1", bg: "rgba(99, 102, 241, 0.08)" },
  { value: "tip", label: "提示", icon: "💡", color: "#10b981", bg: "rgba(16, 185, 129, 0.08)" },
  { value: "success", label: "成功", icon: "✅", color: "#22c55e", bg: "rgba(34, 197, 94, 0.08)" },
  { value: "warning", label: "警告", icon: "⚠️", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
  { value: "danger", label: "危险", icon: "🚨", color: "#ef4444", bg: "rgba(239, 68, 68, 0.08)" },
];

const DEFAULT_TITLES: Record<AdmonitionType, string> = {
  note: "注意",
  info: "信息",
  tip: "提示",
  success: "成功",
  warning: "警告",
  danger: "危险",
};

function getTypeOption(type: string): TypeOption {
  return TYPE_OPTIONS.find(o => o.value === type) ?? TYPE_OPTIONS[0];
}

/** 类型切换下拉 */
function TypeSelector({
  current,
  onChange,
}: {
  current: AdmonitionType;
  onChange: (t: AdmonitionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const opt = getTypeOption(current);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setOpen(!open);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 8px",
          borderRadius: "4px",
          border: "1px solid",
          borderColor: opt.color,
          background: opt.bg,
          color: opt.color,
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          lineHeight: 1.4,
        }}
        title="切换类型"
      >
        {opt.icon} {opt.label}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            background: "var(--card, #fff)",
            border: "1px solid var(--border, #e3e8f7)",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            padding: "4px",
            minWidth: "120px",
          }}
        >
          {TYPE_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={e => {
                e.stopPropagation();
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                width: "100%",
                padding: "6px 8px",
                borderRadius: "4px",
                border: "none",
                background: current === o.value ? o.bg : "transparent",
                color: current === o.value ? o.color : "var(--foreground, #333)",
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** React NodeView 组件 */
function AdmonitionBlockView({ node, updateAttributes }: NodeViewProps) {
  const [titleEditing, setTitleEditing] = useState(false);
  const adType = (node.attrs.admonitionType as AdmonitionType) || "note";
  const title = (node.attrs.title as string) || DEFAULT_TITLES[adType];
  const opt = getTypeOption(adType);

  return (
    <NodeViewWrapper className="admonition-block-wrapper my-3">
      <div
        style={{
          background: opt.bg,
          border: `1px solid color-mix(in srgb, ${opt.color} 25%, transparent)`,
          borderRadius: "8px",
          padding: "1rem",
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "0.5rem",
          }}
          contentEditable={false}
        >
          <TypeSelector
            current={adType}
            onChange={t => {
              updateAttributes({ admonitionType: t });
              if (title === DEFAULT_TITLES[adType]) {
                updateAttributes({ title: DEFAULT_TITLES[t] });
              }
            }}
          />
          {titleEditing ? (
            <input
              type="text"
              value={title}
              onChange={e => updateAttributes({ title: e.target.value })}
              onBlur={() => setTitleEditing(false)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === "Escape") setTitleEditing(false);
              }}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1,
                border: "1px solid var(--border, #e3e8f7)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "14px",
                fontWeight: 600,
                color: opt.color,
                background: "transparent",
                outline: "none",
              }}
              autoFocus
            />
          ) : (
            <span
              style={{
                fontWeight: 600,
                color: opt.color,
                cursor: "text",
                fontSize: "14px",
              }}
              onClick={() => setTitleEditing(true)}
              title="点击编辑标题"
            >
              {title}
            </span>
          )}
        </div>

        {/* 内容区 */}
        <div style={{ fontSize: "14px", lineHeight: 1.6 }}>
          <NodeViewContent className="admonition-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- 命令类型声明 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    admonitionBlock: {
      insertAdmonition: (type?: AdmonitionType, title?: string) => ReturnType;
    };
  }
}

// ---- Tiptap 扩展 ----
export const AdmonitionBlock = Node.create({
  name: "admonitionBlock",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      admonitionType: { default: "note" },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.admonition",
        contentElement: ".admonition-body",
        getAttrs: (el: HTMLElement) => {
          let adType: AdmonitionType = "note";
          for (const t of ["note", "info", "tip", "success", "warning", "danger"] as AdmonitionType[]) {
            if (el.classList.contains(t)) {
              adType = t;
              break;
            }
          }
          const titleEl = el.querySelector(".admonition-title");
          return {
            admonitionType: adType,
            title: titleEl?.textContent || "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const adType = (node.attrs.admonitionType as string) || "note";
    const title = (node.attrs.title as string) || DEFAULT_TITLES[adType as AdmonitionType] || "";

    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: `admonition ${adType}` }),
      ["div", { class: "admonition-title" }, title],
      ["div", { class: "admonition-body" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AdmonitionBlockView);
  },

  addCommands() {
    return {
      insertAdmonition:
        (type: AdmonitionType = "note", title?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              admonitionType: type,
              title: title || DEFAULT_TITLES[type],
            },
            content: [{ type: "paragraph" }],
          });
        },
    };
  },
});
