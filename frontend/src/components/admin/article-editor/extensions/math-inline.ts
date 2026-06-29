/**
 * MathInline 扩展
 * 行内 KaTeX 数学公式节点
 *
 * 功能点：
 * - 点击节点派发 `edit-math-inline` 自定义事件，由外部对话框接管编辑
 * - 支持 `$...$` 输入规则自动转换为行内公式
 * - 提供 `updateMathInlineAt` 命令用于更新指定位置的公式
 */
import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import katex from "katex";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathInline: {
      /** 插入行内公式 */
      insertMathInline: (latex?: string) => ReturnType;
      /** 更新指定位置的行内公式 */
      updateMathInlineAt: (pos: number, latex: string) => ReturnType;
    };
  }
}

/** 点击行内公式时派发的自定义事件名 */
export const MATH_INLINE_EDIT_EVENT = "edit-math-inline";

export interface MathInlineEditDetail {
  latex: string;
  pos: number;
}

export const MathInline = Node.create({
  name: "mathInline",

  group: "inline",

  inline: true,

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
      // 解析 KaTeX 行内输出（排除 display 模式）
      {
        tag: ".katex:not(.katex-display .katex)",
        getAttrs: (element: HTMLElement) => {
          const annotation =
            element.querySelector('annotation[encoding="application/x-tex"]') ||
            element.querySelector("annotation");
          if (annotation?.textContent) {
            return { latex: annotation.textContent };
          }
          return { latex: element.textContent || "" };
        },
      },
      // 解析带 data-latex 的 span
      {
        tag: "span[data-latex]",
        getAttrs: (element: HTMLElement) => ({
          latex: element.getAttribute("data-latex") || "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const latex = (node.attrs.latex as string) || "";
    const dom = document.createElement("span");
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-latex": latex,
      "data-type": "math-inline",
      class: "math-inline",
      contenteditable: "false",
    });
    Object.entries(attrs).forEach(([key, val]) => {
      if (val !== undefined && val !== null) dom.setAttribute(key, String(val));
    });
    if (latex) {
      try {
        dom.innerHTML = katex.renderToString(latex, {
          displayMode: false,
          throwOnError: false,
          output: "html",
        });
      } catch {
        dom.textContent = latex;
      }
    }
    return dom;
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("span");
      dom.className = "math-inline";
      dom.setAttribute("contenteditable", "false");
      dom.setAttribute("data-latex", (node.attrs.latex as string) || "");
      dom.setAttribute("data-type", "math-inline");
      // 可编辑模式下暴露键盘可访问性：Tab 可聚焦 + Enter/Space 触发编辑
      if (editor.isEditable) {
        dom.setAttribute("title", "点击或按 Enter 编辑行内公式");
        dom.setAttribute("role", "button");
        dom.setAttribute("tabindex", "0");
        dom.style.cursor = "pointer";
      }

      // 缓存当前渲染的 latex，避免无意义的 KaTeX 重渲染
      let currentLatex = (node.attrs.latex as string) || "";
      const renderLatex = (latex: string) => {
        try {
          dom.innerHTML = katex.renderToString(latex, {
            displayMode: false,
            throwOnError: false,
            output: "html",
          });
        } catch {
          dom.textContent = latex;
        }
      };
      renderLatex(currentLatex);

      const requestEdit = () => {
        if (!editor.isEditable) return;
        const latex = (node.attrs.latex as string) || "";
        const rawPos = typeof getPos === "function" ? getPos() : null;
        const pos = typeof rawPos === "number" ? rawPos : -1;
        editor.view.dom.dispatchEvent(
          new CustomEvent<MathInlineEditDetail>(MATH_INLINE_EDIT_EVENT, {
            bubbles: true,
            detail: { latex, pos },
          })
        );
      };

      const handleClick = (e: MouseEvent) => {
        if (!editor.isEditable) return;
        e.stopPropagation();
        e.preventDefault();
        requestEdit();
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!editor.isEditable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          requestEdit();
        }
      };
      dom.addEventListener("click", handleClick);
      dom.addEventListener("keydown", handleKeyDown);

      return {
        dom,
        contentDOM: null,
        ignoreMutation: () => true,
        update: updatedNode => {
          if (updatedNode.type !== node.type) return false;
          const nextLatex = (updatedNode.attrs.latex as string) || "";
          if (nextLatex === currentLatex) return true;
          currentLatex = nextLatex;
          dom.setAttribute("data-latex", nextLatex);
          renderLatex(nextLatex);
          return true;
        },
        destroy: () => {
          dom.removeEventListener("click", handleClick);
          dom.removeEventListener("keydown", handleKeyDown);
        },
      };
    };
  },

  addInputRules() {
    return [
      // 匹配 `$...$`：首尾字符均非空白、非 `$`，中间允许空白
      // 要求前置为行首或空白，避免 `$5 or $6 $` 这类常规文本误触发
      new InputRule({
        find: /(?:^|\s)\$([^\s$](?:[^$\n]*[^\s$])?)\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          if (!latex) return null;
          const fullMatch = match[0];
          const hasLeadingSpace = /^\s/.test(fullMatch);
          const start = hasLeadingSpace ? range.from + 1 : range.from;
          state.tr.replaceWith(start, range.to, this.type.create({ latex }));
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertMathInline:
        (latex = "") =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
      updateMathInlineAt:
        (pos, latex) =>
        ({ tr, dispatch, state }) => {
          if (pos < 0 || pos >= state.doc.content.size) return false;
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== "mathInline") return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex });
          }
          return true;
        },
    };
  },
});
