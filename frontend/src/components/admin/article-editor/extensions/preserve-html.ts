/**
 * PreserveHTML 扩展
 * 保留复杂 HTML 结构（画廊、视频画廊等），在编辑器中以不可编辑块显示
 * 参考 anheyu-app FrontendEditor/extensions/PreserveHTML.ts
 */
import { Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const PreserveHTML = Node.create({
  name: "preserveHTML",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      html: {
        default: "",
        parseHTML: (element: HTMLElement) => element.outerHTML,
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-html": attributes.html as string,
        }),
      },
    };
  },

  parseHTML() {
    // 注意：gallery-container, video-gallery-container, markdown-music-player,
    // btns-container, tabs, folding-tag, anzhiyu-tag-link, hide-block
    // 现在由各自的专用 Node 扩展处理。
    // PreserveHTML 仅作为最后的兜底，处理未被专用 Node 匹配到的复杂 HTML。
    return [
      // 恢复已保存的 preserve-html-wrapper
      {
        tag: "div.preserve-html-wrapper[data-html]",
        priority: 100,
        getAttrs: (element: HTMLElement) => {
          const html = element.getAttribute("data-html");
          return html ? { html } : false;
        },
      },
      // details.md-editor-code 必须由 createEnhancedCodeBlock 解析（其 parse 规则默认 priority 50）；
      // 若在此用更高 priority 兜底，会整块变成 preserveHTML「嵌入内容」，代码块样式丢失。
      // 前台已渲染的 Mermaid（p 内嵌 SVG），避免被当成普通段落拆解析
      {
        tag: "p.md-editor-mermaid",
        priority: 88,
        getAttrs: (element: HTMLElement) => ({ html: element.outerHTML }),
      },
    ];
  },

  renderHTML({ node }) {
    const html = (node.attrs.html as string) || "";
    // atom 节点不得使用内容孔 `0`，否则 editor.getHTML() 会抛 Content hole not allowed in a leaf node spec
    return [
      "div",
      {
        "data-preserve-html": "true",
        class: "preserve-html-wrapper",
        "data-html": html,
      },
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "preserve-html-wrapper";
      dom.setAttribute("contenteditable", "false");
      dom.setAttribute("data-preserve-html", "true");

      // 插入原始 HTML 以显示预览
      const html = (node.attrs.html as string) || "";
      dom.innerHTML = html;

      // 添加选中时的视觉提示
      dom.style.cursor = "default";
      dom.style.position = "relative";

      return {
        dom,
        contentDOM: null,
        ignoreMutation: () => true,
      };
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("preserveHTMLPlugin"),
        props: {
          handleDOMEvents: {
            mousedown: (_view, event) => {
              const target = event.target as HTMLElement;
              const preserveNode = target.closest(".preserve-html-wrapper");
              if (preserveNode) {
                event.preventDefault();
                return true;
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
