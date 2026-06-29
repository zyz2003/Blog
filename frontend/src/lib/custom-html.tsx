import type { ReactNode } from "react";
import type { Element as DomElement } from "domhandler";
import { ElementType, isTag } from "domelementtype";
import parse, { type DOMNode } from "html-react-parser";

// 允许出现在 <head> 中的标签集合。
// 管理员配置 CUSTOM_HEADER_HTML 时，非白名单标签会被静默过滤，
// 避免攻击者借助错放到 head 的节点（如 iframe）形成滥用。
const HEAD_ALLOWED_TAGS = new Set(["meta", "link", "script", "style", "base", "title", "noscript"]);

// 这些 head 标签的子节点应为原始文本（CSS/JS/标题），不能用空节点替换，
// 否则 html-react-parser 的 replace 会把 <style> 内文本当成「多余节点」清空。
const HEAD_TAGS_WITH_RAW_TEXT_CHILD = new Set(["style", "script", "title", "noscript"]);

// body 末尾（footer 注入）禁止的事件属性；全部事件 handler 一律拒绝，
// 避免管理员配置被绕过时直接 on* 注入执行任意脚本。
// 允许 <script> / <style> 存在（本来就是 admin-only 信任边界功能），
// 但禁止任何 on* 内联属性以及 javascript: 协议。
const DANGEROUS_EVENT_ATTR = /^on/i;
const DANGEROUS_URL_ATTR = new Set(["href", "src", "action", "formaction"]);
const DANGEROUS_URL_PROTOCOL = /^\s*javascript:/i;

const INVALID_OPEN_BRACKET_REGEX = /[‹＜]\s*(?=(?:\/)?[a-zA-Z!])/g;

/**
 * normalizeCustomHtml 把富文本编辑器常见的全角/兼容尖括号归一为 ASCII <，
 * 并统一换行符，防止管理员粘贴时因中文输入法把 `<` 误打成 `‹/＜` 导致 meta 不生效。
 */
export function normalizeCustomHtml(html: string): string {
  return html.replace(/\r\n/g, "\n").replace(INVALID_OPEN_BRACKET_REGEX, "<").trim();
}

/**
 * renderCustomHeadHtml 渲染 <head> 自定义片段。
 * - 非白名单标签直接丢弃（返回空 fragment）。
 * - 非元素节点（纯文本 / 注释 / doctype）也丢弃，避免多余文本节点被注入 head。
 */
export function renderCustomHeadHtml(html: string): ReactNode {
  const normalizedHtml = normalizeCustomHtml(html);
  if (!normalizedHtml) {
    return null;
  }

  return parse(normalizedHtml, {
    trim: true,
    replace(domNode: DOMNode) {
      // 使用 isTag / type 判别，避免 instanceof 与解析器实际节点类不一致（双份 domhandler 时全被丢弃）
      if (isTag(domNode)) {
        const el = domNode as DomElement;
        return HEAD_ALLOWED_TAGS.has(el.name) ? undefined : <></>;
      }
      if (domNode.type === ElementType.Text) {
        const parent = domNode.parent;
        if (parent && isTag(parent)) {
          const p = parent as DomElement;
          if (HEAD_TAGS_WITH_RAW_TEXT_CHILD.has(p.name)) {
            return undefined;
          }
        }
      }
      return <></>;
    },
  });
}

/**
 * renderCustomBodyHtml 渲染 body 末尾自定义片段。
 * 与 head 不同，这里允许常规 HTML 元素，但强制剥离：
 *   - 任何 on* 事件属性（onclick/onerror/onload ...）
 *   - href/src/action/formaction 属性中以 javascript: 开头的值
 * 这是 admin 信任边界下的"深度防御"：即使后端配置被篡改，
 * 前端也不让内联事件属性 / javascript: 协议生效。
 */
export function renderCustomBodyHtml(html: string): ReactNode {
  const normalizedHtml = normalizeCustomHtml(html);
  if (!normalizedHtml) {
    return null;
  }

  return parse(normalizedHtml, {
    trim: false,
    replace(domNode: DOMNode) {
      if (!isTag(domNode)) {
        return;
      }
      const attribs = (domNode as DomElement).attribs;
      if (!attribs) {
        return;
      }
      for (const name of Object.keys(attribs)) {
        if (DANGEROUS_EVENT_ATTR.test(name)) {
          delete attribs[name];
          continue;
        }
        if (DANGEROUS_URL_ATTR.has(name.toLowerCase()) && DANGEROUS_URL_PROTOCOL.test(attribs[name] ?? "")) {
          delete attribs[name];
        }
      }
    },
  });
}

/**
 * extractCustomHeadElements 用于客户端运行时动态插入 head 片段（例如 theme 切换后重放）。
 * 过滤规则与 renderCustomHeadHtml 保持一致。
 */
export function extractCustomHeadElements(html: string): HTMLElement[] {
  if (typeof document === "undefined") {
    return [];
  }

  const normalizedHtml = normalizeCustomHtml(html);
  if (!normalizedHtml) {
    return [];
  }

  const template = document.createElement("template");
  template.innerHTML = normalizedHtml;

  return Array.from(template.content.childNodes).filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && HEAD_ALLOWED_TAGS.has(node.tagName.toLowerCase()),
  );
}
