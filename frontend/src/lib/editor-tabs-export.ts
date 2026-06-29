/**
 * 将编辑器中的 tabsBlock 导出为 :::tabs Markdown。
 * 避免仅用 Turndown 解析整页 HTML 时，隐藏标签面板 innerHTML 不完整导致 tab 正文丢失。
 */
import type { Editor } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import type TurndownService from "turndown";

/**
 * 按文档顺序收集每个 tabsBlock 对应的 Markdown 片段（含 :::tabs 包裹）。
 */
export function serializeDocTabsBlocksToMarkdown(editor: Editor, turndown: TurndownService): string[] {
  const { doc, schema } = editor.state;
  const serializer = DOMSerializer.fromSchema(schema);
  const chunks: string[] = [];

  doc.descendants(node => {
    if (node.type.name !== "tabsBlock") return true;

    const panelCount = node.childCount;
    const rawIdx = parseInt(String(node.attrs.activeIndex ?? "0"), 10);
    const safeIdx =
      panelCount > 0 ? Math.min(Math.max(0, Number.isNaN(rawIdx) ? 0 : rawIdx), panelCount - 1) : 0;

    let md = `\n:::tabs active=${safeIdx + 1}\n`;
    node.content.forEach((panel, _offset, idx) => {
      const title = String(panel.attrs?.title ?? `标签 ${idx + 1}`);
      const fragment = serializer.serializeFragment(panel.content);
      const host = document.createElement("div");
      host.appendChild(fragment);
      const body = turndown.turndown(host.innerHTML).trim();
      md += `== tab ${title}\n${body}\n\n`;
    });
    md += ":::\n\n";
    chunks.push(md);
    return true;
  });

  return chunks;
}

/**
 * 将 HTML 中的每个 .tabs 节点替换为占位 div，内嵌已算好的 Markdown 文本，供 Turndown 专用规则原样输出。
 */
export function prepareHtmlForTabsTurndown(html: string, tabMarkdownPieces: string[]): string {
  if (!html || tabMarkdownPieces.length === 0 || typeof document === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const tabsEls = Array.from(doc.querySelectorAll<HTMLElement>(".tabs"));
  if (tabsEls.length !== tabMarkdownPieces.length) {
    return html;
  }

  for (let i = 0; i < tabsEls.length; i++) {
    const ph = doc.createElement("div");
    ph.className = "tabs-turndown-source";
    ph.textContent = tabMarkdownPieces[i];
    tabsEls[i].parentNode?.replaceChild(ph, tabsEls[i]);
  }

  return doc.body.innerHTML;
}

/**
 * 可视化模式下将处理后的 HTML 转为 Markdown：优先用文档树导出标签页，再对其余内容走 Turndown。
 *
 * 使用唯一文本标记代替直接嵌入 Markdown 文本，避免 Turndown 对 <div> 内文本节点
 * 进行 HTML 空白折叠（将换行符替换为空格）而破坏 Markdown 格式。
 */
export function turndownArticleMarkdown(
  editor: Editor | null | undefined,
  turndown: TurndownService,
  processedHtml: string
): string {
  if (typeof document === "undefined") {
    return turndown.turndown(processedHtml);
  }
  if (!editor || editor.isDestroyed) {
    return turndown.turndown(processedHtml);
  }

  const pieces = serializeDocTabsBlocksToMarkdown(editor, turndown);
  if (pieces.length === 0) {
    return turndown.turndown(processedHtml);
  }

  const ts = Date.now();
  const markers = pieces.map((_, i) => `ANHEYU_TABS_MARKER_${i}_${ts}`);
  const prepared = prepareHtmlForTabsTurndown(processedHtml, markers);
  let md = turndown.turndown(prepared);

  for (let i = 0; i < markers.length; i++) {
    md = md.replace(markers[i], pieces[i].trim());
  }

  return md;
}
