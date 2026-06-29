/**
 * MathBlock 扩展
 * 块级 KaTeX 数学公式节点
 *
 * 功能点：
 * - React NodeView 支持点击"编辑"按钮/公式区域进行原地编辑
 * - 支持 `$$...$$` 输入规则自动转换为块级公式
 * - 提供 `updateMathBlockAt` 命令用于更新指定位置的公式
 */
import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useState, useCallback, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";

// ---- React NodeView 组件 ----
function MathBlockView({ node, updateAttributes }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const latex = (node.attrs.latex as string) || "";
  const [editValue, setEditValue] = useState(latex);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    updateAttributes({ latex: editValue });
    setIsEditing(false);
  }, [editValue, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        setEditValue(latex);
        setIsEditing(false);
      }
    },
    [handleSave, latex]
  );

  if (isEditing) {
    return (
      <NodeViewWrapper className="math-block-wrapper">
        <div className="math-block-editor border border-primary/30 rounded-lg p-3 bg-muted/20">
          <div className="text-xs text-muted-foreground mb-2 font-mono">LaTeX 公式（Ctrl+Enter 保存，Esc 取消）</div>
          <textarea
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="w-full min-h-[60px] p-2 font-mono text-sm bg-background border border-border rounded resize-y outline-none focus:border-primary"
            placeholder="输入 LaTeX 公式..."
          />
        </div>
      </NodeViewWrapper>
    );
  }

  // 渲染公式
  let renderedHtml = "";
  try {
    renderedHtml = katex.renderToString(latex, {
      displayMode: true,
      throwOnError: false,
      output: "html",
    });
  } catch {
    renderedHtml = `<span class="text-danger text-sm">公式渲染错误: ${latex}</span>`;
  }

  return (
    <NodeViewWrapper className="math-block-wrapper">
      <div className="editor-node-hover-wrap" contentEditable={false}>
        <div
          className="editor-node-edit-btn"
          onClick={e => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          contentEditable={false}
        >
          <Pencil /> 编辑
        </div>
        <div
          className="math-block-display cursor-pointer py-4 text-center transition-colors rounded-lg"
          onClick={() => setIsEditing(true)}
          title="点击编辑公式"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </NodeViewWrapper>
  );
}

// ---- Tiptap 扩展 ----

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathBlock: {
      /** 插入块级公式 */
      insertMathBlock: (latex?: string) => ReturnType;
      /** 更新指定位置的块级公式 */
      updateMathBlockAt: (pos: number, latex: string) => ReturnType;
    };
  }
}

export const MathBlock = Node.create({
  name: "mathBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      // 解析 KaTeX display 模式输出
      {
        tag: ".katex-display",
        getAttrs: (element: HTMLElement) => {
          // 尝试从 annotation 中提取原始 LaTeX（后端净化可能去掉 encoding 属性）
          const annotation =
            element.querySelector('annotation[encoding="application/x-tex"]') ||
            element.querySelector("annotation");
          if (annotation?.textContent) {
            return { latex: annotation.textContent };
          }
          return { latex: element.textContent || "" };
        },
      },
      // 解析带 data-latex 的 div
      {
        tag: "div[data-latex]",
        getAttrs: (element: HTMLElement) => ({
          latex: element.getAttribute("data-latex") || "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const latex = (node.attrs.latex as string) || "";
    const el = document.createElement("div");
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-latex": latex,
      "data-type": "math-block",
      class: "math-block",
    });
    Object.entries(attrs).forEach(([key, val]) => {
      if (val !== undefined && val !== null) el.setAttribute(key, String(val));
    });
    if (latex) {
      try {
        el.innerHTML = katex.renderToString(latex, {
          displayMode: true,
          throwOnError: false,
          output: "html",
        });
      } catch {
        /* initKatex on detail page will handle fallback */
      }
    }
    return el;
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },

  addInputRules() {
    return [
      // 匹配 `$$...$$`：内容非空、不含 `$` 与换行
      // 仅当当前段落恰好是 `$$...$$`（match 从段落开头开始、光标位于段落末尾）时才触发，
      // 避免在段落中间插入块级节点导致结构被切分
      //
      // 注意：InputRule handler 调用时，`text`（即最后输入的字符）尚未应用到 doc，
      // 所以不能直接用 parent.textContent === match[0] 来判断，必须依赖 parentOffset。
      new InputRule({
        find: /\$\$([^$\n]+?)\$\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1]?.trim();
          if (!latex) return null;

          const $from = state.doc.resolve(range.from);
          const $to = state.doc.resolve(range.to);
          const parent = $from.parent;
          // 仅在普通 textBlock（段落、标题等）中触发
          if (!parent.isTextblock) return null;
          // 不在同一段落则跳过
          if (!$from.sameParent($to)) return null;
          // match 必须从段落开头开始
          if ($from.parentOffset !== 0) return null;
          // 光标（range.to）必须位于段落末尾 —— 即当前段落只包含 `$$...$`
          if ($to.parentOffset !== parent.content.size) return null;

          // 替换整个段落节点为 mathBlock
          state.tr.replaceRangeWith($from.before(), $from.after(), this.type.create({ latex }));
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex = "") =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
      updateMathBlockAt:
        (pos, latex) =>
        ({ tr, dispatch, state }) => {
          if (pos < 0 || pos >= state.doc.content.size) return false;
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== "mathBlock") return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex });
          }
          return true;
        },
    };
  },
});
